import { parseTireSizes } from '../lib/tireSize.js'
import { findReferenceEntry, referenceSizes } from '../data/mockVehicleData.js'

/**
 * Fallback fitment, for when data.gov.il will not answer.
 *
 * Scope is deliberately narrow. This can substitute for step 2 of the
 * aggregation — "which tires does this model take" — and never for step 1.
 * Step 1 is what turns a plate into a vehicle, and if it failed we do not know
 * whose car this is. Guessing there would hand a customer tires for a different
 * vehicle, which is a safety failure rather than a data one: fitment determines
 * load rating, rolling diameter and therefore ABS and speedometer calibration.
 *
 * Everything returned from here is marked unverified so the UI can attribute it
 * honestly instead of presenting a guess as a registry fact.
 */

/**
 * Approved sizes for an already-identified vehicle.
 *
 * @param {{ make?: string, model?: string, year?: number }} vehicle
 * @param {{ reason: string }} context Why the registry could not answer.
 * @returns {{ approvedSizes: Array<object>, source: string, verified: false, reason: string, matchedModel: string }|null}
 */
export function fallbackFitmentForVehicle(vehicle, { reason }) {
  const entry = findReferenceEntry(vehicle)
  if (!entry) return null

  // Run the reference strings through the same parser as registry data so the
  // client receives one shape regardless of where the numbers came from.
  const approvedSizes = referenceSizes(entry)
    .map(({ position, size, isOem }) => {
      const parsed = parseTireSizes(size)[0]
      return parsed ? { ...parsed, position, isOem } : null
    })
    .filter(Boolean)

  if (approvedSizes.length === 0) return null

  return {
    approvedSizes,
    source: 'fallback_reference',
    /** The single flag the UI keys its disclaimer off. */
    verified: false,
    reason,
    matchedModel: `${entry.make} ${entry.model}`,
    ...(entry.vehicleClass ? { vehicleClass: entry.vehicleClass } : {}),
  }
}

/**
 * Whether a registry failure is one the fallback should cover.
 *
 * A block, a throttle or an outage means the data exists and we cannot reach
 * it, so serving a labelled reference answer beats serving nothing. A plate
 * that is genuinely absent from the registry is a different thing entirely and
 * must surface as such.
 */
export function shouldFallBack(error) {
  return ['registry_blocked', 'registry_rate_limited', 'registry_unavailable'].includes(error?.code)
}
