import { cn } from '../../lib/cn'
import { SEASONS } from '../../lib/constants'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Skeleton } from '../ui/StateViews'

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-label-sm transition-all active:scale-95',
        active
          ? 'border-secondary-container bg-secondary-container/15 text-secondary-container'
          : 'border-outline-variant/60 bg-surface-container text-on-surface-variant hover:border-secondary/50 hover:text-on-surface',
      )}
    >
      {children}
    </button>
  )
}

function FilterGroup({ title, children }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-label-sm text-on-surface-variant">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'הכי פופולרי' },
  { value: 'price-asc', label: 'מחיר: מהנמוך לגבוה' },
  { value: 'price-desc', label: 'מחיר: מהגבוה לנמוך' },
  { value: 'rating', label: 'דירוג לקוחות' },
]

export function CatalogFilters({
  filters,
  facets,
  onSearchChange,
  onToggle,
  onSortChange,
  onClear,
  hasActiveFilters,
  resultCount,
}) {
  const seasonLabel = (id) => SEASONS.find((season) => season.id === id)?.label ?? id

  return (
    <div className="glass-card space-y-6 rounded-lg p-6">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="group relative flex-1">
          <Icon
            name="search"
            size={20}
            className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary-container"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="חיפוש לפי מידה, יצרן או דגם…"
            aria-label="חיפוש בקטלוג הצמיגים"
            maxLength={80}
            className="w-full rounded-full border border-outline-variant bg-surface-container py-3 ps-12 pe-4 text-body-md text-on-surface transition-all outline-none placeholder:text-on-surface-variant/40 focus:border-primary-container focus:shadow-[0_0_15px_rgba(255,107,0,0.15)]"
          />
        </div>

        <label className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 text-label-sm text-on-surface-variant">
          <Icon name="sort" size={18} />
          <span className="sr-only md:not-sr-only">מיון</span>
          <select
            value={filters.sort}
            onChange={(event) => onSortChange(event.target.value)}
            className="bg-transparent py-3 text-body-md text-on-surface outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {facets.isLoading && !facets.data ? (
        <div className="flex gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      ) : facets.isError ? (
        <p className="text-label-sm text-on-surface-variant">
          לא הצלחנו לטעון את אפשרויות הסינון. החיפוש החופשי עדיין פעיל.
        </p>
      ) : (
        facets.data && (
          <div className="grid gap-6 md:grid-cols-3">
            <FilterGroup title="יצרן">
              {facets.data.brands.map((brand) => (
                <FilterChip
                  key={brand}
                  active={filters.brands.includes(brand)}
                  onClick={() => onToggle('brands', brand)}
                >
                  {brand}
                </FilterChip>
              ))}
            </FilterGroup>

            <FilterGroup title="עונה">
              {facets.data.seasons.map((season) => (
                <FilterChip
                  key={season}
                  active={filters.seasons.includes(season)}
                  onClick={() => onToggle('seasons', season)}
                >
                  {seasonLabel(season)}
                </FilterChip>
              ))}
            </FilterGroup>

            <FilterGroup title="מידה">
              {facets.data.sizes.map((size) => (
                <FilterChip
                  key={size}
                  active={filters.sizes.includes(size)}
                  onClick={() => onToggle('sizes', size)}
                >
                  {size}
                </FilterChip>
              ))}
            </FilterGroup>
          </div>
        )
      )}

      <div className="flex items-center justify-between gap-4 border-t border-outline-variant/25 pt-3">
        <p aria-live="polite" className="text-label-sm text-on-surface-variant">
          {resultCount === null ? 'מחפש…' : `${resultCount} דגמים תואמים`}
        </p>
        {hasActiveFilters && (
          <Button variant="tertiary" size="sm" icon="close" onClick={onClear}>
            ניקוי סינון
          </Button>
        )}
      </div>
    </div>
  )
}
