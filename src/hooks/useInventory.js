import { useCallback, useMemo, useState } from 'react'
import { adminInventoryApi } from '../services/api'
import { useAsyncAction, useAsyncData } from './useAsyncData'
import { useDebouncedValue } from './useDebouncedValue'

const DEFAULT_QUERY = {
  search: '',
  category: '',
  stockState: '',
  sortBy: 'name',
  sortDir: 'asc',
  page: 1,
  pageSize: 20,
}

/** Table state + mutations for the admin inventory module. */
export function useInventory() {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const debouncedSearch = useDebouncedValue(query.search, 300)

  const inventory = useAsyncData(
    ({ signal }) =>
      adminInventoryApi.list({ ...query, search: debouncedSearch }, { signal }),
    [
      debouncedSearch,
      query.category,
      query.stockState,
      query.sortBy,
      query.sortDir,
      query.page,
      query.pageSize,
    ],
    { keepPreviousData: true },
  )

  const patchQuery = useCallback((patch) => {
    setQuery((previous) => ({
      ...previous,
      ...patch,
      // Any change other than paging returns to page 1.
      page: 'page' in patch ? patch.page : 1,
    }))
  }, [])

  /** Clicking the active column flips direction; a new column starts ascending. */
  const toggleSort = useCallback((column) => {
    setQuery((previous) => ({
      ...previous,
      sortBy: column,
      sortDir: previous.sortBy === column && previous.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }))
  }, [])

  const resetFilters = useCallback(() => setQuery(DEFAULT_QUERY), [])

  const { refetch } = inventory

  const adjustStock = useAsyncAction(async (id, delta) => {
    const updated = await adminInventoryApi.adjustStock(id, delta)
    refetch()
    return updated
  })

  const updateItem = useAsyncAction(async (id, patch) => {
    const updated = await adminInventoryApi.update(id, patch)
    refetch()
    return updated
  })

  const createItem = useAsyncAction(async (item) => {
    const created = await adminInventoryApi.create(item)
    refetch()
    return created
  })

  const removeItem = useAsyncAction(async (id) => {
    const result = await adminInventoryApi.remove(id)
    refetch()
    return result
  })

  const totalPages = useMemo(() => {
    const { total = 0, pageSize = 20 } = inventory.data ?? {}
    return Math.max(1, Math.ceil(total / pageSize))
  }, [inventory.data])

  return {
    query,
    patchQuery,
    toggleSort,
    resetFilters,
    inventory,
    items: inventory.data?.items ?? [],
    summary: inventory.data?.summary ?? null,
    total: inventory.data?.total ?? 0,
    totalPages,
    hasActiveFilters:
      query.search.trim() !== '' || query.category !== '' || query.stockState !== '',
    adjustStock,
    updateItem,
    createItem,
    removeItem,
  }
}
