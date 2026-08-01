import { useState } from 'react'
import { AdminBilling } from '../../components/admin/AdminBilling'
import { DataTable } from '../../components/admin/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { GlassPanel } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { EmptyState } from '../../components/ui/StateViews'
import { useAsyncData } from '../../hooks/useAsyncData'
import {
  INVOICE_STATUS,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
} from '../../lib/constants'
import { formatCurrency, formatDate, formatLicensePlate } from '../../lib/format'
import { invoicesApi } from '../../services/invoiceService'

const STATUS_FILTERS = [
  { value: '', label: 'כל החשבוניות' },
  { value: INVOICE_STATUS.ISSUED, label: 'ממתינות לתשלום' },
  { value: INVOICE_STATUS.PAID, label: 'שולמו' },
  { value: INVOICE_STATUS.DRAFT, label: 'טיוטות' },
  { value: INVOICE_STATUS.VOID, label: 'בוטלו' },
]

const STATUS_TONES = {
  [INVOICE_STATUS.PAID]: 'success',
  [INVOICE_STATUS.ISSUED]: 'primary',
  [INVOICE_STATUS.DRAFT]: 'neutral',
  [INVOICE_STATUS.VOID]: 'error',
  [INVOICE_STATUS.REFUNDED]: 'neutral',
}

function SummaryTile({ icon, label, value, tone = 'text-on-surface' }) {
  return (
    <GlassPanel className="flex items-center gap-3 p-3">
      <span className="flex size-9 items-center justify-center rounded-sm bg-surface-container-highest text-on-surface-variant">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <p className="text-label-sm text-on-surface-variant">{label}</p>
        <p className={`text-label-md ${tone}`}>{value}</p>
      </div>
    </GlassPanel>
  )
}

export function BillingPage() {
  const [status, setStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const invoices = useAsyncData(
    ({ signal }) => invoicesApi.list({ status: status || undefined }, { signal }),
    [status],
    { keepPreviousData: true },
  )

  const items = invoices.data?.items ?? []
  const summary = invoices.data?.summary ?? null

  const columns = [
    {
      key: 'invoiceNumber',
      header: 'מספר',
      render: (invoice) => (
        <span dir="ltr" className="text-label-md text-on-surface">
          {invoice.invoiceNumber ?? '—'}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'לקוח',
      render: (invoice) => (
        <div className="min-w-32">
          <p className="truncate text-label-md text-on-surface">{invoice.customer.name}</p>
          <p dir="ltr" className="truncate text-label-sm text-on-surface-variant">
            {formatLicensePlate(invoice.vehicle.licensePlate)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'סטטוס',
      render: (invoice) => (
        <Badge tone={STATUS_TONES[invoice.status] ?? 'neutral'}>
          {INVOICE_STATUS_LABELS[invoice.status]}
        </Badge>
      ),
    },
    {
      key: 'payment',
      header: 'סליקה',
      className: 'hidden lg:table-cell',
      render: (invoice) => (
        <span
          className={
            invoice.payment.status === PAYMENT_STATUS.FAILED
              ? 'text-label-sm text-error'
              : 'text-label-sm text-on-surface-variant'
          }
        >
          {PAYMENT_STATUS_LABELS[invoice.payment.status] ?? '—'}
        </span>
      ),
    },
    {
      key: 'issuedAt',
      header: 'הונפקה',
      align: 'end',
      className: 'hidden lg:table-cell',
      render: (invoice) => (
        <span className="text-label-sm text-on-surface-variant">
          {formatDate(invoice.issuedAt)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'סכום',
      align: 'end',
      render: (invoice) => (
        <div className="text-end">
          <p className="font-headline text-headline-md tabular-nums text-on-surface">
            {formatCurrency(invoice.totals.grandTotal)}
          </p>
          {invoice.totals.amountDue > 0 && (
            <p className="text-label-sm text-primary-container">
              לתשלום {formatCurrency(invoice.totals.amountDue)}
            </p>
          )}
        </div>
      ),
    },
  ]

  const renderMobileCard = (invoice) => (
    <div className="glass-card space-y-3 rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-md text-on-surface">{invoice.customer.name}</p>
          <p dir="ltr" className="text-label-sm text-on-surface-variant">
            {invoice.invoiceNumber ?? 'טיוטה'} ·{' '}
            {formatLicensePlate(invoice.vehicle.licensePlate)}
          </p>
        </div>
        <Badge tone={STATUS_TONES[invoice.status] ?? 'neutral'}>
          {INVOICE_STATUS_LABELS[invoice.status]}
        </Badge>
      </div>

      <div className="flex items-end justify-between border-t border-outline-variant/25 pt-3">
        <span className="text-label-sm text-on-surface-variant">
          {PAYMENT_STATUS_LABELS[invoice.payment.status] ?? '—'}
        </span>
        <span className="font-headline text-headline-md tabular-nums text-on-surface">
          {formatCurrency(invoice.totals.grandTotal)}
        </span>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-headline text-headline-lg text-on-surface md:text-headline-xl">
            חשבוניות וסליקה
          </h1>
          <p className="mt-1 text-on-surface-variant">
            הנפקת חשבוניות, גביית תשלומים ומעקב אחר יתרות פתוחות
          </p>
        </div>

        <Button
          icon={isCreating ? 'close' : 'add'}
          variant={isCreating ? 'neutral' : 'primary'}
          className="rounded-full"
          onClick={() => setIsCreating((previous) => !previous)}
        >
          {isCreating ? 'סגירת הטופס' : 'חשבונית חדשה'}
        </Button>
      </header>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile
            icon="account_balance_wallet"
            label="נגבה עד כה"
            value={formatCurrency(summary.paidTotal)}
            tone="text-success"
          />
          <SummaryTile
            icon="hourglass_top"
            label="יתרות פתוחות"
            value={formatCurrency(summary.outstandingTotal)}
            tone="text-primary-container"
          />
          <SummaryTile
            icon="receipt_long"
            label="חשבוניות ממתינות"
            value={summary.outstandingCount}
          />
        </div>
      )}

      {isCreating && (
        <AdminBilling
          onInvoicePaid={() => {
            // The list is the record of truth for everything already billed.
            invoices.refetch()
          }}
        />
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-headline text-headline-md text-on-surface">היסטוריית חשבוניות</h2>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="סינון לפי סטטוס"
            className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-on-surface outline-none focus:border-primary-container"
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>

        <DataTable
          caption="היסטוריית חשבוניות"
          columns={columns}
          rows={items}
          isLoading={invoices.isLoading}
          error={invoices.error}
          onRetry={invoices.refetch}
          renderMobileCard={renderMobileCard}
          emptyState={
            <EmptyState
              icon="receipt_long"
              title={status ? 'אין חשבוניות בסטטוס הזה' : 'עדיין לא הונפקו חשבוניות'}
              description="הנפיקו את החשבונית הראשונה כדי להתחיל לגבות תשלומים."
              action={
                !isCreating ? (
                  <Button size="sm" icon="add" onClick={() => setIsCreating(true)}>
                    חשבונית חדשה
                  </Button>
                ) : null
              }
            />
          }
        />
      </section>
    </div>
  )
}
