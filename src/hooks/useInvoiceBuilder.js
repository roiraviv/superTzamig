import { useCallback, useMemo, useReducer } from 'react'
import { chargeInvoice, invoicesApi } from '../services/invoiceService'
import { calculateInvoiceTotals, createInvoiceLine } from '../lib/billing'
import { INVOICE_STATUS, PAYMENT_CHANNELS } from '../lib/constants'
import { invoiceCustomerSchema, validateSchema } from '../lib/validation'
import { useAsyncAction } from './useAsyncData'

/**
 * State for building one invoice and taking payment for it.
 *
 * A reducer, for the same reason the booking wizard uses one: the draft is a
 * single tree with a small closed set of transitions, and "is this billable?" is
 * a pure function of the draft rather than something spread across effects.
 *
 * The three phases are deliberately separate pieces of state:
 *
 *   draft  → `createDraft` → `issued` invoice (number allocated, totals frozen)
 *          → `chargeInvoice` → `paid`
 *
 * Once issued, `issuedInvoice` becomes the source of truth and the local draft
 * is no longer editable, which mirrors the immutability the backend enforces.
 */

function createInitialState() {
  return {
    customer: { name: '', phone: '', email: '', taxId: '' },
    vehicle: { licensePlate: '', make: '', model: '', year: '', odometerKm: '' },
    lineItems: [createInvoiceLine()],
    notes: '',
    errors: {},
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'set-section-field':
      return {
        ...state,
        [action.section]: { ...state[action.section], [action.field]: action.value },
        errors: { ...state.errors, [action.field]: undefined },
      }

    case 'set-notes':
      return { ...state, notes: action.value }

    case 'add-line':
      return {
        ...state,
        lineItems: [...state.lineItems, createInvoiceLine(action.line)],
        errors: { ...state.errors, lineItems: undefined },
      }

    case 'patch-line':
      return {
        ...state,
        lineItems: state.lineItems.map((line) =>
          line.localId === action.localId ? { ...line, ...action.patch } : line,
        ),
        errors: { ...state.errors, lineItems: undefined },
      }

    case 'remove-line': {
      const remaining = state.lineItems.filter((line) => line.localId !== action.localId)
      // An invoice with no lines cannot be priced, so keep one empty row.
      return { ...state, lineItems: remaining.length > 0 ? remaining : [createInvoiceLine()] }
    }

    case 'set-errors':
      return { ...state, errors: action.errors }

    case 'reset':
      return createInitialState()

    default:
      return state
  }
}

export function useInvoiceBuilder({ onPaid } = {}) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)

  /**
   * Preview only. The server reprices from the line items on write, so if these
   * two ever disagree the server's answer is the one that gets charged.
   */
  const totals = useMemo(() => calculateInvoiceTotals(state.lineItems), [state.lineItems])

  const setField = useCallback((section, field, value) => {
    dispatch({ type: 'set-section-field', section, field, value })
  }, [])

  const setNotes = useCallback((value) => dispatch({ type: 'set-notes', value }), [])
  const addLine = useCallback((line) => dispatch({ type: 'add-line', line }), [])
  const patchLine = useCallback(
    (localId, patch) => dispatch({ type: 'patch-line', localId, patch }),
    [],
  )
  const removeLine = useCallback((localId) => dispatch({ type: 'remove-line', localId }), [])

  /** Client-side gate for feedback only; the backend validates independently. */
  const validate = useCallback(() => {
    const customer = validateSchema(state.customer, invoiceCustomerSchema)
    const errors = { ...customer.errors }

    const billableLines = state.lineItems.filter(
      (line) => line.description.trim() !== '' && Number(line.unitPrice) > 0,
    )
    if (billableLines.length === 0) {
      errors.lineItems = 'יש להזין לפחות שורה אחת עם תיאור ומחיר'
    }

    dispatch({ type: 'set-errors', errors })
    return Object.keys(errors).length === 0
  }, [state.customer, state.lineItems])

  /**
   * Issue in one step: create the draft, then allocate its number. Two calls,
   * because a draft that fails validation must not burn a number out of the
   * gapless sequence.
   */
  const issue = useAsyncAction(async () => {
    const draft = await invoicesApi.createDraft({
      customer: state.customer,
      vehicle: state.vehicle,
      lineItems: state.lineItems.filter((line) => line.description.trim() !== ''),
      notes: state.notes,
    })
    return invoicesApi.issue(draft.id)
  })

  /**
   * Runs the intent → authorize → capture sequence. The channel decides how the
   * authorization happens; nothing else about the flow changes, which is what
   * makes adding the physical reader a one-line change at the call site.
   */
  const charge = useAsyncAction(async ({ invoiceId, channel, card, terminalId, reference }) => {
    const paid = await chargeInvoice({ invoiceId, channel, card, terminalId, reference })
    onPaid?.(paid)
    return paid
  })

  const issuedInvoice = charge.data ?? issue.data ?? null

  return {
    values: state,
    errors: state.errors,
    totals,
    setField,
    setNotes,
    addLine,
    patchLine,
    removeLine,
    validate,
    reset: useCallback(() => {
      dispatch({ type: 'reset' })
      issue.reset()
      charge.reset()
    }, [issue, charge]),

    issue,
    charge,
    issuedInvoice,
    /** Editing stops the moment a number is allocated. */
    isLocked: issuedInvoice != null,
    isPaid: issuedInvoice?.status === INVOICE_STATUS.PAID,
    /** Only the online channel needs card fields on screen. */
    requiresCard: (channel) => channel === PAYMENT_CHANNELS.CARD_ONLINE,
  }
}
