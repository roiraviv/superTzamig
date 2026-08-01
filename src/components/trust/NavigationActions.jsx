import { CONTACT, NAVIGATION_LINKS } from '../../lib/navigation'
import { Icon } from '../ui/Icon'

/**
 * Waze / Google Maps hand-off.
 *
 * `variant="inline"` for the footer and the reviews section, `variant="floating"`
 * for the fixed corner affordance. Both point at coordinates, so a driver never
 * has to trust that they typed the street name correctly.
 *
 * @param {{ variant?: 'inline'|'floating', className?: string }} props
 */
export function NavigationActions({ variant = 'inline', className = '' }) {
  if (variant === 'floating') {
    return <FloatingNavigation className={className} />
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {NAVIGATION_LINKS.map((link) => (
        <a
          key={link.id}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-label-md text-on-surface transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon name={link.icon} size={18} className="text-secondary" />
          {link.label}
        </a>
      ))}
      <span className="text-label-sm text-on-surface-variant/80">{CONTACT.address}</span>
    </div>
  )
}

/**
 * Fixed navigate button.
 *
 * Deliberately shares the quote FAB's exact position and sizing, since the layout
 * only ever shows one of the two. `bottom-24` clears the mobile bottom nav; the
 * label drops below `sm` so the button stays a thumb-sized target without
 * covering content.
 */
function FloatingNavigation({ className = '' }) {
  const waze = NAVIGATION_LINKS[0]

  return (
    <a
      href={waze.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-24 end-5 z-40 inline-flex items-center gap-2 rounded-full bg-secondary-container px-5 py-4 text-label-md font-bold text-on-secondary-container shadow-lg shadow-black/40 transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:bottom-8 lg:end-8 ${className}`}
      aria-label={waze.label}
    >
      <Icon name={waze.icon} size={22} />
      <span className="hidden sm:inline">ניווט למוסך</span>
    </a>
  )
}
