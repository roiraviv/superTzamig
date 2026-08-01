/**
 * Parsing for the tire size strings the Ministry of Transport publishes.
 *
 * The registry field is free text typed by importers over decades, so it is
 * inconsistent in every way a string can be: `205/55R16`, `205/55 R 16 91V`,
 * `225/45ZR17`, `195/65/15`, occasionally two sizes in one cell separated by a
 * comma. Anything this module cannot confidently parse is dropped rather than
 * guessed — an approximate tire size is a safety problem, not a data problem.
 */

/**
 * Metric tire size.
 *
 * - width in millimetres (three digits, occasionally two on very old vehicles)
 * - aspect ratio as a percentage of width
 * - optional `Z` before the R, a legacy high-speed marker that carries no
 *   dimensional meaning and must not end up in the canonical form
 * - rim diameter in inches, sometimes fractional (16.5 on light commercials)
 * - optional load index and speed rating trailing the size
 */
const METRIC_SIZE = /(\d{2,3})\s*[/\\]\s*(\d{2,3})\s*(?:Z)?\s*[R]\s*[/\\]?\s*(\d{2}(?:[.,]\d)?)(?:\s*(\d{2,3})\s*([A-Z]{1,2})?)?/gi

/**
 * The same dimensions written with slashes throughout and no `R`, e.g.
 * `195/65/15`. Common in older records. Matched separately so the primary
 * pattern stays readable.
 */
const SLASHED_SIZE = /(\d{2,3})\s*[/\\]\s*(\d{2,3})\s*[/\\]\s*(\d{2}(?:[.,]\d)?)/g

/** Plausibility bounds. Values outside these are typos, not exotic fitments. */
const LIMITS = {
  width: [125, 405],
  aspectRatio: [25, 85],
  rimDiameter: [10, 24],
  loadIndex: [60, 130],
}

function inRange(value, [min, max]) {
  return value >= min && value <= max
}

function buildSize({ width, aspectRatio, rimDiameter, loadIndex, speedRating }) {
  if (
    !inRange(width, LIMITS.width) ||
    !inRange(aspectRatio, LIMITS.aspectRatio) ||
    !inRange(rimDiameter, LIMITS.rimDiameter)
  ) {
    return null
  }

  const usableLoadIndex =
    Number.isFinite(loadIndex) && inRange(loadIndex, LIMITS.loadIndex) ? loadIndex : undefined

  return {
    /** Canonical form. Every comparison in the app happens on this string. */
    size: `${width}/${aspectRatio}R${rimDiameter}`,
    width,
    aspectRatio,
    rimDiameter,
    ...(usableLoadIndex ? { loadIndex: usableLoadIndex } : {}),
    ...(speedRating ? { speedRating: speedRating.toUpperCase() } : {}),
  }
}

/**
 * Extract every distinct size in a registry cell.
 *
 * Returns an array because a single cell legitimately lists alternatives; the
 * caller decides which of them it stocks.
 *
 * @param {unknown} raw
 * @returns {Array<{size: string, width: number, aspectRatio: number, rimDiameter: number, loadIndex?: number, speedRating?: string}>}
 */
export function parseTireSizes(raw) {
  if (raw == null) return []

  const text = String(raw).toUpperCase().trim()
  if (!text || text === '0' || text === '-') return []

  const found = []
  const seen = new Set()

  const push = (candidate) => {
    if (candidate && !seen.has(candidate.size)) {
      seen.add(candidate.size)
      found.push(candidate)
    }
  }

  for (const match of text.matchAll(METRIC_SIZE)) {
    push(
      buildSize({
        width: Number(match[1]),
        aspectRatio: Number(match[2]),
        rimDiameter: Number(String(match[3]).replace(',', '.')),
        loadIndex: Number(match[4]),
        speedRating: match[5],
      }),
    )
  }

  // Only fall back to the R-less form when the strict pattern found nothing,
  // so `205/55R16` is never also read as a slashed triple.
  if (found.length === 0) {
    for (const match of text.matchAll(SLASHED_SIZE)) {
      push(
        buildSize({
          width: Number(match[1]),
          aspectRatio: Number(match[2]),
          rimDiameter: Number(String(match[3]).replace(',', '.')),
        }),
      )
    }
  }

  return found
}

/** First parsable size in a cell, or null. */
export function parseTireSize(raw) {
  return parseTireSizes(raw)[0] ?? null
}

/**
 * Turn front and rear registry cells into the approved-size list the client
 * renders.
 *
 * A staggered setup — different sizes front and rear, normal on performance
 * cars — must stay split by axle, because quoting one size for all four wheels
 * on such a vehicle produces an illegal fitment. When both axles agree, or the
 * rear cell is empty, the result collapses to a single `all` entry so the UI
 * does not show a pointless axle filter.
 *
 * @param {{ front: unknown, rear: unknown, isOem?: boolean }} input
 */
export function toApprovedSizes({ front, rear, isOem = true }) {
  const frontSizes = parseTireSizes(front)
  const rearSizes = parseTireSizes(rear)

  if (frontSizes.length === 0 && rearSizes.length === 0) return []

  const frontKeys = frontSizes.map((entry) => entry.size).join('|')
  const rearKeys = rearSizes.map((entry) => entry.size).join('|')
  const isStaggered = rearSizes.length > 0 && frontKeys !== rearKeys

  if (!isStaggered) {
    const sizes = frontSizes.length > 0 ? frontSizes : rearSizes
    // The first listed size is the factory fitment; alternatives follow it.
    return sizes.map((entry, index) => ({
      ...entry,
      position: 'all',
      isOem: isOem && index === 0,
    }))
  }

  return [
    ...frontSizes.map((entry, index) => ({
      ...entry,
      position: 'front',
      isOem: isOem && index === 0,
    })),
    ...rearSizes.map((entry, index) => ({
      ...entry,
      position: 'rear',
      isOem: isOem && index === 0,
    })),
  ]
}

/**
 * Merge approved sizes gathered from several model rows.
 *
 * One model code spans trims and production years with different fitments, and
 * all of them are legal for the vehicle family, so the union is the honest
 * answer. Deduplicated on axle + size; the OEM flag survives if any source row
 * claimed it.
 */
export function mergeApprovedSizes(groups) {
  const byKey = new Map()

  for (const entry of groups.flat()) {
    const key = `${entry.position}:${entry.size}`
    const existing = byKey.get(key)
    if (existing) {
      existing.isOem = existing.isOem || entry.isOem
      existing.loadIndex ??= entry.loadIndex
      existing.speedRating ??= entry.speedRating
    } else {
      byKey.set(key, { ...entry })
    }
  }

  const order = { all: 0, front: 1, rear: 2 }
  return [...byKey.values()].sort(
    (a, b) =>
      order[a.position] - order[b.position] ||
      Number(b.isOem) - Number(a.isOem) ||
      a.rimDiameter - b.rimDiameter,
  )
}
