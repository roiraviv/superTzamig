import { ApiError, toApiError } from './ApiError'

/**
 * Single transport used by every call in `services/api.js`.
 *
 * Security posture (mirrors the Node.js/Express side):
 *  - Sessions ride in an httpOnly + Secure + SameSite=Strict cookie. No token is
 *    ever written to localStorage, so XSS cannot exfiltrate a session.
 *  - Mutations carry the double-submit CSRF token from the XSRF-TOKEN cookie.
 *  - Every request is time-boxed; a hung socket resolves as a network error
 *    instead of a spinner that never stops.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
const DEFAULT_TIMEOUT_MS = 15000
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Loaded on demand so the mock backend lands in its own chunk and never ships
 * inside the production bundle when `VITE_USE_MOCK_API=false`.
 */
let mockTransportPromise = null
function loadMockTransport() {
  mockTransportPromise ??= import('../mock/mockTransport').then((module) => module.mockTransport)
  return mockTransportPromise
}

function readCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function buildUrl(path, query) {
  const entries = Object.entries(query ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  )
  if (entries.length === 0) return `${BASE_URL}${path}`

  const search = new URLSearchParams()
  for (const [key, value] of entries) {
    if (Array.isArray(value)) value.forEach((item) => search.append(key, String(item)))
    else search.append(key, String(value))
  }
  return `${BASE_URL}${path}?${search.toString()}`
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * @param {string} method
 * @param {string} path   Path relative to the API root, e.g. `/tires`.
 * @param {{ query?: object, body?: object, signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<any>} Parsed `data` payload.
 */
export async function request(method, path, options = {}) {
  const { query, body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options
  const upperMethod = method.toUpperCase()

  if (USE_MOCK) {
    const mockTransport = await loadMockTransport()
    return mockTransport({ method: upperMethod, path, query, body, signal })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort, { once: true })

  try {
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    if (UNSAFE_METHODS.has(upperMethod)) {
      const csrfToken = readCookie('XSRF-TOKEN')
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken
    }

    const response = await fetch(buildUrl(path, query), {
      method: upperMethod,
      headers,
      credentials: 'include',
      // Never let the browser reuse a stale authenticated response.
      cache: 'no-store',
      redirect: 'error',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })

    const payload = await parseBody(response)

    if (!response.ok) {
      throw new ApiError(payload?.message ?? response.statusText, {
        status: response.status,
        code: payload?.code ?? 'http_error',
        fieldErrors: payload?.fieldErrors ?? null,
      })
    }

    // The backend envelopes successful responses as `{ data, meta }`.
    return payload?.data ?? payload
  } catch (error) {
    throw toApiError(error)
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

export const http = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  del: (path, options) => request('DELETE', path, options),
}
