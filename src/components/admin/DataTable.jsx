import { cn } from '../../lib/cn'
import { Icon } from '../ui/Icon'
import { ErrorState, Skeleton } from '../ui/StateViews'

/**
 * Dense, sortable table for the admin modules.
 *
 * Presentation only: it owns no data and no sorting logic, it just reports
 * intent through `onSort`. That keeps one table component usable for inventory,
 * appointments, and quotes without any of them leaking into it.
 *
 * Below `md` it swaps to stacked cards via `renderMobileCard`, because a
 * horizontally scrolling table is unusable on a phone in the service bay.
 *
 * @param {{
 *   columns: Array<{ key: string, header: string, sortable?: boolean, align?: 'start'|'end'|'center',
 *                    className?: string, render?: (row: object) => React.ReactNode }>,
 *   rows: object[],
 *   keyField?: string,
 * }} props
 */
export function DataTable({
  columns,
  rows,
  keyField = 'id',
  caption,
  sortBy,
  sortDir = 'asc',
  onSort,
  isLoading = false,
  error = null,
  onRetry,
  emptyState,
  renderMobileCard,
  onRowClick,
}) {
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} title="לא הצלחנו לטעון את הנתונים" />
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) return emptyState ?? null

  const alignClass = (align) =>
    align === 'end' ? 'text-end' : align === 'center' ? 'text-center' : 'text-start'

  return (
    <>
      {renderMobileCard && (
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <div key={row[keyField]}>{renderMobileCard(row)}</div>
          ))}
        </div>
      )}

      <div
        className={cn(
          'overflow-x-auto rounded-md border border-outline-variant/30',
          renderMobileCard && 'hidden md:block',
          isLoading && 'opacity-60 transition-opacity',
        )}
      >
        <table className="w-full border-collapse text-start">
          {caption && <caption className="sr-only">{caption}</caption>}

          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container/60">
              {columns.map((column) => {
                const isSorted = sortBy === column.key
                const ariaSort = isSorted
                  ? sortDir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.sortable ? ariaSort : undefined}
                    className={cn(
                      'px-3 py-3 text-label-sm font-semibold text-on-surface-variant',
                      alignClass(column.align),
                      column.className,
                    )}
                  >
                    {column.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(column.key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-on-surface',
                          isSorted && 'text-secondary',
                        )}
                      >
                        {column.header}
                        <Icon
                          name={
                            isSorted
                              ? sortDir === 'asc'
                                ? 'arrow_upward'
                                : 'arrow_downward'
                              : 'unfold_more'
                          }
                          size={14}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row[keyField]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-outline-variant/15 transition-colors last:border-b-0',
                  index % 2 === 1 && 'bg-surface-container-low/40',
                  'hover:bg-secondary-container/8',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-3 text-body-md text-on-surface',
                      alignClass(column.align),
                      column.className,
                    )}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
