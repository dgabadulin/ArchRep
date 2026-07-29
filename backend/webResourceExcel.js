/**
 * Совместимость: шаблон/экспорт веб-ресурсов для списка и старых вызовов.
 * Логика — в importEntities/web_resource + importLib.
 */
const { getImportEntity } = require('./importEntities');
const { buildEntityWorkbook } = require('./importLib/runner');
const { parseWorkbookBuffer: parseWithCatalog } = require('./importLib/excel');

const entity = getImportEntity('web_resource');

async function buildWorkbookBuffer(pool, queries, opts = {}) {
  return buildEntityWorkbook(entity, pool, queries, opts.dataRows || []);
}

async function buildTemplateBuffer(pool, queries) {
  return buildWorkbookBuffer(pool, queries, { dataRows: [] });
}

async function buildExportBuffer(pool, queries, enrichedRows) {
  return buildWorkbookBuffer(pool, queries, { dataRows: enrichedRows || [] });
}

function parseWorkbookBuffer(buf) {
  return parseWithCatalog(entity.catalog, buf);
}

function rowToContractObject(row) {
  const obj = {};
  for (const f of entity.catalog.orderedFields()) {
    obj[entity.catalog.headerFor(f)] = entity.fieldValueFromRow(row, f.field);
  }
  return obj;
}

module.exports = {
  rowToContractObject,
  buildTemplateBuffer,
  buildExportBuffer,
  buildWorkbookBuffer,
  parseWorkbookBuffer,
  cellStr: require('./importLib/common').cellStr,
};
