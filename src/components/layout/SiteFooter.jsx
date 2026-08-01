import { Link } from 'react-router-dom'
import { useReviewSummary } from '../../hooks/useReviewSummary'
import { CONTACT, PUBLIC_NAV } from '../../lib/navigation'
import { NavigationActions } from '../trust/NavigationActions'
import { TrustRatingBar } from '../trust/TrustBadges'
import { Icon } from '../ui/Icon'

export function SiteFooter() {
  const summary = useReviewSummary()

  return (
    <footer className="mt-16 border-t border-outline-variant/25 bg-surface-container-lowest">
      <div className="mx-auto grid max-w-(--container-page) gap-10 px-4 py-10 md:grid-cols-3 md:px-10">
        <div className="space-y-3">
          <p className="font-headline text-headline-md font-bold tracking-tighter text-primary-container">
            סופר צמיג
          </p>
          <p className="max-w-sm text-body-md text-on-surface-variant">
            מרכז שירות פרימיום לצמיגים ומוסך מורשה. 22 שנה של עבודה מדויקת, אחריות מלאה
            וצוות שאפשר לסמוך עליו.
          </p>
        </div>

        <nav aria-label="ניווט תחתון" className="space-y-3">
          <h2 className="text-label-md text-on-surface">ניווט</h2>
          <ul className="space-y-2">
            {PUBLIC_NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="text-body-md text-on-surface-variant transition-colors hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3">
          <h2 className="text-label-md text-on-surface">יצירת קשר</h2>
          <ul className="space-y-2 text-body-md text-on-surface-variant">
            <li className="flex items-center gap-2">
              <Icon name="call" size={18} className="text-secondary" />
              <a href={CONTACT.phoneHref} className="hover:text-primary">
                {CONTACT.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Icon name="location_on" size={18} className="text-secondary" />
              {CONTACT.address}
            </li>
            <li className="flex items-center gap-2">
              <Icon name="schedule" size={18} className="text-secondary" />
              {CONTACT.hours}
            </li>
          </ul>

          <NavigationActions className="pt-2" />
        </div>
      </div>

      <div className="mx-auto max-w-(--container-page) border-t border-outline-variant/20 px-4 py-6 md:px-10">
        <TrustRatingBar summary={summary.data} />
      </div>

      <div className="border-t border-outline-variant/20 px-4 py-4 text-center text-label-sm text-on-surface-variant/70 md:px-10">
        © {new Date().getFullYear()} סופר צמיג · כל הזכויות שמורות ·{' '}
        <Link to="/admin" className="hover:text-primary">
          כניסת צוות
        </Link>
      </div>
    </footer>
  )
}
