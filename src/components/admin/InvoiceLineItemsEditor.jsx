import { cn } from '../../lib/cn'
import { calculateLine, invoiceLineFromService } from '../../lib/billing'
import {
  INVOICE_LINE_KINDS,
  INVOICE_LINE_KIND_LABELS,
  MAX_INVOICE_LINES,
  MAX_LINE_QUANTITY,
  SERVICE_TYPES,
} from '../../lib/constants'
import { formatCurrency } from '../../lib/format'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

/**
 * Editable line items for a draft invoice.
 *
 * Admin density rules apply: every field is inline-editable, nothing opens a
 * modal, and line totals update as the operator types. Billing is the last thing
 * between a customer and the door, so it has to be fast.
 *
 * The cell inputs below are shared by the desktop grid and the mobile cards. The
 * two layouts are written separately rather than made responsive with one grid,
 * because a seven-column table on a phone is unusable at any breakpoint.
 */

const GRID_COLUMNS = 'grid-cols-[1fr_7rem_4.5rem_7rem_4.5rem_7rem_2.5rem]'

const CELL_INPUT =
  'w-full rounded-sm border border-outline-variant/60 bg-surface-container-lowest px-2 py-1.5 ' +
  'text-body-md text-on-surface outline-none transition-colors focus:border-primary-container ' +
  'disabled:opacity-50'

function DescriptionInput({ line, index, onPatch, disabled }) {
  return (
    <input
      type="text"
      value={line.description}
      disabled={disabled}
      maxLength={160}
      placeholder="תיאור השורה"
      aria-label={`תיאור שורה ${index + 1}`}
      onChange={(event) => onPatch(line.localId, { description: event.target.value })}
      className={CELL_INPUT}
    />
  )
}

function KindSelect({ line, index, onPatch, disabled }) {
  return (
    <select
      value={line.kind}
      disabled={disabled}
      aria-label={`סוג שורה ${index + 1}`}
      onChange={(event) => onPatch(line.localId, { kind: event.target.value })}
      className={cn(CELL_INPUT, 'appearance-none')}
    >
      {Object.values(INVOICE_LINE_KINDS).map((kind) => (
        <option key={kind} value={kind}>
          {INVOICE_LINE_KIND_LABELS[kind]}
        </option>
      ))}
    </select>
  )
}

function NumberCell({ line, index, field, label, onPatch, disabled, min, max, align = 'center' }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={line[field]}
      disabled={disabled}
      aria-label={`${label} שורה ${index + 1}`}
      onChange={(event) => onPatch(line.localId, { [field]: event.target.value })}
      className={cn(CELL_INPUT, 'tabular-nums', align === 'end' ? 'text-end' : 'text-center')}
    />
  )
}

function RemoveButton({ line, index, onRemove, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onRemove(line.localId)}
      disabled={disabled}
      aria-label={`הסרת שורה ${index + 1}`}
      className="flex size-8 items-center justify-center rounded-sm text-on-surface-variant transition-colors hover:bg-error-container/20 hover:text-error disabled:opacity-30"
    >
      <Icon name="delete" size={18} />
    </button>
  )
}

function MobileLineCard({ line, index, onPatch, onRemove, disabled, canRemove }) {
  const computed = calculateLine(line)

  return (
    <div className="space-y-3 rounded-md border border-outline-variant/30 bg-surface-container-low/40 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-2 text-label-sm text-on-surface-variant">{index + 1}.</span>
        <div className="flex-1">
          <DescriptionInput line={line} index={index} onPatch={onPatch} disabled={disabled} />
        </div>
        <RemoveButton
          line={line}
          index={index}
          onRemove={onRemove}
          disabled={disabled || !canRemove}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
          סוג
          <KindSelect line={line} index={index} onPatch={onPatch} disabled={disabled} />
        </label>
        <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
          כמות
          <NumberCell
            line={line}
            index={index}
            field="quantity"
            label="כמות"
            min={1}
            max={MAX_LINE_QUANTITY}
            onPatch={onPatch}
            disabled={disabled}
          />
        </label>
        <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
          מחיר יחידה
          <NumberCell
            line={line}
            index={index}
            field="unitPrice"
            label="מחיר יחידה"
            min={0}
            align="end"
            onPatch={onPatch}
            disabled={disabled}
          />
        </label>
        <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
          הנחה %
          <NumberCell
            line={line}
            index={index}
            field="discountPercent"
            label="הנחה באחוזים"
            min={0}
            max={100}
            onPatch={onPatch}
            disabled={disabled}
          />
        </label>
      </div>

      <p className="flex items-center justify-between border-t border-outline-variant/25 pt-2 text-label-md">
        <span className="text-on-surface-variant">סה״כ שורה</span>
        <span className="tabular-nums text-on-surface">{formatCurrency(computed.lineTotal)}</span>
      </p>
    </div>
  )
}

export function InvoiceLineItemsEditor({
  lineItems,
  onAdd,
  onPatch,
  onRemove,
  disabled = false,
  error,
}) {
  const atCapacity = lineItems.length >= MAX_INVOICE_LINES
  const canRemove = lineItems.length > 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-headline text-headline-md text-on-surface">
          <Icon name="list_alt" className="text-secondary-container" />
          פירוט החשבונית
        </h2>

        <div className="flex flex-wrap gap-2">
          {/* Fixed-price services are the most-billed lines; one tap each. */}
          {SERVICE_TYPES.slice(0, 4).map((service) => (
            <button
              key={service.id}
              type="button"
              disabled={disabled || atCapacity}
              onClick={() => onAdd(invoiceLineFromService(service))}
              className="flex items-center gap-1.5 rounded-full border border-outline-variant/50 px-3 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:border-secondary-container hover:text-secondary-container disabled:opacity-40"
            >
              <Icon name={service.icon} size={16} />
              {service.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-md border border-outline-variant/30 md:block">
        <div
          className={cn(
            'grid items-center gap-2 border-b border-outline-variant/30 bg-surface-container/60 px-3 py-2 text-label-sm text-on-surface-variant',
            GRID_COLUMNS,
          )}
        >
          <span>תיאור</span>
          <span>סוג</span>
          <span className="text-center">כמות</span>
          <span className="text-end">מחיר יח׳</span>
          <span className="text-center">הנחה %</span>
          <span className="text-end">סה״כ</span>
          <span className="sr-only">פעולות</span>
        </div>

        {lineItems.map((line, index) => (
          <div
            key={line.localId}
            className={cn(
              'grid items-center gap-2 border-b border-outline-variant/15 px-3 py-2 last:border-b-0',
              GRID_COLUMNS,
              index % 2 === 1 && 'bg-surface-container-low/40',
            )}
          >
            <DescriptionInput line={line} index={index} onPatch={onPatch} disabled={disabled} />
            <KindSelect line={line} index={index} onPatch={onPatch} disabled={disabled} />
            <NumberCell
              line={line}
              index={index}
              field="quantity"
              label="כמות"
              min={1}
              max={MAX_LINE_QUANTITY}
              onPatch={onPatch}
              disabled={disabled}
            />
            <NumberCell
              line={line}
              index={index}
              field="unitPrice"
              label="מחיר יחידה"
              min={0}
              align="end"
              onPatch={onPatch}
              disabled={disabled}
            />
            <NumberCell
              line={line}
              index={index}
              field="discountPercent"
              label="הנחה באחוזים"
              min={0}
              max={100}
              onPatch={onPatch}
              disabled={disabled}
            />
            <span className="text-end text-label-md tabular-nums text-on-surface">
              {formatCurrency(calculateLine(line).lineTotal)}
            </span>
            <RemoveButton
              line={line}
              index={index}
              onRemove={onRemove}
              disabled={disabled || !canRemove}
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 md:hidden">
        {lineItems.map((line, index) => (
          <MobileLineCard
            key={line.localId}
            line={line}
            index={index}
            onPatch={onPatch}
            onRemove={onRemove}
            disabled={disabled}
            canRemove={canRemove}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-label-sm text-error">
          <Icon name="error" size={14} />
          {error}
        </p>
      )}

      <Button
        variant="tertiary"
        size="sm"
        icon="add"
        disabled={disabled || atCapacity}
        onClick={() => onAdd()}
      >
        {atCapacity ? `הגעתם ל-${MAX_INVOICE_LINES} שורות` : 'הוספת שורה'}
      </Button>
    </div>
  )
}
