import { ApiError } from './http/ApiError'
import { http } from './http/httpClient'
import { clampPagination, listWithIds, withId } from './http/normalize'
import {
  INVOICE_LINE_KINDS,
  MAX_INVOICE_LINES,
  MAX_LINE_QUANTITY,
  PAYMENT_CHANNELS,
} from '../lib/constants'
import { detectCardBrand, parseCardExpiry, sanitizeDigits, sanitizeText } from '../lib/validation'

/**
 * Billing boundary between React and the Node.js/MongoDB service.
 *
 * Two rules shape this file:
 *
 * 1. **Money is server-authoritative.** Every amount the UI shows is a preview.
 *    The invoice is priced from its line items inside MongoDB, and the charge
 *    uses that number, so a tampered payload can change what is billed *for*
 *    but never how much.
 *
 * 2. **Intent is separate from capture.** `createPaymentIntent` reserves an
 *    amount, an authorize call approves it, and `capturePayment` settles it.
 *    Authorization is the only step that knows which channel was used, which is
 *    what lets a counter-top card reader replace the web gateway later without
 *    touching the invoice, the intent, or this file's callers.
 */

const ALLOWED_LINE_KINDS = new Set(Object.values(INVOICE_LINE_KINDS))

/**
 * Whitelists a draft line into the exact shape the backend accepts.
 *
 * Note what is absent: no `lineTotal`, no `lineTax`. Sending computed totals
 * would invite a client that quietly bills a 4,000₪ tire set as 40₪.
 */
function serializeLineItem(line = {}) {
  const kind = ALLOWED_LINE_KINDS.has(line.kind) ? line.kind : INVOICE_LINE_KINDS.CUSTOM

  return {
    kind,
    refId: line.refId ?? null,
    sku: sanitizeText(line.sku, 40).toUpperCase(),
    description: sanitizeText(line.description, 160),
    quantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(Number(line.quantity) || 1))),
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
    discountPercent: Math.max(0, Math.min(100, Number(line.discountPercent) || 0)),
  }
}

function serializeInvoiceDraft(draft = {}) {
  return {
    customer: {
      name: sanitizeText(draft.customer?.name, 80),
      phone: sanitizeDigits(draft.customer?.phone, 10),
      email: sanitizeText(draft.customer?.email, 120).toLowerCase(),
      taxId: sanitizeDigits(draft.customer?.taxId, 9),
    },
    vehicle: {
      licensePlate: sanitizeDigits(draft.vehicle?.licensePlate, 8),
      make: sanitizeText(draft.vehicle?.make, 40),
      model: sanitizeText(draft.vehicle?.model, 60),
      year: Number(draft.vehicle?.year) || null,
      odometerKm: Math.max(0, Math.floor(Number(draft.vehicle?.odometerKm) || 0)) || null,
    },
    lineItems: (draft.lineItems ?? []).slice(0, MAX_INVOICE_LINES).map(serializeLineItem),
    appointmentId: draft.appointmentId ?? null,
    quoteId: draft.quoteId ?? null,
    notes: sanitizeText(draft.notes, 500),
  }
}

/* ------------------------------- Invoices -------------------------------- */

export const invoicesApi = {
  async list({ status, search, page, pageSize } = {}, { signal } = {}) {
    const pagination = clampPagination({ page, pageSize: pageSize ?? 20 })
    const result = await http.get('/admin/invoices', {
      signal,
      query: { status, search: sanitizeText(search, 80), ...pagination },
    })
    return { ...result, items: listWithIds(result.items) }
  },

  async get(id, { signal } = {}) {
    return withId(await http.get(`/admin/invoices/${encodeURIComponent(id)}`, { signal }))
  },

  /**
   * Prices a draft without persisting it. Used to show authoritative totals
   * before the operator commits, so the number on screen at the moment of
   * issuing is the number the server will stand behind.
   */
  previewTotals(draft, { signal } = {}) {
    return http.post(
      '/admin/invoices/preview',
      { lineItems: serializeInvoiceDraft(draft).lineItems },
      { signal },
    )
  },

  /** Creates the invoice as a `draft`; nothing is charged and no number is burned. */
  async createDraft(draft, { signal } = {}) {
    return withId(await http.post('/admin/invoices', serializeInvoiceDraft(draft), { signal }))
  },

  /**
   * Allocates the sequential invoice number and freezes the document. After
   * this, line items and totals are immutable — a correction means voiding and
   * issuing a credit note, which is what keeps the numbering auditable.
   */
  async issue(id, { signal } = {}) {
    return withId(
      await http.post(`/admin/invoices/${encodeURIComponent(id)}/issue`, {}, { signal }),
    )
  },

  async void(id, { reason } = {}, { signal } = {}) {
    return withId(
      await http.post(
        `/admin/invoices/${encodeURIComponent(id)}/void`,
        { reason: sanitizeText(reason, 300) },
        { signal },
      ),
    )
  },
}

/* -------------------------- Gateway tokenization -------------------------- */

/**
 * Exchanges a card for a single-use token.
 *
 * This is the one call in the app that touches a card number, and it does not
 * go to our API — `GATEWAY_TOKENIZE_URL` is the gateway's own origin, so the
 * PAN never enters a system we operate and our servers stay outside PCI-DSS
 * scope. In production this function is replaced entirely by the gateway's
 * hosted fields (Stripe Elements / Tranzila iframe), where the input element
 * itself lives in a cross-origin frame and our JavaScript cannot read it.
 *
 * Callers must discard the card object immediately after this resolves.
 *
 * @param {{ cardNumber: string, expiry: string, cvv: string, holderName: string }} card
 * @returns {Promise<{ token: string, brand: string, last4: string,
 *                     expMonth: number, expYear: number }>}
 */
export async function tokenizeCard(card, { signal } = {}) {
  const digits = sanitizeDigits(card?.cardNumber, 19)
  const expiry = parseCardExpiry(card?.expiry)
  const brand = detectCardBrand(digits)

  if (!expiry || expiry.expired) {
    throw new ApiError('תוקף הכרטיס אינו תקין', {
      status: 422,
      code: 'card_expired',
      fieldErrors: { expiry: 'הכרטיס פג תוקף' },
    })
  }

  const result = await http.post(
    '/gateway/tokens',
    {
      // Field names mirror the gateway's contract, not ours.
      number: digits,
      cvv: sanitizeDigits(card?.cvv, 4),
      exp_month: expiry.month,
      exp_year: expiry.year,
      holder_name: sanitizeText(card?.holderName, 60),
    },
    { signal },
  )

  return {
    token: result.token,
    brand: brand?.id ?? null,
    last4: digits.slice(-4),
    expMonth: expiry.month,
    expYear: expiry.year,
  }
}

/* -------------------------------- Payments ------------------------------- */

export const paymentsApi = {
  /**
   * Step 1 — reserve an amount against the invoice.
   *
   * The amount is not a parameter: the server reads `totals.amountDue` from the
   * stored invoice. Passing it from the client would make the price negotiable
   * by anyone with devtools.
   */
  async createIntent(invoiceId, { channel } = {}, { signal } = {}) {
    if (!Object.values(PAYMENT_CHANNELS).includes(channel)) {
      throw new ApiError('אמצעי תשלום לא נתמך', { status: 422, code: 'unsupported_channel' })
    }
    return withId(
      await http.post(
        `/admin/invoices/${encodeURIComponent(invoiceId)}/payment-intent`,
        { channel },
        { signal },
      ),
    )
  },

  /**
   * Step 2a — authorize through the web gateway.
   *
   * Receives a token, never a card. There is no parameter here that a PAN
   * could be passed through.
   */
  async authorizeOnline(intentId, { token }, { signal } = {}) {
    return withId(
      await http.post(
        `/admin/payment-intents/${encodeURIComponent(intentId)}/authorize`,
        { channel: PAYMENT_CHANNELS.CARD_ONLINE, token: sanitizeText(token, 120) },
        { signal },
      ),
    )
  },

  /**
   * Step 2b — hand the same intent to a physical card reader.
   *
   * The future POS integration lands here and nowhere else: the invoice, the
   * intent, and `capture` below are all unchanged, because the channel is the
   * only thing that differs. The mocked backend simulates the swipe; a real
   * deployment returns `requires_terminal` and completes over a webhook, which
   * is why callers must re-read the intent rather than assume this resolved it.
   */
  async authorizeOnTerminal(intentId, { terminalId }, { signal } = {}) {
    return withId(
      await http.post(
        `/admin/payment-intents/${encodeURIComponent(intentId)}/authorize`,
        {
          channel: PAYMENT_CHANNELS.CARD_TERMINAL,
          terminalId: sanitizeText(terminalId, 40),
        },
        { signal },
      ),
    )
  },

  /** Step 3 — settle an authorized intent and mark the invoice paid. */
  async capture(intentId, { signal } = {}) {
    return withId(
      await http.post(
        `/admin/payment-intents/${encodeURIComponent(intentId)}/capture`,
        {},
        { signal },
      ),
    )
  },

  /** Records a non-card settlement. No gateway is involved. */
  async settleOffline(invoiceId, { channel, reference } = {}, { signal } = {}) {
    return withId(
      await http.post(
        `/admin/invoices/${encodeURIComponent(invoiceId)}/settle-offline`,
        { channel, reference: sanitizeText(reference, 60) },
        { signal },
      ),
    )
  },

  /** Polling target for the terminal flow and for recovering an interrupted tab. */
  async getIntent(intentId, { signal } = {}) {
    return withId(
      await http.get(`/admin/payment-intents/${encodeURIComponent(intentId)}`, { signal }),
    )
  },
}

/**
 * One-shot orchestration of the happy path, so the UI does not have to encode
 * the state machine. Every branch returns the updated invoice.
 *
 * @param {object} params
 * @param {string} params.invoiceId
 * @param {string} params.channel
 * @param {object} [params.card]        Required for `card_online`, discarded immediately.
 * @param {string} [params.terminalId]  Required for `card_terminal`.
 */
export async function chargeInvoice(
  { invoiceId, channel, card, terminalId, reference },
  { signal } = {},
) {
  if (channel === PAYMENT_CHANNELS.CASH || channel === PAYMENT_CHANNELS.BANK_TRANSFER) {
    return paymentsApi.settleOffline(invoiceId, { channel, reference }, { signal })
  }

  const intent = await paymentsApi.createIntent(invoiceId, { channel }, { signal })

  let authorized
  if (channel === PAYMENT_CHANNELS.CARD_TERMINAL) {
    authorized = await paymentsApi.authorizeOnTerminal(intent.id, { terminalId }, { signal })
  } else {
    // The token is the only artefact that survives this block.
    const { token } = await tokenizeCard(card, { signal })
    authorized = await paymentsApi.authorizeOnline(intent.id, { token }, { signal })
  }

  return paymentsApi.capture(authorized.id, { signal })
}
