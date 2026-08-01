import { useState } from 'react'
import { InventoryTable } from '../../components/admin/InventoryTable'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { EmptyState } from '../../components/ui/StateViews'
import { useInventory } from '../../hooks/useInventory'
import { INVENTORY_CATEGORIES } from '../../lib/constants'
import { formatCurrency } from '../../lib/format'

const STOCK_STATES = [
  { value: '', label: 'כל המלאי' },
  { value: 'healthy', label: 'תקין' },
  { value: 'low', label: 'נמוך' },
  { value: 'out', label: 'אזל' },
]

function SummaryTile({ icon, label, value, tone = 'text-on-surface' }) {
  return (
    <div className="glass-panel flex items-center gap-3 rounded-md p-3">
      <span className="flex size-9 items-center justify-center rounded-sm bg-surface-container-highest text-on-surface-variant">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <p className="text-label-sm text-on-surface-variant">{label}</p>
        <p className={`text-label-md ${tone}`}>{value}</p>
      </div>
    </div>
  )
}

export function InventoryPage() {
  const {
    query,
    patchQuery,
    toggleSort,
    resetFilters,
    inventory,
    items,
    summary,
    total,
    totalPages,
    hasActiveFilters,
    adjustStock,
    updateItem,
  } = useInventory()

  const [pendingId, setPendingId] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const runMutation = async (id, mutation) => {
    setPendingId(id)
    setFeedback(null)
    const result = await mutation()
    setPendingId(null)
    setFeedback(
      result.ok
        ? { tone: 'success', message: 'המלאי עודכן' }
        : { tone: 'error', message: result.error.userMessage },
    )
  }

  const handleAdjustStock = (item, delta) =>
    runMutation(item.id, () => adjustStock.run(item.id, delta))

  const handleUpdatePrice = (item, price) =>
    runMutation(item.id, () => updateItem.run(item.id, { price }))

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-headline text-headline-lg text-on-surface md:text-headline-xl">
            ניהול מלאי
          </h1>
          <p className="mt-1 text-on-surface-variant">
            צמיגים, חלפים ורמות מלאי · {total} פריטים
          </p>
        </div>

        <Button icon="add" className="rounded-full">
          פריט חדש
        </Button>
      </header>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile
            icon="account_balance_wallet"
            label="שווי מלאי כולל"
            value={formatCurrency(summary.totalValue)}
          />
          <SummaryTile
            icon="warning"
            label="פריטים במלאי נמוך"
            value={summary.lowStockCount}
            tone="text-primary-container"
          />
          <SummaryTile
            icon="production_quantity_limits"
            label="פריטים שאזלו"
            value={summary.outOfStockCount}
            tone="text-error"
          />
        </div>
      )}

      <div className="glass-card flex flex-col gap-3 rounded-md p-4 md:flex-row">
        <div className="relative flex-1">
          <Icon
            name="search"
            size={20}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            value={query.search}
            onChange={(event) => patchQuery({ search: event.target.value })}
            placeholder="חיפוש לפי שם, יצרן או מק״ט…"
            aria-label="חיפוש במלאי"
            maxLength={80}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-highest py-2 ps-10 pe-4 text-on-surface transition-colors outline-none placeholder:text-on-surface-variant/50 focus:border-primary-container"
          />
        </div>

        <select
          value={query.category}
          onChange={(event) => patchQuery({ category: event.target.value })}
          aria-label="סינון לפי קטגוריה"
          className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-on-surface outline-none focus:border-primary-container"
        >
          <option value="">כל הקטגוריות</option>
          {INVENTORY_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>

        <select
          value={query.stockState}
          onChange={(event) => patchQuery({ stockState: event.target.value })}
          aria-label="סינון לפי מצב מלאי"
          className="rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-2 text-on-surface outline-none focus:border-primary-container"
        >
          {STOCK_STATES.map((state) => (
            <option key={state.value} value={state.value}>
              {state.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button variant="tertiary" size="sm" icon="close" onClick={resetFilters}>
            ניקוי
          </Button>
        )}
      </div>

      {feedback && (
        <p
          role="status"
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-body-md ${
            feedback.tone === 'success'
              ? 'border border-success/30 bg-success/10 text-success'
              : 'border border-error/40 bg-error-container/15 text-error'
          }`}
        >
          <Icon name={feedback.tone === 'success' ? 'check_circle' : 'error'} size={18} />
          {feedback.message}
        </p>
      )}

      <InventoryTable
        items={items}
        isLoading={inventory.isLoading}
        error={inventory.error}
        onRetry={inventory.refetch}
        sortBy={query.sortBy}
        sortDir={query.sortDir}
        onSort={toggleSort}
        onAdjustStock={handleAdjustStock}
        onUpdatePrice={handleUpdatePrice}
        pendingId={pendingId}
        emptyState={
          <EmptyState
            icon="inventory_2"
            title={hasActiveFilters ? 'אין פריטים תואמים' : 'המלאי ריק'}
            description={
              hasActiveFilters
                ? 'נסו לשנות את מונחי החיפוש או לנקות את הסינון.'
                : 'הוסיפו את הפריט הראשון כדי להתחיל לנהל מלאי.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  ניקוי סינון
                </Button>
              ) : null
            }
          />
        }
      />

      {totalPages > 1 && (
        <nav
          aria-label="ניווט בין עמודי המלאי"
          className="flex items-center justify-center gap-4"
        >
          <Button
            variant="neutral"
            size="sm"
            icon="chevron_right"
            disabled={query.page === 1}
            onClick={() => patchQuery({ page: query.page - 1 })}
          >
            הקודם
          </Button>
          <span className="text-label-md text-on-surface-variant">
            עמוד {query.page} מתוך {totalPages}
          </span>
          <Button
            variant="neutral"
            size="sm"
            trailingIcon="chevron_left"
            disabled={query.page >= totalPages}
            onClick={() => patchQuery({ page: query.page + 1 })}
          >
            הבא
          </Button>
        </nav>
      )}
    </div>
  )
}
