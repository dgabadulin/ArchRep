import { getConfig } from '@/config/params'

const EMPTY_LABEL = '(пусто)'

function getCookie(name) {
  const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
  return v ? decodeURIComponent(v.pop()) : null
}

function setCookie(name, value, maxAge) {
  if (maxAge == null) {
    const days = (getConfig().ARR_COOKIE_MAX_DAYS ?? 365) | 0
    maxAge = days * 24 * 60 * 60
  }
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`
}

/** @param {unknown} val */
export function normalizeFilterDisplayValue(val) {
  const s = String(val ?? '').trim()
  if (!s || s === '—') return EMPTY_LABEL
  return s
}

export { EMPTY_LABEL }

/**
 * @param {string} tableId
 * @param {{ key: string, filter?: string }[]} columnDefs
 * @returns {Record<string, object>}
 */
export function getFilterPref(tableId, columnDefs) {
  const allowed = new Map(columnDefs.filter((c) => c.filter).map((c) => [c.key, c.filter]))
  const prefix = getConfig().ARR_FILTER_COOKIE ?? 'ar_filters_'
  const raw = getCookie(prefix + tableId)
  if (!raw) return {}
  try {
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return {}
    const out = {}
    for (const [key, state] of Object.entries(o)) {
      const filterType = allowed.get(key)
      if (!filterType || !state || typeof state !== 'object') continue
      if (filterType === 'text' && state.type === 'text' && typeof state.contains === 'string') {
        const q = state.contains.trim()
        if (q) out[key] = { type: 'text', contains: state.contains }
      } else if (filterType === 'enum' || filterType === 'bool') {
        if (state.mode === 'none') {
          out[key] = { type: filterType, mode: 'none' }
        } else if (state.mode === 'subset' && Array.isArray(state.selected)) {
          const selected = state.selected.filter((v) => typeof v === 'string')
          if (selected.length) out[key] = { type: filterType, mode: 'subset', selected }
        } else if (Array.isArray(state.selected) && state.selected.length) {
          out[key] = { type: filterType, mode: 'subset', selected: state.selected.filter((v) => typeof v === 'string') }
        }
      }
    }
    return out
  } catch (_) {
    return {}
  }
}

/**
 * @param {string} tableId
 * @param {Record<string, object>} filterState
 */
export function setFilterPref(tableId, filterState) {
  const prefix = getConfig().ARR_FILTER_COOKIE ?? 'ar_filters_'
  setCookie(prefix + tableId, JSON.stringify(filterState))
}

/**
 * @param {object} row
 * @param {string} key
 * @param {Record<string, object>} filterState
 * @param {{ filter?: string }} colDef
 * @param {(row: object, key: string) => unknown} getCellValue
 */
export function rowMatchesColumnFilter(row, key, filterState, colDef, getCellValue) {
  const type = colDef.filter
  if (!type) return true
  const state = filterState[key]
  if (!state) return true

  const display = normalizeFilterDisplayValue(getCellValue(row, key))

  if (type === 'text') {
    const q = (state.contains || '').trim()
    if (!q) return true
    return display.toLowerCase().includes(q.toLowerCase())
  }

  if (type === 'enum' || type === 'bool') {
    if (state.mode === 'none') return false
    if (state.mode === 'subset') {
      const selected = state.selected
      if (!Array.isArray(selected) || selected.length === 0) return false
      return selected.includes(display)
    }
    if (Array.isArray(state.selected) && state.selected.length) {
      return state.selected.includes(display)
    }
    return true
  }

  return true
}

/**
 * @param {object[]} rows
 * @param {{ key: string, filter?: string }[]} columnDefs
 * @param {Record<string, object>} filterState
 * @param {(row: object, key: string) => unknown} getCellValue
 * @param {string|null} [excludeKey]
 */
export function applyColumnFilters(rows, columnDefs, filterState, getCellValue, excludeKey = null) {
  const filterCols = columnDefs.filter((c) => c.filter && c.key !== 'actions')
  return rows.filter((row) => {
    for (const col of filterCols) {
      if (excludeKey && col.key === excludeKey) continue
      if (!rowMatchesColumnFilter(row, col.key, filterState, col, getCellValue)) {
        return false
      }
    }
    return true
  })
}

/**
 * @param {object[]} rows
 * @param {{ key: string, filter?: string }[]} columnDefs
 * @param {Record<string, object>} filterState
 * @param {(row: object, key: string) => unknown} getCellValue
 * @param {string} key
 */
export function getDistinctValues(rows, columnDefs, filterState, getCellValue, key) {
  const base = applyColumnFilters(rows, columnDefs, filterState, getCellValue, key)
  const set = new Set()
  for (const row of base) {
    set.add(normalizeFilterDisplayValue(getCellValue(row, key)))
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/**
 * @param {string} key
 * @param {{ filter?: string }} colDef
 * @param {Record<string, object>} filterState
 */
export function isColumnFilterActive(key, colDef, filterState) {
  if (!colDef.filter) return false
  const state = filterState[key]
  if (!state) return false
  if (colDef.filter === 'text') {
    return !!(state.contains || '').trim()
  }
  if (colDef.filter === 'enum' || colDef.filter === 'bool') {
    return state.mode === 'none' || state.mode === 'subset' || (Array.isArray(state.selected) && state.selected.length > 0)
  }
  return false
}

/**
 * @param {Record<string, object>} filterState
 * @param {{ key: string, filter?: string }[]} columnDefs
 */
export function serializeActiveFilters(filterState, columnDefs) {
  const out = {}
  for (const col of columnDefs) {
    if (!col.filter) continue
    const state = filterState[col.key]
    if (!state) continue
    if (col.filter === 'text') {
      const q = (state.contains || '').trim()
      if (q) out[col.key] = { type: 'text', contains: state.contains }
    } else if (col.filter === 'enum' || col.filter === 'bool') {
      if (state.mode === 'none') {
        out[col.key] = { type: col.filter, mode: 'none' }
      } else if (state.mode === 'subset' && Array.isArray(state.selected) && state.selected.length) {
        out[col.key] = { type: col.filter, mode: 'subset', selected: [...state.selected] }
      } else if (Array.isArray(state.selected) && state.selected.length) {
        out[col.key] = { type: col.filter, mode: 'subset', selected: [...state.selected] }
      }
    }
  }
  return out
}

/**
 * Начальное состояние чекбоксов enum/bool для открытия меню.
 * @param {string} key
 * @param {Record<string, object>} filterState
 * @param {string[]} distinctValues
 * @returns {string[]}
 */
export function getEnumMenuChecked(key, filterState, distinctValues) {
  const state = filterState[key]
  if (!state) return [...distinctValues]
  if (state.mode === 'none') return []
  if (state.mode === 'subset' && Array.isArray(state.selected)) {
    return state.selected.filter((v) => distinctValues.includes(v))
  }
  if (Array.isArray(state.selected) && state.selected.length) {
    return state.selected.filter((v) => distinctValues.includes(v))
  }
  return [...distinctValues]
}
