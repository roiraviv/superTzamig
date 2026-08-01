/**
 * Tire pressure information for a vehicle.
 *
 * WHAT THE REGISTRY DOES NOT HAVE
 * -------------------------------
 * The Ministry of Transport open data does not publish manufacturer
 * recommended pressure. Verified against the live API: the vehicle dataset
 * (`053cea08-…`) exposes 25 columns of which only `zmig_kidmi` / `zmig_ahori`
 * are tire-related, and both are *sizes*. The model dataset (`142afde2-…`)
 * exposes 129 columns; the only pressure-adjacent one is
 * `hayshaney_lahatz_avir_batzmigim_ind`, a 0/1 flag for whether the model ships
 * a TPMS. `mispar_kariot_avir` and `kariot_avir_source` are airbags, not air
 * pressure. A catalog search for "לחץ אוויר", "צמיג" and "tire" returns no
 * dataset at all. Recommended pressure lives on the door-jamb placard and is
 * proprietary manufacturer data.
 *
 * So this module returns exactly two things, and keeps them apart on purpose:
 *
 *   1. `tpms`      — a fact, sourced from the registry, per model.
 *   2. `guidance`  — a class-typical RANGE, explicitly not vehicle-specific,
 *                    for orientation only.
 *
 * The separation is the point. Publishing a specific pressure we cannot source
 * would be a safety claim we have no basis for: under-inflation builds heat and
 * causes blowouts, over-inflation shortens the contact patch and lengthens
 * braking distance. A range labelled as a range, next to "read your placard",
 * is useful and true. A precise number would be neither.
 */

/** Registry column carrying the TPMS flag. Lives in the model dataset only. */
export const TPMS_FIELD = 'hayshaney_lahatz_avir_batzmigim_ind'

/** Exact conversion, so the PSI figure is not independently rounded guesswork. */
const PSI_PER_BAR = 14.5038

export function barToPsi(bar) {
  return Math.round(bar * PSI_PER_BAR)
}

/**
 * Cold-inflation ranges that cover the large majority of vehicles in each
 * class. Deliberately wide: these are for orientation, and a range that is
 * honestly wide is safer than a narrow one that looks authoritative.
 *
 * Keyed on the same `vehicleClass` the aggregator already derives.
 */
export const CLASS_RANGES = {
  passenger: { barMin: 2.0, barMax: 2.5 },
  suv: { barMin: 2.2, barMax: 2.8 },
  commercial: { barMin: 2.5, barMax: 3.5 },
  /** Reachable via the reference table, which classifies some cars this way. */
  performance: { barMin: 2.2, barMax: 2.9 },
}

const DEFAULT_RANGE = CLASS_RANGES.passenger

/**
 * Read the TPMS flag off the model rows.
 *
 * Rows are already year-filtered by the caller where the dataset allows it, but
 * a model code still spans trims that were not all equipped the same way. When
 * the rows disagree we return `null` rather than pick a side — "we don't know"
 * is a legitimate answer here, and the UI simply omits the badge.
 *
 * @returns {boolean|null} `null` when unknown or contradictory.
 */
export function readTpms(modelRecords = []) {
  const flags = modelRecords
    .map((record) => record?.[TPMS_FIELD])
    .map((raw) => {
      const text = String(raw ?? '').trim()
      if (text === '1') return true
      if (text === '0') return false
      return null
    })
    .filter((value) => value !== null)

  if (flags.length === 0) return null

  const allTrue = flags.every(Boolean)
  const allFalse = flags.every((value) => !value)
  if (allTrue) return true
  if (allFalse) return false
  return null
}

/**
 * Build the pressure block for a fitment payload.
 *
 * @param {object} input
 * @param {string} input.vehicleClass
 * @param {Array<object>} [input.modelRecords] Rows from the model dataset.
 * @returns {{
 *   tpms: { equipped: boolean|null, source: string },
 *   guidance: { barMin: number, barMax: number, psiMin: number, psiMax: number,
 *               vehicleClass: string, vehicleSpecific: false, source: string },
 * }}
 */
export function buildTirePressure({ vehicleClass, modelRecords = [] }) {
  const range = CLASS_RANGES[vehicleClass] ?? DEFAULT_RANGE

  return {
    tpms: {
      equipped: readTpms(modelRecords),
      source: 'ministry_of_transport',
    },
    guidance: {
      ...range,
      psiMin: barToPsi(range.barMin),
      psiMax: barToPsi(range.barMax),
      vehicleClass,
      /**
       * Read by the client before it renders anything. It must never present
       * this range as the manufacturer's figure for this specific vehicle.
       */
      vehicleSpecific: false,
      source: 'general_guidance',
    },
  }
}
