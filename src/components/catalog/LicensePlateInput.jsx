import { useId } from 'react'
import { cn } from '../../lib/cn'
import { formatLicensePlate } from '../../lib/format'
import { Icon } from '../ui/Icon'

/**
 * An input dressed as an Israeli number plate.
 *
 * The skin is the point: a visitor who does not know what "225/45R18" means
 * still recognises a number plate instantly, so there is nothing to learn before
 * the first interaction. The colours below are the physical plate's, not brand
 * tokens, which is why they are literal here rather than in the theme.
 *
 * The plate is forced to `dir="ltr"` inside the RTL page because a plate number
 * reads left to right, and grouping (12-345-67) would otherwise render mirrored.
 */

const PLATE_YELLOW = '#f0c400'
const PLATE_INK = '#0d0d0d'

export function LicensePlateInput({
  value,
  onChange,
  onSubmit,
  error,
  disabled = false,
  loading = false,
  autoFocus = false,
}) {
  const inputId = useId()
  const errorId = `${inputId}-error`

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={inputId} className="text-label-md text-on-surface">
        הזינו את מספר הרישוי
      </label>

      <div
        dir="ltr"
        className={cn(
          'relative flex items-stretch overflow-hidden rounded-md border-2 transition-all duration-200',
          'shadow-[0_6px_24px_rgba(0,0,0,0.45)]',
          error
            ? 'border-error'
            : 'border-black/70 focus-within:border-primary-container focus-within:shadow-[0_0_22px_rgba(255,107,0,0.4)]',
          disabled && 'opacity-60',
        )}
        style={{ backgroundColor: PLATE_YELLOW }}
      >
        {/* The blue EU-style strip on the physical plate. */}
        <span
          aria-hidden="true"
          className="flex w-11 shrink-0 flex-col items-center justify-center gap-1 bg-[#003399] text-white select-none"
        >
          <span className="text-[9px] leading-none tracking-widest">★</span>
          <span className="text-[11px] leading-none font-bold tracking-wider">IL</span>
        </span>

        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          dir="ltr"
          value={formatLicensePlate(value)}
          disabled={disabled}
          maxLength={10}
          placeholder="12-345-67"
          aria-label="מספר רישוי הרכב"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSubmit()
            }
          }}
          className="w-full min-w-0 bg-transparent px-4 py-4 text-center text-3xl font-bold tabular-nums tracking-[0.12em] outline-none placeholder:opacity-30 md:text-4xl"
          style={{ color: PLATE_INK }}
        />

        {loading && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2" aria-hidden="true">
            <Icon name="progress_activity" size={22} className="animate-spin" style={{ color: PLATE_INK }} />
          </span>
        )}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-label-sm text-error">
          <Icon name="error" size={14} />
          {error}
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant/80">
          <Icon name="lock" size={14} />
          המספר משמש לאיתור המידות המאושרות בלבד ואינו נשמר ללא אישורכם.
        </p>
      )}
    </div>
  )
}
