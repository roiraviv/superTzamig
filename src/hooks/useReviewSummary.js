import { contentApi } from '../services/api'
import { useAsyncData } from './useAsyncData'

/**
 * The rating aggregates are one small, slow-changing, page-wide value, but the
 * badges that need them are scattered across the hero, the tire selector and the
 * quote wizard. Sharing a single promise at module scope keeps that from turning
 * into one request per badge.
 *
 * No abort signal is threaded through on purpose — whoever mounts first owns the
 * request, and cancelling it when that component unmounts would break every
 * other subscriber. A rejection clears the cache so the next mount can retry.
 */
let summaryPromise = null

function loadSummary() {
  summaryPromise ??= contentApi.getReviewSummary().catch((error) => {
    summaryPromise = null
    throw error
  })

  return summaryPromise
}

/**
 * Ratings for the trust badges.
 *
 * Failure is intentionally non-blocking: a badge is decoration on top of a CTA,
 * so callers render the button regardless and simply omit the badge when
 * `data` is null.
 */
export function useReviewSummary() {
  return useAsyncData(() => loadSummary(), [])
}
