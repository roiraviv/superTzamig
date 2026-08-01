import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminAuthApi } from '../services/api'
import { AdminAuthContext } from './adminAuthContext'

/**
 * Admin session state.
 *
 * The session itself lives in an httpOnly cookie the browser cannot read, so
 * "am I logged in" is answered by asking the server, never by reading storage.
 * `status: 'checking'` exists so the router can hold the route instead of
 * flashing the login screen to an already-authenticated admin.
 */
export function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null })

  const refreshSession = useCallback(async (signal) => {
    try {
      const { user } = await adminAuthApi.getSession({ signal })
      setState({ status: 'authenticated', user })
      return user
    } catch {
      setState({ status: 'anonymous', user: null })
      return null
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    adminAuthApi
      .getSession({ signal: controller.signal })
      .then((session) => {
        if (active) setState({ status: 'authenticated', user: session.user })
      })
      .catch(() => {
        if (active) setState({ status: 'anonymous', user: null })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const { user } = await adminAuthApi.login(credentials)
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await adminAuthApi.logout()
    } finally {
      // Drop local state even if the network call fails — the UI must not
      // keep showing an admin as signed in.
      setState({ status: 'anonymous', user: null })
    }
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      isChecking: state.status === 'checking',
      isAuthenticated: state.status === 'authenticated',
      login,
      logout,
      refreshSession,
    }),
    [state, login, logout, refreshSession],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
