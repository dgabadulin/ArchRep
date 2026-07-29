/**
 * Импорт: business_function. Родителей импортируйте раньше дочерних.
 */
const { makeCatalog, buildNameIndex, resolveOptional, pgId } = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'name', label: 'Наименование', zone: 'left', required: true },
    { field: 'parent_name', label: 'Родитель', zone: 'left', kind: 'ref' },
    { field: 'owner_name', label: 'Владелец (орг. единица)', zone: 'left', kind: 'ref' },
    { field: 'description', label: 'Описание', zone: 'left' },
    { field: 'parent_id', label: 'ID родителя', zone: 'right' },
    { field: 'ar_organization_units_id', label: 'ID орг. единицы', zone: 'right' },
  ],
  'business_function',
  1
);

function fieldValueFromRow(row, field) {
  const map = {
    id: row.id,
    name: row.name,
    parent_name: row.parent_name,
    owner_name: row.owner_name,
    description: row.description,
    parent_id: row.parent_id,
    ar_organization_units_id: row.ar_organization_units_id,
  };
  const v = map[field];
  return v == null ? '' : v;
}

async function loadRefs(db, queries) {
  const [fns, ous] = await Promise.all([
    db.query(queries.togaf_business_functions_select),
    db.query(queries.togaf_organization_units_select),
  ]);
  return {
    fns: buildNameIndex(fns.rows, (r) => r.name),
    ous: buildNameIndex(ous.rows, (r) => r.name),
    _raw: { fns: fns.rows, ous: ous.rows },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_бизнес_функции', rows: refs._raw.fns, nameFn: (r) => r.name, field: 'parent_name' },
    { sheetName: 'Справочник_орг_единицы', rows: refs._raw.ous, nameFn: (r) => r.name, field: 'owner_name' },
  ];
}

async function findExisting(db, queries, name) {
  const r = await db.query(queries.togaf_business_functions_get_by_name, [name]);
  return r.rows[0] || null;
}

function resolveIds(f, refs, base = {}) {
  const out = { ...base };
  if (f.parent_name) {
    const hit = resolveOptional(refs.fns, f.parent_name, 'Родитель');
    out.parent_id = hit ? hit.id : null;
  }
  if (f.owner_name) {
    const hit = resolveOptional(refs.ous, f.owner_name, 'Владелец (орг. единица)');
    out.ar_organization_units_id = hit ? hit.id : null;
  }
  return out;
}

async function create(db, ctx, f, refs) {
  const ids = resolveIds(f, refs, { parent_id: null, ar_organization_units_id: null });
  await db.query(ctx.queries.togaf_business_functions_insert, [
    f.name,
    f.description || '',
    pgId(ids.parent_id),
    pgId(ids.ar_organization_units_id),
  ]);
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    name: existing.name,
    description: existing.description || '',
    parent_id: existing.parent_id,
    ar_organization_units_id: existing.ar_organization_units_id,
  };
  if (f.name) merged.name = f.name;
  if (f.description) merged.description = f.description;
  Object.assign(merged, resolveIds(f, refs));
  await db.query(ctx.queries.togaf_business_functions_update, [
    merged.name,
    merged.description,
    pgId(merged.parent_id),
    pgId(merged.ar_organization_units_id),
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.togaf_business_functions_select);
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
