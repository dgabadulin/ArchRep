const XLSX = require('xlsx');
const { getParam } = require('./settingsParams');

/**
 * Строит буфер .xlsx из массива объектов (ключи — заголовки колонок).
 * @param {Array<Object>} rows
 * @param {string} [sheetName] — имя листа; если не задано, берётся из параметра ARR_EXCEL_SHEET (issue #28)
 * @returns {Buffer}
 */
function buildExcelBuffer(rows, sheetName) {
  const name = sheetName != null ? sheetName : (getParam('ARR_EXCEL_SHEET', 'Sheet1') || 'Sheet1');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

module.exports = { buildExcelBuffer };
