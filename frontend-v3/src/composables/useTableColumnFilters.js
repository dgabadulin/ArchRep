import { ref, computed } from 'vue'
import {
  getFilterPref,
  setFilterPref,
  applyColumnFilters,
  getDistinctValues,
  isColumnFilterActive,
  serializeActiveFilters,
  getEnumMenuChecked,
} from '../utils/tableColumnFilters'

/**
 * Фильтрация по колонкам (клиент), cookie, применение по ОК.
 * @param {string} tableId
 * @param {{ key: string, filter?: string }[]} columnDefs
 * @param {() => object[]} getRows
 * @param {(row: object, key: string) => unknown} getCellValue
 */
export function useTableColumnFilters(tableId, columnDefs, getRows, getCellValue) {
  const filterState = ref(getFilterPref(tableId, columnDefs))
  const openFilterKey = ref(null)

  function persistFilters() {
    setFilterPref(tableId, serializeActiveFilters(filterState.value, columnDefs))
  }

  const filteredRows = computed(() => {
    const rows = getRows()
    return applyColumnFilters(rows, columnDefs, filterState.value, getCellValue)
  })

  function getColDef(key) {
    return columnDefs.find((c) => c.key === key)
  }

  function distinctForColumn(key) {
    return getDistinctValues(getRows(), columnDefs, filterState.value, getCellValue, key)
  }

  function columnFilterActive(key) {
    const col = getColDef(key)
    if (!col) return false
    return isColumnFilterActive(key, col, filterState.value)
  }

  function getTextFilter(key) {
    return filterState.value[key]?.contains ?? ''
  }

  function getEnumCheckedForMenu(key) {
    return getEnumMenuChecked(key, filterState.value, distinctForColumn(key))
  }

  function toggleFilterMenu(key) {
    if (openFilterKey.value === key) {
      cancelFilterMenu()
    } else {
      openFilterKey.value = key
    }
  }

  function cancelFilterMenu() {
    openFilterKey.value = null
  }

  /**
   * @param {string} key
   * @param {{ type: string, contains?: string, checked?: string[] }} payload
   */
  function applyFilterFromMenu(key, payload) {
    const col = getColDef(key)
    if (!col) return

    const next = { ...filterState.value }

    if (payload.type === 'text') {
      const q = (payload.contains ?? '').trim()
      if (!q) delete next[key]
      else next[key] = { type: 'text', contains: payload.contains ?? '' }
    } else if (payload.type === 'enum' || payload.type === 'bool') {
      const distinct = distinctForColumn(key)
      const checked = Array.isArray(payload.checked) ? payload.checked : []
      if (checked.length === 0) {
        next[key] = { type: col.filter, mode: 'none' }
      } else if (checked.length >= distinct.length) {
        delete next[key]
      } else {
        next[key] = { type: col.filter, mode: 'subset', selected: checked }
      }
    }

    filterState.value = next
    openFilterKey.value = null
    persistFilters()
  }

  function resetFilters() {
    filterState.value = {}
    openFilterKey.value = null
    persistFilters()
  }

  return {
    filterState,
    filteredRows,
    openFilterKey,
    applyFilterFromMenu,
    resetFilters,
    toggleFilterMenu,
    cancelFilterMenu,
    distinctForColumn,
    columnFilterActive,
    getTextFilter,
    getEnumCheckedForMenu,
  }
}
