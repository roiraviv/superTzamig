import { cn } from '../../lib/cn'

export function Spinner({ size = 20, className, label = 'טוען' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block animate-spin rounded-full border-2 border-current', className)}
      style={{
        width: size,
        height: size,
        borderTopColor: 'transparent',
        borderInlineEndColor: 'transparent',
      }}
    />
  )
}
