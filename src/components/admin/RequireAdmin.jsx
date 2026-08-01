import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../../context/adminAuthContext'
import { LoadingState } from '../ui/StateViews'

/**
 * Route guard for the admin subtree.
 *
 * This is a UX gate, not a security boundary — the API enforces the session on
 * every request. Its job is to avoid rendering an admin shell that would only
 * fill with 401s, and to hold the route while the session check is in flight
 * so a signed-in admin never sees the login screen flash.
 */
export function RequireAdmin({ children }) {
  const { isChecking, isAuthenticated } = useAdminAuth()
  const location = useLocation()

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="מאמת הרשאות…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    // Remember where they were headed so login can return them there.
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  }

  return children
}
