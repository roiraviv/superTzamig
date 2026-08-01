import { cn } from '../../lib/cn'

/**
 * Material Symbols glyph. Decorative by default — pass a `label` only when the
 * icon is the sole carrier of meaning, otherwise it just adds screen-reader noise.
 */
export function Icon({ name, size = 24, filled = false, label, className, ...rest }) {
  return (
    <span
      {...rest}
      className={cn('material-symbols-outlined shrink-0 leading-none', className)}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}`,
        ...rest.style,
      }}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {name}
    </span>
  )
}
