import { MAX_PAGE_SIZE } from '../../lib/constants'

/**
 * Wire-shape helpers shared by every service module.
 *
 * MongoDB's `_id` is translated to `id` at this single boundary, which is why
 * nothing above `services/` ever needs to know the database is Mongo.
 */

export const withId = (doc) =>
  doc ? { ...doc, id: doc.id ?? doc._id, _id: undefined } : doc

export const listWithIds = (docs) => (Array.isArray(docs) ? docs.map(withId) : [])

/** Keeps a hand-edited request from asking for an unbounded page. */
export function clampPagination({ page = 1, pageSize = 12 } = {}) {
  return {
    page: Math.max(1, Math.floor(Number(page) || 1)),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(pageSize) || 12))),
  }
}
