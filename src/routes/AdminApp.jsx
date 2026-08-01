import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '../components/admin/AdminLayout'
import { RequireAdmin } from '../components/admin/RequireAdmin'
import { AdminAuthProvider } from '../context/AdminAuthProvider'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { AppointmentsPage } from '../pages/admin/AppointmentsPage'
import { BillingPage } from '../pages/admin/BillingPage'
import { DashboardPage } from '../pages/admin/DashboardPage'
import { InventoryPage } from '../pages/admin/InventoryPage'
import { QuotesPage } from '../pages/admin/QuotesPage'

/**
 * The entire admin application, loaded as one lazy chunk from `App.jsx`.
 *
 * Auth state is provided here rather than at the app root so the public site
 * never issues a session request, and so no admin identity is reachable from
 * public components even by accident.
 */
export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />

        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="billing" element={<BillingPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminAuthProvider>
  )
}
