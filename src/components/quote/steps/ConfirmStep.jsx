import { SERVICE_TYPES } from '../../../lib/constants'
import { formatLicensePlate, formatLongDate } from '../../../lib/format'
import { Checkbox, TextArea, TextInput } from '../../ui/Field'
import { Icon } from '../../ui/Icon'

function ReviewRow({ icon, label, value, onEdit, editLabel }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 py-3 last:border-b-0">
      <div className="flex gap-3">
        <Icon name={icon} size={20} className="mt-0.5 text-secondary" />
        <div>
          <p className="text-label-sm text-on-surface-variant">{label}</p>
          <p className="text-body-md text-on-surface">{value}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-md px-2 py-1 text-label-sm text-secondary transition-colors hover:bg-surface-container-high"
      >
        {editLabel}
      </button>
    </div>
  )
}

/** Step 4 — contact details plus a last-look summary with inline edit links. */
export function ConfirmStep({ values, errors, onChange, onEditStep }) {
  const serviceLabels = values.serviceIds
    .map((id) => SERVICE_TYPES.find((service) => service.id === id)?.label)
    .filter(Boolean)
    .join(' · ')

  const slotTime = values.schedule.slotId?.split('T')[1] ?? '—'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline text-headline-md text-on-surface">כמעט סיימנו</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          נשאר רק לדעת למי לחזור. אין צורך בכרטיס אשראי ואין חיוב מראש.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="שם מלא"
          required
          autoComplete="name"
          value={values.contact.fullName}
          error={errors.fullName}
          maxLength={60}
          onChange={(event) => onChange('fullName', event.target.value)}
        />
        <TextInput
          label="טלפון נייד"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="050-0000000"
          value={values.contact.phone}
          error={errors.phone}
          maxLength={13}
          onChange={(event) => onChange('phone', event.target.value.replace(/\D/g, '').slice(0, 10))}
        />
      </div>

      <TextInput
        label="אימייל (לא חובה)"
        type="email"
        autoComplete="email"
        dir="ltr"
        value={values.contact.email}
        error={errors.email}
        maxLength={120}
        hint="נשלח אליכם עותק של ההצעה ותזכורת לפני התור"
        onChange={(event) => onChange('email', event.target.value)}
      />

      <TextArea
        label="משהו שכדאי שנדע? (לא חובה)"
        rows={3}
        maxLength={500}
        value={values.contact.notes}
        error={errors.notes}
        hint={`${values.contact.notes.length}/500`}
        placeholder="למשל: רעש בבלימה, רטט בהגה במהירות גבוהה…"
        onChange={(event) => onChange('notes', event.target.value)}
      />

      <section className="glass-card rounded-lg p-6">
        <h3 className="mb-2 text-label-md text-on-surface">סיכום ההזמנה</h3>
        <ReviewRow
          icon="build"
          label="שירותים"
          value={serviceLabels || 'לא נבחר שירות'}
          onEdit={() => onEditStep(0)}
          editLabel="שינוי"
        />
        <ReviewRow
          icon="directions_car"
          label="רכב"
          value={`${values.vehicle.make} ${values.vehicle.model} · ${formatLicensePlate(values.vehicle.licensePlate)}`}
          onEdit={() => onEditStep(1)}
          editLabel="שינוי"
        />
        <ReviewRow
          icon="calendar_today"
          label="מועד"
          value={`${formatLongDate(values.schedule.date)} בשעה ${slotTime}`}
          onEdit={() => onEditStep(2)}
          editLabel="שינוי"
        />
      </section>

      <Checkbox
        checked={values.contact.consent}
        error={errors.consent}
        onChange={(checked) => onChange('consent', checked)}
        label="אני מאשר/ת יצירת קשר בטלפון או ב‑SMS בנוגע להזמנה, ומסכים/ה לתנאי השימוש ומדיניות הפרטיות."
      />
    </div>
  )
}
