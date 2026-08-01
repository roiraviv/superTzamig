import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { config } from './config.js'
import { verifyResources } from './lib/govApiClient.js'
import { vehicleErrorHandler, vehicleRouter } from './routes/vehicleRoutes.js'

/**
 * Super Tzmieg web service.
 *
 * Runs as a single origin: it serves the built React app *and* the vehicle
 * lookup API. That is not just deployment convenience — Vite's dev proxy has no
 * production equivalent, so a separately hosted static build has no route to
 * `/api` at all, and splitting them would mean CORS plus a cross-origin cookie
 * for no benefit.
 *
 * The API surface is deliberately small. Everything the storefront needs beyond
 * vehicle lookup is still served by the in-browser mock, so this process is the
 * only component allowed to talk to data.gov.il, and the rate limit, the cache
 * and the log redaction all live behind that one door.
 */
const app = express()
app.disable('x-powered-by')

/** See `config.trustProxy` — the per-IP rate limit is wrong without this. */
app.set('trust proxy', config.trustProxy)

/** Structured line-per-event logging, with plates already fingerprinted. */
function log(event) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`)
}

app.use((req, res, next) => {
  req.log = log
  next()
})

/* --------------------------------- health --------------------------------- */

/**
 * Render's health check target. Deliberately dependency-free: it reports that
 * this process is up, not that data.gov.il is, so a registry outage cannot
 * convince the platform to restart a service that is working correctly.
 */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()) })
})

/**
 * Registry diagnostics. Hit this first when lookups start failing wholesale —
 * a republished CKAN resource id is the most likely cause.
 *
 * Gated: the response lists internal resource ids and dataset column names.
 * With no token configured the route is disabled rather than public, so a
 * missing environment variable fails closed.
 */
app.get('/api/diagnostics/registry', async (req, res) => {
  if (!config.diagnosticsToken) return res.status(404).json({ error: { code: 'not_found' } })

  const presented = req.get('X-Diagnostics-Token') ?? ''
  if (presented !== config.diagnosticsToken) {
    log({ event: 'diagnostics.rejected', ip: req.ip })
    return res.status(404).json({ error: { code: 'not_found' } })
  }

  const results = await verifyResources({
    vehicles: {
      resourceId: config.gov.resources.vehicles,
      requiredFields: ['mispar_rechev', 'tozeret_cd', 'degem_cd', 'zmig_kidmi', 'zmig_ahori'],
    },
    models: {
      resourceId: config.gov.resources.models,
      requiredFields: ['tozeret_cd', 'degem_cd', 'hayshaney_lahatz_avir_batzmigim_ind'],
    },
  })

  log({ event: 'diagnostics.registry', results })
  return res.status(results.every((entry) => entry.ok) ? 200 : 503).json({ results })
})

/* ---------------------------------- api ----------------------------------- */

app.use('/api/vehicles', vehicleRouter)
app.use(vehicleErrorHandler)

/**
 * Unknown `/api/*` paths answer as JSON.
 *
 * Without this they would fall through to the SPA handler below and return
 * `index.html` with status 200, so a typo in a client path would surface as
 * "unexpected token < in JSON" rather than as a 404.
 */
app.use('/api', (req, res) => {
  res.status(404).json({ error: { message: 'לא נמצא', code: 'not_found' } })
})

/* --------------------------------- static --------------------------------- */

if (config.serveStatic) {
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)), config.staticDir)
  const indexHtml = path.join(root, 'index.html')

  if (!existsSync(indexHtml)) {
    log({
      event: 'static.missing',
      root,
      message: 'No build found. Run `npm run build` before starting, or set SERVE_STATIC=false.',
    })
  } else {
    /**
     * Hashed asset filenames are immutable, so they can be cached hard.
     * `index.html` must not be: it is the document that points at the current
     * hashes, and a cached copy pins visitors to a deleted build.
     */
    app.use(
      express.static(root, {
        index: false,
        setHeaders: (res, filePath) => {
          res.setHeader(
            'Cache-Control',
            filePath.endsWith('index.html')
              ? 'no-cache'
              : 'public, max-age=31536000, immutable',
          )
        },
      }),
    )

    /**
     * SPA fallback. React Router owns the URL space, so any GET that is not a
     * real file is a client route and must receive the shell.
     *
     * Written as a bare `app.use` rather than a wildcard path because Express 5
     * dropped support for `app.get('*')`.
     */
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      res.setHeader('Cache-Control', 'no-cache')
      return res.sendFile(indexHtml)
    })
  }
}

/* --------------------------------- errors --------------------------------- */

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  log({ event: 'request.crashed', message: error.message, stack: error.stack })
  return res.status(500).json({
    error: { message: 'אירעה תקלה בשרת. הצוות שלנו כבר בדרך לתקן.', code: 'internal_error' },
  })
})

const server = app.listen(config.port, () => {
  log({
    event: 'server.started',
    port: config.port,
    serveStatic: config.serveStatic,
    persistentCache: config.persistence.enabled,
    diagnostics: config.diagnosticsToken ? 'enabled' : 'disabled',
  })
})

/**
 * Render sends SIGTERM before replacing an instance. Closing the listener lets
 * in-flight lookups finish instead of having their sockets cut mid-response.
 */
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    log({ event: 'server.stopping', signal })
    server.close(() => process.exit(0))
  })
}
