import { cn } from '../../../lib/cn'
import { SERVICE_TYPES } from '../../../lib/constants'
import { formatCurrency } from '../../../lib/format'
import { Icon } from '../../ui/Icon'
import { EmptyState } from '../../ui/StateViews'

/**
 * Step 1 — large, thumb-friendly tiles. Multi-select, because a tire change and
 * an alignment are almost always booked together.
 */
export function ServiceStep({ selectedIds, lineItems, error, onToggle }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline text-headline-md text-on-surface">איזה שירות תרצו?</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          אפשר לבחור יותר משירות אחד — נשבץ את כולם לאותו ביקור.
        </p>
      </div>

      <div
        role="group"
        aria-label="בחירת שירותים"
        aria-invalid={Boolean(error) || undefined}
        className="grid grid-cols-2 gap-4 md:grid-cols-3"
      >
        {SERVICE_TYPES.map((service) => {
          const isSelected = selectedIds.includes(service.id)

          return (
            <button
              key={service.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(service.id)}
              className={cn(
                'group flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg p-4 text-center transition-all duration-200 active:scale-[0.98]',
                isSelected
                  ? 'border border-primary-container/40 bg-surface-container/80 shadow-[inset_0_0_12px_rgba(255,107,0,0.12)] backdrop-blur-xl'
                  : 'glass-card hover:border-secondary-container/50',
              )}
            >
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-full transition-all',
                  isSelected
                    ? 'bg-primary-container/20 text-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant group-hover:bg-secondary/10 group-hover:text-secondary',
                )}
              >
                <Icon name={service.icon} filled={isSelected} />
              </span>

              <span
                className={cn(
                  'text-label-md',
                  isSelected ? 'text-on-surface' : 'text-on-surface-variant',
                )}
              >
                {service.label}
              </span>
              <span className="text-label-sm text-on-surface-variant/70">
                {formatCurrency(service.basePrice)} · {service.durationMinutes} דק׳
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-label-sm text-error">
          <Icon name="error" size={14} />
          {error}
        </p>
      )}

      {lineItems.length === 0 && (
        <EmptyState
          icon="tire_repair"
          title="עוד לא בחרתם צמיגים"
          description="אפשר להמשיך רק עם שירות, או לבחור צמיגים מהקטלוג ולקבל הצעה מלאה."
          className="border-outline-variant/40"
        />
      )}
    </div>
  )
}
