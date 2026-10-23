/**
 * Сортировка строк таблиц реестров.
 *
 * Сравнивать нужно исходное значение (`row[key]`), а не отформатированное для показа:
 * даты в формате «ДД.ММ.ГГГГ» при строковом сравнении идут не по времени
 * (01.02.2025 оказывается раньше 31.01.2025).
 */

const EMPTY_TOKENS = new Set(['—', '–', '-'])
const RU_DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSortValueEmpty(value) {
  if (value === null || value === undefined) return true
  if (value instanceof Date) return Number.isNaN(value.getTime())
  if (typeof value === 'number') return Number.isNaN(value)
  if (typeof value === 'string') {
    const s = value.trim()
    return s === '' || EMPTY_TOKENS.has(s)
  }
  return false
}

/**
 * Приводит значение колонки к timestamp (мс). Поддерживает Date, число,
 * строки, которые понимает `Date.parse` (ISO), и уже отформатированные
 * «ДД.ММ.ГГГГ[ чч:мм[:сс]]».
 *
 * @param {unknown} value
 * @returns {number|null} null — значение не является датой
 */
export function parseSortTimestamp(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (!s || EMPTY_TOKENS.has(s)) return null
  const m = RU_DATE_RE.exec(s)
  if (m) {
    const ts = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0),
    ).getTime()
    return Number.isNaN(ts) ? null : ts
  }
  const ts = Date.parse(s)
  return Number.isNaN(ts) ? null : ts
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @param {'text'|'number'|'date'|'datetime'} [sortType]
 * @returns {number}
 */
export function compareSortValues(a, b, sortType = 'text') {
  if (sortType === 'date' || sortType === 'datetime') {
    const ta = parseSortTimestamp(a)
    const tb = parseSortTimestamp(b)
    if (ta !== null && tb !== null) return ta - tb
    if (ta !== null) return -1
    if (tb !== null) return 1
  } else if (sortType === 'number') {
    const na = Number(a)
    const nb = Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

/**
 * Сортирует копию массива строк по колонке.
 * Пустые значения (`null`, `''`, `'—'`) всегда оказываются в конце,
 * независимо от направления; при равенстве сохраняется исходный порядок.
 *
 * @template T
 * @param {T[]} rows
 * @param {{
 *   key: string,
 *   order?: 'asc'|'desc',
 *   sortType?: 'text'|'number'|'date'|'datetime',
 *   getValue: (row: T, key: string) => unknown,
 * }} options
 * @returns {T[]}
 */
export function sortByColumn(rows, { key, order = 'asc', sortType = 'text', getValue }) {
  if (!Array.isArray(rows)) return []
  if (!key || typeof getValue !== 'function') return [...rows]
  const dir = order === 'desc' ? -1 : 1
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const va = getValue(x.row, key)
      const vb = getValue(y.row, key)
      const aEmpty = isSortValueEmpty(va)
      const bEmpty = isSortValueEmpty(vb)
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return x.index - y.index
        // Пустые значения считаем «больше» любого непустого:
        // при asc они в конце, при desc — в начале (критерий приёмки issue #75).
        return (aEmpty ? 1 : -1) * dir
      }
      const cmp = compareSortValues(va, vb, sortType)
      if (cmp !== 0) return cmp * dir
      return x.index - y.index
    })
    .map((x) => x.row)
}
