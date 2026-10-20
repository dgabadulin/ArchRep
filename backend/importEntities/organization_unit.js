/**
 * Импорт: organization_unit. Ключ — name. Родителей импортируйте раньше дочерних.
 */
const { makeCatalog, buildNameIndex, resolveOptional, pgId } = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'name', label: 'Наименование', zone: 'left', required: true },
    { field: 'fullname', label: 'Полное наименование', zone: 'left' },
    { field: 'parent_name', label: 'Родитель', zone: 'left', kind: 'ref' },
    { field: 'category_name', label: 'Категория', zone: 'left', kind: 'ref' },
    { field: 'leader', label: 'Руководитель', zone: 'left' },
    { field: 'description', label: 'Описание', zone: 'left' },
    { field: 'parent_id', label: 'ID родителя', zone: 'right' },
    { field: 'organization_unit_categories_id', label: 'ID категории', zone: 'right' },
  ],
  'organization_unit',
  1
);

function fieldValueFromRow(row, field) {
  const map = {
    id: row.id,
    name: row.name,
    fullname: row.fullname,
    parent_name: row.parent_name,
    category_name: row.category_name,
    leader: row.leader,
    description: row.description,
    parent_id: row.parent_id,
    organization_unit_categories_id: row.organization_unit_categories_id,
  };
  const v = map[field];
  return v == null ? '' : v;
}

async function loadRefs(db, queries) {
  const [ous, cats] = await Promise.all([
    db.query(queries.togaf_organization_units_select),
    db.query(queries.togaf_organization_unit_categories_select),
  ]);
  return {
    ous: buildNameIndex(ous.rows, (r) => r.name),
    cats: buildNameIndex(cats.rows, (r) => r.name),
    _raw: { ous: ous.rows, cats: cats.rows },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_орг_единицы', rows: refs._raw.ous, nameFn: (r) => r.name, field: 'parent_name' },
    { sheetName: 'Справочник_категории_ОЕ', rows: refs._raw.cats, nameFn: (r) => r.name, field: 'category_name' },
  ];
}

async function findExisting(db, queries, name) {
  const r = await db.query(queries.togaf_organization_units_get_by_name, [name]);
  return r.rows[0] || null;
}

function resolveIds(f, refs, base = {}) {
  const out = { ...base };
  if (f.parent_name) {
    const hit = resolveOptional(refs.ous, f.parent_name, 'Родитель');
    out.parent_id = hit ? hit.id : null;
  }
  if (f.category_name) {
    const hit = resolveOptional(refs.cats, f.category_name, 'Категория');
    out.organization_unit_categories_id = hit ? hit.id : null;
  }
  return out;
}

async function create(db, ctx, f, refs) {
  const ids = resolveIds(f, refs, { parent_id: null, organization_unit_categories_id: null });
  await db.query(ctx.queries.togaf_organization_units_insert, [
    f.name,
    f.fullname || '',
    pgId(ids.parent_id),
    f.description || '',
    f.leader || '',
    pgId(ids.organization_unit_categories_id),
  ]);
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    name: existing.name,
    fullname: existing.fullname || '',
    parent_id: existing.parent_id,
    description: existing.description || '',
    leader: existing.leader || '',
    organization_unit_categories_id: existing.organization_unit_categories_id,
  };
  if (f.name) merged.name = f.name;
  if (f.fullname) merged.fullname = f.fullname;
  if (f.description) merged.description = f.description;
  if (f.leader) merged.leader = f.leader;
  Object.assign(merged, resolveIds(f, refs));
  await db.query(ctx.queries.togaf_organization_units_update, [
    merged.name,
    merged.fullname,
    pgId(merged.parent_id),
    merged.description,
    merged.leader,
    pgId(merged.organization_unit_categories_id),
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.togaf_organization_units_select);
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
