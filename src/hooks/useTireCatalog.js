import { useCallback, useMemo, useState } from 'react'
import { catalogApi } from '../services/api'
import { useAsyncData } from './useAsyncData'
import { useDebouncedValue } from './useDebouncedValue'

const EMPTY_FILTERS = {
  search: '',
  brands: [],
  seasons: [],
  sizes: [],
  sort: 'relevance',
}

/**
 * Owns catalog filter state and the resulting query. Components read `tires`
 * and render; they never assemble a request.
 */
export function useTireCatalog({ pageSize = 12 } = {}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  const query = useMemo(
    () => ({ ...filters, search: debouncedSearch, page, pageSize }),
    [filters, debouncedSearch, page, pageSize],
  )

  const facets = useAsyncData(({ signal }) => catalogApi.getFacets({ signal }), [])

  const tires = useAsyncData(
    ({ signal }) => catalogApi.listTires(query, { signal }),
    [
      query.search,
      query.sort,
      query.page,
      query.pageSize,
      query.brands.join(','),
      query.seasons.join(','),
      query.sizes.join(','),
    ],
    { keepPreviousData: true },
  )

  /** Toggling any filter resets pagination — otherwise page 3 of 1 result is empty. */
  const toggleFilter = useCallback((key, value) => {
    setPage(1)
    setFilters((previous) => {
      const current = previous[key]
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      return { ...previous, [key]: next }
    })
  }, [])

  const setSearch = useCallback((search) => {
    setPage(1)
    setFilters((previous) => ({ ...previous, search }))
  }, [])

  const setSort = useCallback((sort) => {
    setPage(1)
    setFilters((previous) => ({ ...previous, sort }))
  }, [])

  const clearFilters = useCallback(() => {
    setPage(1)
    setFilters(EMPTY_FILTERS)
  }, [])

  const activeFilterCount =
    filters.brands.length + filters.seasons.length + filters.sizes.length

  return {
    filters,
    facets,
    tires,
    page,
    setPage,
    setSearch,
    setSort,
    toggleFilter,
    clearFilters,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0 || filters.search.trim() !== '',
  }
}
