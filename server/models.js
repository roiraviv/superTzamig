/**
 * Reference Mongoose schemas for the Node.js/MongoDB service.
 *
 * This file is the contract the frontend is written against — `services/api.js`
 * and `services/invoiceService.js` normalize exactly these documents, and
 * `services/mock/fixtures.js` seeds exactly these shapes. It is not imported by
 * the Vite app; it lives here so the wire format has one source of truth.
 */

import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

/* ==========================================================================
 * VehicleTireSpecs — cached fitment data from the Ministry of Transport
 * ========================================================================== */

/**
 * A single legally approved wheel/tire combination.
 *
 * `position` matters because staggered setups (common on performance cars) run
 * a different size front and rear, and quoting one size for all four wheels on
 * such a car produces an illegal fitment.
 */
const ApprovedSizeSchema = new Schema(
  {
    position: { type: String, enum: ['all', 'front', 'rear'], default: 'all' },
    /** Canonical form, e.g. "225/45R18". Normalized on write so lookups match. */
    size: { type: String, required: true, uppercase: true, trim: true },
    width: { type: Number, required: true },
    aspectRatio: { type: Number, required: true },
    rimDiameter: { type: Number, required: true },
    loadIndex: { type: Number, min: 60, max: 130 },
    speedRating: { type: String, maxlength: 3, uppercase: true },
    /** Factory-fitted size. Surfaced first in the UI as the safe default. */
    isOem: { type: Boolean, default: false },
    /**
     * No per-size pressure field here on purpose. The Ministry of Transport
     * publishes tire *sizes* and a TPMS flag, and nothing else about inflation
     * — see `lib/tirePressure.js` for the field-level survey. A column that can
     * only ever hold a guess is worse than no column, because the next person
     * to read this schema will assume it holds a manufacturer figure.
     */
  },
  { _id: false },
)

/**
 * What we can honestly say about inflation pressure.
 *
 * Split in two because the halves have different provenance and must not be
 * rendered with the same authority: `tpms` is registry data about this model,
 * `guidance` is a class-typical range that is true of most vehicles and
 * specific to none.
 */
const TirePressureSchema = new Schema(
  {
    tpms: {
      /** `null` when the model rows are absent or disagree across trims. */
      equipped: { type: Boolean, default: null },
      source: { type: String, enum: ['ministry_of_transport'], default: 'ministry_of_transport' },
    },
    guidance: {
      barMin: { type: Number, min: 1.5, max: 5 },
      barMax: { type: Number, min: 1.5, max: 5 },
      psiMin: { type: Number, min: 20, max: 75 },
      psiMax: { type: Number, min: 20, max: 75 },
      vehicleClass: { type: String },
      /** Always false. Persisted so a stale document cannot lose the caveat. */
      vehicleSpecific: { type: Boolean, default: false },
      source: { type: String, enum: ['general_guidance'], default: 'general_guidance' },
    },
  },
  { _id: false },
)

const VehicleTireSpecsSchema = new Schema(
  {
    /**
     * Digits only, no separators. Unique because this collection is a cache
     * keyed by plate: one document per vehicle, refreshed rather than appended.
     *
     * A plate is personal data under Israeli privacy law. It is indexed for
     * lookup but must be redacted from application logs, and the collection
     * carries a retention TTL rather than being kept indefinitely.
     */
    licensePlate: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\d{5,8}$/,
    },
    vehicle: {
      make: { type: String, required: true, trim: true, maxlength: 40 },
      model: { type: String, required: true, trim: true, maxlength: 60 },
      trim: { type: String, trim: true, maxlength: 40 },
      year: { type: Number, required: true, min: 1970 },
      vehicleClass: {
        type: String,
        enum: ['passenger', 'suv', 'commercial', 'performance'],
        default: 'passenger',
      },
      /** Drives the alignment upsell: heavier cars wear shoulders faster. */
      curbWeightKg: { type: Number, min: 500, max: 5000 },
    },
    approvedSizes: {
      type: [ApprovedSizeSchema],
      required: true,
      validate: {
        validator: (sizes) => sizes.length > 0,
        message: 'A vehicle must have at least one approved size',
      },
    },
    tirePressure: { type: TirePressureSchema },
    source: {
      type: String,
      /**
       * `fallback_reference` is what the aggregator emits when the registry
       * knows the vehicle but carries no sizes for it. Omitting it here would
       * make every fallback result fail validation on write — silently, since a
       * cache write is deliberately not allowed to fail the request.
       */
      enum: ['ministry_of_transport', 'fallback_reference', 'manufacturer', 'manual'],
      required: true,
    },
    /**
     * False when the sizes came from the reference table rather than the
     * registry. Persisted because the UI's disclaimer keys off it, and a
     * cached document that lost the flag would present unverified sizes with
     * full authority.
     */
    verified: { type: Boolean, default: true },
    fetchedAt: { type: Date, required: true, default: Date.now },
    /**
     * Cache expiry. The registry is authoritative and changes when a vehicle is
     * modified or re-registered, so a hit older than this is refetched.
     * `expires: 0` lets MongoDB drop the document itself once the date passes,
     * which doubles as the privacy retention policy.
     */
    ttlExpiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: 'vehicle_tire_specs' },
)

/* ==========================================================================
 * Invoice — the financial record
 * ========================================================================== */

const InvoiceLineItemSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ['tire', 'service', 'part', 'labor', 'custom'],
      required: true,
    },
    /** Points at the Tire/InventoryItem it was billed from, when there is one. */
    refId: { type: Schema.Types.ObjectId, refPath: 'lineItems.refModel' },
    refModel: { type: String, enum: ['Tire', 'InventoryItem', null], default: null },
    sku: { type: String, trim: true, maxlength: 40 },
    /**
     * Copied, not referenced. A tire renamed or repriced next year must not
     * retroactively alter an invoice that was already issued.
     */
    description: { type: String, required: true, trim: true, maxlength: 160 },
    quantity: { type: Number, required: true, min: 1, max: 999 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    /** Frozen per line: an exempt line and a VAT line can share one invoice. */
    taxRate: { type: Number, required: true, min: 0, max: 1 },
    lineSubtotal: { type: Number, required: true, min: 0 },
    lineTax: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true },
)

/**
 * Append-only audit trail. Every state transition of the intent is recorded
 * with who triggered it and what the gateway answered, which is what makes a
 * disputed charge reconstructible months later.
 */
const PaymentEventSchema = new Schema(
  {
    at: { type: Date, required: true, default: Date.now },
    action: {
      type: String,
      enum: ['intent_created', 'authorized', 'captured', 'failed', 'refunded', 'voided'],
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    channel: {
      type: String,
      enum: ['card_online', 'card_terminal', 'cash', 'bank_transfer'],
    },
    gatewayCode: { type: String, maxlength: 40 },
    amount: { type: Number, min: 0 },
    /** Operator-safe text only. Raw gateway payloads stay in the secure log. */
    message: { type: String, maxlength: 300 },
  },
  { _id: false },
)

const PaymentSchema = new Schema(
  {
    channel: {
      type: String,
      enum: ['card_online', 'card_terminal', 'cash', 'bank_transfer'],
      default: null,
    },
    status: {
      type: String,
      enum: [
        'unpaid',
        'requires_payment_method',
        'requires_terminal',
        'authorized',
        'captured',
        'failed',
        'refunded',
      ],
      default: 'unpaid',
      index: true,
    },
    gateway: { type: String, enum: ['tranzila', 'stripe', 'local_terminal', null], default: null },
    /**
     * The gateway's intent id. Authorization and capture are two calls against
     * this one id, which is what lets the garage authorize on the web today and
     * authorize on a counter-top reader tomorrow without a schema change.
     */
    intentId: { type: String, index: true, sparse: true, maxlength: 80 },
    /** Set only for `card_terminal`: which physical reader handled the swipe. */
    terminalId: { type: String, maxlength: 40 },

    /**
     * PCI-DSS scope boundary.
     *
     * The PAN and CVV never arrive here. The browser posts the card straight to
     * the gateway's tokenization endpoint (a different origin from this API) and
     * sends us only the token plus these non-sensitive display artefacts. There
     * is deliberately no field a full card number could be written into.
     */
    card: {
      brand: { type: String, enum: ['visa', 'mastercard', 'amex', 'diners', 'discover', null] },
      last4: { type: String, match: /^\d{4}$/ },
      expMonth: { type: Number, min: 1, max: 12 },
      expYear: { type: Number, min: 2000 },
      /** Gateway-scoped, single-merchant token. Useless if exfiltrated. */
      token: { type: String, maxlength: 120 },
    },

    authorizedAt: { type: Date },
    capturedAt: { type: Date },
    events: { type: [PaymentEventSchema], default: [] },
  },
  { _id: false },
)

const InvoiceSchema = new Schema(
  {
    /**
     * Sequential and gapless per tax year — a legal requirement, so it is
     * allocated by an atomic counter document rather than a random id, and it
     * is immutable once set.
     */
    invoiceNumber: { type: String, required: true, unique: true, immutable: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'issued', 'paid', 'refunded', 'void'],
      default: 'draft',
      index: true,
    },

    customer: {
      name: { type: String, required: true, trim: true, maxlength: 80 },
      phone: { type: String, required: true, match: /^0\d{8,9}$/ },
      email: { type: String, lowercase: true, trim: true, maxlength: 120 },
      /** ח.פ / ת.ז — required for a business to deduct the VAT. */
      taxId: { type: String, match: /^\d{9}$/ },
    },

    vehicle: {
      licensePlate: { type: String, match: /^\d{5,8}$/, index: true },
      make: { type: String, trim: true, maxlength: 40 },
      model: { type: String, trim: true, maxlength: 60 },
      year: { type: Number, min: 1970 },
      odometerKm: { type: Number, min: 0, max: 2000000 },
    },

    lineItems: {
      type: [InvoiceLineItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0 && items.length <= 40,
        message: 'An invoice needs between 1 and 40 line items',
      },
    },

    /**
     * Stored rather than derived. VAT rates change by legislation, and a query
     * for "revenue this quarter" must not have to replay pricing rules to get
     * an answer it can index and sum.
     */
    totals: {
      subtotal: { type: Number, required: true, min: 0 },
      discountTotal: { type: Number, required: true, default: 0, min: 0 },
      taxTotal: { type: Number, required: true, min: 0 },
      grandTotal: { type: Number, required: true, min: 0 },
      amountPaid: { type: Number, required: true, default: 0, min: 0 },
      amountDue: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'ILS', enum: ['ILS'] },
    },

    payment: { type: PaymentSchema, default: () => ({}) },

    /** Provenance, so a charge can be traced back to what was agreed. */
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', index: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', index: true },

    issuedAt: { type: Date },
    dueAt: { type: Date },
    notes: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true },
  },
  { timestamps: true, collection: 'invoices' },
)

/** Powers the billing list: newest first, filtered by status. */
InvoiceSchema.index({ status: 1, createdAt: -1 })
InvoiceSchema.index({ 'customer.phone': 1, createdAt: -1 })

/**
 * Totals are recomputed from the line items on every save, so a tampered
 * client payload cannot dictate what gets charged. The client's numbers are
 * only ever used to render a preview.
 */
InvoiceSchema.pre('validate', function recomputeTotals(next) {
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0

  for (const line of this.lineItems ?? []) {
    const gross = line.unitPrice * line.quantity
    const discount = Math.round(gross * (line.discountPercent / 100))
    const net = gross - discount

    line.lineSubtotal = net
    line.lineTax = Math.round(net * line.taxRate)
    line.lineTotal = net + line.lineTax

    subtotal += gross
    discountTotal += discount
    taxTotal += line.lineTax
  }

  this.totals.subtotal = subtotal
  this.totals.discountTotal = discountTotal
  this.totals.taxTotal = taxTotal
  this.totals.grandTotal = subtotal - discountTotal + taxTotal
  this.totals.amountDue = Math.max(0, this.totals.grandTotal - this.totals.amountPaid)

  next()
})

/**
 * An issued invoice is a financial record, not a mutable row. Corrections are
 * made by voiding it and issuing a credit note, which keeps the numbering
 * sequence auditable.
 */
InvoiceSchema.pre('save', function guardIssuedInvoice(next) {
  if (this.isNew || this.status === 'draft') return next()

  const financialPaths = ['lineItems', 'totals', 'customer', 'invoiceNumber']
  const mutated = financialPaths.filter((path) => this.isModified(path))
  if (mutated.length > 0) {
    return next(new Error(`Cannot modify ${mutated.join(', ')} on an issued invoice`))
  }
  return next()
})

/* ==========================================================================
 * Counter — gapless invoice numbering
 * ========================================================================== */

const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { collection: 'counters' },
)

/**
 * findOneAndUpdate with $inc is atomic, so two cashiers issuing at the same
 * moment cannot receive the same invoice number.
 */
CounterSchema.statics.next = async function nextSequence(key) {
  const counter = await this.findOneAndUpdate(
    { _id: key },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true },
  )
  return counter.sequence
}

/* ========================================================================== */

export const VehicleTireSpecs =
  models.VehicleTireSpecs ?? model('VehicleTireSpecs', VehicleTireSpecsSchema)
export const Invoice = models.Invoice ?? model('Invoice', InvoiceSchema)
export const Counter = models.Counter ?? model('Counter', CounterSchema)
