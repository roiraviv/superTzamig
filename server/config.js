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

export const config = {
  port: num(process.env.PORT, 4000),
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
