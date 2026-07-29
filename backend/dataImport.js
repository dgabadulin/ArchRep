/**
 * Сервисный импорт данных (issue #64).
 * Делегирует в адаптеры importEntities + importLib/runner.
 */
const { getImportEntity } = require('./importEntities');
const { runEntityImport, buildEntityWorkbook } = require('./importLib/runner');

async function runImport(entityCode, opts) {
  const adapter = getImportEntity(entityCode);
  if (!adapter) {
    const err = new Error(`Сущность не поддерживается импортом: ${entityCode}`);
    err.status = 400;
    throw err;
  }
  return runEntityImport(adapter, opts);
}

async function buildTemplate(entityCode, pool, queries) {
  const adapter = getImportEntity(entityCode);
  if (!adapter) {
    const err = new Error(`Сущность не поддерживается импортом: ${entityCode}`);
    err.status = 400;
    throw err;
  }
  return buildEntityWorkbook(adapter, pool, queries, []);
}

async function buildExport(entityCode, pool, queries, enrichers = {}) {
  const adapter = getImportEntity(entityCode);
  if (!adapter) {
    const err = new Error(`Сущность не поддерживается импортом: ${entityCode}`);
    err.status = 400;
    throw err;
  }
  const enrichRow = enrichers[entityCode];
  const rows = await adapter.loadExportRows(pool, queries, enrichRow);
  return buildEntityWorkbook(adapter, pool, queries, rows);
}

/** @deprecated используйте runImport('web_resource', opts) */
async function runWebResourceImport(opts) {
  return runImport('web_resource', opts);
}

module.exports = {
  runImport,
  buildTemplate,
  buildExport,
  runWebResourceImport,
};
