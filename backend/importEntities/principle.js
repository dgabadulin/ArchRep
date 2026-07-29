/**
 * Импорт: principle (принципы TOGAF / ar_principles). Ключ — name.
 */
const { makeCatalog, parseBool } = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'name', label: 'Наименование', zone: 'left', required: true },
    { field: 'statement', label: 'Утверждение', zone: 'left' },
    { field: 'rationale', label: 'Обоснование', zone: 'left' },
    { field: 'implications', label: 'Применение', zone: 'left' },
    { field: 'is_approved', label: 'Утверждён', zone: 'left', kind: 'bool' },
    { field: 'approve_document', label: 'Документ утверждения', zone: 'left' },
  ],
  'principle',
  1
);

function fieldValueFromRow(row, field) {
  if (field === 'is_approved') return row.is_approved ? 'да' : 'нет';
  const v = row[field];
  return v == null ? '' : v;
}

async function loadRefs() {
  return { _raw: {} };
}

async function loadRefSheetData() {
  return [];
}

async function findExisting(db, queries, name) {
  const r = await db.query(queries.principles_get_by_name, [name]);
  return r.rows[0] || null;
}

async function create(db, ctx, f) {
  const approved = f.is_approved ? parseBool(f.is_approved, false) : false;
  await db.query(ctx.queries.principles_insert, [
    f.name,
    f.statement || '',
    f.rationale || '',
    f.implications || '',
    approved,
    f.approve_document || '',
  ]);
}

async function update(db, ctx, existing, f) {
  const merged = {
    name: existing.name,
    statement: existing.statement || '',
    rationale: existing.rationale || '',
    implications: existing.implications || '',
    is_approved: !!existing.is_approved,
    approve_document: existing.approve_document || '',
  };
  if (f.name) merged.name = f.name;
  if (f.statement) merged.statement = f.statement;
  if (f.rationale) merged.rationale = f.rationale;
  if (f.implications) merged.implications = f.implications;
  if (f.approve_document) merged.approve_document = f.approve_document;
  if (f.is_approved) merged.is_approved = parseBool(f.is_approved, merged.is_approved);
  await db.query(ctx.queries.principles_update, [
    merged.name,
    merged.statement,
    merged.rationale,
    merged.implications,
    merged.is_approved,
    merged.approve_document,
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.principles_select);
  return r.rows;
}

module.exports = {
  catalog,
  matchMode: 'name',
  matchField: 'name',
  loadRefs,
  loadRefSheetData,
  findExisting,
  create,
  update,
  fieldValueFromRow,
  loadExportRows,
};
