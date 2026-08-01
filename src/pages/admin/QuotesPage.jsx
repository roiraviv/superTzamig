import { useState } from 'react'
import { QuoteStatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { GlassPanel } from '../../components/ui/Card'
import { TextArea } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { AsyncBoundary, EmptyState } from '../../components/ui/StateViews'
import { useAsyncAction, useAsyncData } from '../../hooks/useAsyncData'
import { adminQuotesApi } from '../../services/api'
import { QUOTE_STATUS, QUOTE_STATUS_LABELS, SERVICE_TYPES } from '../../lib/constants'
import { formatCurrency, formatLicensePlate, formatRelativeTime } from '../../lib/format'

const FILTERS = [
  { value: QUOTE_STATUS.PENDING, label: QUOTE_STATUS_LABELS[QUOTE_STATUS.PENDING] },
  { value: '', label: 'הכל' },
  { value: QUOTE_STATUS.APPROVED, label: QUOTE_STATUS_LABELS[QUOTE_STATUS.APPROVED] },
  { value: QUOTE_STATUS.REJECTED, label: QUOTE_STATUS_LABELS[QUOTE_STATUS.REJECTED] },
]

/** Rejection requires a reason — it's what the customer sees, so it can't be blank. */
function RejectForm({ onCancel, onConfirm, isSubmitting }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)

  return (
    <div className="mt-6 space-y-3 rounded-md border border-error/30 bg-error-container/10 p-4">
      <TextArea
        label="סיבת הדחייה (תישלח ללקוח)"
        rows={2}
        maxLength={300}
        value={reason}
        error={error}
        onChange={(event) => {
          setReason(event.target.value)
          setError(null)
        }}
      />
      <div className="flex gap-2">
        <Button
          variant="danger"
          size="sm"
          icon="close"
          loading={isSubmitting}
          onClick={() => {
            if (reason.trim().length < 3) {
              setError('יש לפרט סיבה קצרה')
              return
            }
            onConfirm(reason.trim())
          }}
        >
          אישור דחייה
        </Button>
        <Button variant="tertiary" size="sm" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </div>
  )
}

export function QuotesPage() {
  const [status, setStatus] = useState(QUOTE_STATUS.PENDING)
  const [rejectingId, setRejectingId] = useState(null)

  const quotes = useAsyncData(
    ({ signal }) => adminQuotesApi.list({ status: status || undefined }, { signal }),
    [status],
    { keepPreviousData: true },
  )

  const { refetch } = quotes

  const decision = useAsyncAction(async (id, action, payload) => {
    const result =
      action === 'approve'
        ? await adminQuotesApi.approve(id, payload)
        : await adminQuotesApi.reject(id, payload)
    setRejectingId(null)
    refetch()
    return result
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline text-headline-lg text-on-surface md:text-headline-xl">
          אישור הצעות מחיר
        </h1>
        <p className="mt-1 text-on-surface-variant">
          כל הצעה שאושרה נשלחת ללקוח ונפתחת להזמנת תור.
        </p>
      </header>

      <div role="tablist" aria-label="סינון לפי סטטוס" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            role="tab"
            aria-selected={status === filter.value}
            onClick={() => setStatus(filter.value)}
            className={`rounded-full border px-4 py-1.5 text-label-sm transition-colors ${
              status === filter.value
                ? 'border-secondary-container bg-secondary-container/15 text-secondary-container'
                : 'border-outline-variant/50 bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {decision.isError && (
        <p role="alert" className="rounded-lg border border-error/40 bg-error-container/15 px-4 py-3 text-body-md text-error">
          {decision.error.userMessage}
        </p>
      )}

      <AsyncBoundary
        query={quotes}
        skeletonRows={3}
        empty={
          <EmptyState
            icon="task_alt"
            title="אין הצעות שממתינות לך"
            description="כל ההצעות בסטטוס הזה טופלו. עבודה יפה."
          />
        }
      >
        {(items) => (
          <ul className="space-y-4">
            {items.map((quote) => (
              <GlassPanel as="li" key={quote.id} className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-headline text-headline-md text-on-surface">
                        {quote.reference}
                      </span>
                      <QuoteStatusBadge status={quote.status} />
                      <span className="text-label-sm text-on-surface-variant">
                        {formatRelativeTime(quote.createdAt)}
                      </span>
                    </div>

                    <p className="text-body-md text-on-surface">
                      {quote.customerName} ·{' '}
                      <a href={`tel:${quote.phone}`} dir="ltr" className="text-secondary">
                        {quote.phone}
                      </a>
                    </p>

                    <p className="text-body-md text-on-surface-variant">
                      {quote.vehicle.make} {quote.vehicle.model} ·{' '}
                      <span dir="ltr">{formatLicensePlate(quote.vehicle.licensePlate)}</span>
                    </p>

                    <p className="text-label-sm text-secondary">
                      {quote.serviceIds
                        .map((id) => SERVICE_TYPES.find((service) => service.id === id)?.label)
                        .filter(Boolean)
                        .join(' · ')}
                    </p>

                    {quote.notes && (
                      <p className="flex items-start gap-1.5 pt-1 text-body-md text-on-surface-variant italic">
                        <Icon name="chat" size={16} className="mt-0.5" />
                        {quote.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <div className="text-start md:text-end">
                      <p className="font-headline text-headline-md text-primary-container">
                        {formatCurrency(quote.total, { precise: true })}
                      </p>
                      <p className="text-label-sm text-on-surface-variant">כולל מע״מ</p>
                    </div>

                    {quote.status === QUOTE_STATUS.PENDING && rejectingId !== quote.id && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          icon="check"
                          loading={decision.isSubmitting}
                          onClick={() => decision.run(quote.id, 'approve', {})}
                        >
                          אישור
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon="close"
                          onClick={() => setRejectingId(quote.id)}
                        >
                          דחייה
                        </Button>
                      </div>
                    )}

                    {quote.decisionNote && (
                      <p className="max-w-xs text-label-sm text-on-surface-variant">
                        {quote.decisionNote}
                      </p>
                    )}
                  </div>
                </div>

                {rejectingId === quote.id && (
                  <RejectForm
                    isSubmitting={decision.isSubmitting}
                    onCancel={() => setRejectingId(null)}
                    onConfirm={(reason) => decision.run(quote.id, 'reject', { reason })}
                  />
                )}
              </GlassPanel>
            ))}
          </ul>
        )}
      </AsyncBoundary>
    </div>
  )
}
