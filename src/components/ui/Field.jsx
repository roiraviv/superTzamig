import { useId } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

const CONTROL_BASE =
  'w-full rounded-lg bg-surface-container-lowest border px-4 py-3 text-body-md text-on-surface ' +
  'placeholder:text-on-surface-variant/40 transition-all duration-200 outline-none ' +
  'focus:border-primary-container focus:shadow-[0_0_15px_rgba(255,107,0,0.18)] ' +
  'disabled:opacity-50 read-only:text-on-surface-variant'

function controlClasses(hasError, className) {
  return cn(
    CONTROL_BASE,
    hasError ? 'border-error/70 shadow-[0_0_0_1px_rgba(255,180,171,0.3)]' : 'border-outline-variant',
    className,
  )
}

/**
 * Label + control + inline feedback. The error and hint are wired to the
 * control through aria-describedby so screen readers announce them on focus.
 */
export function Field({ label, error, hint, success, required, children, className }) {
  const id = useId()
  const describedBy = [error && `${id}-error`, !error && hint && `${id}-hint`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={id} className="text-label-sm text-on-surface-variant">
          {label}
          {required && <span className="text-primary-container"> *</span>}
        </label>
      )}

      {children({ id, describedBy: describedBy || undefined, hasError: Boolean(error) })}

      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-label-sm text-error">
          <Icon name="error" size={14} />
          {error}
        </p>
      ) : success ? (
        <p className="flex items-center gap-1 text-label-sm text-secondary">
          <Icon name="check_circle" size={14} />
          {success}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-label-sm text-on-surface-variant/70">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({ label, error, hint, success, required, className, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} success={success} required={required}>
      {({ id, describedBy, hasError }) => (
        <input
          {...rest}
          id={id}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={controlClasses(hasError, className)}
        />
      )}
    </Field>
  )
}

export function TextArea({ label, error, hint, required, className, rows = 4, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, hasError }) => (
        <textarea
          {...rest}
          id={id}
          rows={rows}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={controlClasses(hasError, cn('resize-y', className))}
        />
      )}
    </Field>
  )
}

export function Select({ label, error, hint, required, options = [], className, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, hasError }) => (
        <div className="relative">
          <select
            {...rest}
            id={id}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            className={controlClasses(hasError, cn('appearance-none pe-10', className))}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon
            name="expand_more"
            size={20}
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
        </div>
      )}
    </Field>
  )
}

/** Mechanical-switch styling, per the design system's form input notes. */
export function Checkbox({ label, error, checked, onChange, name, disabled }) {
  const id = useId()

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          'flex cursor-pointer items-start gap-3 text-body-md text-on-surface-variant',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className="relative mt-0.5 flex">
          <input
            id={id}
            name={name}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.checked)}
            aria-invalid={Boolean(error) || undefined}
            className="peer size-5 shrink-0 cursor-pointer appearance-none rounded-sm border border-outline-variant bg-surface-container-lowest transition-colors checked:border-secondary-container checked:bg-secondary-container disabled:cursor-not-allowed"
          />
          <Icon
            name="check"
            size={16}
            className="pointer-events-none absolute inset-0 m-auto text-on-secondary-container opacity-0 peer-checked:opacity-100"
          />
        </span>
        <span>{label}</span>
      </label>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-label-sm text-error">
          <Icon name="error" size={14} />
          {error}
        </p>
      )}
    </div>
  )
}
