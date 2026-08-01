import { formatCurrency } from '../../lib/format'
import { Icon } from '../ui/Icon'
import { ErrorState, Skeleton } from '../ui/StateViews'

function SummaryLine({ label, detail, quantity, amount }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-label-md text-on-surface">
          {label}
          {quantity > 1 && <span className="text-on-surface-variant"> ×{quantity}</span>}
        </p>
        {detail && <p className="text-label-sm text-on-surface-variant">{detail}</p>}
      </div>
      <p className="text-body-md whitespace-nowrap text-on-surface">{formatCurrency(amount)}</p>
    </div>
  )
}

/**
 * Live price panel. Every number is server-computed — the client only renders
 * what `POST /quotes/price` returned, so the displayed total can never drift
 * from what the customer is actually charged.
 */
export function QuoteSummary({ pricing, cartItems, onRemoveItem, footer }) {
  const data = pricing.data
  const hasSelection = (cartItems?.length ?? 0) > 0 || pricing.isLoading || Boolean(data)

  return (
    <aside className="glass-card sticky top-24 rounded-lg p-6">
      <h2 className="mb-6 border-b border-outline-variant/30 pb-4 font-headline text-headline-md text-on-surface">
        סיכום הצעת מחיר
      </h2>

      {!hasSelection ? (
        <p className="py-6 text-center text-body-md text-on-surface-variant">
          בחרו שירות או צמיגים והמחיר יתעדכן כאן בזמן אמת.
        </p>
      ) : pricing.isError ? (
        <ErrorState
          error={pricing.error}
          onRetry={pricing.refetch}
          title="לא הצלחנו לחשב מחיר"
        />
      ) : pricing.isLoading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        data && (
          <div className={pricing.isLoading ? 'opacity-60 transition-opacity' : undefined}>
            <div className="mb-6 space-y-4">
              {data.lineItems.map((line) => (
                <div key={line.tireId} className="flex items-start gap-2">
                  <div className="flex-1">
                    <SummaryLine
                      label={line.label}
                      detail={line.detail}
                      quantity={line.quantity}
                      amount={line.lineTotal}
                    />
                  </div>
                  {onRemoveItem && (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(line.tireId)}
                      aria-label={`הסרת ${line.label} מההצעה`}
                      className="rounded-full p-1 text-on-surface-variant transition-colors hover:text-error"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
              ))}

              {data.serviceLines.map((line) => (
                <SummaryLine
                  key={line.serviceId}
                  label={line.label}
                  detail={line.detail}
                  quantity={1}
                  amount={line.lineTotal}
                />
              ))}
            </div>

            <div className="space-y-2 border-t border-outline-variant/30 pt-4">
              <div className="flex justify-between text-label-md text-on-surface-variant">
                <span>סה״כ לפני מע״מ</span>
                <span className="text-body-md text-on-surface">
                  {formatCurrency(data.subtotal, { precise: true })}
                </span>
              </div>
              <div className="flex justify-between text-label-md text-on-surface-variant">
                <span>מע״מ ({Math.round(data.vatRate * 100)}%)</span>
                <span className="text-body-md text-on-surface">
                  {formatCurrency(data.vat, { precise: true })}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="font-headline text-headline-md text-primary-container">
                  סה״כ לתשלום
                </span>
                <span className="font-headline text-headline-md text-on-surface">
                  {formatCurrency(data.total, { precise: true })}
                </span>
              </div>
            </div>

            {data.estimatedMinutes > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                <Icon name="schedule" size={14} />
                זמן טיפול משוער: {data.estimatedMinutes} דקות
              </p>
            )}
          </div>
        )
      )}

      {footer && <div className="mt-6 space-y-3">{footer}</div>}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-label-sm text-on-surface-variant">
        <Icon name="lock" size={14} className="text-secondary" />
        אין תשלום עד לסיום העבודה
      </p>
    </aside>
  )
}
