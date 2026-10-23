import { ref, computed } from 'vue'
import { getVisibleColumns, setVisibleColumns, getSortPref, setSortPref } from '../utils/tableColumns'
import { useTableColumnFilters } from './useTableColumnFilters'
import { exportTableToExcel } from '../utils/exportTableToExcel'
import { sortByColumn } from '../utils/tableSort'

/**
 * @param {{
 *   tableId: string,
 *   columns: { key: string, label?: string, filter?: string, sortField?: string, sortType?: 'text'|'number'|'date'|'datetime', defaultVisible?: boolean }[],
 *   rows: import('vue').Ref<object[]>,
 *   cellValue: (row: object, key: string) => unknown,
 *   sortValue?: (row: object, key: string, column?: object) => unknown,
 *   defaultSortKey: string,
 *   defaultSortOrder?: 'asc'|'desc',
 * }} options
 */
export function useRegistryTable(options) {
  const { tableId, columns, rows, cellValue, sortValue = null, defaultSortKey, defaultSortOrder = 'asc' } = options

  const visibleCols = ref(getVisibleColumns(tableId, columns))
  const colPickerOpen = ref(false)
  const sortPref = getSortPref(tableId, defaultSortKey, defaultSortOrder, columns)
  const sortKey = ref(sortPref.sortKey)
  const sortOrder = ref(sortPref.sortOrder)

  const filters = useTableColumnFilters(tableId, columns, () => rows.value, cellValue)

  const displayRows = computed(() => {
    const key = sortKey.value
    const sortCol = columns.find((c) => (c.sortField || c.key) === key)
    const cellKey = sortCol?.key ?? key
    const sortType = sortCol?.sortType || 'text'
    const rawField = sortCol?.sortField || cellKey

    return sortByColumn(filters.filteredRows.value, {
      key: cellKey,
      order: sortOrder.value,
      sortType,
      getValue: (row, colKey) => {
        if (sortValue) return sortValue(row, colKey, sortCol)
        // Даты и числа сравниваем по исходному значению: отформатированная дата
        // «ДД.ММ.ГГГГ» при строковом сравнении даёт неверный порядок.
        if (sortType === 'date' || sortType === 'datetime' || sortType === 'number') {
          const raw = row[rawField]
          if (raw !== undefined) return raw
        }
        return cellValue(row, colKey)
      },
    })
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
