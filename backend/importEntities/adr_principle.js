/**
 * Импорт: adr_principle (принципиальные архитектурные решения)
 */
const { makeCatalog, buildNameIndex, resolveOptional, pgId } = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'code', label: 'Код', zone: 'left' },
    { field: 'name', label: 'Наименование', zone: 'left', required: true },
    { field: 'status_name', label: 'Статус', zone: 'left', kind: 'ref' },
    { field: 'author', label: 'Автор', zone: 'left' },
    { field: 'context', label: 'Контекст', zone: 'left' },
    { field: 'decision', label: 'Решение', zone: 'left' },
    { field: 'consequences', label: 'Последствия', zone: 'left' },
    { field: 'ar_adr_statuses_id', label: 'ID статуса', zone: 'right' },
  ],
  'adr_principle',
  1
);

function fieldValueFromRow(row, field) {
  const map = {
    id: row.id,
    code: row.code,
    name: row.name,
    status_name: row.status_name,
    author: row.author,
    context: row.context,
    decision: row.decision,
    consequences: row.consequences,
    ar_adr_statuses_id: row.ar_adr_statuses_id,
  };
  const v = map[field];
  return v == null ? '' : v;
}

async function loadRefs(db, queries) {
  const statuses = await db.query(queries.adr_statuses_select);
  return {
    statuses: buildNameIndex(statuses.rows, (r) => r.name),
    _raw: { statuses: statuses.rows },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_статусы_ADR', rows: refs._raw.statuses, nameFn: (r) => r.name, field: 'status_name' },
  ];
}

async function findExisting(db, queries, code) {
  const r = await db.query(queries.adrs_principle_get_by_code, [code]);
  return r.rows[0] || null;
}

async function create(db, ctx, f, refs) {
  const status = resolveOptional(refs.statuses, f.status_name, 'Статус');
  const prefix = ctx.getParam('ADR_ADRP_PREFIX', 'ADRP-') || 'ADRP-';
  const r = await db.query(ctx.queries.adrs_principle_insert, [
    prefix,
    f.name,
    f.context || '',
    f.decision || '',
    f.consequences || '',
    pgId(status && status.id),
    f.author || '',
  ]);
  return { outFieldsPatch: { code: r.rows[0].code } };
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    name: existing.name,
    context: existing.context || '',
    decision: existing.decision || '',
    consequences: existing.consequences || '',
    ar_adr_statuses_id: existing.ar_adr_statuses_id,
    author: existing.author || '',
  };
  if (f.name) merged.name = f.name;
  if (f.context) merged.context = f.context;
  if (f.decision) merged.decision = f.decision;
  if (f.consequences) merged.consequences = f.consequences;
  if (f.author) merged.author = f.author;
  if (f.status_name) {
    const status = resolveOptional(refs.statuses, f.status_name, 'Статус');
    merged.ar_adr_statuses_id = status ? status.id : null;
  }
  await db.query(ctx.queries.adrs_principle_update, [
    merged.name,
    merged.context,
    merged.decision,
    merged.consequences,
    pgId(merged.ar_adr_statuses_id),
    merged.author,
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.adrs_principle_select);
  return r.rows;
}

module.exports = {
  catalog,
  matchMode: 'auto_code',
  matchField: 'code',
  loadRefs,
  loadRefSheetData,
  findExisting,
  create,
  update,
  fieldValueFromRow,
  loadExportRows,
};
