import { INVOICE_LINE_KINDS, MAX_LINE_QUANTITY, VAT_RATE } from './constants'

/**
 * Invoice arithmetic, kept pure and dependency-free.
 *
 * The backend runs the same rules in `Invoice.pre('validate')` and its answer
 * is the one that gets charged. This copy exists only so the operator sees
 * totals update as they type instead of after a round trip — never trust it as
 * the amount due.
 *
 * Everything is computed in whole agorot-free shekels: the garage prices in
 * round shekels, and rounding once per line (rather than once at the end)
 * matches how the tax authority expects a line-itemized invoice to add up.
 */

const clampQuantity = (value) =>
  Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(Number(value) || 1)))

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0))

const toAmount = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

/** @returns {{ lineSubtotal: number, lineTax: number, lineTotal: number, discount: number }} */
export function calculateLine(line) {
  const quantity = clampQuantity(line?.quantity)
  const unitPrice = toAmount(line?.unitPrice)
  const taxRate = Number.isFinite(Number(line?.taxRate)) ? Number(line.taxRate) : VAT_RATE

  const gross = unitPrice * quantity
  const discount = Math.round(gross * (clampPercent(line?.discountPercent) / 100))
  const lineSubtotal = gross - discount
  const lineTax = Math.round(lineSubtotal * taxRate)

  return { gross, discount, lineSubtotal, lineTax, lineTotal: lineSubtotal + lineTax }
}

/**
 * @param {Array} lineItems
 * @param {{ amountPaid?: number }} [options]
 */
export function calculateInvoiceTotals(lineItems = [], { amountPaid = 0 } = {}) {
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0

  const lines = lineItems.map((line) => {
    const computed = calculateLine(line)
    subtotal += computed.gross
    discountTotal += computed.discount
    taxTotal += computed.lineTax
    return { ...line, ...computed }
  })

  const grandTotal = subtotal - discountTotal + taxTotal
  const paid = Math.max(0, Math.min(grandTotal, toAmount(amountPaid)))

  return {
    lines,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    amountPaid: paid,
    amountDue: grandTotal - paid,
    currency: 'ILS',
  }
}

let lineCounter = 0

/**
 * Draft lines need a stable key before the server assigns an `_id`, otherwise
 * React remounts every input on each keystroke and focus jumps.
 */
export function createInvoiceLine(overrides = {}) {
  lineCounter += 1
  return {
    localId: `line-${lineCounter}`,
    kind: INVOICE_LINE_KINDS.CUSTOM,
    refId: null,
    sku: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    taxRate: VAT_RATE,
    ...overrides,
  }
}

/** Builds a billable line from a catalog tire, copying the price at bill time. */
export function invoiceLineFromTire(tire, quantity = 4) {
  return createInvoiceLine({
    kind: INVOICE_LINE_KINDS.TIRE,
    refId: tire.id,
    sku: tire.sku ?? '',
    description: `${tire.brand} ${tire.model} · ${tire.size}`,
    quantity,
    unitPrice: tire.price,
  })
}

/** Builds a billable line from a `SERVICE_TYPES` entry. */
export function invoiceLineFromService(service, quantity = 1) {
  return createInvoiceLine({
    kind: INVOICE_LINE_KINDS.SERVICE,
    refId: null,
    sku: service.id,
    description: service.label,
    quantity,
    unitPrice: service.basePrice,
  })
}
