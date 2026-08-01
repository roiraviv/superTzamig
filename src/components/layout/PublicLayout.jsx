import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useQuoteCart } from '../../context/quoteCartContext'
import { NavigationActions } from '../trust/NavigationActions'
import { Icon } from '../ui/Icon'
import { BottomNavBar } from './BottomNavBar'
import { SiteFooter } from './SiteFooter'
import { TopAppBar } from './TopAppBar'

/** Floating quote button — the persistent path back to conversion. */
function QuoteFab({ count }) {
  if (count === 0) return null

  return (
    <Link
      to="/quote"
      className="fixed bottom-24 end-5 z-40 flex items-center gap-2 rounded-full bg-primary-container px-5 py-4 text-label-md font-bold text-on-primary-container shadow-[0_0_20px_rgba(255,107,0,0.45)] transition-transform hover:scale-105 active:scale-95 lg:bottom-8 lg:end-8"
    >
      <Icon name="request_quote" />
      <span>המשך להצעה</span>
      <span className="flex size-6 items-center justify-center rounded-full bg-on-primary-container/20 text-label-sm">
        {count}
      </span>
    </Link>
  )
}

export function PublicLayout() {
  const { pathname } = useLocation()
  const { totalUnits } = useQuoteCart()

  // Route changes should start at the top, the way a page navigation would.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-100 focus:rounded-lg focus:bg-primary-container focus:px-4 focus:py-2 focus:text-on-primary-container"
      >
        דילוג לתוכן הראשי
      </a>

      <TopAppBar />

      <main id="main" className="pt-16 pb-28 lg:pb-0">
        <Outlet />
      </main>

      <SiteFooter />

      {/*
        One floating button per corner. An active quote is the more valuable
        action, so it takes the slot; the navigate shortcut appears only when
        there is no quote in progress, and the footer keeps both map links
        available at all times either way.
      */}
      {totalUnits === 0 ? <NavigationActions variant="floating" /> : <QuoteFab count={totalUnits} />}

      <BottomNavBar />
    </div>
  )
}
