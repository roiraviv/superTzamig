import { cn } from '../../lib/cn'
import { Icon } from './Icon'

/** Glassmorphic surface used for every customer-facing card. */
export function GlassCard({ as: Component = 'div', glow = false, className, children, ...rest }) {
  return (
    <Component
      {...rest}
      className={cn('glass-card rounded-lg', glow && 'inner-glow', className)}
    >
      {children}
    </Component>
  )
}

/** Denser, admin-flavoured variant with the orange inner hairline. */
export function GlassPanel({ as: Component = 'div', className, children, ...rest }) {
  return (
    <Component {...rest} className={cn('glass-panel rounded-md', className)}>
      {children}
    </Component>
  )
}

export function SectionHeading({
  icon,
  iconTone = 'text-secondary-container',
  title,
  description,
  action,
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-headline text-headline-md text-on-surface">
          {icon && <Icon name={icon} className={iconTone} />}
          {title}
        </h2>
        {description && <p className="text-body-md text-on-surface-variant">{description}</p>}
      </div>
      {action}
    </div>
  )
}
