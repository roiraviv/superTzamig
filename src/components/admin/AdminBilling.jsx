import { useState } from 'react'
import { cn } from '../../lib/cn'
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_CHANNELS,
  PAYMENT_CHANNEL_OPTIONS,
  PAYMENT_STATUS_LABELS,
  VAT_RATE,
} from '../../lib/constants'
import { formatCurrency, formatDateTime } from '../../lib/format'
import { useInvoiceBuilder } from '../../hooks/useInvoiceBuilder'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { GlassPanel } from '../ui/Card'
import { Select, TextArea, TextInput } from '../ui/Field'
import { Icon } from '../ui/Icon'
import { CardPaymentForm } from './CardPaymentForm'
import { InvoiceLineItemsEditor } from './InvoiceLineItemsEditor'

/** Registered readers. In production this list comes from the terminals collection. */
const TERMINALS = [
  { value: 'POS-01', label: 'מסוף 01 · דלפק קבלה' },
  { value: 'POS-02', label: 'מסוף 02 · עמדת שירות' },
]

function TotalsRow({ label, value, tone = 'muted', bold = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={cn(
          bold ? 'text-label-md text-on-surface' : 'text-body-md text-on-surface-variant',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums',
          bold && 'font-headline text-headline-md',
          tone === 'primary' && 'text-primary-container',
          tone === 'success' && 'text-success',
          tone === 'muted' && !bold && 'text-on-surface',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** Touch-friendly channel tiles. The channel is the only thing that varies. */
function ChannelPicker({ value, onChange, disabled }) {
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 text-label-md text-on-surface">אמצעי תשלום</legend>

      <div className="grid gap-3 sm:grid-cols-2">
        {PAYMENT_CHANNEL_OPTIONS.map((option) => {
          const isSelected = value === option.id
          const isDisabled = disabled || !option.available

          return (
            <button
              key={option.id}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              onClick={() => onChange(option.id)}
              className={cn(
                'flex items-start gap-3 rounded-md border p-4 text-start transition-all duration-200',
                isSelected
                  ? 'border-primary-container bg-primary-container/12 shadow-[0_0_15px_rgba(255,107,0,0.2)]'
                  : 'border-outline-variant/50 hover:border-secondary-container/60',
                isDisabled && 'cursor-not-allowed opacity-40',
              )}
            >
              <Icon
                name={option.icon}
                size={22}
                className={isSelected ? 'text-primary-container' : 'text-on-surface-variant'}
              />
              <span>
                <span className="block text-label-md text-on-surface">{option.label}</span>
                <span className="block text-label-sm text-on-surface-variant">
                  {option.available ? option.hint : 'בקרוב'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Terminal of a captured payment, rendered from PCI-safe artefacts only. */
function PaymentReceipt({ invoice }) {
  const { payment } = invoice

  return (
    <div className="space-y-4 rounded-lg border border-success/30 bg-success/8 p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-success/20 text-success">
          <Icon name="check_circle" size={26} filled />
        </span>
        <div>
          <h3 className="font-headline text-headline-md text-on-surface">התשלום הושלם</h3>
          <p className="text-body-md text-on-surface-variant">
            חשבונית {invoice.invoiceNumber} · {formatCurrency(invoice.totals.grandTotal)}
          </p>
        </div>
      </div>

      <dl className="grid gap-3 text-body-md sm:grid-cols-2">
        <div>
          <dt className="text-label-sm text-on-surface-variant">אמצעי</dt>
          <dd className="text-on-surface">
            {PAYMENT_CHANNEL_OPTIONS.find((option) => option.id === payment.channel)?.label ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-label-sm text-on-surface-variant">סטטוס סליקה</dt>
          <dd className="text-on-surface">{PAYMENT_STATUS_LABELS[payment.status]}</dd>
        </div>
        {payment.card?.last4 && (
          <div>
            <dt className="text-label-sm text-on-surface-variant">כרטיס</dt>
            {/* Four digits is the most this system is ever allowed to know. */}
            <dd dir="ltr" className="font-mono text-on-surface">
              •••• •••• •••• {payment.card.last4}
            </dd>
          </div>
        )}
        {payment.terminalId && (
          <div>
            <dt className="text-label-sm text-on-surface-variant">מסוף</dt>
            <dd dir="ltr" className="text-on-surface">
              {payment.terminalId}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-label-sm text-on-surface-variant">מועד חיוב</dt>
          <dd className="text-on-surface">{formatDateTime(payment.capturedAt)}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * Invoice creation and payment clearance.
 *
 * The screen walks one invoice through three server-enforced states — draft,
 * issued, paid — and the UI mirrors that rather than inventing its own: editing
 * is disabled the moment a number is allocated, because the backend rejects
 * changes to an issued invoice anyway.
 *
 * Card details never reach this component. `CardPaymentForm` owns them, hands
 * them to the service layer for tokenization against the gateway's origin, and
 * clears itself; what comes back here is an invoice carrying only a brand and
 * four digits.
 */
export function AdminBilling({ onInvoicePaid }) {
  const builder = useInvoiceBuilder({ onPaid: onInvoicePaid })
  const [channel, setChannel] = useState(PAYMENT_CHANNELS.CARD_ONLINE)
  const [terminalId, setTerminalId] = useState(TERMINALS[0].value)
  const [reference, setReference] = useState('')

  const { values, errors, totals, issuedInvoice, isLocked, isPaid } = builder

  const handleIssue = async () => {
    if (!builder.validate()) return
    await builder.issue.run()
  }

  const chargeCard = (card) =>
    builder.charge.run({ invoiceId: issuedInvoice.id, channel, card })

  const chargeTerminal = () =>
    builder.charge.run({ invoiceId: issuedInvoice.id, channel, terminalId })

  const settleOffline = () =>
    builder.charge.run({ invoiceId: issuedInvoice.id, channel, reference })

  // Server-priced once issued; the local preview only drives the draft view.
  const displayTotals = issuedInvoice?.totals ?? totals
  const amountDue = issuedInvoice ? issuedInvoice.totals.amountDue : totals.grandTotal

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        {isLocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-secondary-container/40 bg-secondary-container/10 px-4 py-3">
            <p className="flex items-center gap-2 text-body-md text-on-surface">
              <Icon name="receipt_long" size={18} className="text-secondary-container" />
              חשבונית{' '}
              <span dir="ltr" className="font-bold">
                {issuedInvoice.invoiceNumber}
              </span>{' '}
              הונפקה ונעולה לעריכה.
            </p>
            <Badge tone={isPaid ? 'success' : 'primary'}>
              {INVOICE_STATUS_LABELS[issuedInvoice.status]}
            </Badge>
          </div>
        )}

        <GlassPanel className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 font-headline text-headline-md text-on-surface">
            <Icon name="person" className="text-secondary-container" />
            פרטי הלקוח
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="שם מלא"
              required
              maxLength={80}
              autoComplete="name"
              disabled={isLocked}
              value={values.customer.name}
              error={errors.name}
              onChange={(event) => builder.setField('customer', 'name', event.target.value)}
            />
            <TextInput
              label="טלפון"
              dir="ltr"
              inputMode="tel"
              required
              maxLength={10}
              autoComplete="tel"
              disabled={isLocked}
              value={values.customer.phone}
              error={errors.phone}
              onChange={(event) => builder.setField('customer', 'phone', event.target.value)}
            />
            <TextInput
              label="אימייל"
              dir="ltr"
              type="email"
              maxLength={120}
              autoComplete="email"
              hint="החשבונית תישלח לכתובת זו"
              disabled={isLocked}
              value={values.customer.email}
              error={errors.email}
              onChange={(event) => builder.setField('customer', 'email', event.target.value)}
            />
            <TextInput
              label="ח.פ / ת.ז"
              dir="ltr"
              inputMode="numeric"
              maxLength={9}
              hint="נדרש לחשבונית על שם חברה"
              disabled={isLocked}
              value={values.customer.taxId}
              error={errors.taxId}
              onChange={(event) => builder.setField('customer', 'taxId', event.target.value)}
            />
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 font-headline text-headline-md text-on-surface">
            <Icon name="directions_car" className="text-secondary-container" />
            פרטי הרכב
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput
              label="מספר רישוי"
              dir="ltr"
              inputMode="numeric"
              maxLength={8}
              disabled={isLocked}
              value={values.vehicle.licensePlate}
              onChange={(event) =>
                builder.setField('vehicle', 'licensePlate', event.target.value)
              }
            />
            <TextInput
              label="יצרן"
              maxLength={40}
              disabled={isLocked}
              value={values.vehicle.make}
              onChange={(event) => builder.setField('vehicle', 'make', event.target.value)}
            />
            <TextInput
              label="דגם"
              maxLength={60}
              disabled={isLocked}
              value={values.vehicle.model}
              onChange={(event) => builder.setField('vehicle', 'model', event.target.value)}
            />
            <TextInput
              label="קילומטראז׳"
              dir="ltr"
              inputMode="numeric"
              disabled={isLocked}
              value={values.vehicle.odometerKm}
              onChange={(event) => builder.setField('vehicle', 'odometerKm', event.target.value)}
            />
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4 p-6">
          <InvoiceLineItemsEditor
            lineItems={values.lineItems}
            onAdd={builder.addLine}
            onPatch={builder.patchLine}
            onRemove={builder.removeLine}
            disabled={isLocked}
            error={errors.lineItems}
          />

          <TextArea
            label="הערות לחשבונית"
            rows={2}
            maxLength={500}
            disabled={isLocked}
            value={values.notes}
            onChange={(event) => builder.setNotes(event.target.value)}
          />
        </GlassPanel>
      </div>

      <aside className="xl:col-span-4">
        <div className="space-y-4 xl:sticky xl:top-6">
          <GlassPanel className="space-y-4 p-6">
            <h2 className="font-headline text-headline-md text-on-surface">סיכום לתשלום</h2>

            <div className="space-y-2 border-b border-outline-variant/25 pb-4">
              <TotalsRow label="סכום לפני הנחה" value={formatCurrency(displayTotals.subtotal)} />
              {displayTotals.discountTotal > 0 && (
                <TotalsRow
                  label="הנחה"
                  value={`−${formatCurrency(displayTotals.discountTotal)}`}
                  tone="success"
                />
              )}
              <TotalsRow
                label={`מע״מ ${Math.round(VAT_RATE * 100)}%`}
                value={formatCurrency(displayTotals.taxTotal)}
              />
            </div>

            <TotalsRow
              label="סה״כ לתשלום"
              value={formatCurrency(displayTotals.grandTotal, { precise: true })}
              tone="primary"
              bold
            />

            {issuedInvoice && issuedInvoice.totals.amountPaid > 0 && (
              <TotalsRow
                label="שולם"
                value={formatCurrency(issuedInvoice.totals.amountPaid)}
                tone="success"
              />
            )}

            {!isLocked && (
              <>
                <p className="text-label-sm text-on-surface-variant/70">
                  הסכומים מחושבים מחדש בשרת בעת ההנפקה — התצוגה כאן היא תחשיב מקדים.
                </p>

                {builder.issue.isError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/15 px-4 py-3 text-body-md text-error"
                  >
                    <Icon name="error" size={18} />
                    {builder.issue.error.userMessage}
                  </p>
                )}

                <Button
                  fullWidth
                  size="lg"
                  icon="receipt_long"
                  loading={builder.issue.isSubmitting}
                  onClick={handleIssue}
                >
                  הנפקת חשבונית
                </Button>
              </>
            )}
          </GlassPanel>

          {isLocked && !isPaid && (
            <GlassPanel className="space-y-5 p-6">
              <ChannelPicker
                value={channel}
                onChange={setChannel}
                disabled={builder.charge.isSubmitting}
              />

              {channel === PAYMENT_CHANNELS.CARD_ONLINE && (
                <CardPaymentForm
                  amount={amountDue}
                  onSubmit={chargeCard}
                  isSubmitting={builder.charge.isSubmitting}
                  error={builder.charge.error}
                />
              )}

              {channel === PAYMENT_CHANNELS.CARD_TERMINAL && (
                <div className="space-y-4">
                  <Select
                    label="בחירת מסוף"
                    options={TERMINALS}
                    value={terminalId}
                    disabled={builder.charge.isSubmitting}
                    onChange={(event) => setTerminalId(event.target.value)}
                  />

                  <p className="flex items-start gap-2 rounded-lg border border-secondary-container/30 bg-secondary-container/8 px-4 py-3 text-label-sm text-on-surface-variant">
                    <Icon
                      name="contactless"
                      size={16}
                      className="mt-0.5 shrink-0 text-secondary-container"
                    />
                    <span>
                      הסכום יישלח למסוף והלקוח יעביר את הכרטיס שם. אותה בקשת תשלום
                      משמשת את שני הערוצים — פרטי הכרטיס אינם עוברים דרך המערכת כלל.
                    </span>
                  </p>

                  {builder.charge.isError && (
                    <p
                      role="alert"
                      className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/15 px-4 py-3 text-body-md text-error"
                    >
                      <Icon name="error" size={18} />
                      {builder.charge.error.userMessage}
                    </p>
                  )}

                  <Button
                    fullWidth
                    size="lg"
                    icon="point_of_sale"
                    loading={builder.charge.isSubmitting}
                    onClick={chargeTerminal}
                  >
                    שליחה למסוף · {formatCurrency(amountDue)}
                  </Button>
                </div>
              )}

              {(channel === PAYMENT_CHANNELS.CASH ||
                channel === PAYMENT_CHANNELS.BANK_TRANSFER) && (
                <div className="space-y-4">
                  <TextInput
                    label="אסמכתא"
                    maxLength={60}
                    hint="מספר קבלה או אסמכתת העברה, לתיעוד"
                    disabled={builder.charge.isSubmitting}
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                  />

                  {builder.charge.isError && (
                    <p
                      role="alert"
                      className="flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/15 px-4 py-3 text-body-md text-error"
                    >
                      <Icon name="error" size={18} />
                      {builder.charge.error.userMessage}
                    </p>
                  )}

                  <Button
                    fullWidth
                    size="lg"
                    icon="check_circle"
                    loading={builder.charge.isSubmitting}
                    onClick={settleOffline}
                  >
                    סימון כשולם · {formatCurrency(amountDue)}
                  </Button>
                </div>
              )}
            </GlassPanel>
          )}

          {isPaid && (
            <>
              <PaymentReceipt invoice={issuedInvoice} />
              <Button
                fullWidth
                variant="secondary"
                size="lg"
                icon="add"
                onClick={() => {
                  builder.reset()
                  setChannel(PAYMENT_CHANNELS.CARD_ONLINE)
                  setReference('')
                }}
              >
                חשבונית חדשה
              </Button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
