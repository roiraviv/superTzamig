import { useCallback, useMemo, useState } from 'react'
import { vehicleSpecsApi } from '../services/api'
import { TIRE_POSITIONS } from '../lib/constants'
import { plateLookupSchema, sanitizeDigits, validateSchema } from '../lib/validation'
import { useAsyncData } from './useAsyncData'

/**
 * State for the smart tire selector.
 *
 * The plate the user is typing and the plate we have searched for are two
 * different things. Keeping them apart is what makes the flow feel instant: the
 * input stays fully responsive while a request is in flight, and `useAsyncData`
 * aborts the previous lookup the moment a new one starts, so an earlier slow
 * response can never overwrite a later fast one.
 *
 * One request serves the whole screen. The backend resolves the approved sizes
 * and the matching inventory together, so the vehicle name and the tire grid
 * appear in the same paint instead of the grid popping in a beat later.
 */
export function useTireSelector() {
  const [plate, setPlate] = useState('')
  const [submittedPlate, setSubmittedPlate] = useState('')
  const [position, setPosition] = useState(TIRE_POSITIONS.ALL)
  const [sort, setSort] = useState('')
  const [validationError, setValidationError] = useState(null)

  const fitment = useAsyncData(
    ({ signal }) => vehicleSpecsApi.listFittingTires(submittedPlate, { position, sort, signal }),
    [submittedPlate, position, sort],
    { enabled: submittedPlate !== '' },
  )

  /** Digits only, at the edge — the state never holds a character we'd reject. */
  const changePlate = useCallback((value) => {
    setPlate(sanitizeDigits(value, 8))
    setValidationError(null)
  }, [])

  const search = useCallback(() => {
    const { valid, errors } = validateSchema({ licensePlate: plate }, plateLookupSchema)
    if (!valid) {
      setValidationError(errors.licensePlate)
      return false
    }
    setValidationError(null)
    setPosition(TIRE_POSITIONS.ALL)
    setSubmittedPlate(plate)
    return true
  }, [plate])

  const reset = useCallback(() => {
    setPlate('')
    setSubmittedPlate('')
    setPosition(TIRE_POSITIONS.ALL)
    setSort('')
    setValidationError(null)
  }, [])

  const data = fitment.data

  /**
   * Staggered setups run different sizes front and rear. The axle filter is
   * meaningless on the other 95% of cars, so it only appears when it applies.
   */
  const isStaggered = useMemo(() => {
    const positions = new Set((data?.approvedSizes ?? []).map((entry) => entry.position))
    return positions.has(TIRE_POSITIONS.FRONT) || positions.has(TIRE_POSITIONS.REAR)
  }, [data?.approvedSizes])

  return {
    plate,
    changePlate,
    search,
    reset,
    validationError,
    hasSearched: submittedPlate !== '',
    submittedPlate,
    fitment,
    vehicle: data?.vehicle ?? null,
    /**
     * The backend flags anything it could not confirm against the registry.
     * Absent means verified, so a payload from an older build is not silently
     * treated as unverified.
     */
    isUnverified: data?.verified === false,
    approvedSizes: data?.approvedSizes ?? [],
    unavailableSizes: data?.unavailableSizes ?? [],
    tires: data?.items ?? [],
    isStaggered,
    position,
    setPosition,
    sort,
    setSort,
  }
}
