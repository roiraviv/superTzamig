/**
 * Server configuration.
 *
 * Everything that differs between environments — and every value that lives
 * outside our control, like a government dataset id — is read from the
 * environment with a documented default, so a change never requires a redeploy
 * of new code.
 */

function num(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function bool(value, fallback) {
  if (value === undefined) return fallback
  return value !== 'false' && value !== '0'
}

export const config = {
  /** Render (and every other PaaS) injects the port it wants us on. */
  port: num(process.env.PORT, 4000),

  /**
   * Behind Render's load balancer every request arrives from the proxy, so
   * `req.ip` is the proxy's address unless Express is told to read
   * `X-Forwarded-For`. Without this the per-IP rate limit throttles the whole
   * internet as if it were one visitor — the first real request would lock
   * everyone out for a minute.
   *
   * Exactly one hop, not `true`: trusting the entire chain lets a client forge
   * `X-Forwarded-For` and reset its own limit at will.
   */
  trustProxy: num(process.env.TRUST_PROXY, 1),

  /**
   * Serve the Vite build from this process.
   *
   * Vite's dev proxy does not exist in a production build, so a separately
   * hosted static site has no way to reach `/api`. Serving both from one origin
   * removes that problem and CORS along with it.
   */
  serveStatic: bool(process.env.SERVE_STATIC, true),
  staticDir: process.env.STATIC_DIR ?? 'dist',

  /**
   * Shared secret for `/api/diagnostics/registry`.
   *
   * The endpoint reports internal CKAN resource ids and dataset column names —
   * useful on a bad day, not something to publish. Unset means the endpoint is
   * disabled outright rather than open, so forgetting to configure it fails
   * closed.
   */
  diagnosticsToken: process.env.DIAGNOSTICS_TOKEN ?? '',

  /**
   * Persistent fitment cache.
   *
   * Off by default: `mongoose` is not a dependency of this service yet, so the
   * in-process cache is the only layer. Enabling this without installing it
   * would take the whole service down at boot, hence the explicit opt-in.
   */
  persistence: {
    enabled: bool(process.env.ENABLE_MONGO_CACHE, false),
  },
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/supertzamig',

  gov: {
    baseUrl: process.env.GOV_API_BASE_URL ?? 'https://data.gov.il/api/3/action',

    /**
     * CKAN resource ids for the Ministry of Transport datasets.
     *
     * These are NOT stable constants. data.gov.il mints a new resource id every
     * time a dataset is republished, which silently turns a working lookup into
     * a 404. They are configurable for that reason, and `verifyResources()`
     * checks them at boot so a stale id fails loudly on deploy instead of
     * quietly on a customer's first search.
     *
     * Verify against https://data.gov.il/dataset/private-and-commercial-vehicles
     * before going live.
     */
    resources: {
      /** רכב פרטי ומסחרי — one row per registered vehicle, keyed by plate. */
      vehicles: process.env.GOV_RESOURCE_VEHICLES ?? '053cea08-09bc-40ec-8f7a-156f0677aff3',
      /** דגמי רכב — one row per model/trim/year, carries the tire sizes. */
      models: process.env.GOV_RESOURCE_MODELS ?? '142afde2-6228-49f9-8a29-9b6c3a0cbe40',
    },

    /**
     * Additional plate-keyed datasets, tried in order when the primary misses.
     *
     * A plate absent from the private-vehicle registry is not necessarily a bad
     * plate: motorcycles, heavy trucks and recently deregistered vehicles each
     * live in their own dataset. Configure as a comma-separated list of ids.
     */
    fallbackVehicleResources: (process.env.GOV_RESOURCE_VEHICLES_FALLBACK ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),

    /**
     * data.gov.il is slow and occasionally unresponsive. The timeout is well
     * under the frontend's patience threshold so we can fail over to a stale
     * cache entry rather than leaving the user watching a spinner.
     */
    timeoutMs: num(process.env.GOV_API_TIMEOUT_MS, 6000),
    maxRetries: num(process.env.GOV_API_MAX_RETRIES, 2),

    /**
     * Model-dataset enrichment (currently the TPMS flag).
     *
     * The vehicle row usually carries the tire sizes, so the fitment lookup can
     * finish in one call. Enrichment lives only in the model dataset, so
     * fetching it costs a second call on the otherwise-fast path — but only
     * once per model, since the result is cached by model rather than by plate
     * and the Israeli fleet is concentrated in relatively few models.
     *
     * Budgeted tightly and allowed to fail: it is a nice-to-have badge, and it
     * must never delay or break a lookup that can already answer the question
     * the customer actually asked.
     */
    enrichModelData: process.env.GOV_ENRICH_MODEL_DATA !== 'false',
    /**
     * Deliberately tight. Observed successful model queries return in ~400ms,
     * so this clears the normal case with room to spare while capping what a
     * hung enrichment can add to a lookup that is already answerable. A badge
     * is not worth another second of the customer watching a spinner.
     */
    enrichTimeoutMs: num(process.env.GOV_ENRICH_TIMEOUT_MS, 1500),
    /** Distinct models held in the shared enrichment cache. */
    enrichCacheEntries: num(process.env.GOV_ENRICH_CACHE_ENTRIES, 1000),
    /** Consecutive failures before the breaker opens. */
    circuitThreshold: num(process.env.GOV_API_CIRCUIT_THRESHOLD, 5),
    circuitResetMs: num(process.env.GOV_API_CIRCUIT_RESET_MS, 30_000),
  },

  cache: {
    /**
     * How long a fitment result stays authoritative.
     *
     * Registry data changes only when a vehicle is modified or re-registered,
     * so 30 days is generous without being wrong. This doubles as the privacy
     * retention window: the document is a plate-keyed record of a person's
     * vehicle, and MongoDB drops it on expiry via the TTL index.
     */
    ttlDays: num(process.env.VEHICLE_CACHE_TTL_DAYS, 30),
    /** In-process layer in front of Mongo, sized for a single web dyno. */
    memoryEntries: num(process.env.VEHICLE_CACHE_MEMORY_ENTRIES, 500),
  },
}
