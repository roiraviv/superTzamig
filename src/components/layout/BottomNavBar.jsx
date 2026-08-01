import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { PUBLIC_NAV } from '../../lib/navigation'
import { useQuoteCart } from '../../context/quoteCartContext'
import { Icon } from '../ui/Icon'

/** Thumb-anchored navigation for mobile, per the design system's reflow rules. */
export function BottomNavBar() {
  const { totalUnits } = useQuoteCart()

  return (
    <nav
      aria-label="ניווט מהיר"
      className="pb-safe fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-outline-variant/20 bg-surface/90 shadow-2xl backdrop-blur-2xl lg:hidden"
    >
      <ul className="flex h-20 items-center px-1">
        {/* Equal flex shares rather than fixed widths, so five items always fit. */}
        {PUBLIC_NAV.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center justify-center gap-1 rounded-full px-1 py-1.5 transition-transform active:scale-90',
                  isActive
                    ? 'bg-primary-container/20 text-primary-container'
                    : 'text-on-surface-variant',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} filled={isActive} />
                  <span className="max-w-full truncate text-label-sm">
                    {item.shortLabel ?? item.label}
                  </span>
                  {item.to === '/quote' && totalUnits > 0 && (
                    <span className="absolute -top-0.5 end-1 flex size-5 items-center justify-center rounded-full border-2 border-background bg-primary-container text-label-sm text-on-primary-container">
                      {totalUnits}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
