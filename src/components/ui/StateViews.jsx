import { cn } from '../../lib/cn'
import { Button } from './Button'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

/**
 * The four states every data-driven surface must handle. Centralising them here
 * is what lets each page stay a single readable render path.
 */

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-surface-container-high/70', className)}
    />
  )
}

export function LoadingState({ label = 'טוען נתונים…', className, rows = 0 }) {
  if (rows > 0) {
    return (
      <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-live="polite">
        <span className="sr-only">{label}</span>
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-on-surface-variant',
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size={28} className="text-primary-container" />
      <p className="text-body-md">{label}</p>
    </div>
  )
}

export function ErrorState({ error, onRetry, className, title = 'משהו השתבש' }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-error/30 bg-error-container/10 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-error-container/25 text-error">
        <Icon name="error" size={26} />
      </span>
      <div>
        <h3 className="font-headline text-headline-md text-on-surface">{title}</h3>
        <p className="mt-1 text-body-md text-on-surface-variant">
          {error?.userMessage ?? 'אירעה שגיאה בלתי צפויה.'}
        </p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          נסו שוב
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ icon = 'inbox', title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-outline-variant/60 px-6 py-16 text-center',
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <Icon name={icon} size={28} />
      </span>
      <div>
        <h3 className="font-headline text-headline-md text-on-surface">{title}</h3>
        {description && (
          <p className="mt-1 max-w-md text-body-md text-on-surface-variant">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/**
 * Renders the right state for a `useAsyncData` result so callers write the
 * success path only.
 *
 * @param {{ query: object, children: (data: any) => React.ReactNode }} props
 */
export function AsyncBoundary({
  query,
  children,
  loading,
  empty,
  skeletonRows = 0,
  loadingLabel,
  errorTitle,
  className,
}) {
  if (query.isLoading && !query.data) {
    return loading ?? <LoadingState rows={skeletonRows} label={loadingLabel} className={className} />
  }
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={query.refetch}
        title={errorTitle}
        className={className}
      />
    )
  }
  if (query.isEmpty && empty) return empty
  if (!query.data) return null

  return children(query.data)
}
