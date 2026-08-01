import { createHash } from 'node:crypto'
import { config } from '../config.js'
import { errors } from '../lib/errors.js'
import { searchDatastore } from '../lib/govApiClient.js'
import { mergeApprovedSizes, toApprovedSizes } from '../lib/tireSize.js'
import { buildTirePressure } from '../lib/tirePressure.js'
import { fallbackFitmentForVehicle, shouldFallBack } from './fallbackService.js'

/**
 * Ministry of Transport fitment lookup.
 *
 * data.gov.il has no "tire sizes by plate" endpoint, so this composes one out
 * of two datasets:
 *
 *   1. רכב פרטי ומסחרי — one row per registered vehicle, keyed by plate. Yields
 *      the manufacturer and model codes, and sometimes the tire sizes directly.
 *   2. דגמי רכב — one row per model/trim/year, which always carries the sizes.
 *
 * Step 2 is a fallback, not a fixed second leg: when the vehicle row already
 * has both tire fields populated we return on one network call instead of two.
 * That is the difference between a fast lookup and a slow one for a large share
 * of traffic, and the government API is the entire latency budget here.
 *
 * The model dataset also carries attributes the vehicle row does not — right
 * now the TPMS flag. Those are fetched as *enrichment*: same query, tight
 * budget, failures swallowed, and the rows are kept out of the size
 * calculation. See `getVehicleTireSpecs`.
 */

/* ------------------------------- Field names ------------------------------ */

/**
 * Registry column names, transliterated Hebrew, quoted verbatim from the
 * datasets. Centralized because they are the seam most likely to drift when a
 * dataset is republished.
 */
const FIELDS = {
  plate: 'mispar_rechev',
  manufacturerCode: 'tozeret_cd',
  manufacturerName: 'tozeret_nm',
  modelCode: 'degem_cd',
  modelName: 'degem_nm',
  commercialName: 'kinuy_mishari',
  trim: 'ramat_gimur',
  year: 'shnat_yitzur',
  frontTire: 'zmig_kidmi',
  rearTire: 'zmig_ahori',
  totalWeight: 'mishkal_kolel',
  bodyType: 'sug_rechev_nm',
}

/* --------------------------------- Privacy -------------------------------- */

/**
 * A license plate identifies a person's vehicle and is personal data under
 * Israeli privacy law, so it never reaches a log line. The truncated hash is
 * stable enough to correlate requests for one vehicle while being useless for
 * identifying it.
 */
export function plateFingerprint(plate) {
  return createHash('sha256').update(String(plate)).digest('hex').slice(0, 10)
}

/* ------------------------------- Normalizing ------------------------------ */

export function normalizePlate(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (!/^\d{5,8}$/.test(digits)) throw errors.invalidPlate()
  return digits
}

/** Registry numerics arrive as strings as often as numbers. */
function toInt(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function cleanText(value) {
  const text = String(value ?? '').trim()
  // "לא רלוונטי" and bare zeros are how the registry spells an empty cell.
  if (!text || text === '0' || text === 'לא רלוונטי') return ''
  return text.replace(/\s+/g, ' ')
}

/**
 * Country-of-origin suffix on a manufacturer name.
 *
 * The registry writes the importing country after the make — "טויוטה יפן",
 * "שברולט ד.קוריא" (ד for דרום/South). Correct on a government record, noise on
 * a storefront. Matched on stems with an optional single-letter abbreviation
 * prefix, because the spellings are inconsistent and truncated: "קוריא",
 * "קוריאה" and "ד.קוריא" all appear.
 */
const COUNTRY_SUFFIX =
  /\s+(?:[א-ת]\.\s*)?(?:יפן|יפאן|קוריא|גרמני|צרפת|ארה"ב|ארה״ב|ארהב|ספרד|צ'כי|צכי|בריטני|אנגלי|איטלי|שבדי|סין|הודו|טורקי|רומני|סלובקי|פולין|מקסיק|ברזיל|בלגי|הולנד|אוסטרי|רוסי|תאילנד|אינדונזי|ויאטנם|טאיוואן|צפון אמריק|דרום אפריק)[א-ת]*$/u

function cleanManufacturer(value) {
  const text = cleanText(value)
  if (!text) return ''

  const stripped = text.replace(COUNTRY_SUFFIX, '').trim()
  // Never strip the whole value: some records are only a country name.
  return stripped || text
}

/**
 * Rough vehicle class, used by the UI for the alignment upsell rather than for
 * anything safety-critical, so a heuristic on weight and body type is enough.
 */
function classifyVehicle({ bodyType, totalWeightKg }) {
  const body = bodyType.toLowerCase()
  if (body.includes('מסחרי') || body.includes('משא')) return 'commercial'
  if (body.includes('שטח') || body.includes('פנאי')) return 'suv'
  if (totalWeightKg && totalWeightKg > 2600) return 'suv'
  return 'passenger'
}

/* ------------------------------ Step 1: plate ----------------------------- */

/**
 * Locate the vehicle row for a plate.
 *
 * Falls through the configured secondary datasets on a miss: a plate absent
 * from the private-vehicle registry may be a motorcycle, a heavy truck, or a
 * recently deregistered vehicle, each of which is published separately. Only
 * after all of them miss is the plate genuinely unknown.
 */
async function fetchVehicleRecord(plate, { signal, log } = {}) {
  const resourceIds = [config.gov.resources.vehicles, ...config.gov.fallbackVehicleResources]

  for (const resourceId of resourceIds) {
    const records = await searchDatastore({
      resourceId,
      filters: { [FIELDS.plate]: Number(plate) },
      limit: 1,
      signal,
      log,
    })

    if (records.length > 0) return records[0]
  }

  throw errors.plateNotFound()
}

/* ------------------------------ Step 2: model ----------------------------- */

/**
 * Look up the model rows for a vehicle.
 *
 * Filters on manufacturer AND model code together. `degem_cd` is unique only
 * within a manufacturer, so filtering on it alone returns a different
 * manufacturer's model and produces confidently wrong tire sizes — the worst
 * failure mode available here, because nothing about it looks like an error.
 *
 * Returns every matching row. One model code spans trims and production years
 * with different fitments, and the caller merges them.
 *
 * Cached by model, not by plate. Two customers with the same car share the
 * entry, which is what makes the enrichment call affordable: the fleet is
 * concentrated in few models, so after warmup most lookups pay nothing for it.
 */
async function fetchModelRecords(
  { manufacturerCode, modelCode, year },
  { signal, log, timeoutMs, maxRetries } = {},
) {
  if (manufacturerCode == null || modelCode == null) return []

  const cacheKey = `${manufacturerCode}:${modelCode}`
  let records = modelCache.get(cacheKey)

  if (!records) {
    records = await searchDatastore({
      resourceId: config.gov.resources.models,
      filters: {
        [FIELDS.manufacturerCode]: manufacturerCode,
        [FIELDS.modelCode]: modelCode,
      },
      limit: 50,
      signal,
      timeoutMs,
      maxRetries,
      log,
    })
    // Cached unfiltered so every production year of the model shares one entry.
    modelCache.set(cacheKey, records, config.cache.ttlDays * 24 * 60 * 60 * 1000)
  }

  if (records.length === 0) return []

  // Prefer the exact production year when the dataset covers it; otherwise keep
  // every row, since all of them are legal fitments for the model family.
  const sameYear = records.filter((record) => toInt(record[FIELDS.year]) === year)
  return sameYear.length > 0 ? sameYear : records
}

/* ------------------------------- Aggregation ------------------------------ */

/**
 * Compose the two datasets into the response the client consumes.
 *
 * Exported for tests, which drive it with fixture records rather than the live
 * registry.
 */
export function buildFitment({
  plate,
  vehicleRecord,
  modelRecords = [],
  /**
   * Model rows fetched purely to read attributes off, when the sizes were
   * already answered by the vehicle row.
   *
   * Kept as a separate argument rather than merged into `modelRecords` so that
   * turning enrichment on can never change which tire sizes we call legal. A
   * badge is not worth a new way to produce a wrong fitment.
   */
  enrichmentRecords = [],
  fallbackReason,
}) {
  const year = toInt(vehicleRecord[FIELDS.year])
  const totalWeightKg = toInt(vehicleRecord[FIELDS.totalWeight])

  const make =
    cleanManufacturer(vehicleRecord[FIELDS.manufacturerName]) ||
    cleanText(modelRecords[0]?.[FIELDS.manufacturerName]) ||
    'לא ידוע'

  // `kinuy_mishari` is the name on the tailgate ("COROLLA"); `degem_nm` is the
  // internal code ("ZRE172L-..."). Prefer the one a customer recognizes.
  const model =
    cleanText(vehicleRecord[FIELDS.commercialName]) ||
    cleanText(vehicleRecord[FIELDS.modelName]) ||
    'לא ידוע'

  const sizesFromVehicle = toApprovedSizes({
    front: vehicleRecord[FIELDS.frontTire],
    rear: vehicleRecord[FIELDS.rearTire],
  })

  const sizesFromModels = modelRecords.map((record) =>
    toApprovedSizes({
      front: record[FIELDS.frontTire],
      rear: record[FIELDS.rearTire],
      // Only the row matching this vehicle's own year is its factory fitment;
      // the others are legal alternatives.
      isOem: toInt(record[FIELDS.year]) === year,
    }),
  )

  const approvedSizes = mergeApprovedSizes([sizesFromVehicle, ...sizesFromModels])

  const vehicle = {
    make,
    model,
    trim: cleanText(vehicleRecord[FIELDS.trim]),
    year,
    vehicleClass: classifyVehicle({
      bodyType: cleanText(vehicleRecord[FIELDS.bodyType]),
      totalWeightKg,
    }),
    ...(totalWeightKg ? { curbWeightKg: totalWeightKg } : {}),
  }

  /**
   * Pressure reads from whichever model rows we happen to hold. The registry
   * publishes no recommended pressure at all, so this is a TPMS fact plus a
   * class-typical range — see `lib/tirePressure.js`.
   */
  const pressureRecords = modelRecords.length > 0 ? modelRecords : enrichmentRecords
  const tirePressure = buildTirePressure({
    vehicleClass: vehicle.vehicleClass,
    modelRecords: pressureRecords,
  })

  if (approvedSizes.length > 0) {
    return {
      licensePlate: plate,
      vehicle,
      approvedSizes,
      tirePressure,
      source: 'ministry_of_transport',
      verified: true,
      fetchedAt: new Date().toISOString(),
    }
  }

  /**
   * The registry could not supply sizes — either it refused the model query or
   * the model row has empty tire cells. We do know the vehicle, so the
   * reference table can answer, clearly labelled as unverified.
   */
  const fallback = fallbackFitmentForVehicle(vehicle, {
    reason: fallbackReason ?? 'registry_missing_sizes',
  })
  if (!fallback) throw errors.tireSpecsUnavailable()

  const fallbackClass = fallback.vehicleClass ?? vehicle.vehicleClass

  return {
    licensePlate: plate,
    vehicle: {
      ...vehicle,
      vehicleClass: fallbackClass,
    },
    approvedSizes: fallback.approvedSizes,
    /**
     * Rebuilt rather than reused: the reference table may classify the vehicle
     * differently from the registry heuristic, and the guidance range is keyed
     * on that class. The TPMS flag itself stays valid either way — it came from
     * the registry and describes the vehicle, not the sizes we fell back on.
     */
    tirePressure: buildTirePressure({
      vehicleClass: fallbackClass,
      modelRecords: pressureRecords,
    }),
    source: fallback.source,
    verified: false,
    fallbackReason: fallback.reason,
    matchedModel: fallback.matchedModel,
    fetchedAt: new Date().toISOString(),
  }
}

/* --------------------------------- Caching -------------------------------- */

/**
 * Bounded in-process cache in front of the persistent one.
 *
 * Insertion-ordered eviction rather than true LRU: this sits behind a Mongo
 * cache, so an eviction costs a local query, not a government round trip, and
 * the extra bookkeeping of an LRU is not worth it.
 */
class MemoryCache {
  #entries = new Map()
  #maxEntries

  constructor(maxEntries) {
    this.#maxEntries = maxEntries
  }

  get(key) {
    const entry = this.#entries.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      this.#entries.delete(key)
      return null
    }
    return entry.value
  }

  set(key, value, ttlMs) {
    if (this.#entries.size >= this.#maxEntries) {
      this.#entries.delete(this.#entries.keys().next().value)
    }
    this.#entries.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  clear() {
    this.#entries.clear()
  }
}

/** Fitment results, keyed by plate. */
const memoryCache = new MemoryCache(config.cache.memoryEntries)

/**
 * Model dataset rows, keyed by manufacturer + model code.
 *
 * Separate from the plate cache and much denser in value: one entry serves
 * every customer driving that model, which is what keeps the enrichment call
 * off the critical path in practice.
 */
const modelCache = new MemoryCache(config.gov.enrichCacheEntries)

/**
 * Requests for the same plate that arrive while a lookup is in flight.
 *
 * One customer double-clicking the search button should not produce two
 * government round trips, and neither should a page that mounts the selector
 * twice.
 */
const inFlight = new Map()

/* ------------------------------- Entry point ------------------------------ */

/**
 * Fitment data for a license plate.
 *
 * @param {string} rawPlate As typed by the customer; separators are tolerated.
 * @param {object} [options]
 * @param {{ read: (plate: string) => Promise<object|null>, write: (doc: object) => Promise<void> }} [options.store]
 *   Persistent cache, normally backed by the `VehicleTireSpecs` collection.
 *   Injected rather than imported so this module stays free of a database
 *   dependency and testable without one.
 * @param {AbortSignal} [options.signal]
 * @param {(event: object) => void} [options.log]
 * @returns {Promise<object>} Fitment payload, with a `cached` flag.
 */
export async function getVehicleTireSpecs(rawPlate, { store, signal, log = () => {} } = {}) {
  const plate = normalizePlate(rawPlate)
  const fingerprint = plateFingerprint(plate)
  const ttlMs = config.cache.ttlDays * 24 * 60 * 60 * 1000

  const cached = memoryCache.get(plate)
  if (cached) {
    log({ event: 'fitment.hit', layer: 'memory', plate: fingerprint })
    return { ...cached, cached: true }
  }

  if (inFlight.has(plate)) {
    log({ event: 'fitment.coalesced', plate: fingerprint })
    return inFlight.get(plate)
  }

  const lookup = (async () => {
    if (store) {
      const stored = await store.read(plate)
      if (stored) {
        memoryCache.set(plate, stored, ttlMs)
        log({ event: 'fitment.hit', layer: 'store', plate: fingerprint })
        return { ...stored, cached: true }
      }
    }

    const startedAt = Date.now()

    /**
     * Step 1 has no fallback. It is the step that says which car this is, and
     * without it any tire size we returned would belong to somebody else's
     * vehicle. A block here has to surface as an error.
     */
    const vehicleRecord = await fetchVehicleRecord(plate, { signal, log })

    // Step 2 only when step 1 came up short — see the module note on latency.
    const vehicleHasSizes =
      toApprovedSizes({
        front: vehicleRecord[FIELDS.frontTire],
        rear: vehicleRecord[FIELDS.rearTire],
      }).length > 0

    const modelKey = {
      manufacturerCode: toInt(vehicleRecord[FIELDS.manufacturerCode]),
      modelCode: toInt(vehicleRecord[FIELDS.modelCode]),
      year: toInt(vehicleRecord[FIELDS.year]),
    }

    let modelRecords = []
    let enrichmentRecords = []
    let registryFailure = null

    if (!vehicleHasSizes) {
      try {
        modelRecords = await fetchModelRecords(modelKey, { signal, log })
      } catch (error) {
        // Step 2 is the one the fallback can cover: we already know the vehicle,
        // so a reference lookup by model is an honest substitute for the sizes.
        if (!shouldFallBack(error)) throw error
        registryFailure = error
        log({ event: 'fitment.step2_failed', plate: fingerprint, code: error.code })
      }
    } else if (config.gov.enrichModelData) {
      /**
       * Sizes are already answered, so this call buys attributes only. It runs
       * on a short budget with no retries and every failure swallowed: the
       * customer asked which tires fit their car, and they get that answer
       * whether or not we can also tell them the car has a TPMS.
       */
      try {
        enrichmentRecords = await fetchModelRecords(modelKey, {
          signal,
          log,
          timeoutMs: config.gov.enrichTimeoutMs,
          maxRetries: 0,
        })
      } catch (error) {
        if (signal?.aborted) throw error
        log({ event: 'fitment.enrich_failed', plate: fingerprint, code: error.code })
      }
    }

    const fitment = buildFitment({
      plate,
      vehicleRecord,
      modelRecords,
      enrichmentRecords,
      fallbackReason: registryFailure?.code ?? 'registry_missing_sizes',
    })

    log({
      event: 'fitment.resolved',
      plate: fingerprint,
      steps: vehicleHasSizes ? 1 : 2,
      source: fitment.source,
      verified: fitment.verified,
      sizes: fitment.approvedSizes.length,
      tpms: fitment.tirePressure?.tpms?.equipped ?? null,
      durationMs: Date.now() - startedAt,
    })

    memoryCache.set(plate, fitment, ttlMs)
    if (store) {
      // A cache write must never fail the request that populated it.
      await store
        .write({ ...fitment, ttlExpiresAt: new Date(Date.now() + ttlMs) })
        .catch((error) => log({ event: 'fitment.store_failed', plate: fingerprint, error: error.message }))
    }

    return { ...fitment, cached: false }
  })()

  inFlight.set(plate, lookup)

  try {
    return await lookup
  } finally {
    inFlight.delete(plate)
  }
}

/** Test seam. */
export function __clearCaches() {
  memoryCache.clear()
  modelCache.clear()
  inFlight.clear()
}
