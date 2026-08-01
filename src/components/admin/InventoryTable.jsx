import { useState } from 'react'
import { cn } from '../../lib/cn'
import { formatCurrency, formatDate, formatNumber } from '../../lib/format'
import { INVENTORY_CATEGORIES } from '../../lib/constants'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Spinner } from '../ui/Spinner'
import { DataTable } from './DataTable'

const categoryLabel = (id) =>
  INVENTORY_CATEGORIES.find((category) => category.id === id)?.label ?? id

function stockTone(item) {
  if (item.stock === 0) return 'error'
  if (item.stock <= item.reorderPoint) return 'primary'
  return 'success'
}

function StockCell({ item, onAdjust, isAdjusting }) {
  const tone = stockTone(item)

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'size-2.5 shrink-0 rounded-full',
          tone === 'error' && 'bg-error shadow-[0_0_8px_rgba(255,180,171,0.5)]',
          tone === 'primary' && 'bg-primary-container shadow-[0_0_8px_rgba(255,107,0,0.5)]',
          tone === 'success' && 'bg-success shadow-[0_0_8px_rgba(74,222,128,0.4)]',
        )}
      />

      <span
        className={cn(
          'w-16 text-label-md tabular-nums',
          tone === 'error' ? 'text-error' : 'text-on-surface',
        )}
      >
        {formatNumber(item.stock)} יח׳
      </span>

      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onAdjust(item, -1)}
          disabled={item.stock === 0 || isAdjusting}
          aria-label={`הורדת יחידה מ${item.name}`}
          className="flex size-7 items-center justify-center rounded-sm border border-outline-variant/50 text-on-surface-variant transition-colors hover:border-error hover:text-error disabled:opacity-30"
        >
          <Icon name="remove" size={16} />
        </button>

        {isAdjusting ? (
          <Spinner size={14} className="mx-1 text-secondary" />
        ) : (
          <button
            type="button"
            onClick={() => onAdjust(item, 1)}
            aria-label={`הוספת יחידה ל${item.name}`}
            className="flex size-7 items-center justify-center rounded-sm border border-outline-variant/50 text-on-surface-variant transition-colors hover:border-secondary hover:text-secondary"
          >
            <Icon name="add" size={16} />
          </button>
        )}
      </span>
    </div>
  )
}

function PriceCell({ item, onSave, isSaving }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(item.price))
  const [error, setError] = useState(null)

  const commit = () => {
    const next = Number(draft)
    if (!Number.isFinite(next) || next <= 0) {
      setError('מחיר חייב להיות מספר חיובי')
      return
    }
    setError(null)
    setEditing(false)
    if (next !== item.price) onSave(item, next)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(item.price))
          setEditing(true)
        }}
        className="group/price flex items-center gap-2 rounded-sm px-1 text-secondary-container transition-colors hover:text-secondary"
      >
        <span className="font-headline text-headline-md tabular-nums">
          {formatCurrency(item.price)}
        </span>
        <Icon
          name="edit"
          size={14}
          className="opacity-0 transition-opacity group-hover/price:opacity-100"
        />
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="1"
          autoFocus
          value={draft}
          disabled={isSaving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setEditing(false)
              setError(null)
            }
          }}
          aria-label={`מחיר עבור ${item.name}`}
          aria-invalid={Boolean(error) || undefined}
          className="w-24 rounded-sm border border-outline-variant bg-surface-container-lowest px-2 py-1 text-body-md text-on-surface outline-none focus:border-primary-container"
        />
        <button
          type="button"
          onClick={commit}
          aria-label="שמירת מחיר"
          className="flex size-7 items-center justify-center rounded-sm text-secondary hover:bg-surface-container-high"
        >
          <Icon name="check" size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError(null)
          }}
          aria-label="ביטול"
          className="flex size-7 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      {error && (
        <span role="alert" className="text-label-sm text-error">
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Inventory grid. Stock and price are editable inline because the alternative —
 * a modal per adjustment — is the slowest possible path for the most frequent
 * action in the garage.
 */
export function InventoryTable({
  items,
  isLoading,
  error,
  onRetry,
  sortBy,
  sortDir,
  onSort,
  onAdjustStock,
  onUpdatePrice,
  pendingId,
  emptyState,
}) {
  const columns = [
    {
      key: 'name',
      header: 'פריט',
      sortable: true,
      render: (item) => (
        <div className="min-w-40">
          <p className="truncate text-label-md text-on-surface">{item.name}</p>
          <p className="truncate text-label-sm text-on-surface-variant">
            {item.brand}
            {item.size !== '—' ? ` · ${item.size}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'מק״ט',
      sortable: true,
      className: 'hidden lg:table-cell',
      render: (item) => (
        <span dir="ltr" className="text-label-sm text-on-surface-variant">
          {item.sku}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'קטגוריה',
      className: 'hidden xl:table-cell',
      render: (item) => <Badge>{categoryLabel(item.category)}</Badge>,
    },
    {
      key: 'stock',
      header: 'מלאי',
      sortable: true,
      render: (item) => (
        <StockCell item={item} onAdjust={onAdjustStock} isAdjusting={pendingId === item.id} />
      ),
    },
    {
      key: 'price',
      header: 'מחיר',
      sortable: true,
      align: 'end',
      render: (item) => (
        <div className="flex justify-end">
          <PriceCell item={item} onSave={onUpdatePrice} isSaving={pendingId === item.id} />
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'עודכן',
      sortable: true,
      align: 'end',
      className: 'hidden lg:table-cell',
      render: (item) => (
        <span className="text-label-sm text-on-surface-variant">{formatDate(item.updatedAt)}</span>
      ),
    },
  ]

  const renderMobileCard = (item) => (
    <div className="glass-card space-y-3 rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-md text-on-surface">{item.name}</p>
          <p className="text-label-sm text-on-surface-variant">{item.brand}</p>
          <p dir="ltr" className="text-label-sm text-on-surface-variant/70">
            {item.sku}
          </p>
        </div>
        <PriceCell item={item} onSave={onUpdatePrice} isSaving={pendingId === item.id} />
      </div>

      <div className="flex items-center justify-between border-t border-outline-variant/25 pt-3">
        <StockCell item={item} onAdjust={onAdjustStock} isAdjusting={pendingId === item.id} />
        {item.stock <= item.reorderPoint && (
          <Button
            variant={item.stock === 0 ? 'primary' : 'secondary'}
            size="sm"
            icon="add_circle"
            onClick={() => onAdjustStock(item, item.reorderPoint * 2)}
          >
            הזמנה
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <DataTable
      caption="רשימת מלאי המוסך"
      columns={columns}
      rows={items}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      emptyState={emptyState}
      renderMobileCard={renderMobileCard}
    />
  )
}
