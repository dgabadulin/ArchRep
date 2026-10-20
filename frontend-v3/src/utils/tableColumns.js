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
  const allowed = new Set(columnDefs.map((c) => c.key))
  const defaults = columnDefs.filter((c) => c.defaultVisible !== false).map((c) => c.key)
  const prefix = getConfig().ARR_COLS_COOKIE ?? 'ar_cols_'
  const raw = getCookie(prefix + tableId)
  if (raw) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) {
        const filtered = arr.filter((k) => typeof k === 'string' && allowed.has(k))
        if (filtered.length) return filtered
      }
    } catch (_) {}
  }
  return defaults
}

export function setVisibleColumns(tableId, columnKeys) {
  const prefix = getConfig().ARR_COLS_COOKIE ?? 'ar_cols_'
  setCookie(prefix + tableId, JSON.stringify(columnKeys))
}

/**
 * @param {string} tableId
 * @param {string} defaultSortKey
 * @param {'asc'|'desc'} defaultSortOrder
 * @param {{ key: string }[]|null} [columnDefs] если задано, sortKey из cookie сбрасывается, если колонки больше нет (например убрали «код»)
 * @returns {{ sortKey: string, sortOrder: 'asc'|'desc' }}
 */
export function getSortPref(tableId, defaultSortKey, defaultSortOrder = 'asc', columnDefs = null) {
  const prefix = getConfig().ARR_SORT_COOKIE ?? 'ar_sort_'
  const raw = getCookie(prefix + tableId)
  if (raw) {
    try {
      const o = JSON.parse(raw)
      if (o && typeof o.sortKey === 'string' && (o.sortOrder === 'asc' || o.sortOrder === 'desc')) {
        let sortKey = o.sortKey
        const sortOrder = o.sortOrder
        if (Array.isArray(columnDefs) && columnDefs.length) {
          const allowed = new Set(columnDefs.map((c) => c.key))
          if (!allowed.has(sortKey) || sortKey === 'actions') sortKey = defaultSortKey
        }
        return { sortKey, sortOrder }
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
