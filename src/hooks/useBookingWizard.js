import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { bookingApi, quotesApi } from '../services/api'
import {
  contactStepSchema,
  scheduleStepSchema,
  serviceStepSchema,
  validateSchema,
  vehicleStepSchema,
} from '../lib/validation'
import { toDateKey } from '../lib/format'
import { useAsyncAction, useAsyncData } from './useAsyncData'

/**
 * State for the four-step booking/quoting wizard.
 *
 * A reducer rather than a form library or a global store: the whole flow lives
 * in one component subtree, the transitions are a small closed set, and every
 * step's validity is derivable from `values` alone. That keeps "can I advance?"
 * a pure function instead of scattered effects.
 */

export const WIZARD_STEPS = [
  { id: 'service', label: 'שירות', icon: 'build' },
  { id: 'vehicle', label: 'רכב', icon: 'directions_car' },
  { id: 'schedule', label: 'מועד', icon: 'calendar_today' },
  { id: 'confirm', label: 'אישור', icon: 'task_alt' },
]

const STEP_SCHEMAS = [serviceStepSchema, vehicleStepSchema, scheduleStepSchema, contactStepSchema]

const DRAFT_STORAGE_KEY = 'st.booking-draft.v1'

function createInitialState(seed = {}) {
  return {
    stepIndex: 0,
    /** Highest step reached, so the user can jump back and forth freely. */
    furthestStep: 0,
    submitted: false,
    values: {
      serviceIds: seed.serviceIds ?? [],
      lineItems: seed.lineItems ?? [],
      vehicle: { licensePlate: '', make: '', model: '', year: '', ...seed.vehicle },
      schedule: { date: toDateKey(new Date()), slotId: null, ...seed.schedule },
      contact: { fullName: '', phone: '', email: '', notes: '', consent: false, ...seed.contact },
    },
    errors: {},
  }
}

/** Flattens the nested `values` into the flat shape the step schemas expect. */
function stepValues(values, stepIndex) {
  switch (stepIndex) {
    case 0:
      return { serviceIds: values.serviceIds }
    case 1:
      return values.vehicle
    case 2:
      return values.schedule
    case 3:
      return values.contact
    default:
      return {}
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'toggle-service': {
      const current = state.values.serviceIds
      const serviceIds = current.includes(action.serviceId)
        ? current.filter((id) => id !== action.serviceId)
        : [...current, action.serviceId]
      return {
        ...state,
        values: { ...state.values, serviceIds },
        errors: { ...state.errors, serviceIds: undefined },
      }
    }

    case 'set-line-items':
      return { ...state, values: { ...state.values, lineItems: action.lineItems } }

    case 'set-field':
      return {
        ...state,
        values: {
          ...state.values,
          [action.section]: { ...state.values[action.section], [action.field]: action.value },
        },
        // Clear the field's error the moment the user edits it.
        errors: { ...state.errors, [action.field]: undefined },
      }

    case 'merge-section':
      return {
        ...state,
        values: {
          ...state.values,
          [action.section]: { ...state.values[action.section], ...action.patch },
        },
        errors: {},
      }

    case 'set-errors':
      return { ...state, errors: action.errors }

    case 'go-to': {
      // Forward jumps are only allowed into already-validated territory.
      const target = Math.max(0, Math.min(WIZARD_STEPS.length - 1, action.stepIndex))
      if (target > state.furthestStep) return state
      return { ...state, stepIndex: target, errors: {} }
    }

    case 'advance': {
      const next = Math.min(WIZARD_STEPS.length - 1, state.stepIndex + 1)
      return {
        ...state,
        stepIndex: next,
        furthestStep: Math.max(state.furthestStep, next),
        errors: {},
      }
    }

    case 'back':
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1), errors: {} }

    case 'submitted':
      return { ...state, submitted: true }

    case 'reset':
      return createInitialState(action.seed)

    default:
      return state
  }
}

function readDraft() {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * @param {{ lineItems?: Array, onComplete?: (result: object, intent: string) => void }} options
 */
export function useBookingWizard({ lineItems = [], onComplete } = {}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const draft = readDraft()
    // Cart lines always win over the persisted draft — the cart is newer.
    return createInitialState({ ...draft, lineItems })
  })

  // Keep the wizard's line items in sync with the cart while the user shops.
  useEffect(() => {
    dispatch({ type: 'set-line-items', lineItems })
  }, [lineItems])

  // A mid-wizard refresh shouldn't cost the visitor their progress.
  useEffect(() => {
    if (state.submitted) {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
      return
    }
    try {
      window.sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        // Personal contact details are deliberately never persisted.
        JSON.stringify({
          serviceIds: state.values.serviceIds,
          vehicle: state.values.vehicle,
          schedule: state.values.schedule,
        }),
      )
    } catch {
      // Storage being unavailable must not break the flow.
    }
  }, [state.values, state.submitted])

  const { values, stepIndex } = state

  const setField = useCallback(
    (section, field, value) => dispatch({ type: 'set-field', section, field, value }),
    [],
  )

  const toggleService = useCallback(
    (serviceId) => dispatch({ type: 'toggle-service', serviceId }),
    [],
  )

  /* ---- server-derived data the wizard needs ---- */

  const pricing = useAsyncData(
    ({ signal }) =>
      quotesApi.priceQuote(
        { serviceIds: values.serviceIds, lineItems: values.lineItems },
        { signal },
      ),
    [values.serviceIds.join(','), JSON.stringify(values.lineItems)],
    {
      enabled: values.serviceIds.length > 0 || values.lineItems.length > 0,
      keepPreviousData: true,
    },
  )

  const availability = useAsyncData(
    ({ signal }) =>
      bookingApi.getAvailability(
        { date: values.schedule.date, serviceIds: values.serviceIds },
        { signal },
      ),
    [values.schedule.date, values.serviceIds.join(',')],
    { enabled: Boolean(values.schedule.date) },
  )

  const vehicleLookup = useAsyncAction(async (plate) => {
    const vehicle = await bookingApi.lookupVehicle(plate)
    if (vehicle) {
      dispatch({
        type: 'merge-section',
        section: 'vehicle',
        patch: { make: vehicle.make, model: vehicle.model, year: vehicle.year },
      })
    }
    return vehicle
  })

  /* ---- navigation ---- */

  const validateCurrentStep = useCallback(() => {
    const schema = STEP_SCHEMAS[stepIndex]
    return validateSchema(stepValues(values, stepIndex), schema)
  }, [stepIndex, values])

  const isCurrentStepValid = useMemo(() => validateCurrentStep().valid, [validateCurrentStep])

  const next = useCallback(() => {
    const { valid, errors } = validateCurrentStep()
    if (!valid) {
      dispatch({ type: 'set-errors', errors })
      return false
    }
    dispatch({ type: 'advance' })
    return true
  }, [validateCurrentStep])

  const back = useCallback(() => dispatch({ type: 'back' }), [])
  const goToStep = useCallback((index) => dispatch({ type: 'go-to', stepIndex: index }), [])

  /* ---- submission ---- */

  const submission = useAsyncAction(async (intent = 'appointment') => {
    // Re-validate every step, not just the last one: a user can edit an early
    // step after reaching the end and walk it back into an invalid state.
    const allErrors = STEP_SCHEMAS.reduce((accumulated, schema, index) => {
      const { errors } = validateSchema(stepValues(values, index), schema)
      return { ...accumulated, ...errors }
    }, {})

    if (Object.keys(allErrors).length > 0) {
      dispatch({ type: 'set-errors', errors: allErrors })
      const firstInvalidStep = STEP_SCHEMAS.findIndex(
        (schema, index) => !validateSchema(stepValues(values, index), schema).valid,
      )
      dispatch({ type: 'go-to', stepIndex: firstInvalidStep })
      throw Object.assign(new Error('חלק מהפרטים אינם תקינים'), {
        status: 422,
        fieldErrors: allErrors,
      })
    }

    const result =
      intent === 'quote'
        ? await quotesApi.submitQuote(values)
        : await bookingApi.createAppointment(values)

    dispatch({ type: 'submitted' })
    onComplete?.(result, intent)
    return result
  })

  const reset = useCallback(() => dispatch({ type: 'reset', seed: { lineItems } }), [lineItems])

  return {
    steps: WIZARD_STEPS,
    stepIndex,
    step: WIZARD_STEPS[stepIndex],
    furthestStep: state.furthestStep,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === WIZARD_STEPS.length - 1,
    values,
    // Backend field errors take precedence over the client's own.
    errors: { ...state.errors, ...(submission.fieldErrors ?? {}) },
    isCurrentStepValid,
    submitted: state.submitted,
    setField,
    toggleService,
    next,
    back,
    goToStep,
    reset,
    pricing,
    availability,
    vehicleLookup,
    submission,
  }
}
