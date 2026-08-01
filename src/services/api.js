import { ApiError } from './http/ApiError'
import { http } from './http/httpClient'
import { clampPagination, listWithIds, withId } from './http/normalize'
import { sanitizeDigits, sanitizeText } from '../lib/validation'

/**
 * The single boundary between React and the Node.js/MongoDB backend.
 *
 * Rules for this file:
 *  1. Nothing above it (hooks, components) ever touches `fetch` or a URL.
 *  2. Wire shapes are normalized here — MongoDB `_id` becomes `id`, ISO strings
 *     stay strings, and nothing else in the app knows Mongo exists.
 *  3. Outbound payloads are sanitized and whitelisted field-by-field so a
 *     stray form key can never reach the database.
 */

/* ------------------------------- Public: catalog ------------------------- */

export const catalogApi = {
  /**
   * @param {{ search?: string, brands?: string[], seasons?: string[], sizes?: string[],
   *           minPrice?: number, maxPrice?: number, sort?: string, page?: number,
   *           pageSize?: number }} filters
   */
  async listTires(filters = {}, { signal } = {}) {
    const { page, pageSize } = clampPagination(filters)
    const result = await http.get('/tires', {
      signal,
      query: {
        search: sanitizeText(filters.search, 80),
        brands: filters.brands,
        seasons: filters.seasons,
        sizes: filters.sizes,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sort: filters.sort,
        page,
        pageSize,
      },
    })
    return { ...result, items: listWithIds(result.items) }
  },

  async getTire(id, { signal } = {}) {
    return withId(await http.get(`/tires/${encodeURIComponent(id)}`, { signal }))
  },

  /** Distinct brands/sizes/seasons + price bounds, for building the filter UI. */
  getFacets({ signal } = {}) {
    return http.get('/tires/facets', { signal })
  },
}

/* --------------------------- Public: tire fitment ------------------------ */

export const vehicleSpecsApi = {
  /**
   * Approved tire sizes for a plate.
   *
   * The browser never talks to the Ministry of Transport directly — that would
   * ship an API key to every visitor and be blocked by CORS anyway. Our Node
   * service holds the key, rate-limits per IP, and caches the answer in the
   * `VehicleTireSpecs` collection, so a repeat lookup costs one indexed read.
   *
   * @returns {Promise<{ vehicle: object, approvedSizes: object[], source: string,
   *                     cached: boolean }>}
   */
  async getTireSpecs(licensePlate, { signal } = {}) {
    const plate = sanitizeDigits(licensePlate, 8)
    // Refuse to spend a request on input that cannot be a plate.
    if (plate.length < 5) {
      throw new ApiError('מספר רישוי חייב להכיל 5–8 ספרות', {
        status: 422,
        code: 'invalid_plate',
        fieldErrors: { licensePlate: 'מספר רישוי חייב להכיל 5–8 ספרות' },
      })
    }
    return withId(await http.get(`/vehicles/${plate}/tire-specs`, { signal }))
  },

  /**
   * Inventory filtered to what is street-legal for one vehicle. The fitment
   * rule lives on the server: the client sends the plate, not a size list, so
   * a tampered request cannot widen the result set to illegal sizes.
   */
  async listFittingTires(licensePlate, { position, sort, signal } = {}) {
    const plate = sanitizeDigits(licensePlate, 8)
    const result = await http.get('/tires/fitment', {
      signal,
      query: { licensePlate: plate, position, sort },
    })
    return { ...result, items: listWithIds(result.items) }
  },
}

/* ------------------------------- Public: content ------------------------- */

export const contentApi = {
  async getTeam({ signal } = {}) {
    return listWithIds(await http.get('/content/team', { signal }))
  },

  /** @param {{ limit?: number, source?: 'google'|'easy' }} [options] */
  async getReviews({ signal, limit = 6, source } = {}) {
    return listWithIds(await http.get('/content/reviews', { signal, query: { limit, source } }))
  },

  /**
   * Per-platform rating aggregates for the trust badges.
   *
   * Deliberately its own endpoint: the badges sit next to conversion buttons and
   * must not wait on the review bodies, and on the backend this is a cached
   * value refreshed on a schedule rather than a live call to Google and Easy on
   * every page view.
   */
  getReviewSummary({ signal } = {}) {
    return http.get('/content/reviews/summary', { signal })
  },

  getTrustStats({ signal } = {}) {
    return http.get('/content/trust-stats', { signal })
  },
}

/* ------------------------------- Public: booking ------------------------- */

export const bookingApi = {
  /** Free slots for a given day. Capacity lives in Mongo, never in the client. */
  getAvailability({ date, serviceIds = [] }, { signal } = {}) {
    return http.get('/booking/availability', {
      signal,
      query: { date, serviceIds },
    })
  },

  /** Prefills make/model from the vehicle registry by plate number. */
  async lookupVehicle(licensePlate, { signal } = {}) {
    const plate = sanitizeDigits(licensePlate, 8)
    if (plate.length < 5) return null
    return withId(await http.get(`/vehicles/${plate}`, { signal }))
  },

  async createAppointment(draft, { signal } = {}) {
    return withId(await http.post('/appointments', serializeBookingDraft(draft), { signal }))
  },
}

/* ------------------------------- Public: quotes -------------------------- */

export const quotesApi = {
  /** Server-side pricing. The client's numbers are display-only and re-computed. */
  priceQuote({ serviceIds = [], lineItems = [] }, { signal } = {}) {
    return http.post(
      '/quotes/price',
      {
        serviceIds,
        lineItems: lineItems.map((item) => ({
          tireId: item.tireId,
          quantity: Math.max(1, Math.min(16, Math.floor(Number(item.quantity) || 1))),
        })),
      },
      { signal },
    )
  },

  async submitQuote(draft, { signal } = {}) {
    return withId(await http.post('/quotes', serializeBookingDraft(draft), { signal }))
  },

  async getQuoteByReference(reference, { signal } = {}) {
    return withId(await http.get(`/quotes/${encodeURIComponent(reference)}`, { signal }))
  },
}

/**
 * Whitelist + sanitize the wizard state into the exact document the backend
 * accepts. Anything not listed here is dropped before it leaves the browser.
 */
function serializeBookingDraft(draft = {}) {
  return {
    serviceIds: Array.isArray(draft.serviceIds) ? draft.serviceIds.slice(0, 6) : [],
    lineItems: (draft.lineItems ?? []).map((item) => ({
      tireId: item.tireId,
      quantity: Math.max(1, Math.min(16, Math.floor(Number(item.quantity) || 1))),
    })),
    vehicle: {
      licensePlate: sanitizeDigits(draft.vehicle?.licensePlate, 8),
      make: sanitizeText(draft.vehicle?.make, 40),
      model: sanitizeText(draft.vehicle?.model, 40),
      year: Number(draft.vehicle?.year) || null,
    },
    schedule: {
      date: draft.schedule?.date ?? null,
      slotId: draft.schedule?.slotId ?? null,
    },
    contact: {
      fullName: sanitizeText(draft.contact?.fullName, 60),
      phone: sanitizeDigits(draft.contact?.phone, 10),
      email: sanitizeText(draft.contact?.email, 120).toLowerCase(),
      notes: sanitizeText(draft.contact?.notes, 500),
      consent: draft.contact?.consent === true,
    },
  }
}

/* --------------------------------- Admin --------------------------------- */

export const adminAuthApi = {
  /** Sets the httpOnly session cookie server-side; no token is returned. */
  login({ email, password }, { signal } = {}) {
    return http.post(
      '/admin/auth/login',
      { email: sanitizeText(email, 120).toLowerCase(), password: String(password ?? '') },
      { signal },
    )
  },

  logout({ signal } = {}) {
    return http.post('/admin/auth/logout', {}, { signal })
  },

  /** Source of truth for "am I logged in" — the cookie is unreadable to JS. */
  getSession({ signal } = {}) {
    return http.get('/admin/auth/session', { signal })
  },
}

export const adminDashboardApi = {
  getStats({ signal } = {}) {
    return http.get('/admin/dashboard/stats', { signal })
  },

  async getActivity({ signal, limit = 8 } = {}) {
    return listWithIds(await http.get('/admin/dashboard/activity', { signal, query: { limit } }))
  },
}

export const adminAppointmentsApi = {
  async list({ from, to, status } = {}, { signal } = {}) {
    return listWithIds(
      await http.get('/admin/appointments', { signal, query: { from, to, status } }),
    )
  },

  async updateStatus(id, status, { signal } = {}) {
    return withId(
      await http.patch(`/admin/appointments/${encodeURIComponent(id)}/status`, { status }, { signal }),
    )
  },
}

export const adminInventoryApi = {
  async list(params = {}, { signal } = {}) {
    const { page, pageSize } = clampPagination({ ...params, pageSize: params.pageSize ?? 20 })
    const result = await http.get('/admin/inventory', {
      signal,
      query: {
        search: sanitizeText(params.search, 80),
        category: params.category,
        stockState: params.stockState,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
        page,
        pageSize,
      },
    })
    return { ...result, items: listWithIds(result.items) }
  },

  async create(item, { signal } = {}) {
    return withId(await http.post('/admin/inventory', serializeInventoryItem(item), { signal }))
  },

  async update(id, patch, { signal } = {}) {
    return withId(
      await http.patch(
        `/admin/inventory/${encodeURIComponent(id)}`,
        serializeInventoryItem(patch, { partial: true }),
        { signal },
      ),
    )
  },

  /** Relative delta, so two concurrent admins can't clobber each other's count. */
  async adjustStock(id, delta, { signal } = {}) {
    return withId(
      await http.patch(
        `/admin/inventory/${encodeURIComponent(id)}/stock`,
        { delta: Math.trunc(Number(delta) || 0) },
        { signal },
      ),
    )
  },

  remove(id, { signal } = {}) {
    return http.del(`/admin/inventory/${encodeURIComponent(id)}`, { signal })
  },
}

function serializeInventoryItem(item = {}, { partial = false } = {}) {
  const payload = {
    name: sanitizeText(item.name, 80),
    brand: sanitizeText(item.brand, 40),
    sku: sanitizeText(item.sku, 40).toUpperCase(),
    category: item.category,
    price: Number(item.price),
    stock: Math.trunc(Number(item.stock)),
    size: sanitizeText(item.size, 30),
  }

  if (!partial) return payload
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        key in item && value !== '' && value !== undefined && !Number.isNaN(value),
    ),
  )
}

export const adminQuotesApi = {
  async list({ status } = {}, { signal } = {}) {
    return listWithIds(await http.get('/admin/quotes', { signal, query: { status } }))
  },

  async approve(id, { note } = {}, { signal } = {}) {
    return withId(
      await http.patch(
        `/admin/quotes/${encodeURIComponent(id)}/approve`,
        { note: sanitizeText(note, 300) },
        { signal },
      ),
    )
  },

  async reject(id, { reason } = {}, { signal } = {}) {
    return withId(
      await http.patch(
        `/admin/quotes/${encodeURIComponent(id)}/reject`,
        { reason: sanitizeText(reason, 300) },
        { signal },
      ),
    )
  },
}
