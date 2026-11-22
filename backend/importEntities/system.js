/**
 * Импорт: system (+ модули через parent). Технологии/интеграции на вкладках — вне плоского импорта.
 * Ключ — code (ручной). «Организация-владелец» (issue #126) импортируется по названию
 * организации (категория ОУ «Организация»); направление (owner) по-прежнему не пишется.
 */
const {
  makeCatalog,
  buildNameIndex,
  resolveOptional,
  parseBool,
  pgId,
} = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'code', label: 'Код', zone: 'left', required: true },
    { field: 'name', label: 'Краткое наименование', zone: 'left', required: true },
    { field: 'fullname', label: 'Полное наименование', zone: 'left' },
    { field: 'parent_name', label: 'Родительская система', zone: 'left', kind: 'ref' },
    { field: 'status_name', label: 'Статус', zone: 'left', kind: 'ref' },
    { field: 'external_system', label: 'Внешняя система', zone: 'left', kind: 'bool' },
    { field: 'owner_organization_name', label: 'Организация-владелец', zone: 'left', kind: 'ref' },
    { field: 'vendor_name', label: 'Вендор', zone: 'left', kind: 'ref' },
    { field: 'supplier_name', label: 'Поставщик', zone: 'left', kind: 'ref' },
    { field: 'supporter_name', label: 'Партнёр по поддержке', zone: 'left', kind: 'ref' },
    { field: 'hosting_name', label: 'Тип хостинга', zone: 'left', kind: 'ref' },
    { field: 'it_lead_employee_name', label: 'Ответственный от ИТ', zone: 'left', kind: 'ref' },
    { field: 'business_lead_employee_name', label: 'Владелец системы (бизнес)', zone: 'left', kind: 'ref' },
    { field: 'description', label: 'Описание', zone: 'left' },
    { field: 'comment', label: 'Примечание', zone: 'left' },
    { field: 'parent_ar_systems_id', label: 'ID родительской системы', zone: 'right' },
    { field: 'ar_system_statuses_id', label: 'ID статуса', zone: 'right' },
    { field: 'owner_ar_organization_units_id', label: 'ID организации-владельца', zone: 'right' },
    { field: 'vendor_ar_partners_id', label: 'ID вендора', zone: 'right' },
    { field: 'supplier_ar_partners_id', label: 'ID поставщика', zone: 'right' },
    { field: 'supporter_ar_partners_id', label: 'ID партнёра по поддержке', zone: 'right' },
    { field: 'ar_system_hosting_types_id', label: 'ID типа хостинга', zone: 'right' },
    { field: 'it_lead_employee_id', label: 'ID ответственного от ИТ', zone: 'right' },
    { field: 'business_lead_employee_id', label: 'ID владельца системы (бизнес)', zone: 'right' },
  ],
  'system',
  2
);

function fieldValueFromRow(row, field) {
  if (field === 'external_system') return row.external_system ? 'да' : 'нет';
  if (field === 'status_name') return row.status || '';
  if (field === 'owner_organization_name') return row.owner_organization_name || '';
  if (field === 'vendor_name') return row.vendor || '';
  if (field === 'supplier_name') return row.supplier || '';
  if (field === 'supporter_name') return row.supporter || '';
  if (field === 'hosting_name') return row.hosting || '';
  const v = row[field];
  return v == null ? '' : v;
}

async function loadRefs(db, queries) {
  const [systems, statuses, partners, hosting, employees, organizations] = await Promise.all([
    db.query(queries.systems_select_for_import_labels),
    db.query(queries.system_statuses_select),
    db.query(queries.partners_select),
    db.query(queries.system_hosting_types_select),
    db.query(queries.employees_select),
    db.query(queries.organization_units_org_select),
  ]);
  return {
    systems: buildNameIndex(systems.rows, (r) => r.import_label),
    statuses: buildNameIndex(statuses.rows, (r) => r.name),
    partners: buildNameIndex(partners.rows, (r) => r.name),
    hosting: buildNameIndex(hosting.rows, (r) => r.name),
    employees: buildNameIndex(employees.rows, (r) => r.full_name),
    organizations: buildNameIndex(organizations.rows, (r) => r.name),
    _raw: {
      systems: systems.rows,
      statuses: statuses.rows,
      partners: partners.rows,
      hosting: hosting.rows,
      employees: employees.rows,
      organizations: organizations.rows,
    },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_ИС', rows: refs._raw.systems, nameFn: (r) => r.import_label, field: 'parent_name' },
    { sheetName: 'Справочник_статусы', rows: refs._raw.statuses, nameFn: (r) => r.name, field: 'status_name' },
    {
      sheetName: 'Справочник_партнёры',
      rows: refs._raw.partners,
      nameFn: (r) => r.name,
      fields: ['vendor_name', 'supplier_name', 'supporter_name'],
    },
    { sheetName: 'Справочник_хостинг', rows: refs._raw.hosting, nameFn: (r) => r.name, field: 'hosting_name' },
    {
      sheetName: 'Справочник_сотрудники',
      rows: refs._raw.employees,
      nameFn: (r) => r.full_name,
      fields: ['it_lead_employee_name', 'business_lead_employee_name'],
    },
    {
      sheetName: 'Справочник_организации',
      rows: refs._raw.organizations,
      nameFn: (r) => r.name,
      field: 'owner_organization_name',
    },
  ];
}

async function findExisting(db, queries, code) {
  const r = await db.query(queries.systems_get_by_code, [code]);
  return r.rows[0] || null;
}

function resolveIds(f, refs, base = {}) {
  const out = { ...base };
  if (f.parent_name) {
    const hit = resolveOptional(refs.systems, f.parent_name, 'Родительская система');
    out.parent_ar_systems_id = hit ? hit.id : null;
  }
  if (f.status_name) {
    const hit = resolveOptional(refs.statuses, f.status_name, 'Статус');
    out.ar_system_statuses_id = hit ? hit.id : null;
  }
  if (f.vendor_name) {
    const hit = resolveOptional(refs.partners, f.vendor_name, 'Вендор');
    out.vendor_ar_partners_id = hit ? hit.id : null;
  }
  if (f.supplier_name) {
    const hit = resolveOptional(refs.partners, f.supplier_name, 'Поставщик');
    out.supplier_ar_partners_id = hit ? hit.id : null;
  }
  if (f.supporter_name) {
    const hit = resolveOptional(refs.partners, f.supporter_name, 'Партнёр по поддержке');
    out.supporter_ar_partners_id = hit ? hit.id : null;
  }
  if (f.owner_organization_name) {
    const hit = resolveOptional(refs.organizations, f.owner_organization_name, 'Организация-владелец');
    out.owner_ar_organization_units_id = hit ? hit.id : null;
  }
  if (f.hosting_name) {
    const hit = resolveOptional(refs.hosting, f.hosting_name, 'Тип хостинга');
    out.ar_system_hosting_types_id = hit ? hit.id : null;
  }
  if (f.it_lead_employee_name) {
    const hit = resolveOptional(refs.employees, f.it_lead_employee_name, 'Ответственный от ИТ');
    out.it_lead_employee_id = hit ? hit.id : null;
  }
  if (f.business_lead_employee_name) {
    const hit = resolveOptional(refs.employees, f.business_lead_employee_name, 'Владелец системы (бизнес)');
    out.business_lead_employee_id = hit ? hit.id : null;
  }
  return out;
}

async function create(db, ctx, f, refs) {
  const ids = resolveIds(f, refs, {
    parent_ar_systems_id: null,
    ar_system_statuses_id: null,
    vendor_ar_partners_id: null,
    supplier_ar_partners_id: null,
    supporter_ar_partners_id: null,
    ar_system_hosting_types_id: null,
    it_lead_employee_id: null,
    business_lead_employee_id: null,
    owner_ar_organization_units_id: null,
  });
  const external = f.external_system ? parseBool(f.external_system, false) : false;
  await db.query(ctx.queries.systems_insert, [
    f.code.trim(),
    f.name,
    f.fullname || null,
    pgId(ids.parent_ar_systems_id),
    pgId(ids.ar_system_statuses_id),
    pgId(ids.vendor_ar_partners_id),
    pgId(ids.supplier_ar_partners_id),
    pgId(ids.supporter_ar_partners_id),
    f.description || null,
    pgId(ids.ar_system_hosting_types_id),
    '',
    external,
    f.comment || null,
    pgId(ids.it_lead_employee_id),
    pgId(ids.business_lead_employee_id),
    pgId(ids.owner_ar_organization_units_id),
  ]);
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    code: existing.code,
    name: existing.name,
    fullname: existing.fullname || '',
    parent_ar_systems_id: existing.parent_ar_systems_id,
    ar_system_statuses_id: existing.ar_system_statuses_id,
    vendor_ar_partners_id: existing.vendor_ar_partners_id,
    supplier_ar_partners_id: existing.supplier_ar_partners_id,
    supporter_ar_partners_id: existing.supporter_ar_partners_id,
    description: existing.description || '',
    ar_system_hosting_types_id: existing.ar_system_hosting_types_id,
    technologies: existing.technologies || '',
    external_system: !!existing.external_system,
    comment: existing.comment || '',
    it_lead_employee_id: existing.it_lead_employee_id,
    business_lead_employee_id: existing.business_lead_employee_id,
    owner_ar_organization_units_id: existing.owner_ar_organization_units_id,
  };
  if (f.code) merged.code = f.code.trim();
  if (f.name) merged.name = f.name;
  if (f.fullname) merged.fullname = f.fullname;
  if (f.description) merged.description = f.description;
  if (f.comment) merged.comment = f.comment;
  if (f.external_system) merged.external_system = parseBool(f.external_system, merged.external_system);
  Object.assign(merged, resolveIds(f, refs));
  await db.query(ctx.queries.systems_update, [
    merged.code,
    merged.name,
    merged.fullname || null,
    pgId(merged.parent_ar_systems_id),
    pgId(merged.ar_system_statuses_id),
    pgId(merged.vendor_ar_partners_id),
    pgId(merged.supplier_ar_partners_id),
    pgId(merged.supporter_ar_partners_id),
    merged.description || null,
    pgId(merged.ar_system_hosting_types_id),
    merged.technologies,
    merged.external_system,
    merged.comment || null,
    pgId(merged.it_lead_employee_id),
    pgId(merged.business_lead_employee_id),
    pgId(merged.owner_ar_organization_units_id),
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.systems_select);
  return r.rows;
}

module.exports = {
  catalog,
  matchMode: 'manual_code',
  matchField: 'code',
  loadRefs,
  loadRefSheetData,
  findExisting,
  create,
  update,
  fieldValueFromRow,
  loadExportRows,
};
