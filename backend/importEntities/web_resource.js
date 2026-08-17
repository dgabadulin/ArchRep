/**
 * Каталог + адаптер импорта: web_resource
 */
const { makeCatalog, buildNameIndex, resolveOne } = require('../importLib/common');
const { createWebResourceService } = require('../webResourceService');
const { findDomainRowByName } = require('../domainFromUrl');

const TEMPLATE_VERSION = 3;
const ENTITY_CODE = 'web_resource';

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead', required: false, kind: 'id' },
    { field: 'code', label: 'Код', zone: 'left', required: false, kind: 'text' },
    { field: 'short_name', label: 'Краткое наименование', zone: 'left', required: true, kind: 'text' },
    { field: 'purpose', label: 'Назначение', zone: 'left', required: false, kind: 'text' },
    { field: 'publication_url', label: 'Адрес публикации (URL)', zone: 'left', required: false, kind: 'url' },
    { field: 'domain_name', label: 'Домен', zone: 'left', required: false, kind: 'ref', ref: 'domains' },
    { field: 'system_name', label: 'Информационная система или модуль', zone: 'left', required: true, kind: 'ref', ref: 'systems' },
    { field: 'category_name', label: 'Категория', zone: 'left', required: true, kind: 'ref', ref: 'categories' },
    { field: 'stage_type_name', label: 'Тип стенда', zone: 'left', required: true, kind: 'ref', ref: 'stage_types' },
    { field: 'status_name', label: 'Статус', zone: 'left', required: true, kind: 'ref', ref: 'statuses' },
    { field: 'publication_request_number', label: 'Номер заявки на публикацию', zone: 'left', required: false, kind: 'text' },
    { field: 'publication_date', label: 'Дата публикации', zone: 'left', required: false, kind: 'date' },
    { field: 'ar_systems_id', label: 'ID информационной системы', zone: 'right', required: false, kind: 'id' },
    { field: 'ar_domains_id', label: 'ID домена', zone: 'right', required: false, kind: 'id' },
    { field: 'ar_web_resource_categories_id', label: 'ID категории', zone: 'right', required: false, kind: 'id' },
    { field: 'ar_web_resource_stage_types_id', label: 'ID типа стенда', zone: 'right', required: false, kind: 'id' },
    { field: 'ar_web_resource_statuses_id', label: 'ID статуса', zone: 'right', required: false, kind: 'id' },
  ],
  ENTITY_CODE,
  TEMPLATE_VERSION
);

function systemLabelFromRow(row) {
  return String(row.system_name || row.system_code || '').trim();
}

function fieldValueFromRow(row, field) {
  switch (field) {
    case 'id':
      return row.id != null ? row.id : '';
    case 'code':
      return row.code || '';
    case 'short_name':
      return row.short_name || '';
    case 'purpose':
      return row.purpose || '';
    case 'publication_url':
      return row.publication_url || '';
    case 'domain_name':
      return row.domain_name || '';
    case 'system_name':
      return systemLabelFromRow(row);
    case 'category_name':
      return row.category_name || '';
    case 'stage_type_name':
      return row.stage_type_name || '';
    case 'status_name':
      return row.status_name || '';
    case 'publication_request_number':
      return row.publication_request_number || '';
    case 'publication_date':
      return row.publication_date ? String(row.publication_date).slice(0, 10) : '';
    case 'ar_systems_id':
      return row.ar_systems_id != null ? row.ar_systems_id : '';
    case 'ar_domains_id':
      return row.ar_domains_id != null ? row.ar_domains_id : '';
    case 'ar_web_resource_categories_id':
      return row.ar_web_resource_categories_id != null ? row.ar_web_resource_categories_id : '';
    case 'ar_web_resource_stage_types_id':
      return row.ar_web_resource_stage_types_id != null ? row.ar_web_resource_stage_types_id : '';
    case 'ar_web_resource_statuses_id':
      return row.ar_web_resource_statuses_id != null ? row.ar_web_resource_statuses_id : '';
    default:
      return '';
  }
}

async function loadRefs(db, queries) {
  const [statuses, categories, stages, systems, domains] = await Promise.all([
    db.query(queries.web_resource_statuses_select),
    db.query(queries.web_resource_categories_select),
    db.query(queries.web_resource_stage_types_select),
    db.query(queries.systems_select_for_import_labels),
    db.query(queries.domains_select),
  ]);
  return {
    statuses: buildNameIndex(statuses.rows, (r) => r.name),
    categories: buildNameIndex(categories.rows, (r) => r.name),
    stage_types: buildNameIndex(stages.rows, (r) => r.name),
    systems: buildNameIndex(systems.rows, (r) => r.import_label),
    domains: buildNameIndex(domains.rows, (r) => r.name),
    _raw: {
      statuses: statuses.rows,
      categories: categories.rows,
      stages: stages.rows,
      systems: systems.rows,
      domains: domains.rows,
    },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_статусы', rows: refs._raw.statuses, nameFn: (r) => r.name, field: 'status_name' },
    { sheetName: 'Справочник_категории', rows: refs._raw.categories, nameFn: (r) => r.name, field: 'category_name' },
    { sheetName: 'Справочник_стенды', rows: refs._raw.stages, nameFn: (r) => r.name, field: 'stage_type_name' },
    { sheetName: 'Справочник_ИС', rows: refs._raw.systems, nameFn: (r) => r.import_label, field: 'system_name' },
    { sheetName: 'Справочник_домены', rows: refs._raw.domains, nameFn: (r) => r.name, field: 'domain_name' },
  ];
}

async function findExisting(db, queries, code) {
  const r = await db.query(queries.web_resources_get_by_code, [code]);
  return r.rows[0] || null;
}

async function resolveDomainId(db, queries, refs, domainName) {
  const name = String(domainName || '').trim();
  if (!name) return null;
  const row = await findDomainRowByName(db, queries, name);
  if (row) return row.id;
  return resolveOne(refs.domains, name, 'Домен').id;
}

async function create(db, ctx, f, refs) {
  const svc = createWebResourceService(db, ctx);
  const body = {
    short_name: f.short_name,
    purpose: f.purpose || '',
    publication_url: f.publication_url || '',
    publication_request_number: f.publication_request_number || '',
    publication_date: f.publication_date || '',
    ar_systems_id: resolveOne(refs.systems, f.system_name, 'ИС / модуль').id,
    ar_domains_id: await resolveDomainId(db, ctx.queries, refs, f.domain_name),
    ar_web_resource_categories_id: resolveOne(refs.categories, f.category_name, 'Категория').id,
    ar_web_resource_stage_types_id: resolveOne(refs.stage_types, f.stage_type_name, 'Тип стенда').id,
    ar_web_resource_statuses_id: resolveOne(refs.statuses, f.status_name, 'Статус').id,
  };
  const created = await svc.create(body);
  return { outFieldsPatch: { code: created.code } };
}

async function update(db, ctx, existing, f, refs) {
  const svc = createWebResourceService(db, ctx);
  const merged = {
    short_name: existing.short_name,
    purpose: existing.purpose || '',
    publication_url: existing.publication_url || '',
    ar_systems_id: existing.ar_systems_id,
    ar_domains_id: existing.ar_domains_id ?? null,
    publication_request_number: existing.publication_request_number || '',
    publication_date: existing.publication_date ? String(existing.publication_date).slice(0, 10) : '',
    ar_web_resource_statuses_id: existing.ar_web_resource_statuses_id,
    ar_web_resource_categories_id: existing.ar_web_resource_categories_id,
    ar_web_resource_stage_types_id: existing.ar_web_resource_stage_types_id,
  };
  if (f.short_name) merged.short_name = f.short_name;
  if (f.purpose) merged.purpose = f.purpose;
  if (f.publication_url) merged.publication_url = f.publication_url;
  if (f.publication_request_number) merged.publication_request_number = f.publication_request_number;
  if (f.publication_date) merged.publication_date = f.publication_date;
  if (f.system_name) merged.ar_systems_id = resolveOne(refs.systems, f.system_name, 'ИС / модуль').id;
  if (f.domain_name !== undefined && f.domain_name !== null) {
    merged.ar_domains_id = String(f.domain_name).trim()
      ? await resolveDomainId(db, ctx.queries, refs, f.domain_name)
      : null;
  }
  if (f.category_name) merged.ar_web_resource_categories_id = resolveOne(refs.categories, f.category_name, 'Категория').id;
  if (f.stage_type_name) merged.ar_web_resource_stage_types_id = resolveOne(refs.stage_types, f.stage_type_name, 'Тип стенда').id;
  if (f.status_name) merged.ar_web_resource_statuses_id = resolveOne(refs.statuses, f.status_name, 'Статус').id;
  await svc.update(existing.id, merged);
}

async function loadExportRows(db, queries, enrichRow) {
  const r = await db.query(queries.web_resources_select);
  const rows = r.rows;
  if (typeof enrichRow === 'function') {
    return Promise.all(rows.map((row) => enrichRow(row)));
  }
  return rows;
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
