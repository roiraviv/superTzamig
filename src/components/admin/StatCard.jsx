import { cn } from '../../lib/cn'
import { Icon } from '../ui/Icon'
import { Skeleton } from '../ui/StateViews'

const TONES = {
  secondary: {
    icon: 'text-secondary-container',
    glow: 'bg-secondary-container/10 group-hover:bg-secondary-container/20',
    hover: 'hover:shadow-[0_8px_32px_rgba(0,162,253,0.15)]',
    value: 'text-on-surface',
  },
  primary: {
    icon: 'text-primary-container',
    glow: 'bg-primary-container/10 group-hover:bg-primary-container/20',
    hover: 'hover:shadow-[0_8px_32px_rgba(255,107,0,0.15)]',
    value: 'text-on-surface',
  },
  error: {
    icon: 'text-error',
    glow: 'bg-error/10',
    hover: 'hover:border-error/50',
    value: 'text-error',
  },
  neutral: {
    icon: 'text-tertiary',
    glow: 'bg-surface-bright/20',
    hover: 'hover:shadow-[0_8px_32px_rgba(255,255,255,0.05)]',
    value: 'text-on-surface',
  },
}

export function StatCard({ icon, label, value, trend, note, tone = 'neutral', pulse, loading }) {
  const palette = TONES[tone]

  return (
    <div
      className={cn(
        'glass-panel group relative overflow-hidden rounded-md p-6 transition-all duration-300',
        palette.hover,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          '-me-10 -mt-10 absolute top-0 end-0 size-32 rounded-full blur-2xl transition-colors',
          palette.glow,
        )}
      />

      {pulse && (
        <span className="absolute top-4 end-4 flex size-3">
          <span
            className="absolute inline-flex size-full rounded-full bg-error opacity-75"
            style={{ animation: 'pulse-ring 2s cubic-bezier(0.215,0.61,0.355,1) infinite' }}
          />
          <span className="relative inline-flex size-3 rounded-full bg-error" />
        </span>
      )}

      <div className="relative z-10 mb-6 flex items-start justify-between">
        <span
          className={cn(
            'rounded-lg border border-outline-variant/30 bg-surface-container-highest p-3',
            palette.icon,
          )}
        >
          <Icon name={icon} />
        </span>

        {typeof trend === 'number' && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-label-sm',
              trend >= 0
                ? 'bg-secondary-container/10 text-secondary-container'
                : 'bg-error-container/20 text-error',
            )}
          >
            <Icon name={trend >= 0 ? 'trending_up' : 'trending_down'} size={14} />
            {trend > 0 ? '+' : ''}
            {trend}%
          </span>
        )}
      </div>

      <div className="relative z-10">
        <p className="mb-1 text-body-md text-on-surface-variant">{label}</p>
        {loading ? (
          <Skeleton className="h-12 w-24" />
        ) : (
          <p className={cn('font-headline text-headline-xl', palette.value)}>{value}</p>
        )}
        {note && <p className="mt-2 text-label-sm text-error/70">{note}</p>}
      </div>
    </div>
  )
}
