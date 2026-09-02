import { ref, computed } from 'vue'
import { getVisibleColumns, setVisibleColumns, getSortPref, setSortPref } from '../utils/tableColumns'
import { useTableColumnFilters } from './useTableColumnFilters'
import { exportTableToExcel } from '../utils/exportTableToExcel'

/**
 * @param {{
 *   tableId: string,
 *   columns: { key: string, label?: string, filter?: string, sortField?: string, defaultVisible?: boolean }[],
 *   rows: import('vue').Ref<object[]>,
 *   cellValue: (row: object, key: string) => unknown,
 *   defaultSortKey: string,
 *   defaultSortOrder?: 'asc'|'desc',
 * }} options
 */
export function useRegistryTable(options) {
  const { tableId, columns, rows, cellValue, defaultSortKey, defaultSortOrder = 'asc' } = options

  const visibleCols = ref(getVisibleColumns(tableId, columns))
  const colPickerOpen = ref(false)
  const sortPref = getSortPref(tableId, defaultSortKey, defaultSortOrder, columns)
  const sortKey = ref(sortPref.sortKey)
  const sortOrder = ref(sortPref.sortOrder)

  const filters = useTableColumnFilters(tableId, columns, () => rows.value, cellValue)

  const displayRows = computed(() => {
    const list = [...filters.filteredRows.value]
    const key = sortKey.value
    const order = sortOrder.value
    list.sort((a, b) => {
      const sortCol = columns.find((c) => (c.sortField || c.key) === key)
      const cellKey = sortCol?.key ?? key
      const va = cellValue(a, cellKey)
      const vb = cellValue(b, cellKey)
      if (va === vb) return 0
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return order === 'asc' ? cmp : -cmp
    })
    return list
  })

  function sortFieldFor(key) {
    return columns.find((c) => c.key === key)?.sortField || key
  }

  function isSorted(key) {
    return sortKey.value === sortFieldFor(key)
  }

  function toggleSort(key) {
    if (key === 'actions') return
    const field = sortFieldFor(key)
    if (sortKey.value === field) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    else {
      sortKey.value = field
      sortOrder.value = 'asc'
    }
    setSortPref(tableId, sortKey.value, sortOrder.value)
  }

  function colLabel(key) {
    return columns.find((c) => c.key === key)?.label || key
  }

  function filterTypeFor(key) {
    return columns.find((c) => c.key === key)?.filter || ''
  }

  function toggleCol(key) {
    const idx = visibleCols.value.indexOf(key)
    let next
    if (idx >= 0) {
      if (visibleCols.value.length <= 1) return
      next = visibleCols.value.filter((k) => k !== key)
    } else {
      const order = columns.map((c) => c.key)
      const current = [...visibleCols.value]
      const keyIdx = order.indexOf(key)
      const insertAt = current.findIndex((k) => order.indexOf(k) > keyIdx)
      if (insertAt < 0) current.push(key)
      else current.splice(insertAt, 0, key)
      next = current
    }
    visibleCols.value = next
    setVisibleColumns(tableId, next)
  }

  function onFilterClickOutside() {
    if (filters.openFilterKey.value) filters.cancelFilterMenu()
  }

  async function exportExcel({ sheetName, filename }) {
    if (displayRows.value.length === 0) return false
    const exportCols = columns.filter(
      (c) => visibleCols.value.includes(c.key) && c.key !== 'actions',
    )
    await exportTableToExcel({
      rows: displayRows.value,
      columns: exportCols,
      getCellValue: cellValue,
      sheetName,
      filename,
    })
    return true
  }

  return {
    visibleCols,
    colPickerOpen,
    sortKey,
    sortOrder,
    displayRows,
    toggleSort,
    isSorted,
    colLabel,
    filterTypeFor,
    toggleCol,
    onFilterClickOutside,
    exportExcel,
    ...filters,
  }
}
