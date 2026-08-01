import { VEHICLE_CLASSES } from '../../../lib/constants'
import { formatLicensePlate } from '../../../lib/format'
import { Button } from '../../ui/Button'
import { Field, Select, TextInput } from '../../ui/Field'
import { Icon } from '../../ui/Icon'

/**
 * Step 2 — plate lookup first. One field auto-fills three, which is the single
 * biggest friction cut in the whole flow.
 */
export function VehicleStep({ vehicle, errors, onChange, lookup }) {
  const currentYear = new Date().getFullYear()
  const lookupFailed = lookup.isError && lookup.error?.status === 404

  const handleLookup = () => {
    if (vehicle.licensePlate) lookup.run(vehicle.licensePlate)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline text-headline-md text-on-surface">פרטי הרכב</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          הזינו מספר רישוי ונמלא את השאר עבורכם.
        </p>
      </div>

      <Field
        label="מספר רישוי"
        required
        error={errors.licensePlate}
        success={lookup.isSuccess && lookup.data ? 'הפרטים הושלמו אוטומטית מהמאגר' : undefined}
        hint={!lookup.isSuccess ? 'ספרות בלבד, ללא מקפים' : undefined}
      >
        {({ id, describedBy, hasError }) => (
          <div className="flex">
            <input
              id={id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              value={formatLicensePlate(vehicle.licensePlate)}
              onChange={(event) =>
                onChange('licensePlate', event.target.value.replace(/\D/g, '').slice(0, 8))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleLookup()
                }
              }}
              aria-invalid={hasError || undefined}
              aria-describedby={describedBy}
              placeholder="12-345-67"
              className="w-full rounded-s-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-body-md tracking-widest text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 focus:border-primary-container focus:shadow-[0_0_15px_rgba(255,107,0,0.18)]"
            />
            <Button
              variant="neutral"
              icon={lookup.isSubmitting ? undefined : 'search'}
              loading={lookup.isSubmitting}
              onClick={handleLookup}
              className="rounded-s-none rounded-e-lg border-s-0"
              aria-label="חיפוש רכב לפי מספר רישוי"
            />
          </div>
        )}
      </Field>

      {lookupFailed && (
        <p className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container px-4 py-3 text-body-md text-on-surface-variant">
          <Icon name="info" size={18} className="text-secondary" />
          הרכב לא נמצא במאגר. אפשר להשלים את הפרטים ידנית ולהמשיך כרגיל.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <TextInput
          label="יצרן"
          required
          value={vehicle.make}
          error={errors.make}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => onChange('make', event.target.value)}
        />
        <TextInput
          label="דגם"
          required
          value={vehicle.model}
          error={errors.model}
          maxLength={40}
          autoComplete="off"
          onChange={(event) => onChange('model', event.target.value)}
        />
        <TextInput
          label="שנת ייצור"
          required
          type="number"
          inputMode="numeric"
          min={1970}
          max={currentYear + 1}
          value={vehicle.year}
          error={errors.year}
          onChange={(event) => onChange('year', event.target.value)}
        />
      </div>

      <Select
        label="סוג הרכב"
        value={vehicle.vehicleClass ?? 'passenger'}
        onChange={(event) => onChange('vehicleClass', event.target.value)}
        options={VEHICLE_CLASSES.map((item) => ({ value: item.id, label: item.label }))}
        hint="עוזר לנו להקצות את העמדה והמרים המתאימים"
      />
    </div>
  )
}
