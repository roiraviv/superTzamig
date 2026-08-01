import { Router } from 'express'
import { ServiceError } from '../lib/errors.js'
import { getVehicleTireSpecs, plateFingerprint } from '../services/vehicleService.js'
import { vehicleSpecsStore } from '../services/vehicleSpecsStore.js'

/**
 * Public fitment endpoint.
 *
 * The browser never talks to data.gov.il directly. Routing through here is not
 * only about CORS: it is where the rate limit, the cache and the log redaction
 * live, and it keeps the registry's shape and quirks from becoming part of our
 * public contract.
 */
export const vehicleRouter = Router()

/**
 * Per-IP throttle.
 *
 * The plate space is small enough to enumerate, and a scraper walking it would
 * both exhaust our government quota and turn this endpoint into a vehicle
 * lookup service for whoever is asking. Swap for a Redis-backed limiter behind
 * more than one process.
 */
const RATE_LIMIT = { windowMs: 60_000, max: 20 }
const hits = new Map()

function rateLimit(req, res, next) {
  /**
   * Requires `trust proxy` to be set on the app. Behind a load balancer without
   * it, every request shares the proxy's address and the first visitor to hit
   * the limit locks out everyone else.
   */
  const key = req.ip
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs })
    return next()
  }

  entry.count += 1
  if (entry.count > RATE_LIMIT.max) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000))
    return res.status(429).json({
      error: { message: 'יותר מדי חיפושים. נסו שוב בעוד דקה.', code: 'rate_limited' },
    })
  }

  return next()
}

// Unbounded growth otherwise: one entry per distinct IP, forever.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key)
  }
}, RATE_LIMIT.windowMs).unref()

vehicleRouter.get('/:plate/tire-specs', rateLimit, async (req, res, next) => {
  /**
   * Ties the outbound government call to the client connection: if the visitor
   * navigates away mid-search, the upstream request is cancelled rather than
   * left running against a socket nobody is reading.
   */
  const controller = new AbortController()
  req.on('close', () => controller.abort())

  try {
    const specs = await getVehicleTireSpecs(req.params.plate, {
      store: vehicleSpecsStore,
      signal: controller.signal,
      log: (event) => req.log?.(event),
    })

    // Private: the response is keyed to one person's vehicle, so it may sit in
    // that browser's cache but never in a shared proxy.
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.json(specs)
  } catch (error) {
    next(error)
  }
})

/**
 * Error translator for this router.
 *
 * `ServiceError` instances are already customer-safe and carry their status.
 * Anything else is a bug, and its message must not reach the client — it gets
 * logged with a redacted plate and reported as a generic 500.
 */
export function vehicleErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)

  if (error instanceof ServiceError) {
    if (error.status >= 500) {
      req.log?.({
        event: 'fitment.failed',
        level: 'error',
        code: error.code,
        plate: req.params?.plate ? plateFingerprint(req.params.plate) : undefined,
        cause: error.cause?.message,
      })
    }
    return res.status(error.status).json(error.toResponse())
  }

  req.log?.({
    event: 'fitment.crashed',
    level: 'error',
    message: error.message,
    stack: error.stack,
  })
  return res.status(500).json({
    error: { message: 'אירעה תקלה בשרת. הצוות שלנו כבר בדרך לתקן.', code: 'internal_error' },
  })
}
