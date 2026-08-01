import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { ADMIN_NAV } from '../../lib/navigation'
import { useAdminAuth } from '../../context/adminAuthContext'
import { Icon } from '../ui/Icon'
import { AdminSidebar } from './AdminSidebar'

/**
 * Shell for every authenticated admin screen.
 *
 * Deliberately shares nothing with `PublicLayout` beyond the design tokens —
 * separate layout, separate navigation, separate route subtree, and loaded from
 * a separate lazy chunk so the public bundle never contains admin code.
 */
export function AdminLayout() {
  const { user, logout } = useAdminAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // A route change should always close the mobile drawer, including a browser
  // back navigation. Adjusting during render beats an effect here: the drawer
  // never paints open on the new route.
  const [renderedPath, setRenderedPath] = useState(pathname)
  if (pathname !== renderedPath) {
    setRenderedPath(pathname)
    setDrawerOpen(false)
  }

  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKeyDown = (event) => event.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-72 border-e border-outline-variant/40 shadow-lg md:block">
        <AdminSidebar user={user} onLogout={handleLogout} />
      </aside>

      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant/30 bg-surface/80 px-6 backdrop-blur-xl md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="פתיחת תפריט ניהול"
          aria-expanded={drawerOpen}
          className="rounded-full p-2 text-primary transition-colors hover:bg-surface-container-high"
        >
          <Icon name="menu" />
        </button>
        <p className="font-headline text-headline-md font-bold tracking-tighter text-primary-container">
          סופר צמיג
        </p>
        <img src={user?.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="סגירת התפריט"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 start-0 w-72 border-e border-outline-variant/40 shadow-2xl">
            <AdminSidebar
              user={user}
              onLogout={handleLogout}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="min-h-screen px-4 pt-20 pb-28 md:ps-72 md:pt-6 md:pe-10 md:pb-6">
        <div className="mx-auto max-w-(--container-page)">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="ניווט ניהול מהיר"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-around rounded-t-xl border-t border-outline-variant/20 bg-surface/90 backdrop-blur-2xl md:hidden"
      >
        {ADMIN_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 rounded-full px-3 py-1.5 transition-transform active:scale-90',
                isActive
                  ? 'bg-primary-container/20 text-primary-container'
                  : 'text-on-surface-variant',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} filled={isActive} />
                <span className="text-label-sm">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
