/**
 * Импорт: technology. Ключ — name.
 */
const { makeCatalog, buildNameIndex, resolveOptional, parseBool, pgId } = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'name', label: 'Название', zone: 'left', required: true },
    { field: 'vendor_name', label: 'Вендор', zone: 'left', kind: 'ref' },
    { field: 'technology_class_name', label: 'Класс технологии', zone: 'left', kind: 'ref' },
    { field: 'technology_type_name', label: 'Тип технологии', zone: 'left', kind: 'ref' },
    { field: 'technology_status_name', label: 'Статус (техрадар)', zone: 'left', kind: 'ref' },
    { field: 'radar_include_flag', label: 'В техрадаре', zone: 'left', kind: 'bool' },
    { field: 'domestic_flag', label: 'Отечественное ПО', zone: 'left', kind: 'bool' },
    { field: 'description', label: 'Описание', zone: 'left' },
    { field: 'approve_document', label: 'Основание для включения в каталог', zone: 'left' },
    { field: 'vendor_ar_partners_id', label: 'ID вендора', zone: 'right' },
    { field: 'technology_classes_id', label: 'ID класса', zone: 'right' },
    { field: 'technology_types_id', label: 'ID типа', zone: 'right' },
    { field: 'technology_statuses_id', label: 'ID статуса', zone: 'right' },
  ],
  'technology',
  1
);

function fieldValueFromRow(row, field) {
  if (field === 'radar_include_flag') return row.radar_include_flag ? 'да' : 'нет';
  if (field === 'domestic_flag') return row.domestic_flag ? 'да' : 'нет';
  const map = {
    id: row.id,
    name: row.name,
    vendor_name: row.vendor_name,
    technology_class_name: row.technology_class_name,
    technology_type_name: row.technology_type_name,
    technology_status_name: row.technology_status_name,
    description: row.description,
    approve_document: row.approve_document,
    vendor_ar_partners_id: row.vendor_ar_partners_id,
    technology_classes_id: row.technology_classes_id,
    technology_types_id: row.technology_types_id,
    technology_statuses_id: row.technology_statuses_id,
  };
  const v = map[field];
  return v == null ? '' : v;
}

async function loadRefs(db, queries) {
  const [partners, classes, types, statuses] = await Promise.all([
    db.query(queries.partners_select),
    db.query(queries.technology_classes_select),
    db.query(queries.technology_types_select),
    db.query(queries.technology_statuses_select),
  ]);
  return {
    partners: buildNameIndex(partners.rows, (r) => r.name),
    classes: buildNameIndex(classes.rows, (r) => r.name),
    types: buildNameIndex(types.rows, (r) => r.name),
    statuses: buildNameIndex(statuses.rows, (r) => r.name),
    _raw: {
      partners: partners.rows,
      classes: classes.rows,
      types: types.rows,
      statuses: statuses.rows,
    },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_вендоры', rows: refs._raw.partners, nameFn: (r) => r.name, field: 'vendor_name' },
    { sheetName: 'Справочник_классы', rows: refs._raw.classes, nameFn: (r) => r.name, field: 'technology_class_name' },
    { sheetName: 'Справочник_типы', rows: refs._raw.types, nameFn: (r) => r.name, field: 'technology_type_name' },
    { sheetName: 'Справочник_статусы', rows: refs._raw.statuses, nameFn: (r) => r.name, field: 'technology_status_name' },
  ];
}

async function findExisting(db, queries, name) {
  const r = await db.query(queries.technologies_get_by_name, [name]);
  return r.rows[0] || null;
}

function resolveIds(f, refs, base = {}) {
  const out = { ...base };
  if (f.vendor_name) {
    const hit = resolveOptional(refs.partners, f.vendor_name, 'Вендор');
    out.vendor_ar_partners_id = hit ? hit.id : null;
  }
  if (f.technology_class_name) {
    const hit = resolveOptional(refs.classes, f.technology_class_name, 'Класс технологии');
    out.technology_classes_id = hit ? hit.id : null;
  }
  if (f.technology_type_name) {
    const hit = resolveOptional(refs.types, f.technology_type_name, 'Тип технологии');
    out.technology_types_id = hit ? hit.id : null;
  }
  if (f.technology_status_name) {
    const hit = resolveOptional(refs.statuses, f.technology_status_name, 'Статус (техрадар)');
    out.technology_statuses_id = hit ? hit.id : null;
  }
  return out;
}

async function create(db, ctx, f, refs) {
  const ids = resolveIds(f, refs, {
    vendor_ar_partners_id: null,
    technology_classes_id: null,
    technology_types_id: null,
    technology_statuses_id: null,
  });
  await db.query(ctx.queries.technologies_insert, [
    f.name,
    pgId(ids.vendor_ar_partners_id),
    pgId(ids.technology_classes_id),
    f.approve_document || '',
    pgId(ids.technology_types_id),
    pgId(ids.technology_statuses_id),
    f.radar_include_flag ? parseBool(f.radar_include_flag, false) : null,
    f.description || '',
    f.domestic_flag ? parseBool(f.domestic_flag, false) : null,
  ]);
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    name: existing.name,
    vendor_ar_partners_id: existing.vendor_ar_partners_id,
    technology_classes_id: existing.technology_classes_id,
    approve_document: existing.approve_document || '',
    technology_types_id: existing.technology_types_id,
    technology_statuses_id: existing.technology_statuses_id,
    radar_include_flag: existing.radar_include_flag,
    description: existing.description || '',
    domestic_flag: existing.domestic_flag,
  };
  if (f.name) merged.name = f.name;
  if (f.approve_document) merged.approve_document = f.approve_document;
  if (f.description) merged.description = f.description;
  if (f.radar_include_flag) merged.radar_include_flag = parseBool(f.radar_include_flag, !!merged.radar_include_flag);
  if (f.domestic_flag) merged.domestic_flag = parseBool(f.domestic_flag, !!merged.domestic_flag);
  Object.assign(merged, resolveIds(f, refs));
  await db.query(ctx.queries.technologies_update, [
    merged.name,
    pgId(merged.vendor_ar_partners_id),
    pgId(merged.technology_classes_id),
    merged.approve_document,
    pgId(merged.technology_types_id),
    pgId(merged.technology_statuses_id),
    merged.radar_include_flag,
    merged.description,
    merged.domestic_flag,
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.technologies_select);
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
