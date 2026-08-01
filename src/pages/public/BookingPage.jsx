import { useSearchParams } from 'react-router-dom'
import { QuoteWizard } from '../../components/quote/QuoteWizard'
import { SERVICE_TYPES } from '../../lib/constants'

/**
 * Hosts the wizard for both conversion paths. `/book` commits to a slot,
 * `/quote` asks for pricing first — same flow, different terminal action.
 */
export function BookingPage({ intent = 'appointment' }) {
  const [searchParams] = useSearchParams()

  // Query params are user-controlled: only accept a known service id.
  const requestedService = searchParams.get('service')
  const preselectedServiceId = SERVICE_TYPES.some((service) => service.id === requestedService)
    ? requestedService
    : undefined

  const isQuote = intent === 'quote'

  return (
    <div className="mx-auto max-w-(--container-page) space-y-10 px-4 py-6 md:px-10">
      <header className="space-y-2">
        <h1 className="font-headline text-headline-lg text-on-surface md:text-headline-xl">
          {isQuote ? 'קבלת הצעת מחיר' : 'קביעת תור לטיפול'}
        </h1>
        <p className="max-w-2xl text-body-lg text-on-surface-variant">
          {isQuote
            ? 'ארבעה שלבים קצרים, בלי טלפונים ובלי המתנה. תקבלו מחיר מלא ומחייב עם כל העלויות.'
            : 'בחרו שירות, מועד ופרטים — ואנחנו נשמור לכם עמדה. ללא תשלום מראש.'}
        </p>
      </header>

      <QuoteWizard intent={intent} preselectedServiceId={preselectedServiceId} />
    </div>
  )
}
