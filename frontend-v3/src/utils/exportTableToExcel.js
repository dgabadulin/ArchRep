import { downloadBlob } from './downloadBlob'

/**
 * Выгрузка таблицы в .xlsx на клиенте (xlsx подгружается только при экспорте).
 * @param {{ rows: object[], columns: { key: string, label?: string }[], getCellValue: (row: object, key: string) => unknown, sheetName?: string, filename?: string }} opts
 */
export async function exportTableToExcel({ rows, columns, getCellValue, sheetName = 'Sheet1', filename = 'export.xlsx' }) {
  const mod = await import('xlsx')
  const XLSX = mod.default || mod
  const data = rows.map((row) => {
    const obj = {}
    for (const col of columns) {
      const header = col.label || col.key
      obj[header] = getCellValue(row, col.key)
    }
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, filename)
}
