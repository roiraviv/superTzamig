import { Link } from 'react-router-dom'
import { VEHICLE_CLASSES } from '../../lib/constants'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { InfoTooltip } from '../ui/Tooltip'

/**
 * Tire pressure panel.
 *
 * Rendered once per vehicle rather than per tire, because inflation pressure is
 * a property of the car and its load — not of the brand on the sidewall.
 * Repeating the same figure down a grid of twelve tires would imply it varies
 * between them, which is the opposite of true.
 *
 * The panel is deliberately built from two claims of different strength, and
 * they are styled so a visitor can tell which is which:
 *
 *   - the TPMS line is a fact from the Ministry of Transport model dataset
 *   - the bar/PSI figure is a RANGE typical of the vehicle class, and the
 *     registry publishes no per-vehicle pressure whatsoever
 *
 * Hence the placard note is not fine print tucked at the bottom — it is the
 * line that tells the customer where the real number for their car is. Quoting
 * a specific pressure we cannot source would be a safety claim, and a wrong one
 * costs either fuel and tread or braking distance.
 */

const CLASS_LABELS = Object.fromEntries(VEHICLE_CLASSES.map(({ id, label }) => [id, label]))

/** Exactly the copy the brief asked for, and the reason anyone should care. */
const PRESSURE_BENEFIT = 'לחץ אוויר תקין חוסך בדלק ומונע שחיקת צמיגים'

function TpmsBadge({ equipped }) {
  // `null` means the model rows were unavailable or disagreed across trims.
  // Silence is the honest rendering of "we don't know".
  if (equipped == null) return null

  return equipped ? (
    <Badge tone="secondary">
      <Icon name="sensors" size={14} filled />
      מצויד בחיישני לחץ אוויר (TPMS)
    </Badge>
  ) : (
    <Badge tone="neutral">
      <Icon name="sensors_off" size={14} />
      ללא חיישני לחץ אוויר
    </Badge>
  )
}

export function TirePressureCard({ tirePressure }) {
  const guidance = tirePressure?.guidance
  if (!guidance) return null

  const classLabel = CLASS_LABELS[guidance.vehicleClass] ?? 'רכב פרטי'

  return (
    <section
      aria-labelledby="tire-pressure-heading"
      className="rounded-lg border border-outline-variant/40 bg-surface-container/50 p-6"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <h3
            id="tire-pressure-heading"
            className="flex items-center gap-2 font-headline text-headline-md text-on-surface"
          >
            <Icon name="tire_repair" size={22} className="text-secondary-container" />
            לחץ אוויר בצמיגים
            <InfoTooltip text={PRESSURE_BENEFIT} label="למה לחץ אוויר תקין חשוב" />
          </h3>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            {/* BAR leads: it is what the compressor at the bay reads. */}
            <p dir="ltr" className="font-headline text-headline-xl leading-none text-on-surface">
              {guidance.barMin.toFixed(1)}–{guidance.barMax.toFixed(1)}
              <span className="ms-2 text-headline-md text-on-surface-variant">bar</span>
            </p>
            <p dir="ltr" className="text-body-lg text-on-surface-variant">
              ({guidance.psiMin}–{guidance.psiMax} PSI)
            </p>
          </div>

          <p className="text-body-md text-on-surface-variant">
            טווח אופייני ל{classLabel} — לא הערך המדויק של הרכב שלכם.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <TpmsBadge equipped={tirePressure?.tpms?.equipped} />

          <Button
            as={Link}
            to="/book"
            variant="secondary"
            size="sm"
            icon="compress"
            className="shrink-0"
          >
            בדיקת לחץ אוויר — ללא תשלום
          </Button>
        </div>
      </div>

      {/*
        The single most useful sentence in this panel. The exact figure exists,
        it is just not ours to publish — so point at where it actually lives
        instead of inventing a number that looks equally confident.
      */}
      <p className="mt-5 flex items-start gap-3 border-t border-outline-variant/30 pt-4 text-body-md text-on-surface-variant">
        <Icon name="sticky_note_2" size={20} className="mt-0.5 shrink-0 text-primary-container" />
        <span>
          <span className="text-on-surface">
            הערך המדויק שקבע יצרן הרכב מופיע על המדבקה שבמשקוף דלת הנהג
          </span>{' '}
          (או בספר הרכב). משרד התחבורה אינו מפרסם לחץ אוויר מומלץ, ולכן לא נמציא לכם מספר —
          נשמח לבדוק ולכוון עבורכם במוסך.
        </span>
      </p>
    </section>
  )
}
