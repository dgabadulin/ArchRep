const BOOL_KEYS = new Set([
  'external_system',
  'wildcard_flag',
  'radar_include_flag',
  'domestic_flag',
  'is_approved',
])

/**
 * Добавляет filter: text|enum|bool к columnDefs, если не задано явно.
 * @param {{ key: string, filter?: string }[]} columns
 */
export function applyRegistryFilters(columns) {
  return columns.map((col) => {
    if (col.key === 'actions' || col.filter) return col
    if (BOOL_KEYS.has(col.key) || col.key.endsWith('_flag')) {
      return { ...col, filter: 'bool' }
    }
    if (
      col.key.endsWith('_name') ||
      col.key === 'source' ||
      col.key === 'target' ||
      col.key === 'status' ||
      col.key === 'owner' ||
      col.key === 'vendor' ||
      col.key === 'hosting' ||
      col.key === 'periodicity' ||
      col.key === 'transfer_method' ||
      col.key === 'responsible_person' ||
      col.key === 'remediation_effort' ||
      col.key === 'source' ||
      col.key === 'category' ||
      col.key.endsWith('_type') ||
      col.key.endsWith('_state')
    ) {
      return { ...col, filter: 'enum' }
    }
    return { ...col, filter: 'text' }
  })
}
