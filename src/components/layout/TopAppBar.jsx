import { Link, NavLink, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { CONTACT, PUBLIC_NAV } from '../../lib/navigation'
import { useQuoteCart } from '../../context/quoteCartContext'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

/**
 * Sticky top bar. The two conversion CTAs stay visible at every scroll
 * position on desktop; on mobile they live in the thumb-reachable bottom bar.
 */
export function TopAppBar() {
  const navigate = useNavigate()
  const { totalUnits } = useQuoteCart()

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-outline-variant/25 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-(--container-page) items-center justify-between gap-4 px-4 md:px-10">
        <Link
          to="/"
          className="font-headline text-headline-md font-bold tracking-tighter text-primary-container md:text-headline-lg"
        >
          סופר צמיג
        </Link>

        <nav aria-label="ניווט ראשי" className="hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-4 py-2 text-body-md transition-colors',
                  isActive
                    ? 'font-bold text-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                )
              }
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={CONTACT.phoneHref}
            className="hidden items-center gap-2 rounded-md px-3 py-2 text-label-md text-on-surface-variant transition-colors hover:text-on-surface md:flex"
          >
            <Icon name="call" size={18} />
            {CONTACT.phone}
          </a>

          <Button
            variant="secondary"
            size="sm"
            icon="request_quote"
            className="hidden sm:inline-flex"
            onClick={() => navigate('/quote')}
          >
            הצעת מחיר
            {totalUnits > 0 && (
              <span className="ms-1 rounded-full bg-secondary-container px-1.5 text-label-sm text-on-secondary-container">
                {totalUnits}
              </span>
            )}
          </Button>

          <Button size="sm" icon="calendar_today" onClick={() => navigate('/book')}>
            קביעת תור
          </Button>
        </div>
      </div>
    </header>
  )
}
