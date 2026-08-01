import { cn } from '../../lib/cn'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

/**
 * Per the design system, the neon orange fill is reserved for primary
 * conversion actions only. Everything else is blue-outlined or ghost.
 */
const VARIANTS = {
  primary:
    'bg-primary-container text-on-primary-container font-bold shadow-lg hover:shadow-[0_0_18px_rgba(255,107,0,0.55)] active:scale-[0.98]',
  secondary:
    'bg-transparent border-2 border-secondary-container text-secondary-container hover:bg-secondary-container/10 hover:shadow-[0_0_15px_rgba(0,162,253,0.35)] active:scale-[0.98]',
  tertiary: 'bg-transparent text-secondary hover:bg-surface-container-high active:scale-[0.98]',
  neutral:
    'bg-surface-container-highest text-on-surface border border-outline-variant/60 hover:bg-surface-bright active:scale-[0.98]',
  danger:
    'bg-transparent border border-error/60 text-error hover:bg-error-container/20 active:scale-[0.98]',
}

const SIZES = {
  sm: 'text-label-sm px-3 py-1.5 gap-1.5 rounded-md',
  md: 'text-label-md px-6 py-3 gap-2 rounded-lg',
  lg: 'text-label-md px-8 py-4 gap-2 rounded-lg',
}

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  icon,
  iconFilled = false,
  trailingIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  className,
  children,
  ...rest
}) {
  const isDisabled = disabled || loading

  return (
    <Component
      {...rest}
      type={Component === 'button' ? (rest.type ?? 'button') : rest.type}
      disabled={Component === 'button' ? isDisabled : undefined}
      aria-disabled={Component === 'button' ? undefined : isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-all duration-200',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? (
        <Spinner size={size === 'sm' ? 14 : 18} />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} filled={iconFilled} />
      )}
      {children}
      {trailingIcon && !loading && (
        <Icon name={trailingIcon} size={size === 'sm' ? 16 : 18} />
      )}
    </Component>
  )
}
