/**
 * Импорт: actor
 */
const { makeCatalog, buildNameIndex, resolveOptional, pgId } = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'name', label: 'Наименование', zone: 'left', required: true },
    { field: 'actor_type_name', label: 'Тип заинтересованного лица', zone: 'left', kind: 'ref' },
    { field: 'organization_unit_name', label: 'Орг. единица', zone: 'left', kind: 'ref' },
    { field: 'description', label: 'Описание', zone: 'left' },
    { field: 'actor_type_id', label: 'ID типа', zone: 'right' },
    { field: 'organization_unit_id', label: 'ID орг. единицы', zone: 'right' },
  ],
  'actor',
  1
);

function fieldValueFromRow(row, field) {
  const map = {
    id: row.id,
    name: row.name,
    actor_type_name: row.actor_type_name,
    organization_unit_name: row.organization_unit_name,
    description: row.description,
    actor_type_id: row.actor_type_id,
    organization_unit_id: row.organization_unit_id,
  };
  const v = map[field];
  return v == null ? '' : v;
}

async function loadRefs(db, queries) {
  const [ous, types] = await Promise.all([
    db.query(queries.togaf_organization_units_select),
    db.query(queries.togaf_actor_types_select),
  ]);
  return {
    ous: buildNameIndex(ous.rows, (r) => r.name),
    types: buildNameIndex(types.rows, (r) => r.name),
    _raw: { ous: ous.rows, types: types.rows },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_типы_ЗЛ', rows: refs._raw.types, nameFn: (r) => r.name, field: 'actor_type_name' },
    { sheetName: 'Справочник_орг_единицы', rows: refs._raw.ous, nameFn: (r) => r.name, field: 'organization_unit_name' },
  ];
}

async function findExisting(db, queries, name) {
  const r = await db.query(queries.togaf_actors_get_by_name, [name]);
  return r.rows[0] || null;
}

function resolveIds(f, refs, base = {}) {
  const out = { ...base };
  if (f.actor_type_name) {
    const hit = resolveOptional(refs.types, f.actor_type_name, 'Тип заинтересованного лица');
    out.actor_type_id = hit ? hit.id : null;
  }
  if (f.organization_unit_name) {
    const hit = resolveOptional(refs.ous, f.organization_unit_name, 'Орг. единица');
    out.organization_unit_id = hit ? hit.id : null;
  }
  return out;
}

async function create(db, ctx, f, refs) {
  const ids = resolveIds(f, refs, { actor_type_id: null, organization_unit_id: null });
  await db.query(ctx.queries.togaf_actors_insert, [
    f.name,
    f.description || '',
    pgId(ids.organization_unit_id),
    pgId(ids.actor_type_id),
  ]);
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    name: existing.name,
    description: existing.description || '',
    organization_unit_id: existing.organization_unit_id,
    actor_type_id: existing.actor_type_id,
  };
  if (f.name) merged.name = f.name;
  if (f.description) merged.description = f.description;
  Object.assign(merged, resolveIds(f, refs));
  await db.query(ctx.queries.togaf_actors_update, [
    merged.name,
    merged.description,
    pgId(merged.organization_unit_id),
    pgId(merged.actor_type_id),
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.togaf_actors_select);
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
