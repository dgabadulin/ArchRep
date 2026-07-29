const XLSX = require('xlsx');
const { cellStr } = require('./common');

function getExcelJS() {
  try {
    return require('exceljs');
  } catch (e) {
    const err = new Error(
      'Не установлен пакет exceljs. В корне репозитория выполните: npm install exceljs'
    );
    err.status = 500;
    throw err;
  }
}

/**
 * @param {object} catalog
 * @param {object} opts
 * @param {Array<object>} [opts.dataRows]
 * @param {Function} opts.fieldValueFromRow - (row, field) => value
 * @param {Array<{sheetName:string, rows:object[], nameFn:Function, field?:string}>} opts.refSheets
 */
async function buildWorkbookBuffer(catalog, opts = {}) {
  const ExcelJS = getExcelJS();
  const dataRows = opts.dataRows || [];
  const fieldValueFromRow = opts.fieldValueFromRow;
  const refSheets = opts.refSheets || [];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISAR';
  wb.created = new Date();

  const headers = catalog.allHeaders();
  const dataSheet = wb.addWorksheet('Данные', { views: [{ state: 'frozen', ySplit: 1 }] });
  dataSheet.addRow(headers);
  dataSheet.getRow(1).font = { bold: true };

  if (dataRows.length === 0) {
    dataSheet.addRow(headers.map(() => ''));
  } else {
    for (const row of dataRows) {
      dataSheet.addRow(headers.map((h) => {
        const field = catalog.parseHeaderField(h);
        return field ? fieldValueFromRow(row, field) : '';
      }));
    }
  }

  headers.forEach((_, i) => {
    dataSheet.getColumn(i + 1).width = Math.min(40, Math.max(14, String(headers[i]).length + 2));
  });

  const metaSheet = wb.addWorksheet('_meta');
  metaSheet.addRow(['entity', catalog.ENTITY_CODE]);
  metaSheet.addRow(['template_version', catalog.TEMPLATE_VERSION]);

  const validationByField = {};
  for (const ref of refSheets) {
    const ws = wb.addWorksheet(ref.sheetName);
    ws.addRow(['name', 'id', 'code']);
    ws.getRow(1).font = { bold: true };
    for (const r of ref.rows || []) {
      ws.addRow([ref.nameFn(r), r.id, r.code || '']);
    }
    ws.getColumn(1).width = 40;
    ws.getColumn(2).width = 10;
    ws.getColumn(3).width = 20;
    const fields = ref.fields || (ref.field ? [ref.field] : []);
    const maxRows = Math.max(1000, (ref.rows || []).length + 50);
    const formula = `'${ref.sheetName}'!$A$2:$A$${maxRows}`;
    for (const field of fields) {
      if (field) validationByField[field] = formula;
    }
  }

  const maxDataRow = Math.max(1000, dataRows.length + 50);
  for (let col = 0; col < headers.length; col++) {
    const field = catalog.parseHeaderField(headers[col]);
    const formula = field && validationByField[field];
    if (!formula) continue;
    const colLetter = dataSheet.getColumn(col + 1).letter;
    dataSheet.dataValidations.add(`${colLetter}2:${colLetter}${maxDataRow}`, {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: 'Значение из справочника',
      error: 'Выберите значение из списка или оставьте ячейку пустой',
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function parseWorkbookBuffer(catalog, buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const metaSheet = wb.Sheets['_meta'];
  let meta = { entity: null, template_version: null };
  if (metaSheet) {
    const metaRows = XLSX.utils.sheet_to_json(metaSheet, { header: 1 });
    for (const row of metaRows) {
      if (!row || !row[0]) continue;
      const k = String(row[0]).trim();
      const v = row[1];
      if (k === 'entity') meta.entity = String(v || '').trim();
      if (k === 'template_version') meta.template_version = Number(v);
    }
  }
  const dataName = wb.SheetNames.includes('Данные') ? 'Данные' : wb.SheetNames[0];
  const dataWs = wb.Sheets[dataName];
  const rawRows = XLSX.utils.sheet_to_json(dataWs, { defval: '', raw: false });
  const mapped = [];
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const byField = {};
    for (const [header, val] of Object.entries(raw)) {
      const field = catalog.parseHeaderField(header);
      if (field) byField[field] = cellStr(val);
    }
    const vals = catalog.orderedFields().map((f) => byField[f.field] || '');
    if (vals.every((v) => !v)) continue;
    mapped.push({ row_no: i + 2, fields: byField });
  }
  return { meta, rows: mapped };
}

module.exports = { buildWorkbookBuffer, parseWorkbookBuffer };
