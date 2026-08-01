import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CatalogFilters } from '../../components/catalog/CatalogFilters'
import { TireCard } from '../../components/catalog/TireCard'
import { Button } from '../../components/ui/Button'
import { AsyncBoundary, EmptyState, Skeleton } from '../../components/ui/StateViews'
import { useQuoteCart } from '../../context/quoteCartContext'
import { useTireCatalog } from '../../hooks/useTireCatalog'

function CatalogSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-[26rem] w-full" />
      ))}
    </div>
  )
}

export function CatalogPage() {
  const catalog = useTireCatalog()
  const cart = useQuoteCart()
  const [lastAdded, setLastAdded] = useState(null)

  const handleAddToQuote = (tire) => {
    cart.addItem(tire, 4)
    setLastAdded(`${tire.brand} ${tire.model}`)
  }

  const resultCount = catalog.tires.isLoading ? null : (catalog.tires.data?.total ?? 0)

  return (
    <div className="mx-auto max-w-(--container-page) space-y-6 px-4 py-6 md:px-10">
      <header className="space-y-2">
        <h1 className="font-headline text-headline-lg text-on-surface md:text-headline-xl">
          קטלוג צמיגים
        </h1>
        <p className="max-w-2xl text-body-lg text-on-surface-variant">
          כל המחירים כוללים התקנה, איזון ממוחשב וסילוק הצמיג הישן. הוסיפו לסל ההצעה
          וקבלו מחיר סופי בתוך דקה.
        </p>
      </header>

      <CatalogFilters
        filters={catalog.filters}
        facets={catalog.facets}
        onSearchChange={catalog.setSearch}
        onToggle={catalog.toggleFilter}
        onSortChange={catalog.setSort}
        onClear={catalog.clearFilters}
        hasActiveFilters={catalog.hasActiveFilters}
        resultCount={resultCount}
      />

      {/* Announced to screen readers without stealing focus from the grid. */}
      <p aria-live="polite" className="sr-only">
        {lastAdded ? `${lastAdded} נוסף להצעת המחיר` : ''}
      </p>

      {lastAdded && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-secondary-container/40 bg-secondary-container/10 px-4 py-3">
          <p className="text-body-md text-on-surface">
            <span className="font-bold text-secondary-container">{lastAdded}</span> נוסף
            להצעת המחיר ({cart.totalUnits} יחידות).
          </p>
          <Button as={Link} to="/quote" size="sm" trailingIcon="arrow_back">
            להשלמת ההצעה
          </Button>
        </div>
      )}

      {cart.isFull && (
        <p role="status" className="rounded-lg border border-primary-container/40 bg-primary-container/10 px-4 py-3 text-body-md text-primary-container">
          הגעתם למספר הפריטים המרבי בהצעה אחת. הסירו פריט או פנו אלינו להצעה מותאמת.
        </p>
      )}

      <AsyncBoundary
        query={catalog.tires}
        loading={<CatalogSkeleton />}
        errorTitle="לא הצלחנו לטעון את הקטלוג"
        empty={
          <EmptyState
            icon="search_off"
            title="לא נמצאו צמיגים תואמים"
            description="נסו להסיר חלק מהמסננים, או ספרו לנו מה אתם מחפשים ונאתר עבורכם."
            action={
              <div className="flex gap-3">
                <Button variant="secondary" size="sm" onClick={catalog.clearFilters}>
                  ניקוי סינון
                </Button>
                <Button as={Link} to="/quote" size="sm">
                  בקשת הצעה מותאמת
                </Button>
              </div>
            }
          />
        }
      >
        {(result) => (
          <>
            <div
              className={
                catalog.tires.isLoading
                  ? 'grid gap-6 opacity-60 transition-opacity md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'grid gap-6 transition-opacity md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              }
            >
              {result.items.map((tire) => (
                <TireCard
                  key={tire.id}
                  tire={tire}
                  inQuote={cart.has(tire.id)}
                  onAddToQuote={handleAddToQuote}
                />
              ))}
            </div>

            {(result.hasMore || catalog.page > 1) && (
              <nav
                aria-label="ניווט בין עמודי הקטלוג"
                className="flex items-center justify-center gap-4 pt-6"
              >
                <Button
                  variant="neutral"
                  size="sm"
                  icon="chevron_right"
                  disabled={catalog.page === 1}
                  onClick={() => catalog.setPage(catalog.page - 1)}
                >
                  הקודם
                </Button>
                <span className="text-label-md text-on-surface-variant">
                  עמוד {catalog.page} מתוך {Math.ceil(result.total / result.pageSize)}
                </span>
                <Button
                  variant="neutral"
                  size="sm"
                  trailingIcon="chevron_left"
                  disabled={!result.hasMore}
                  onClick={() => catalog.setPage(catalog.page + 1)}
                >
                  הבא
                </Button>
              </nav>
            )}
          </>
        )}
      </AsyncBoundary>
    </div>
  )
}
