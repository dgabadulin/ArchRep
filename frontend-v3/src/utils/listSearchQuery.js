/** Имя query-параметра фильтра списка (совпадает с API `search`). */
export const LIST_SEARCH_QUERY_KEY = 'search'

/** Строка поиска из query маршрута. */
export function searchFromQuery(query) {
  const v = query?.[LIST_SEARCH_QUERY_KEY]
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v[0] ?? ''
  return ''
}

/** Query для ссылок: `extra` + опциональный `search`. */
export function listQueryWithSearch(search, extra = {}) {
  const q = { ...extra }
  const s = (typeof search === 'string' ? search : '').trim()
  if (s) q[LIST_SEARCH_QUERY_KEY] = s
  else delete q[LIST_SEARCH_QUERY_KEY]
  return q
}

/** Location для router-link / router.push. */
export function listRoute(path, search, extraQuery = {}) {
  const q = listQueryWithSearch(search, extraQuery)
  return Object.keys(q).length ? { path, query: q } : { path }
}
