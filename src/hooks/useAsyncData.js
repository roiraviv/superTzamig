import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toApiError } from '../services/http/ApiError'

/**
 * The single async primitive every screen in the app is built on.
 *
 * It exposes the four states the design system requires — loading, success,
 * empty, error — so a component never has to assemble them by hand, and it
 * aborts the in-flight request on unmount or when the key changes, which is
 * what keeps fast filter typing from producing out-of-order results.
 */

const defaultIsEmpty = (data) => {
  if (data == null) return true
  if (Array.isArray(data)) return data.length === 0
  if (Array.isArray(data?.items)) return data.items.length === 0
  return false
}

const sameKey = (a, b) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

/**
 * @param {(options: { signal: AbortSignal }) => Promise<any>} fetcher
 * @param {any[]} deps  Re-fetch key, same contract as useEffect deps.
 * @param {{ enabled?: boolean, initialData?: any, isEmpty?: (data: any) => boolean,
 *           keepPreviousData?: boolean }} [options]
 */
export function useAsyncData(fetcher, deps = [], options = {}) {
  const {
    enabled = true,
    initialData = null,
    isEmpty = defaultIsEmpty,
    keepPreviousData = false,
  } = options

  const [state, setState] = useState({
    status: enabled ? 'loading' : 'idle',
    data: initialData,
    error: null,
  })

  // Keeping the fetcher in a ref lets callers pass an inline arrow function
  // without it becoming a re-fetch trigger; `deps` stays the only trigger.
  // The ref is refreshed in its own effect, declared first so it commits
  // before the fetch effect below reads it.
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const [reloadToken, setReloadToken] = useState(0)
  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])

  // Switching to `loading` belongs to the render that changed the key, not to
  // an effect: writing it here means the stale data never paints as if it were
  // the answer to the new request, and it costs no extra render pass.
  const requestKey = [...deps, enabled, reloadToken]
  const [activeKey, setActiveKey] = useState(requestKey)
  if (enabled && !sameKey(activeKey, requestKey)) {
    setActiveKey(requestKey)
    setState((previous) => ({
      status: 'loading',
      data: keepPreviousData ? previous.data : initialData,
      error: null,
    }))
  }

  useEffect(() => {
    if (!enabled) return undefined

    const controller = new AbortController()
    let active = true

    fetcherRef
      .current({ signal: controller.signal })
      .then((data) => {
        if (active) setState({ status: 'success', data, error: null })
      })
      .catch((error) => {
        const apiError = toApiError(error)
        // An abort is a cancellation, not a failure — never surface it.
        if (active && apiError.code !== 'aborted') {
          setState({ status: 'error', data: null, error: apiError })
        }
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, reloadToken])

  const setData = useCallback((updater) => {
    setState((previous) => ({
      ...previous,
      data: typeof updater === 'function' ? updater(previous.data) : updater,
    }))
  }, [])

  return useMemo(() => {
    // A disabled query reports idle without the effect having to write state.
    const view = enabled ? state : { status: 'idle', data: initialData, error: null }

    return {
      ...view,
      isIdle: view.status === 'idle',
      isLoading: view.status === 'loading',
      isError: view.status === 'error',
      isSuccess: view.status === 'success',
      isEmpty: view.status === 'success' && isEmpty(view.data),
      refetch,
      setData,
    }
  }, [state, enabled, initialData, isEmpty, refetch, setData])
}

/**
 * Mutation counterpart. Tracks submitting/success/error for a one-shot action
 * and surfaces `fieldErrors` from the backend validator straight to the form.
 */
export function useAsyncAction(action) {
  const [state, setState] = useState({ status: 'idle', error: null, data: null })
  const actionRef = useRef(action)
  const mountedRef = useRef(true)

  useEffect(() => {
    actionRef.current = action
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = useCallback(async (...args) => {
    setState({ status: 'submitting', error: null, data: null })
    try {
      const data = await actionRef.current(...args)
      if (mountedRef.current) setState({ status: 'success', error: null, data })
      return { ok: true, data }
    } catch (error) {
      const apiError = toApiError(error)
      if (mountedRef.current) setState({ status: 'error', error: apiError, data: null })
      return { ok: false, error: apiError }
    }
  }, [])

  const reset = useCallback(() => setState({ status: 'idle', error: null, data: null }), [])

  return {
    ...state,
    isSubmitting: state.status === 'submitting',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    fieldErrors: state.error?.fieldErrors ?? null,
    run,
    reset,
  }
}
