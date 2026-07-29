/**
 * Импорт: business_service
 */
const { makeCatalog, buildNameIndex, resolveOptional, pgId } = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'name', label: 'Наименование', zone: 'left', required: true },
    { field: 'fullname', label: 'Полное наименование', zone: 'left' },
    { field: 'owner_name', label: 'Владелец (орг. единица)', zone: 'left', kind: 'ref' },
    { field: 'status_name', label: 'Статус', zone: 'left', kind: 'ref' },
    { field: 'description', label: 'Описание', zone: 'left' },
    { field: 'ar_organization_units_id', label: 'ID орг. единицы', zone: 'right' },
    { field: 'ar_business_service_statuses_id', label: 'ID статуса', zone: 'right' },
  ],
  'business_service',
  1
);

function fieldValueFromRow(row, field) {
  const map = {
    id: row.id,
    name: row.name,
    fullname: row.fullname,
    owner_name: row.owner_name,
    status_name: row.status_name,
    description: row.description,
    ar_organization_units_id: row.ar_organization_units_id,
    ar_business_service_statuses_id: row.ar_business_service_statuses_id,
  };
  const v = map[field];
  return v == null ? '' : v;
}

async function loadRefs(db, queries) {
  const [ous, statuses] = await Promise.all([
    db.query(queries.togaf_organization_units_select),
    db.query(queries.togaf_business_service_statuses_select),
  ]);
  return {
    ous: buildNameIndex(ous.rows, (r) => r.name),
    statuses: buildNameIndex(statuses.rows, (r) => r.name),
    _raw: { ous: ous.rows, statuses: statuses.rows },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_орг_единицы', rows: refs._raw.ous, nameFn: (r) => r.name, field: 'owner_name' },
    { sheetName: 'Справочник_статусы', rows: refs._raw.statuses, nameFn: (r) => r.name, field: 'status_name' },
  ];
}

async function findExisting(db, queries, name) {
  const r = await db.query(queries.togaf_business_services_get_by_name, [name]);
  return r.rows[0] || null;
}

function resolveIds(f, refs, base = {}) {
  const out = { ...base };
  if (f.owner_name) {
    const hit = resolveOptional(refs.ous, f.owner_name, 'Владелец (орг. единица)');
    out.ar_organization_units_id = hit ? hit.id : null;
  }
  if (f.status_name) {
    const hit = resolveOptional(refs.statuses, f.status_name, 'Статус');
    out.ar_business_service_statuses_id = hit ? hit.id : null;
  }
  return out;
}

async function create(db, ctx, f, refs) {
  const ids = resolveIds(f, refs, {
    ar_organization_units_id: null,
    ar_business_service_statuses_id: null,
  });
  await db.query(ctx.queries.togaf_business_services_insert, [
    f.name,
    f.fullname || '',
    f.description || '',
    pgId(ids.ar_organization_units_id),
    pgId(ids.ar_business_service_statuses_id),
  ]);
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    name: existing.name,
    fullname: existing.fullname || '',
    description: existing.description || '',
    ar_organization_units_id: existing.ar_organization_units_id,
    ar_business_service_statuses_id: existing.ar_business_service_statuses_id,
  };
  if (f.name) merged.name = f.name;
  if (f.fullname) merged.fullname = f.fullname;
  if (f.description) merged.description = f.description;
  Object.assign(merged, resolveIds(f, refs));
  await db.query(ctx.queries.togaf_business_services_update, [
    merged.name,
    merged.fullname,
    merged.description,
    pgId(merged.ar_organization_units_id),
    pgId(merged.ar_business_service_statuses_id),
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.togaf_business_services_select);
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
