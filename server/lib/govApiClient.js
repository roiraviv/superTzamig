import { config } from '../config.js'
import { errors } from './errors.js'

/**
 * Client for the data.gov.il CKAN datastore.
 *
 * Wraps a third-party service we neither control nor pay for: it is slow,
 * rate-limited, and goes down without notice. Everything here exists to keep
 * those properties from becoming our properties — a bounded timeout, retries
 * only where a retry can help, and a breaker so an outage costs one failed
 * request rather than one per visitor.
 */

/**
 * Retrying a 4xx just burns the customer's patience — the answer won't change.
 *
 * 429 is the exception: it is explicitly "try later". 403 is not retryable and
 * must never be retried, because hammering a WAF is how a soft block becomes a
 * permanent one.
 */
function isRetryable(status) {
  return status === 0 || status === 429 || status >= 500
}

/**
 * Map an upstream status onto our taxonomy.
 *
 * The three failure modes need different handling downstream — the fallback
 * layer covers all of them, but only the rate limit and the outage are worth
 * retrying, and only the block needs a human.
 */
function errorForStatus(status, cause) {
  if (status === 403 || status === 401) return errors.registryBlocked(cause)
  if (status === 429) return errors.registryRateLimited(cause)
  return errors.registryUnavailable(cause)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Fail-fast breaker.
 *
 * While open, calls reject immediately instead of each one waiting out the full
 * timeout. Without this, a registry outage turns every tire search into a
 * multi-second hang and ties up a connection for the duration.
 */
class CircuitBreaker {
  #failures = 0
  #openedAt = 0

  get isOpen() {
    if (this.#failures < config.gov.circuitThreshold) return false
    if (Date.now() - this.#openedAt >= config.gov.circuitResetMs) {
      // Half-open: let the next call through to probe for recovery.
      this.#failures = config.gov.circuitThreshold - 1
      return false
    }
    return true
  }

  recordSuccess() {
    this.#failures = 0
  }

  recordFailure() {
    this.#failures += 1
    if (this.#failures >= config.gov.circuitThreshold) this.#openedAt = Date.now()
  }
}

const breaker = new CircuitBreaker()

/** Exposed for tests, which need a clean breaker between cases. */
export function __resetBreaker() {
  breaker.recordSuccess()
}

/**
 * One `datastore_search` call.
 *
 * @param {object} params
 * @param {string} params.resourceId CKAN resource id.
 * @param {object} [params.filters] Exact-match field filters.
 * @param {number} [params.limit]
 * @param {AbortSignal} [params.signal] Caller cancellation, e.g. client hang-up.
 * @returns {Promise<Array<object>>} Matching records, possibly empty.
 */
export async function searchDatastore({ resourceId, filters = {}, limit = 10, signal, log = () => {} }) {
  if (breaker.isOpen) {
    log({ event: 'gov.short_circuited', resourceId })
    throw errors.registryUnavailable(new Error('circuit_open'))
  }

  const url = new URL(`${config.gov.baseUrl}/datastore_search`)
  url.searchParams.set('resource_id', resourceId)
  url.searchParams.set('limit', String(limit))
  if (Object.keys(filters).length > 0) {
    url.searchParams.set('filters', JSON.stringify(filters))
  }

  let lastError = null
  let lastStatus = 0

  for (let attempt = 0; attempt <= config.gov.maxRetries; attempt += 1) {
    const startedAt = Date.now()
    /**
     * Two independent reasons to abort: our own timeout, and the caller giving
     * up. `AbortSignal.any` collapses them so a client disconnect stops the
     * outbound call instead of leaving it running against a dead response.
     */
    const timeout = AbortSignal.timeout(config.gov.timeoutMs)
    const composite = signal ? AbortSignal.any([timeout, signal]) : timeout

    try {
      const response = await fetch(url, {
        signal: composite,
        headers: { Accept: 'application/json' },
      })

      lastStatus = response.status
      log({
        event: 'gov.response',
        resourceId,
        attempt,
        status: response.status,
        durationMs: Date.now() - startedAt,
      })

      if (!response.ok) {
        if (!isRetryable(response.status)) {
          breaker.recordSuccess() // The service answered; it just said no.
          throw errorForStatus(
            response.status,
            new Error(`datastore_search responded ${response.status}`),
          )
        }
        lastError = new Error(`datastore_search responded ${response.status}`)
      } else {
        const payload = await response.json()

        // CKAN reports failures in the body with HTTP 200, so `success` is the
        // only reliable signal that the query actually ran.
        if (payload?.success !== true) {
          breaker.recordSuccess()
          log({ event: 'gov.body_failure', resourceId, error: payload?.error?.message })
          throw errors.registryUnavailable(
            new Error(payload?.error?.message ?? 'datastore_search returned success: false'),
          )
        }

        const records = payload.result?.records ?? []
        breaker.recordSuccess()
        log({ event: 'gov.records', resourceId, count: records.length })
        return records
      }
    } catch (error) {
      // A caller-initiated abort is not a registry fault and must not retry.
      if (signal?.aborted) throw error
      if (error?.expected) throw error
      log({ event: 'gov.attempt_failed', resourceId, attempt, error: error.message })
      lastError = error
    }

    if (attempt < config.gov.maxRetries) {
      // Exponential backoff with jitter, so a fleet of dynos recovering from an
      // outage does not resynchronize into a thundering herd.
      const backoff = 200 * 2 ** attempt
      await sleep(backoff + Math.random() * 100)
    }
  }

  breaker.recordFailure()
  log({ event: 'gov.exhausted', resourceId, lastStatus, error: lastError?.message })
  throw errorForStatus(lastStatus, lastError)
}

/**
 * Boot-time check that the configured resource ids still exist and expose the
 * fields we read.
 *
 * CKAN resource ids change when a dataset is republished. Without this, a
 * stale id surfaces as "vehicle not found" for every customer — a silent,
 * total outage of the conversion flow that looks like a data problem.
 *
 * @returns {Promise<Array<{resource: string, ok: boolean, missingFields?: string[], error?: string}>>}
 */
export async function verifyResources(expectations) {
  const results = []

  for (const [name, { resourceId, requiredFields }] of Object.entries(expectations)) {
    try {
      const records = await searchDatastore({ resourceId, limit: 1 })
      const sample = records[0] ?? {}
      const missingFields = requiredFields.filter((field) => !(field in sample))
      results.push({
        resource: name,
        resourceId,
        ok: records.length > 0 && missingFields.length === 0,
        ...(missingFields.length > 0
          ? {
              missingFields,
              // The actual column list is what tells an operator whether the id
              // points at the wrong dataset or the columns were renamed.
              availableFields: Object.keys(sample),
            }
          : {}),
      })
    } catch (error) {
      results.push({ resource: name, ok: false, error: error.message })
    }
  }

  return results
}
