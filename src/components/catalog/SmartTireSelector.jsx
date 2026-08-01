import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuoteCart } from '../../context/quoteCartContext'
import { useReviewSummary } from '../../hooks/useReviewSummary'
import { useTireSelector } from '../../hooks/useTireSelector'
import { SERVICE_TYPES, TIRE_POSITION_LABELS, TIRE_POSITIONS } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { GlassCard } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { EmptyState, ErrorState, Skeleton } from '../ui/StateViews'
import { MicroTrustBadge } from '../trust/TrustBadges'
import { LicensePlateInput } from './LicensePlateInput'
import { TireCard } from './TireCard'
import { TirePressureCard } from './TirePressureCard'

const ALIGNMENT_SERVICE = SERVICE_TYPES.find((service) => service.id === 'alignment')

/** Reads back what the registry returned, so the visitor can confirm it is their car. */
function VehicleSummary({ vehicle, approvedSizes, onReset }) {
  return (
    <GlassCard glow className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary-container/15 text-secondary-container">
          <Icon name="directions_car" size={26} />
        </span>
        <div>
          <p className="text-label-sm text-on-surface-variant">זוהה הרכב שלכם</p>
          <h3 className="font-headline text-headline-md text-on-surface">
            {vehicle.make} {vehicle.model}
          </h3>
          <p className="text-body-md text-on-surface-variant">
            {vehicle.year}
            {vehicle.trim ? ` · ${vehicle.trim}` : ''}
          </p>

          <ul className="mt-3 flex flex-wrap gap-2">
            {approvedSizes.map((entry) => (
              <li key={`${entry.position}-${entry.size}`}>
                <Badge tone={entry.isOem ? 'secondary' : 'neutral'}>
                  <span dir="ltr" className="font-bold">
                    {entry.size}
                  </span>
                  <span className="opacity-70">
                    {entry.position === TIRE_POSITIONS.ALL
                      ? ''
                      : ` · ${TIRE_POSITION_LABELS[entry.position]}`}
                    {entry.isOem ? ' · מקורי' : ''}
                  </span>
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Button variant="tertiary" size="sm" icon="autorenew" onClick={onReset}>
        רכב אחר
      </Button>
    </GlassCard>
  )
}

/** Axle picker, rendered only for staggered vehicles where it changes the answer. */
function AxleFilter({ value, onChange }) {
  const options = [
    { id: TIRE_POSITIONS.ALL, label: 'הצג הכול' },
    { id: TIRE_POSITIONS.FRONT, label: TIRE_POSITION_LABELS[TIRE_POSITIONS.FRONT] },
    { id: TIRE_POSITIONS.REAR, label: TIRE_POSITION_LABELS[TIRE_POSITIONS.REAR] },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="me-1 text-label-sm text-on-surface-variant">
        לרכב שלכם מידות שונות מלפנים ומאחור:
      </p>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            'rounded-full border px-4 py-1.5 text-label-sm transition-colors',
            value === option.id
              ? 'border-secondary-container bg-secondary-container/15 text-secondary-container'
              : 'border-outline-variant/50 text-on-surface-variant hover:text-on-surface',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Shown when the sizes came from our reference table instead of the registry.
 *
 * Not optional politeness. A reference lookup matches on make and model, which
 * cannot distinguish trims that ship different wheels, so the customer is the
 * one who has to confirm. Presenting an unverified size with the same authority
 * as a registry answer is how somebody ends up on tires that do not fit.
 */
function UnverifiedSourceNotice() {
  return (
    <p className="flex items-start gap-3 rounded-lg border border-primary-container/40 bg-primary-container/8 px-4 py-3 text-body-md text-on-surface-variant">
      <Icon name="info" size={20} className="mt-0.5 shrink-0 text-primary-container" />
      <span>
        <span className="text-on-surface">המידות הוצגו לפי דגם הרכב, לא ממאגר משרד התחבורה.</span>{' '}
        אנא ודאו מול המדבקה במשקוף דלת הנהג לפני ההזמנה — או התקשרו אלינו ונאמת עבורכם.
      </span>
    </p>
  )
}

/** Post-fitting upsell. Alignment is the service a new set of tires actually needs. */
function AlignmentUpsell() {
  if (!ALIGNMENT_SERVICE) return null

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-primary-container/30 bg-primary-container/8 p-6 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-container/20 text-primary-container">
          <Icon name={ALIGNMENT_SERVICE.icon} size={24} />
        </span>
        <div>
          <h3 className="font-headline text-headline-md text-on-surface">
            להוסיף {ALIGNMENT_SERVICE.label}?
          </h3>
          <p className="mt-1 max-w-xl text-body-md text-on-surface-variant">
            סט צמיגים חדש על גיאומטריה לא מכוונת נשחק לא אחיד ומאבד עד 30% מהחיים שלו.
            {ALIGNMENT_SERVICE.description} · {ALIGNMENT_SERVICE.durationMinutes} דקות.
          </p>
        </div>
      </div>

      <Button
        as={Link}
        to={`/book?service=${ALIGNMENT_SERVICE.id}`}
        variant="secondary"
        icon="add_circle"
        className="shrink-0"
      >
        הוספה לתור
      </Button>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-[26rem] w-full" />
      ))}
    </div>
  )
}

/**
 * The two datasets the backend cross-references, named for the visitor.
 *
 * Naming the Ministry of Transport during the wait is doing two jobs: it
 * explains why a search takes a couple of seconds instead of feeling broken,
 * and it attributes the answer to the registry rather than to us — which is
 * the whole basis for trusting that the sizes are actually road-legal.
 */
const LOOKUP_STAGES = [
  { id: 'vehicle', label: 'מאתר את הרכב במאגר משרד התחבורה' },
  { id: 'sizes', label: 'מצליב את מידות הצמיגים המאושרות לדגם' },
]

/** Roughly how long step one runs before the model lookup begins. */
const STAGE_ADVANCE_MS = 1200

function LookupProgress() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    // Time-based, not event-based: the backend answers once, so this reflects
    // the typical shape of the two-step lookup rather than its real progress.
    const timer = setTimeout(() => setStage(1), STAGE_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="space-y-6">
      <GlassCard className="flex flex-col gap-4 p-6">
        <p className="flex items-center gap-3 text-body-lg text-on-surface">
          <Icon name="progress_activity" className="animate-spin text-secondary-container" />
          מחפש במאגר משרד התחבורה…
        </p>

        <ol className="space-y-2">
          {LOOKUP_STAGES.map((entry, index) => {
            const isDone = index < stage
            const isActive = index === stage

            return (
              <li
                key={entry.id}
                className={cn(
                  'flex items-center gap-2 text-body-md transition-colors',
                  isDone || isActive ? 'text-on-surface-variant' : 'text-on-surface-variant/40',
                )}
              >
                <Icon
                  name={isDone ? 'check_circle' : isActive ? 'radio_button_checked' : 'radio_button_unchecked'}
                  size={18}
                  filled={isDone}
                  className={isDone ? 'text-secondary-container' : ''}
                />
                {entry.label}
              </li>
            )
          })}
        </ol>
      </GlassCard>

      <ResultsSkeleton />
    </div>
  )
}

/**
 * Smart tire selector: one input, and everything that is not street-legal for
 * the vehicle disappears from the catalog.
 *
 * The component renders state and delegates everything else — filtering rules
 * live on the server, filter state lives in `useTireSelector`, and the cart is
 * the same `QuoteCartProvider` the catalog uses, so a set chosen here flows into
 * the existing quote wizard with no special case.
 */
export function SmartTireSelector() {
  const selector = useTireSelector()
  const cart = useQuoteCart()
  const summary = useReviewSummary()
  const { fitment, vehicle, tires } = selector

  /**
   * The backend distinguishes three failures that all look like "no results"
   * but need different exits:
   *
   * - the plate is not in any registry dataset — probably a typo, so offer a
   *   re-entry before anything else
   * - the vehicle was found but carries no tire data — the plate was right, so
   *   never tell them to check their typing; hand it to a human
   * - data.gov.il is down — nothing is wrong with their input, so the only
   *   sensible action is retry
   */
  const failureCode = fitment.error?.code
  const isUnknownVehicle = fitment.error?.status === 404 || failureCode === 'plate_not_found'
  const hasNoTireData = failureCode === 'tire_specs_unavailable'
  const isRegistryDown = failureCode === 'registry_unavailable'


  return (
    <section className="space-y-6">
      <GlassCard className="grid gap-6 p-6 md:p-10 lg:grid-cols-2 lg:items-center">
        <div className="space-y-4">
          <Badge tone="secondary">
            <Icon name="bolt" size={14} filled />
            התאמה לפי מספר רישוי
          </Badge>

          <h2 className="font-headline text-headline-lg text-on-surface">
            לא צריך לדעת את מידת הצמיג
          </h2>
          <p className="max-w-lg text-body-lg text-on-surface-variant">
            הזינו מספר רישוי ונציג רק צמיגים שמאושרים חוקית לרכב שלכם, עם המחיר הסופי
            כולל התקנה ואיזון.
          </p>

          <ul className="space-y-2 pt-1">
            {[
              'מידות מאושרות מתוך מאגר משרד התחבורה',
              'רק מה שבמלאי ומותקן באותו יום',
              'מחיר כולל התקנה, איזון וסילוק הצמיג הישן',
            ].map((line) => (
              <li key={line} className="flex items-center gap-2 text-body-md text-on-surface-variant">
                <Icon name="check_circle" size={18} filled className="text-secondary-container" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <LicensePlateInput
            value={selector.plate}
            onChange={selector.changePlate}
            onSubmit={selector.search}
            error={selector.validationError}
            loading={fitment.isLoading}
          />

          <Button
            fullWidth
            size="lg"
            icon="search"
            loading={fitment.isLoading}
            onClick={selector.search}
          >
            מצאו לי צמיגים
          </Button>

          {/*
            Peak hesitation: the visitor has just typed their plate number and is
            deciding whether to hand it over. The badge answers "who am I giving
            this to" in one line, directly under the button doing the asking.
          */}
          <MicroTrustBadge summary={summary.data} className="justify-center" />
        </div>
      </GlassCard>

      {/* Progress announced without moving focus away from the plate input. */}
      <p aria-live="polite" className="sr-only">
        {fitment.isLoading
          ? 'מחפש במאגר משרד התחבורה את מידות הצמיגים המאושרות'
          : vehicle
            ? `נמצאו ${tires.length} צמיגים מתאימים ל${vehicle.make} ${vehicle.model}`
            : ''}
      </p>

      {isUnknownVehicle && (
        <EmptyState
          icon="car_crash"
          title="לא מצאנו את הרכב במאגר"
          description="ייתכן שהמספר הוקלד שגוי, או שהרכב חדש ועדיין לא עודכן. אנחנו נאתר עבורכם ידנית — זה לוקח דקה."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="secondary" size="sm" icon="autorenew" onClick={selector.reset}>
                מספר אחר
              </Button>
              <Button as={Link} to="/quote" size="sm" icon="support_agent">
                שנאתר עבורכם
              </Button>
            </div>
          }
        />
      )}

      {hasNoTireData && (
        <EmptyState
          icon="help_center"
          title="מצאנו את הרכב, אך המידות חסרות במאגר"
          description="במאגר משרד התחבורה אין מידות צמיגים מאושרות לדגם הזה. נאתר אותן ידנית מול היבואן — שלחו פרטים ונחזור אליכם עם המידה המדויקת."
          action={
            <Button as={Link} to="/quote" size="sm" icon="support_agent">
              שנאתר עבורכם
            </Button>
          }
        />
      )}

      {isRegistryDown && (
        <EmptyState
          icon="cloud_off"
          title="מאגר משרד התחבורה אינו זמין כרגע"
          description="התקלה אצלם, לא אצלכם. אפשר לנסות שוב בעוד רגע, או לחפש בקטלוג לפי מידה אם היא ידועה לכם."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="sm" icon="refresh" onClick={fitment.refetch}>
                נסו שוב
              </Button>
              <Button as={Link} to="/catalog" variant="secondary" size="sm" icon="tire_repair">
                חיפוש לפי מידה
              </Button>
            </div>
          }
        />
      )}

      {fitment.isError && !isUnknownVehicle && !hasNoTireData && !isRegistryDown && (
        <ErrorState
          error={fitment.error}
          onRetry={fitment.refetch}
          title="לא הצלחנו לאתר את מידות הרכב"
        />
      )}

      {fitment.isLoading && !vehicle && <LookupProgress />}

      {vehicle && (
        <div className="space-y-6">
          <VehicleSummary
            vehicle={vehicle}
            approvedSizes={selector.approvedSizes}
            onReset={selector.reset}
          />

          {selector.isUnverified && <UnverifiedSourceNotice />}

          {/*
            Sits with the vehicle, not with the tires. Pressure is set by the
            car and its load, so it belongs next to "this is your car" rather
            than repeated down a grid of interchangeable products.
          */}
          <TirePressureCard tirePressure={selector.tirePressure} />

          {selector.isStaggered && (
            <AxleFilter value={selector.position} onChange={selector.setPosition} />
          )}

          {selector.unavailableSizes.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-outline-variant/40 bg-surface-container/50 px-4 py-3 text-label-sm text-on-surface-variant">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              <span>
                המידות{' '}
                <span dir="ltr" className="font-bold text-on-surface">
                  {selector.unavailableSizes.join(', ')}
                </span>{' '}
                מאושרות לרכב אך אינן במלאי כרגע. נשמח להזמין עבורכם — זמן אספקה עד 48 שעות.
              </span>
            </p>
          )}

          {tires.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="אין כרגע צמיגים במלאי במידות של הרכב"
              description="המידות המאושרות לרכב שלכם אינן במלאי הרגעי. השאירו פרטים ונחזור אליכם עם הצעה תוך שעה."
              action={
                <Button as={Link} to="/quote" size="sm" icon="request_quote">
                  בקשת הצעה מותאמת
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-headline text-headline-md text-on-surface">
                  {tires.length} צמיגים מאושרים לרכב שלכם
                </h3>

                <select
                  value={selector.sort}
                  onChange={(event) => selector.setSort(event.target.value)}
                  aria-label="מיון תוצאות"
                  className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-body-md text-on-surface outline-none focus:border-primary-container"
                >
                  <option value="">מומלץ · מידה מקורית תחילה</option>
                  <option value="price-asc">מחיר · מהזול ליוקר</option>
                  <option value="price-desc">מחיר · מהיוקר לזול</option>
                  <option value="rating">דירוג לקוחות</option>
                </select>
              </div>

              <div
                className={cn(
                  'grid gap-6 transition-opacity md:grid-cols-2 xl:grid-cols-3',
                  fitment.isLoading && 'opacity-60',
                )}
              >
                {tires.map((tire) => (
                  <TireCard
                    key={tire.id}
                    tire={tire}
                    inQuote={cart.has(tire.id)}
                    onAddToQuote={(selected) => cart.addItem(selected, 4)}
                  />
                ))}
              </div>

              <AlignmentUpsell />

              {!cart.isEmpty && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary-container/40 bg-primary-container/10 px-6 py-4">
                  <p className="text-body-md text-on-surface">
                    בהצעה שלכם{' '}
                    <span className="font-bold text-primary-container">
                      {cart.totalUnits} צמיגים
                    </span>{' '}
                    · המשיכו לקבלת מחיר סופי כולל התקנה.
                  </p>
                  {/* Second and last badge on this page — the hand-off to the quote form. */}
                  <div className="flex flex-col items-start gap-2">
                    <Button as={Link} to="/quote" size="lg" trailingIcon="arrow_back">
                      להשלמת ההצעה
                    </Button>
                    <MicroTrustBadge summary={summary.data} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
