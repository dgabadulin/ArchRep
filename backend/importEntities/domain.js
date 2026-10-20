/**
 * Импорт: domain (#67). Ключ — name (имя домена).
 */
const {
  makeCatalog,
  buildNameIndex,
  resolveOne,
  resolveOptional,
  pgId,
} = require('../importLib/common');
const { normalizeDomainName, findDomainRowByName } = require('../domainFromUrl');

const TEMPLATE_VERSION = 1;
const ENTITY_CODE = 'domain';

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'name', label: 'Домен', zone: 'left', required: true, kind: 'text' },
    { field: 'status_name', label: 'Статус', zone: 'left', required: true, kind: 'ref', ref: 'statuses' },
    { field: 'registrar_name', label: 'Регистратор', zone: 'left', kind: 'ref', ref: 'partners' },
    { field: 'registered_at', label: 'Дата регистрации', zone: 'left', kind: 'date' },
    { field: 'expires_at', label: 'Дата окончания', zone: 'left', kind: 'date' },
    { field: 'purpose', label: 'Назначение', zone: 'left', kind: 'text' },
    { field: 'company_name', label: 'Компания', zone: 'left', kind: 'ref', ref: 'companies' },
    { field: 'business_owner_name', label: 'Владелец от бизнеса', zone: 'left', kind: 'ref', ref: 'employees' },
    { field: 'ar_domain_statuses_id', label: 'ID статуса', zone: 'right', kind: 'id' },
    { field: 'registrar_ar_partners_id', label: 'ID регистратора', zone: 'right', kind: 'id' },
    { field: 'company_ar_organization_units_id', label: 'ID компании', zone: 'right', kind: 'id' },
    { field: 'business_owner_ar_employees_id', label: 'ID владельца', zone: 'right', kind: 'id' },
  ],
  ENTITY_CODE,
  TEMPLATE_VERSION
);

function fieldValueFromRow(row, field) {
  switch (field) {
    case 'id':
      return row.id != null ? row.id : '';
    case 'name':
      return row.name || '';
    case 'status_name':
      return row.status_name || '';
    case 'registrar_name':
      return row.registrar_name || '';
    case 'registered_at':
      return row.registered_at ? String(row.registered_at).slice(0, 10) : '';
    case 'expires_at':
      return row.expires_at ? String(row.expires_at).slice(0, 10) : '';
    case 'purpose':
      return row.purpose || '';
    case 'company_name':
      return row.company_name || '';
    case 'business_owner_name':
      return row.business_owner_name || '';
    case 'ar_domain_statuses_id':
      return row.ar_domain_statuses_id != null ? row.ar_domain_statuses_id : '';
    case 'registrar_ar_partners_id':
      return row.registrar_ar_partners_id != null ? row.registrar_ar_partners_id : '';
    case 'company_ar_organization_units_id':
      return row.company_ar_organization_units_id != null ? row.company_ar_organization_units_id : '';
    case 'business_owner_ar_employees_id':
      return row.business_owner_ar_employees_id != null ? row.business_owner_ar_employees_id : '';
    default:
      return '';
  }
}

async function loadRefs(db, queries) {
  const [statuses, partners, companies, employees] = await Promise.all([
    db.query(queries.domain_statuses_select),
    db.query(queries.partners_select),
    db.query(queries.organization_units_select_org_only),
    db.query(queries.employees_select),
  ]);
  return {
    statuses: buildNameIndex(statuses.rows, (r) => r.name),
    partners: buildNameIndex(partners.rows, (r) => r.name),
    companies: buildNameIndex(companies.rows, (r) => r.name),
    employees: buildNameIndex(employees.rows, (r) => r.full_name),
    _raw: {
      statuses: statuses.rows,
      partners: partners.rows,
      companies: companies.rows,
      employees: employees.rows,
    },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_статусы', rows: refs._raw.statuses, nameFn: (r) => r.name, field: 'status_name' },
    { sheetName: 'Справочник_регистраторы', rows: refs._raw.partners, nameFn: (r) => r.name, field: 'registrar_name' },
    { sheetName: 'Справочник_компании', rows: refs._raw.companies, nameFn: (r) => r.name, field: 'company_name' },
    { sheetName: 'Справочник_сотрудники', rows: refs._raw.employees, nameFn: (r) => r.full_name, field: 'business_owner_name' },
  ];
}

async function findExisting(db, queries, name) {
  return findDomainRowByName(db, queries, name);
}

async function assertCompanyOrg(db, queries, companyId) {
  if (companyId == null) return;
  const r = await db.query(queries.domains_org_unit_is_org, [companyId]);
  if (r.rowCount === 0) {
    throw new Error('Компания должна быть организационной единицей с категорией «Организация» (code=org).');
  }
}

function resolveFkIds(f, refs) {
  const status = resolveOne(refs.statuses, f.status_name, 'Статус');
  const registrar = f.registrar_name
    ? resolveOptional(refs.partners, f.registrar_name, 'Регистратор')
    : null;
  const company = f.company_name
    ? resolveOptional(refs.companies, f.company_name, 'Компания')
    : null;
  const owner = f.business_owner_name
    ? resolveOptional(refs.employees, f.business_owner_name, 'Владелец от бизнеса')
    : null;
  return {
    ar_domain_statuses_id: status.id,
    registrar_ar_partners_id: registrar ? registrar.id : null,
    company_ar_organization_units_id: company ? company.id : null,
    business_owner_ar_employees_id: owner ? owner.id : null,
  };
}

async function create(db, ctx, f, refs) {
  const name = normalizeDomainName(f.name);
  if (!name) throw new Error('Некорректное имя домена');
  const ids = resolveFkIds(f, refs);
  await assertCompanyOrg(db, ctx.queries, ids.company_ar_organization_units_id);
  await db.query(ctx.queries.domains_insert, [
    name,
    pgId(ids.registrar_ar_partners_id),
    f.registered_at || '',
    f.expires_at || '',
    ids.ar_domain_statuses_id,
    f.purpose || '',
    pgId(ids.company_ar_organization_units_id),
    pgId(ids.business_owner_ar_employees_id),
  ]);
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    name: existing.name,
    ar_domain_statuses_id: existing.ar_domain_statuses_id,
    registrar_ar_partners_id: existing.registrar_ar_partners_id,
    registered_at: existing.registered_at ? String(existing.registered_at).slice(0, 10) : '',
    expires_at: existing.expires_at ? String(existing.expires_at).slice(0, 10) : '',
    purpose: existing.purpose || '',
    company_ar_organization_units_id: existing.company_ar_organization_units_id,
    business_owner_ar_employees_id: existing.business_owner_ar_employees_id,
  };
  if (f.name) {
    const n = normalizeDomainName(f.name);
    if (!n) throw new Error('Некорректное имя домена');
    merged.name = n;
  }
  if (f.purpose) merged.purpose = f.purpose;
  if (f.registered_at) merged.registered_at = f.registered_at;
  if (f.expires_at) merged.expires_at = f.expires_at;
  if (f.status_name) merged.ar_domain_statuses_id = resolveOne(refs.statuses, f.status_name, 'Статус').id;
  if (f.registrar_name) {
    const hit = resolveOptional(refs.partners, f.registrar_name, 'Регистратор');
    merged.registrar_ar_partners_id = hit ? hit.id : null;
  }
  if (f.company_name) {
    const hit = resolveOptional(refs.companies, f.company_name, 'Компания');
    merged.company_ar_organization_units_id = hit ? hit.id : null;
  }
  if (f.business_owner_name) {
    const hit = resolveOptional(refs.employees, f.business_owner_name, 'Владелец от бизнеса');
    merged.business_owner_ar_employees_id = hit ? hit.id : null;
  }
  await assertCompanyOrg(db, ctx.queries, merged.company_ar_organization_units_id);
  await db.query(ctx.queries.domains_update, [
    merged.name,
    pgId(merged.registrar_ar_partners_id),
    merged.registered_at || '',
    merged.expires_at || '',
    merged.ar_domain_statuses_id,
    merged.purpose || '',
    pgId(merged.company_ar_organization_units_id),
    pgId(merged.business_owner_ar_employees_id),
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.domains_select);
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
