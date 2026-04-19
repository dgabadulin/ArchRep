import { getConfig } from '@/config/params'

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

export function getVisibleColumns(tableId, columnDefs) {
  const prefix = getConfig().ARR_COLS_COOKIE ?? 'ar_cols_'
  const raw = getCookie(prefix + tableId)
  if (raw) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) return arr
    } catch (_) {}
  }
  return columnDefs.filter(c => c.defaultVisible !== false).map(c => c.key)
}

export function setVisibleColumns(tableId, columnKeys) {
  const prefix = getConfig().ARR_COLS_COOKIE ?? 'ar_cols_'
  setCookie(prefix + tableId, JSON.stringify(columnKeys))
}

/**
 * @param {string} tableId
 * @param {string} defaultSortKey
 * @param {'asc'|'desc'} defaultSortOrder
 * @returns {{ sortKey: string, sortOrder: 'asc'|'desc' }}
 */
export function getSortPref(tableId, defaultSortKey, defaultSortOrder = 'asc') {
  const prefix = getConfig().ARR_SORT_COOKIE ?? 'ar_sort_'
  const raw = getCookie(prefix + tableId)
  if (raw) {
    try {
      const o = JSON.parse(raw)
      if (o && typeof o.sortKey === 'string' && (o.sortOrder === 'asc' || o.sortOrder === 'desc')) {
        return { sortKey: o.sortKey, sortOrder: o.sortOrder }
      }
    } catch (_) {}
  }
  return { sortKey: defaultSortKey, sortOrder: defaultSortOrder }
}

/**
 * @param {string} tableId
 * @param {string} sortKey
 * @param {'asc'|'desc'} sortOrder
 */
export function setSortPref(tableId, sortKey, sortOrder) {
  const prefix = getConfig().ARR_SORT_COOKIE ?? 'ar_sort_'
  setCookie(prefix + tableId, JSON.stringify({ sortKey, sortOrder }))
}
