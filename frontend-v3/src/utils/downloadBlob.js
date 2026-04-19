export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'export.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
