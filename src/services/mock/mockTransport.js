import { ApiError } from '../http/ApiError'
import {
  APPOINTMENT_STATUS,
  INVOICE_STATUS,
  LOW_STOCK_THRESHOLD,
  PAYMENT_CHANNELS,
  PAYMENT_STATUS,
  QUOTE_STATUS,
  REVIEW_SOURCES,
  SERVICE_TYPES,
  VAT_RATE,
} from '../../lib/constants'
import { toDateKey } from '../../lib/format'
import * as fixtures from './fixtures'

/**
 * In-memory stand-in for the Node.js/MongoDB API.
 *
 * It is deliberately wired in at the transport layer: `services/api.js` calls
 * `http.get('/tires')` either way, so deleting this file and flipping
 * `VITE_USE_MOCK_API=false` is the entire cutover to the real backend.
 */

const LATENCY_MS = [180, 520]
const db = {
  tires: structuredClone(fixtures.tires),
  team: structuredClone(fixtures.team),
  reviews: structuredClone(fixtures.reviews),
  inventory: structuredClone(fixtures.inventory),
  appointments: structuredClone(fixtures.appointments),
  quotes: structuredClone(fixtures.quotes),
  invoices: structuredClone(fixtures.invoices),
  paymentIntents: [],
  activity: [],
}

let session = null
/** Mirrors the atomic `Counter` document that allocates invoice numbers. */
let invoiceSequence = 313

/* ------------------------------- utilities ------------------------------- */

const delay = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

const randomLatency = () =>
  LATENCY_MS[0] + Math.random() * (LATENCY_MS[1] - LATENCY_MS[0])

const objectId = () =>
  Date.now().toString(16).padStart(12, '0') +
  Math.floor(Math.random() * 0xffffffffff)
    .toString(16)
    .padStart(12, '0')

const fail = (status, message, extra = {}) => {
  throw new ApiError(message, { status, ...extra })
}

const toArray = (value) => (value == null ? [] : Array.isArray(value) ? value : [value])

/** Admin routes are gated exactly like the Express `requireAdmin` middleware. */
function requireSession() {
  if (!session) fail(401, 'ההתחברות פגה')
  return session
}

function logActivity(entry) {
  db.activity.unshift({ _id: objectId(), createdAt: new Date().toISOString(), ...entry })
  db.activity = db.activity.slice(0, 40)
}

/** Stable per-day pseudo-randomness so slot lists don't shuffle on re-render. */
function seededBool(seed, index, trueRatio) {
  let hash = 0
  const key = `${seed}:${index}`
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return (hash % 100) / 100 < trueRatio
}

function priceQuote({ serviceIds = [], lineItems = [] }) {
  const services = SERVICE_TYPES.filter((service) => serviceIds.includes(service.id))

  const pricedItems = lineItems.map((item) => {
    const tire = db.tires.find((candidate) => candidate._id === item.tireId)
    if (!tire) fail(422, 'אחד הפריטים בהצעה אינו קיים במלאי', { code: 'unknown_tire' })
    const quantity = Math.max(1, Math.min(16, Math.floor(Number(item.quantity) || 1)))
    return {
      tireId: tire._id,
      label: `${tire.brand} ${tire.model}`,
      detail: tire.size,
      quantity,
      unitPrice: tire.price,
      lineTotal: tire.price * quantity,
    }
  })

  const serviceLines = services.map((service) => ({
    serviceId: service.id,
    label: service.label,
    detail: service.description,
    quantity: 1,
    unitPrice: service.basePrice,
    lineTotal: service.basePrice,
  }))

  const subtotal = [...pricedItems, ...serviceLines].reduce(
    (sum, line) => sum + line.lineTotal,
    0,
  )
  const vat = Math.round(subtotal * VAT_RATE)

  return {
    lineItems: pricedItems,
    serviceLines,
    subtotal,
    vat,
    vatRate: VAT_RATE,
    total: subtotal + vat,
    estimatedMinutes: services.reduce((sum, service) => sum + service.durationMinutes, 0),
  }
}

/* ----------------------------- tire fitment ------------------------------ */

/**
 * Parses any of `205/55R16`, `LT275/65R18`, `245/40ZR19`, `195/75R16C` into the
 * three numbers that actually determine fitment. Comparing the raw strings would
 * miss `245/40ZR19` vs `245/40R19`, which are the same fitment.
 */
function parseTireSize(size) {
  const match = /(\d{3})\s*\/\s*(\d{2})\s*Z?R\s*(\d{2})/i.exec(String(size ?? ''))
  if (!match) return null
  return { width: Number(match[1]), aspectRatio: Number(match[2]), rimDiameter: Number(match[3]) }
}

const sizeKey = (size) => {
  const parsed = parseTireSize(size)
  return parsed ? `${parsed.width}/${parsed.aspectRatio}R${parsed.rimDiameter}` : null
}

/**
 * Reserved plates that force the failure modes the real aggregator can hit, so
 * every branch of the selector's error handling is reachable in the browser
 * without taking data.gov.il down.
 */
const REGISTRY_FAILURE_PLATES = {
  /** Vehicle exists in the registry but no dataset carries its tire sizes. */
  '5555555': () =>
    fail(422, 'מצאנו את הרכב, אך מידות הצמיגים אינן זמינות במאגר', {
      code: 'tire_specs_unavailable',
    }),
  /** data.gov.il is unreachable or the circuit breaker is open. */
  '5555556': () =>
    fail(503, 'מאגר משרד התחבורה אינו זמין כרגע. נסו שוב בעוד רגע.', {
      code: 'registry_unavailable',
    }),
  /** Genuinely absent from every dataset — keeps that UI branch reachable. */
  '5555554': () =>
    fail(404, 'לא מצאנו את הרכב במאגר משרד התחבורה', { code: 'plate_not_found' }),
}

/**
 * Ask the real backend which vehicle this plate belongs to.
 *
 * Vehicle identity is the one thing that cannot be mocked. Deriving a car from
 * the plate digits produces a confident, wrong answer — and a wrong vehicle
 * means a wrong tire size, which sets load rating and rolling diameter and so
 * breaks ABS and speedometer calibration. So this reaches through to the
 * Express service on :4000, which is the only component allowed to call
 * data.gov.il.
 *
 * Tire stock stays mocked below, because that is our own inventory rather than
 * registry data.
 */
async function fetchRealVehicleSpecs(plate) {
  let response
  try {
    response = await fetch(`/api/vehicles/${plate}/tire-specs`, {
      headers: { Accept: 'application/json' },
    })
  } catch (cause) {
    fail(503, 'שירות איתור הרכב אינו זמין. ודאו שהשרת רץ (npm run server).', {
      code: 'lookup_service_down',
      cause,
    })
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    fail(response.status, payload?.error?.message ?? 'איתור הרכב נכשל', {
      code: payload?.error?.code ?? 'lookup_failed',
    })
  }

  return payload
}

async function findVehicleSpecs(plate) {
  REGISTRY_FAILURE_PLATES[plate]?.()

  // Seeded plates keep the offline demo and the automated tests working.
  const specs = fixtures.vehicleTireSpecs[plate]
  if (specs) return { ...specs, verified: true }

  return fetchRealVehicleSpecs(plate)
}

/* -------------------------------- billing -------------------------------- */

/**
 * The authoritative pricing pass, mirroring `InvoiceSchema.pre('validate')`.
 * The client's totals are never read back — they are recomputed here from the
 * line items on every write.
 */
function computeInvoiceTotals(lineItems, { amountPaid = 0 } = {}) {
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0

  const lines = lineItems.map((line) => {
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(line.quantity) || 1)))
    const unitPrice = Math.max(0, Number(line.unitPrice) || 0)
    const discountPercent = Math.max(0, Math.min(100, Number(line.discountPercent) || 0))
    const taxRate = VAT_RATE

    const gross = unitPrice * quantity
    const discount = Math.round(gross * (discountPercent / 100))
    const lineSubtotal = gross - discount
    const lineTax = Math.round(lineSubtotal * taxRate)

    subtotal += gross
    discountTotal += discount
    taxTotal += lineTax

    return {
      _id: objectId(),
      kind: line.kind,
      refId: line.refId ?? null,
      sku: line.sku ?? '',
      description: line.description,
      quantity,
      unitPrice,
      discountPercent,
      taxRate,
      lineSubtotal,
      lineTax,
      lineTotal: lineSubtotal + lineTax,
    }
  })

  const grandTotal = subtotal - discountTotal + taxTotal
  const paid = Math.max(0, Math.min(grandTotal, Number(amountPaid) || 0))

  return {
    lines,
    totals: {
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      amountPaid: paid,
      amountDue: grandTotal - paid,
      currency: 'ILS',
    },
  }
}

function assertInvoiceDraft(draft) {
  const fieldErrors = {}
  if (!draft?.customer?.name) fieldErrors.name = 'יש להזין שם לקוח'
  if (!/^0(5\d{8}|7\d{8}|[23489]\d{7})$/.test(draft?.customer?.phone ?? '')) {
    fieldErrors.phone = 'מספר טלפון לא תקין'
  }
  if (draft?.customer?.taxId && !/^\d{9}$/.test(draft.customer.taxId)) {
    fieldErrors.taxId = 'ח.פ / ת.ז חייב להכיל 9 ספרות'
  }
  if (!Array.isArray(draft?.lineItems) || draft.lineItems.length === 0) {
    fieldErrors.lineItems = 'חשבונית חייבת לכלול לפחות שורה אחת'
  } else if (draft.lineItems.some((line) => !line.description)) {
    fieldErrors.lineItems = 'לכל שורה נדרש תיאור'
  } else if (draft.lineItems.some((line) => Number(line.unitPrice) <= 0)) {
    fieldErrors.lineItems = 'מחיר יחידה חייב להיות גדול מאפס'
  }

  if (Object.keys(fieldErrors).length > 0) {
    fail(422, 'חלק מהפרטים אינם תקינים', { code: 'validation_failed', fieldErrors })
  }
}

function findInvoice(id) {
  const invoice = db.invoices.find((candidate) => candidate._id === id)
  if (!invoice) fail(404, 'החשבונית לא נמצאה')
  return invoice
}

function findIntent(id) {
  const intent = db.paymentIntents.find((candidate) => candidate._id === id)
  if (!intent) fail(404, 'בקשת התשלום לא נמצאה')
  return intent
}

function recordPaymentEvent(invoice, event) {
  invoice.payment.events = [
    ...(invoice.payment.events ?? []),
    { at: new Date().toISOString(), actorId: session?.user?._id ?? null, ...event },
  ].slice(-20)
}

function assertBookingDraft(draft) {
  const fieldErrors = {}
  if (!Array.isArray(draft?.serviceIds) || draft.serviceIds.length === 0) {
    fieldErrors.serviceIds = 'יש לבחור לפחות שירות אחד'
  }
  if (!/^\d{5,8}$/.test(draft?.vehicle?.licensePlate ?? '')) {
    fieldErrors.licensePlate = 'מספר רישוי לא תקין'
  }
  if (!/^0(5\d{8}|7\d{8}|[23489]\d{7})$/.test(draft?.contact?.phone ?? '')) {
    fieldErrors.phone = 'מספר טלפון לא תקין'
  }
  if (!draft?.contact?.fullName) fieldErrors.fullName = 'יש להזין שם מלא'
  if (draft?.contact?.consent !== true) fieldErrors.consent = 'נדרש אישור תנאי השימוש'

  if (Object.keys(fieldErrors).length > 0) {
    fail(422, 'חלק מהפרטים אינם תקינים', { code: 'validation_failed', fieldErrors })
  }
}

/* -------------------------------- handlers -------------------------------- */

const routes = [
  /* ---- catalog ---- */
  {
    method: 'GET',
    pattern: /^\/tires$/,
    handle: ({ query }) => {
      const search = String(query.search ?? '').trim().toLowerCase()
      const brands = toArray(query.brands)
      const seasons = toArray(query.seasons)
      const sizes = toArray(query.sizes)
      const minPrice = Number(query.minPrice)
      const maxPrice = Number(query.maxPrice)

      let items = db.tires.filter((tire) => {
        const haystack = `${tire.brand} ${tire.model} ${tire.size}`.toLowerCase()
        if (search && !haystack.includes(search)) return false
        if (brands.length && !brands.includes(tire.brand)) return false
        if (seasons.length && !seasons.includes(tire.season)) return false
        if (sizes.length && !sizes.includes(tire.size)) return false
        if (Number.isFinite(minPrice) && tire.price < minPrice) return false
        if (Number.isFinite(maxPrice) && tire.price > maxPrice) return false
        return true
      })

      const sorters = {
        'price-asc': (a, b) => a.price - b.price,
        'price-desc': (a, b) => b.price - a.price,
        rating: (a, b) => b.rating - a.rating,
        relevance: (a, b) => b.reviewCount - a.reviewCount,
      }
      items = [...items].sort(sorters[query.sort] ?? sorters.relevance)

      const page = Number(query.page) || 1
      const pageSize = Number(query.pageSize) || 12
      const start = (page - 1) * pageSize

      return {
        items: items.slice(start, start + pageSize),
        total: items.length,
        page,
        pageSize,
        hasMore: start + pageSize < items.length,
      }
    },
  },
  {
    method: 'GET',
    pattern: /^\/tires\/facets$/,
    handle: () => ({
      brands: [...new Set(db.tires.map((tire) => tire.brand))].sort(),
      sizes: [...new Set(db.tires.map((tire) => tire.size))].sort(),
      seasons: [...new Set(db.tires.map((tire) => tire.season))],
      minPrice: Math.min(...db.tires.map((tire) => tire.price)),
      maxPrice: Math.max(...db.tires.map((tire) => tire.price)),
    }),
  },
  /**
   * Fitment search. Registered before `/tires/:id` so the literal path wins.
   *
   * The client sends a plate, not a size list: the approved sizes are resolved
   * here, server-side, so a tampered request cannot widen the results to a size
   * that is illegal for the vehicle.
   */
  {
    method: 'GET',
    pattern: /^\/tires\/fitment$/,
    handle: async ({ query }) => {
      const plate = String(query.licensePlate ?? '').replace(/\D/g, '')
      if (!/^\d{5,8}$/.test(plate)) fail(422, 'מספר רישוי לא תקין', { code: 'invalid_plate' })

      const specs = await findVehicleSpecs(plate)
      const requestedPosition = query.position
      const approved = specs.approvedSizes.filter(
        (entry) =>
          !requestedPosition ||
          requestedPosition === 'all' ||
          entry.position === requestedPosition ||
          entry.position === 'all',
      )

      // Index the approved sizes so each tire can report why it matched.
      const approvedByKey = new Map()
      for (const entry of approved) {
        const key = sizeKey(entry.size)
        if (key && !approvedByKey.has(key)) approvedByKey.set(key, entry)
      }

      const items = db.tires
        .map((tire) => {
          const match = approvedByKey.get(sizeKey(tire.size))
          return match ? { ...tire, fitment: match } : null
        })
        .filter(Boolean)

      const sorters = {
        'price-asc': (a, b) => a.price - b.price,
        'price-desc': (a, b) => b.price - a.price,
        rating: (a, b) => b.rating - a.rating,
      }
      // Default order puts the factory-fitted size first: it is the safe pick.
      const byOem = (a, b) => Number(b.fitment.isOem) - Number(a.fitment.isOem)
      items.sort(sorters[query.sort] ?? ((a, b) => byOem(a, b) || b.rating - a.rating))

      return {
        items,
        total: items.length,
        vehicle: specs.vehicle,
        /** Drives the "not confirmed against the registry" notice in the UI. */
        verified: specs.verified !== false,
        /** Vehicle-level, so it rides alongside the grid rather than in it. */
        tirePressure: specs.tirePressure ?? null,
        source: specs.source,
        approvedSizes: approved,
        /** Approved sizes we stock nothing for — shown so the offer stays honest. */
        unavailableSizes: approved
          .filter((entry) => !db.tires.some((tire) => sizeKey(tire.size) === sizeKey(entry.size)))
          .map((entry) => entry.size),
      }
    },
  },
  {
    method: 'GET',
    pattern: /^\/tires\/([^/]+)$/,
    handle: ({ params }) =>
      db.tires.find((tire) => tire._id === params[0]) ?? fail(404, 'הצמיג לא נמצא'),
  },

  /* ---- marketing content ---- */
  { method: 'GET', pattern: /^\/content\/team$/, handle: () => db.team },
  /** Registered before `/content/reviews` is matched by the list route below. */
  {
    method: 'GET',
    pattern: /^\/content\/reviews\/summary$/,
    handle: () => fixtures.reviewSummary,
  },
  {
    method: 'GET',
    pattern: /^\/content\/reviews$/,
    handle: ({ query }) => {
      const source = query.source
      if (source && !Object.values(REVIEW_SOURCES).includes(source)) {
        fail(422, 'מקור ביקורות לא מוכר')
      }

      return db.reviews
        .filter((review) => !source || review.source === source)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.min(20, Number(query.limit) || 6))
    },
  },
  { method: 'GET', pattern: /^\/content\/trust-stats$/, handle: () => fixtures.trustStats },

  /* ---- booking ---- */
  {
    method: 'GET',
    pattern: /^\/booking\/availability$/,
    handle: ({ query }) => {
      const dateKey = String(query.date ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) fail(422, 'תאריך לא תקין')

      const day = new Date(`${dateKey}T00:00:00`)
      // Saturday is closed; Friday is a half day.
      const weekday = day.getDay()
      if (weekday === 6) return { date: dateKey, closed: true, slots: [] }

      const lastHour = weekday === 5 ? 13 : 18
      const slots = []
      for (let hour = 8, index = 0; hour < lastHour; hour += 1) {
        for (const minute of [0, 30]) {
          const available = seededBool(dateKey, index, 0.62)
          slots.push({
            id: `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            available,
            bay: (index % 3) + 1,
          })
          index += 1
        }
      }
      return { date: dateKey, closed: false, slots }
    },
  },
  {
    method: 'GET',
    pattern: /^\/vehicles\/([^/]+)$/,
    handle: ({ params }) =>
      fixtures.vehicleRegistry[params[0]] ?? fail(404, 'הרכב לא נמצא במאגר'),
  },
  /**
   * Stands in for the backend's cached proxy to the Ministry of Transport. In
   * production the outbound call happens here, behind the API key and a per-IP
   * rate limit, and the answer is upserted into `VehicleTireSpecs` with a TTL.
   */
  {
    method: 'GET',
    pattern: /^\/vehicles\/([^/]+)\/tire-specs$/,
    handle: async ({ params }) => {
      const plate = params[0].replace(/\D/g, '')
      if (!/^\d{5,8}$/.test(plate)) {
        fail(422, 'מספר רישוי חייב להכיל 5–8 ספרות', {
          code: 'invalid_plate',
          fieldErrors: { licensePlate: 'מספר רישוי חייב להכיל 5–8 ספרות' },
        })
      }

      const specs = await findVehicleSpecs(plate)
      return { ...specs, fetchedAt: new Date().toISOString() }
    },
  },
  {
    method: 'POST',
    pattern: /^\/appointments$/,
    handle: ({ body }) => {
      assertBookingDraft(body)
      if (!body.schedule?.date || !body.schedule?.slotId) {
        fail(422, 'יש לבחור תאריך ושעה', {
          code: 'validation_failed',
          fieldErrors: { slotId: 'יש לבחור שעה' },
        })
      }

      const pricing = priceQuote(body)
      const appointment = {
        _id: objectId(),
        reference: `AP-${2000 + db.appointments.length + 47}`,
        customerName: body.contact.fullName,
        phone: body.contact.phone,
        vehicle: body.vehicle,
        serviceIds: body.serviceIds,
        bay: (db.appointments.length % 3) + 1,
        startsAt: new Date(body.schedule.slotId).toISOString(),
        durationMinutes: pricing.estimatedMinutes || 60,
        status: APPOINTMENT_STATUS.SCHEDULED,
        estimatedTotal: pricing.total,
        notes: body.contact.notes,
        createdAt: new Date().toISOString(),
      }

      db.appointments.push(appointment)
      logActivity({
        type: 'appointment_created',
        title: `${appointment.customerName} קבע/ה תור`,
        detail: `${appointment.reference} · עמדה ${appointment.bay}`,
        icon: 'calendar_add_on',
        tone: 'secondary',
      })

      return appointment
    },
  },

  /* ---- quotes ---- */
  { method: 'POST', pattern: /^\/quotes\/price$/, handle: ({ body }) => priceQuote(body) },
  {
    method: 'POST',
    pattern: /^\/quotes$/,
    handle: ({ body }) => {
      assertBookingDraft(body)
      const pricing = priceQuote(body)
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 7)

      const quote = {
        _id: objectId(),
        reference: `Q-${1044 + db.quotes.length}`,
        customerName: body.contact.fullName,
        phone: body.contact.phone,
        email: body.contact.email,
        vehicle: body.vehicle,
        serviceIds: body.serviceIds,
        lineItems: pricing.lineItems,
        serviceLines: pricing.serviceLines,
        subtotal: pricing.subtotal,
        vat: pricing.vat,
        total: pricing.total,
        status: QUOTE_STATUS.PENDING,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        notes: body.contact.notes,
        preferredDate: body.schedule?.date ?? null,
      }

      db.quotes.unshift(quote)
      logActivity({
        type: 'quote_created',
        title: `הצעת מחיר חדשה ${quote.reference}`,
        detail: `${quote.customerName} · ${quote.vehicle.make} ${quote.vehicle.model}`,
        icon: 'request_quote',
        tone: 'primary',
      })

      return quote
    },
  },
  {
    method: 'GET',
    pattern: /^\/quotes\/([^/]+)$/,
    handle: ({ params }) =>
      db.quotes.find((quote) => quote.reference === params[0] || quote._id === params[0]) ??
      fail(404, 'הצעת המחיר לא נמצאה'),
  },

  /* ---- admin auth ---- */
  {
    method: 'POST',
    pattern: /^\/admin\/auth\/login$/,
    handle: ({ body }) => {
      const emailMatches = body?.email === fixtures.DEMO_CREDENTIALS.email
      const passwordMatches = body?.password === fixtures.DEMO_CREDENTIALS.password
      // Single generic message: never reveal which half of the pair was wrong.
      if (!emailMatches || !passwordMatches) fail(401, 'אימייל או סיסמה שגויים')

      session = { user: fixtures.adminUser, issuedAt: Date.now() }
      return { user: fixtures.adminUser }
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/auth\/logout$/,
    handle: () => {
      session = null
      return { ok: true }
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/auth\/session$/,
    handle: () => (session ? { user: session.user } : fail(401, 'לא מחובר')),
  },

  /* ---- admin dashboard ---- */
  {
    method: 'GET',
    pattern: /^\/admin\/dashboard\/stats$/,
    handle: () => {
      requireSession()
      const todayKey = toDateKey(new Date())
      const todays = db.appointments.filter((item) => toDateKey(item.startsAt) === todayKey)
      const lowStock = db.inventory.filter((item) => item.stock <= item.reorderPoint)
      const criticalItem = [...lowStock].sort((a, b) => a.stock - b.stock)[0]

      return {
        activeAppointments: {
          value: todays.filter((item) => item.status !== APPOINTMENT_STATUS.CANCELLED).length,
          trend: 12,
        },
        revenueToday: {
          value: todays
            .filter((item) => item.status === APPOINTMENT_STATUS.COMPLETED)
            .reduce((sum, item) => sum + item.estimatedTotal, 0),
          trend: 5.2,
        },
        lowStock: {
          value: lowStock.length,
          criticalLabel: criticalItem ? `${criticalItem.brand} ${criticalItem.name}` : null,
        },
        pendingQuotes: {
          value: db.quotes.filter((quote) => quote.status === QUOTE_STATUS.PENDING).length,
        },
      }
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/dashboard\/activity$/,
    handle: ({ query }) => {
      requireSession()
      const seeded = [
        {
          _id: 'seed-1',
          type: 'appointment_created',
          title: 'משיקו קבע/ה כיוון פרונט',
          detail: 'היום 14:00 · עמדה 2',
          icon: 'calendar_add_on',
          tone: 'secondary',
          createdAt: new Date(Date.now() - 2 * 60000).toISOString(),
        },
        {
          _id: 'seed-2',
          type: 'stock_updated',
          title: 'עודכן מלאי רפידות בלם קרמיות',
          detail: 'נוספו 50 יחידות על ידי המנהל',
          icon: 'inventory',
          tone: 'neutral',
          createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
        },
        {
          _id: 'seed-3',
          type: 'service_completed',
          title: 'הטיפול ברכב של שרה ת. הושלם',
          detail: 'החלפת שמן סינתטי · חשבונית #892',
          icon: 'check_circle',
          tone: 'primary',
          createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
        },
        {
          _id: 'seed-4',
          type: 'quote_rejected',
          title: 'הצעת מחיר Q-1039 נדחתה',
          detail: 'סיבה: מחיר גבוה מדי',
          icon: 'cancel',
          tone: 'error',
          createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
        },
        {
          _id: 'seed-5',
          type: 'appointment_created',
          title: 'דוד ל. קבע/ה סבב צמיגים',
          detail: 'מחר 09:00 · עמדה 1',
          icon: 'calendar_add_on',
          tone: 'secondary',
          createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
        },
      ]
      return [...db.activity, ...seeded].slice(0, Number(query.limit) || 8)
    },
  },

  /* ---- admin appointments ---- */
  {
    method: 'GET',
    pattern: /^\/admin\/appointments$/,
    handle: ({ query }) => {
      requireSession()
      return db.appointments
        .filter((item) => {
          if (query.status && item.status !== query.status) return false
          if (query.from && item.startsAt < query.from) return false
          if (query.to && item.startsAt > query.to) return false
          return true
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/admin\/appointments\/([^/]+)\/status$/,
    handle: ({ params, body }) => {
      requireSession()
      const appointment = db.appointments.find((item) => item._id === params[0])
      if (!appointment) fail(404, 'התור לא נמצא')
      if (!Object.values(APPOINTMENT_STATUS).includes(body?.status)) {
        fail(422, 'סטטוס לא חוקי')
      }
      appointment.status = body.status
      return appointment
    },
  },

  /* ---- admin inventory ---- */
  {
    method: 'GET',
    pattern: /^\/admin\/inventory$/,
    handle: ({ query }) => {
      requireSession()
      const search = String(query.search ?? '').trim().toLowerCase()

      let items = db.inventory.filter((item) => {
        const haystack = `${item.name} ${item.brand} ${item.sku}`.toLowerCase()
        if (search && !haystack.includes(search)) return false
        if (query.category && item.category !== query.category) return false
        if (query.stockState === 'low' && item.stock > item.reorderPoint) return false
        if (query.stockState === 'out' && item.stock !== 0) return false
        if (query.stockState === 'healthy' && item.stock <= item.reorderPoint) return false
        return true
      })

      const sortBy = query.sortBy ?? 'name'
      const direction = query.sortDir === 'desc' ? -1 : 1
      items = [...items].sort((a, b) => {
        const left = a[sortBy]
        const right = b[sortBy]
        if (typeof left === 'number' && typeof right === 'number') {
          return (left - right) * direction
        }
        return String(left).localeCompare(String(right), 'he') * direction
      })

      const page = Number(query.page) || 1
      const pageSize = Number(query.pageSize) || 20
      const start = (page - 1) * pageSize

      return {
        items: items.slice(start, start + pageSize),
        total: items.length,
        page,
        pageSize,
        summary: {
          totalValue: db.inventory.reduce((sum, item) => sum + item.price * item.stock, 0),
          lowStockCount: db.inventory.filter((item) => item.stock <= item.reorderPoint).length,
          outOfStockCount: db.inventory.filter((item) => item.stock === 0).length,
        },
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/inventory$/,
    handle: ({ body }) => {
      requireSession()
      if (db.inventory.some((item) => item.sku === body.sku)) {
        fail(409, 'קיים כבר פריט עם מק"ט זה', { fieldErrors: { sku: 'מק"ט כפול' } })
      }
      const item = {
        _id: objectId(),
        reorderPoint: LOW_STOCK_THRESHOLD,
        cost: Math.round(Number(body.price) * 0.7),
        supplier: 'ספק כללי',
        ...body,
        updatedAt: new Date().toISOString(),
      }
      db.inventory.unshift(item)
      return item
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/admin\/inventory\/([^/]+)\/stock$/,
    handle: ({ params, body }) => {
      requireSession()
      const item = db.inventory.find((candidate) => candidate._id === params[0])
      if (!item) fail(404, 'הפריט לא נמצא')

      const next = item.stock + Math.trunc(Number(body?.delta) || 0)
      if (next < 0) fail(409, 'לא ניתן להוריד מלאי מתחת לאפס')

      item.stock = next
      item.updatedAt = new Date().toISOString()
      logActivity({
        type: 'stock_updated',
        title: `עודכן מלאי ${item.name}`,
        detail: `${body.delta > 0 ? '+' : ''}${body.delta} יחידות`,
        icon: 'inventory',
        tone: 'neutral',
      })
      return item
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/admin\/inventory\/([^/]+)$/,
    handle: ({ params, body }) => {
      requireSession()
      const item = db.inventory.find((candidate) => candidate._id === params[0])
      if (!item) fail(404, 'הפריט לא נמצא')
      Object.assign(item, body, { updatedAt: new Date().toISOString() })
      return item
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/admin\/inventory\/([^/]+)$/,
    handle: ({ params }) => {
      requireSession()
      const index = db.inventory.findIndex((candidate) => candidate._id === params[0])
      if (index === -1) fail(404, 'הפריט לא נמצא')
      db.inventory.splice(index, 1)
      return { ok: true }
    },
  },

  /* ---- gateway tokenization ---- */
  /**
   * Stands in for the PCI-DSS compliant gateway's own endpoint, which in
   * production lives on the gateway's origin — not ours. It is the only route
   * that ever sees a card number, and it returns a token instead of storing it.
   */
  {
    method: 'POST',
    pattern: /^\/gateway\/tokens$/,
    handle: ({ body }) => {
      const digits = String(body?.number ?? '').replace(/\D/g, '')
      if (digits.length < 12) fail(422, 'מספר כרטיס לא תקין', { code: 'invalid_card' })

      // Test-card conventions so the failure path is reachable on demand.
      if (digits.endsWith('0002')) {
        fail(402, 'הכרטיס נדחה על ידי חברת האשראי', { code: 'card_declined' })
      }

      return {
        token: `tok_mock_${digits.slice(-4)}_${Math.random().toString(36).slice(2, 8)}`,
        last4: digits.slice(-4),
      }
    },
  },

  /* ---- admin invoices ---- */
  {
    method: 'GET',
    pattern: /^\/admin\/invoices$/,
    handle: ({ query }) => {
      requireSession()
      const search = String(query.search ?? '').trim().toLowerCase()

      const items = db.invoices
        .filter((invoice) => {
          if (query.status && invoice.status !== query.status) return false
          if (!search) return true
          const haystack = `${invoice.invoiceNumber} ${invoice.customer.name} ${invoice.vehicle.licensePlate}`
          return haystack.toLowerCase().includes(search)
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      const page = Number(query.page) || 1
      const pageSize = Number(query.pageSize) || 20
      const start = (page - 1) * pageSize

      const outstanding = db.invoices.filter(
        (invoice) => invoice.status === INVOICE_STATUS.ISSUED && invoice.totals.amountDue > 0,
      )

      return {
        items: items.slice(start, start + pageSize),
        total: items.length,
        page,
        pageSize,
        summary: {
          paidTotal: db.invoices
            .filter((invoice) => invoice.status === INVOICE_STATUS.PAID)
            .reduce((sum, invoice) => sum + invoice.totals.grandTotal, 0),
          outstandingTotal: outstanding.reduce((sum, invoice) => sum + invoice.totals.amountDue, 0),
          outstandingCount: outstanding.length,
        },
      }
    },
  },
  /** Registered before `/admin/invoices/:id` so the literal path wins. */
  {
    method: 'POST',
    pattern: /^\/admin\/invoices\/preview$/,
    handle: ({ body }) => {
      requireSession()
      const { lines, totals } = computeInvoiceTotals(body?.lineItems ?? [])
      return { lineItems: lines, totals }
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/invoices$/,
    handle: ({ body }) => {
      requireSession()
      assertInvoiceDraft(body)

      const { lines, totals } = computeInvoiceTotals(body.lineItems)
      const invoice = {
        _id: objectId(),
        // A draft carries no number: the sequence is only burned on issue.
        invoiceNumber: null,
        status: INVOICE_STATUS.DRAFT,
        customer: body.customer,
        vehicle: body.vehicle,
        lineItems: lines,
        totals,
        payment: { channel: null, status: PAYMENT_STATUS.UNPAID, gateway: null, events: [] },
        appointmentId: body.appointmentId ?? null,
        quoteId: body.quoteId ?? null,
        issuedAt: null,
        notes: body.notes ?? '',
        createdBy: session.user._id,
        createdAt: new Date().toISOString(),
      }

      db.invoices.unshift(invoice)
      return invoice
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/invoices\/([^/]+)$/,
    handle: ({ params }) => {
      requireSession()
      return findInvoice(params[0])
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/invoices\/([^/]+)\/issue$/,
    handle: ({ params }) => {
      requireSession()
      const invoice = findInvoice(params[0])
      if (invoice.status !== INVOICE_STATUS.DRAFT) {
        fail(409, 'ניתן להנפיק רק חשבונית בסטטוס טיוטה')
      }

      invoiceSequence += 1
      invoice.invoiceNumber = `2026-${String(invoiceSequence).padStart(4, '0')}`
      invoice.status = INVOICE_STATUS.ISSUED
      invoice.issuedAt = new Date().toISOString()

      logActivity({
        type: 'invoice_issued',
        title: `חשבונית ${invoice.invoiceNumber} הונפקה`,
        detail: `${invoice.customer.name} · ${invoice.totals.grandTotal} ₪`,
        icon: 'receipt_long',
        tone: 'secondary',
      })
      return invoice
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/invoices\/([^/]+)\/void$/,
    handle: ({ params, body }) => {
      requireSession()
      const invoice = findInvoice(params[0])
      if (invoice.status === INVOICE_STATUS.PAID) {
        fail(409, 'חשבונית ששולמה מבוטלת בזיכוי ולא בביטול ישיר')
      }
      invoice.status = INVOICE_STATUS.VOID
      invoice.notes = body?.reason ? `בוטלה: ${body.reason}` : invoice.notes
      return invoice
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/invoices\/([^/]+)\/settle-offline$/,
    handle: ({ params, body }) => {
      requireSession()
      const invoice = findInvoice(params[0])
      if (invoice.status !== INVOICE_STATUS.ISSUED) {
        fail(409, 'ניתן לסמן כשולם רק חשבונית שהונפקה')
      }
      if (![PAYMENT_CHANNELS.CASH, PAYMENT_CHANNELS.BANK_TRANSFER].includes(body?.channel)) {
        fail(422, 'אמצעי תשלום לא נתמך לסליקה ידנית')
      }

      invoice.payment.channel = body.channel
      invoice.payment.status = PAYMENT_STATUS.CAPTURED
      invoice.payment.capturedAt = new Date().toISOString()
      invoice.totals.amountPaid = invoice.totals.grandTotal
      invoice.totals.amountDue = 0
      invoice.status = INVOICE_STATUS.PAID
      recordPaymentEvent(invoice, {
        action: 'captured',
        channel: body.channel,
        amount: invoice.totals.grandTotal,
        message: body.reference ? `אסמכתא ${body.reference}` : 'תשלום ידני',
      })

      logActivity({
        type: 'invoice_paid',
        title: `חשבונית ${invoice.invoiceNumber} שולמה`,
        detail: body.channel === PAYMENT_CHANNELS.CASH ? 'מזומן' : 'העברה בנקאית',
        icon: 'payments',
        tone: 'primary',
      })
      return invoice
    },
  },

  /* ---- admin payment intents ---- */
  /**
   * The amount comes from the stored invoice, never from the request body, so
   * the client cannot negotiate what it is about to be charged.
   */
  {
    method: 'POST',
    pattern: /^\/admin\/invoices\/([^/]+)\/payment-intent$/,
    handle: ({ params, body }) => {
      requireSession()
      const invoice = findInvoice(params[0])
      if (invoice.status !== INVOICE_STATUS.ISSUED) {
        fail(409, 'ניתן לחייב רק חשבונית שהונפקה')
      }
      if (invoice.totals.amountDue <= 0) fail(409, 'החשבונית שולמה במלואה')

      const intent = {
        _id: `pi_mock_${Math.random().toString(36).slice(2, 10)}`,
        invoiceId: invoice._id,
        channel: body?.channel ?? null,
        amount: invoice.totals.amountDue,
        currency: 'ILS',
        status:
          body?.channel === PAYMENT_CHANNELS.CARD_TERMINAL
            ? PAYMENT_STATUS.REQUIRES_TERMINAL
            : PAYMENT_STATUS.REQUIRES_METHOD,
        card: null,
        terminalId: null,
        createdAt: new Date().toISOString(),
      }

      db.paymentIntents.push(intent)
      invoice.payment.intentId = intent._id
      invoice.payment.channel = intent.channel
      invoice.payment.status = intent.status
      recordPaymentEvent(invoice, {
        action: 'intent_created',
        channel: intent.channel,
        amount: intent.amount,
      })

      return intent
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/payment-intents\/([^/]+)\/authorize$/,
    handle: ({ params, body }) => {
      requireSession()
      const intent = findIntent(params[0])
      const invoice = findInvoice(intent.invoiceId)

      if (![PAYMENT_STATUS.REQUIRES_METHOD, PAYMENT_STATUS.REQUIRES_TERMINAL].includes(intent.status)) {
        fail(409, 'בקשת התשלום כבר טופלה')
      }

      if (body?.channel === PAYMENT_CHANNELS.CARD_TERMINAL) {
        if (!body?.terminalId) fail(422, 'יש לבחור מסוף')
        intent.terminalId = body.terminalId
        intent.gateway = 'local_terminal'
        // A real reader answers asynchronously; the client re-reads the intent.
        intent.card = { brand: null, last4: '••••', expMonth: null, expYear: null }
      } else {
        const token = String(body?.token ?? '')
        if (!token.startsWith('tok_')) fail(422, 'טוקן תשלום לא תקין', { code: 'invalid_token' })
        intent.gateway = 'tranzila'
        // Only the non-sensitive artefacts survive: derived from the token, and
        // there is nowhere here a full card number could be written.
        intent.card = { brand: null, last4: token.split('_')[2] ?? '••••', token }
      }

      intent.status = PAYMENT_STATUS.AUTHORIZED
      intent.authorizedAt = new Date().toISOString()

      invoice.payment.status = PAYMENT_STATUS.AUTHORIZED
      invoice.payment.gateway = intent.gateway
      invoice.payment.terminalId = intent.terminalId
      invoice.payment.card = intent.card
      invoice.payment.authorizedAt = intent.authorizedAt
      recordPaymentEvent(invoice, {
        action: 'authorized',
        channel: intent.channel,
        amount: intent.amount,
        gatewayCode: 'approved',
      })

      return intent
    },
  },
  {
    method: 'POST',
    pattern: /^\/admin\/payment-intents\/([^/]+)\/capture$/,
    handle: ({ params }) => {
      requireSession()
      const intent = findIntent(params[0])
      const invoice = findInvoice(intent.invoiceId)

      if (intent.status !== PAYMENT_STATUS.AUTHORIZED) {
        fail(409, 'ניתן לחייב רק בקשה שאושרה')
      }

      intent.status = PAYMENT_STATUS.CAPTURED
      intent.capturedAt = new Date().toISOString()

      invoice.payment.status = PAYMENT_STATUS.CAPTURED
      invoice.payment.capturedAt = intent.capturedAt
      invoice.totals.amountPaid = invoice.totals.grandTotal
      invoice.totals.amountDue = 0
      invoice.status = INVOICE_STATUS.PAID
      recordPaymentEvent(invoice, {
        action: 'captured',
        channel: intent.channel,
        amount: intent.amount,
      })

      logActivity({
        type: 'invoice_paid',
        title: `חשבונית ${invoice.invoiceNumber} שולמה`,
        detail: `${invoice.totals.grandTotal} ₪ · ${
          intent.channel === PAYMENT_CHANNELS.CARD_TERMINAL ? 'מסוף פיזי' : 'אשראי מקוון'
        }`,
        icon: 'credit_score',
        tone: 'primary',
      })

      // The invoice, not the intent, is what the UI renders next.
      return invoice
    },
  },
  {
    method: 'GET',
    pattern: /^\/admin\/payment-intents\/([^/]+)$/,
    handle: ({ params }) => {
      requireSession()
      return findIntent(params[0])
    },
  },

  /* ---- admin quotes ---- */
  {
    method: 'GET',
    pattern: /^\/admin\/quotes$/,
    handle: ({ query }) => {
      requireSession()
      return db.quotes
        .filter((quote) => !query.status || quote.status === query.status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/admin\/quotes\/([^/]+)\/approve$/,
    handle: ({ params, body }) => {
      requireSession()
      const quote = db.quotes.find((candidate) => candidate._id === params[0])
      if (!quote) fail(404, 'הצעת המחיר לא נמצאה')
      if (quote.status !== QUOTE_STATUS.PENDING) {
        fail(409, 'ניתן לאשר רק הצעה שממתינה לאישור')
      }
      quote.status = QUOTE_STATUS.APPROVED
      quote.decisionNote = body?.note ?? ''
      quote.decidedAt = new Date().toISOString()
      logActivity({
        type: 'quote_approved',
        title: `הצעת מחיר ${quote.reference} אושרה`,
        detail: quote.customerName,
        icon: 'check_circle',
        tone: 'primary',
      })
      return quote
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/admin\/quotes\/([^/]+)\/reject$/,
    handle: ({ params, body }) => {
      requireSession()
      const quote = db.quotes.find((candidate) => candidate._id === params[0])
      if (!quote) fail(404, 'הצעת המחיר לא נמצאה')
      if (quote.status !== QUOTE_STATUS.PENDING) {
        fail(409, 'ניתן לדחות רק הצעה שממתינה לאישור')
      }
      quote.status = QUOTE_STATUS.REJECTED
      quote.decisionNote = body?.reason ?? ''
      quote.decidedAt = new Date().toISOString()
      logActivity({
        type: 'quote_rejected',
        title: `הצעת מחיר ${quote.reference} נדחתה`,
        detail: body?.reason || 'ללא סיבה',
        icon: 'cancel',
        tone: 'error',
      })
      return quote
    },
  },
]

/**
 * Entry point used by `httpClient`. Mirrors `fetch` semantics: resolves with the
 * parsed `data` payload, rejects with an `ApiError`.
 */
export async function mockTransport({ method, path, query = {}, body, signal }) {
  await delay(randomLatency(), signal)

  const route = routes.find(
    (candidate) => candidate.method === method && candidate.pattern.test(path),
  )
  if (!route) {
    throw new ApiError(`אין נתיב מדומה עבור ${method} ${path}`, {
      status: 404,
      code: 'mock_route_missing',
    })
  }

  const params = path.match(route.pattern).slice(1).map(decodeURIComponent)
  // Awaited because the vehicle routes reach through to the real backend.
  // structuredClone keeps callers from mutating the "database" by reference.
  return structuredClone(await route.handle({ params, query, body }))
}

/** Test/story helper: reset mutable state between scenarios. */
export function __resetMockDb() {
  db.tires = structuredClone(fixtures.tires)
  db.inventory = structuredClone(fixtures.inventory)
  db.appointments = structuredClone(fixtures.appointments)
  db.quotes = structuredClone(fixtures.quotes)
  db.invoices = structuredClone(fixtures.invoices)
  db.paymentIntents = []
  db.activity = []
  session = null
  invoiceSequence = 313
}
