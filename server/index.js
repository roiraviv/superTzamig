import express from 'express'
import { config } from './config.js'
import { ServiceError } from './lib/errors.js'
import { verifyResources } from './lib/govApiClient.js'
import { getVehicleTireSpecs, plateFingerprint } from './services/vehicleService.js'

/**
 * Vehicle lookup API.
 *
 * Deliberately standalone and database-free. Its only job is to be the thing
 * that is allowed to talk to data.gov.il — the browser must never do that
 * itself, both because of CORS and because this is where the rate limit, the
 * cache and the log redaction live.
 *
 * Persistence is optional: without Mongo the service still runs on its
 * in-process cache, which is enough for development and degrades to more
 * upstream calls rather than to an outage.
 */
const app = express()
app.disable('x-powered-by')

/** Structured line-per-event logging, with plates already fingerprinted. */
function log(event) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mock: false })
})

/**
 * Confirms the configured CKAN resource ids still resolve and expose the fields
 * the aggregator reads. Hit this first when lookups start failing wholesale —
 * a republished dataset is the most likely cause.
 */
app.get('/api/diagnostics/registry', async (req, res) => {
  const results = await verifyResources({
    vehicles: {
      resourceId: config.gov.resources.vehicles,
      requiredFields: ['mispar_rechev', 'tozeret_cd', 'degem_cd', 'zmig_kidmi', 'zmig_ahori'],
    },
    models: {
      resourceId: config.gov.resources.models,
      requiredFields: ['tozeret_cd', 'degem_cd', 'zmig_kidmi'],
    },
  })

  log({ event: 'diagnostics.registry', results })
  res.status(results.every((entry) => entry.ok) ? 200 : 503).json({ results })
})

app.get('/api/vehicles/:plate/tire-specs', async (req, res, next) => {
  const controller = new AbortController()
  req.on('close', () => controller.abort())

  const startedAt = Date.now()

  try {
    const specs = await getVehicleTireSpecs(req.params.plate, {
      signal: controller.signal,
      log,
    })

    log({
      event: 'lookup.ok',
      plate: plateFingerprint(req.params.plate),
      source: specs.source,
      verified: specs.verified,
      cached: specs.cached,
      durationMs: Date.now() - startedAt,
    })

    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.json(specs)
  } catch (error) {
    next(error)
  }
})

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  if (error instanceof ServiceError) {
    log({
      event: 'lookup.failed',
      plate: req.params?.plate ? plateFingerprint(req.params.plate) : undefined,
      status: error.status,
      code: error.code,
      cause: error.cause?.message,
    })
    return res.status(error.status).json(error.toResponse())
  }

  log({ event: 'lookup.crashed', message: error.message, stack: error.stack })
  return res.status(500).json({
    error: { message: 'אירעה תקלה בשרת. הצוות שלנו כבר בדרך לתקן.', code: 'internal_error' },
  })
})

app.listen(config.port, () => {
  log({ event: 'server.started', port: config.port, govBaseUrl: config.gov.baseUrl })
})
