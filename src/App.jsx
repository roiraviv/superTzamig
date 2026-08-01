import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PublicLayout } from './components/layout/PublicLayout'
import { LoadingState } from './components/ui/StateViews'
import { QuoteCartProvider } from './context/QuoteCartProvider'
import { BookingPage } from './pages/public/BookingPage'
import { CatalogPage } from './pages/public/CatalogPage'
import { HomePage } from './pages/public/HomePage'
import { TireFinderPage } from './pages/public/TireFinderPage'
import { NotFoundPage } from './pages/NotFoundPage'

// The admin dashboard is a separate chunk: a customer browsing tires never
// downloads it, and it keeps the two apps from sharing anything but tokens.
const AdminApp = lazy(() => import('./routes/AdminApp'))

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center">
                    <LoadingState label="טוען את מערכת הניהול…" />
                  </div>
                }
              >
                <AdminApp />
              </Suspense>
            }
          />

          <Route
            element={
              <QuoteCartProvider>
                <PublicLayout />
              </QuoteCartProvider>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="tire-finder" element={<TireFinderPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="book" element={<BookingPage intent="appointment" />} />
            <Route path="quote" element={<BookingPage intent="quote" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
