import { Link } from 'react-router-dom'
import { formatCurrency, formatLongDate, formatTime } from '../../lib/format'
import { CONTACT } from '../../lib/navigation'
import { Button } from '../ui/Button'
import { GlassCard } from '../ui/Card'
import { Icon } from '../ui/Icon'

/** Terminal state of the wizard. Confirms, sets expectations, offers next steps. */
export function WizardSuccess({ result, intent, onStartOver }) {
  const isQuote = intent === 'quote'

  return (
    <GlassCard className="mx-auto max-w-2xl p-10 text-center">
      <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary-container/20 text-primary-container">
        <Icon name={isQuote ? 'request_quote' : 'event_available'} size={34} filled />
      </span>

      <h1 className="font-headline text-headline-lg text-on-surface">
        {isQuote ? 'ההצעה נשלחה אליכם' : 'התור נקבע בהצלחה'}
      </h1>

      <p className="mt-2 text-body-lg text-on-surface-variant">
        {isQuote
          ? 'הצעת המחיר ממתינה לאישור הצוות שלנו. נחזור אליכם עם אישור סופי תוך שעת עבודה אחת.'
          : 'שלחנו לכם אישור ב‑SMS. הגיעו 5 דקות לפני המועד ואנחנו נדאג לשאר.'}
      </p>

      <dl className="mt-6 grid gap-3 rounded-lg border border-outline-variant/40 bg-surface-container/50 p-6 text-start">
        <div className="flex justify-between gap-4">
          <dt className="text-label-md text-on-surface-variant">מספר אסמכתא</dt>
          <dd className="font-headline text-headline-md text-primary-container">
            {result.reference}
          </dd>
        </div>

        {!isQuote && result.startsAt && (
          <div className="flex justify-between gap-4">
            <dt className="text-label-md text-on-surface-variant">מועד</dt>
            <dd className="text-body-md text-on-surface">
              {formatLongDate(result.startsAt)} · {formatTime(result.startsAt)}
              {result.bay ? ` · עמדה ${result.bay}` : ''}
            </dd>
          </div>
        )}

        <div className="flex justify-between gap-4">
          <dt className="text-label-md text-on-surface-variant">סכום משוער</dt>
          <dd className="text-body-md text-on-surface">
            {formatCurrency(result.total ?? result.estimatedTotal, { precise: true })}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button as={Link} to="/" icon="home">
          חזרה לדף הבית
        </Button>
        <Button
          as="a"
          href={CONTACT.phoneHref}
          variant="secondary"
          icon="call"
        >
          שינוי או ביטול · {CONTACT.phone}
        </Button>
        <Button variant="tertiary" icon="restart_alt" onClick={onStartOver}>
          הזמנה נוספת
        </Button>
      </div>
    </GlassCard>
  )
}
