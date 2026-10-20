/**
 * Импорт: certificate (#69). Ключ — code (auto_code).
 */
const {
  makeCatalog,
  buildNameIndex,
  resolveOne,
  resolveOptional,
  pgId,
} = require('../importLib/common');

const TEMPLATE_VERSION = 1;
const ENTITY_CODE = 'certificate';

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'code', label: 'Код', zone: 'left', kind: 'text' },
    { field: 'domain_name', label: 'Домен', zone: 'left', required: true, kind: 'ref', ref: 'domains' },
    { field: 'ca_name', label: 'Сертификационный центр', zone: 'left', kind: 'ref', ref: 'partners' },
    { field: 'issued_at', label: 'Дата выпуска', zone: 'left', required: true, kind: 'date' },
    { field: 'expires_at', label: 'Дата окончания', zone: 'left', required: true, kind: 'date' },
    { field: 'wildcard_flag', label: 'Wildcard', zone: 'left', kind: 'bool' },
    { field: 'placement_url', label: 'Ссылка на размещение', zone: 'left', kind: 'text' },
    { field: 'responsible_name', label: 'Ответственный', zone: 'left', kind: 'ref', ref: 'employees' },
    { field: 'ar_domains_id', label: 'ID домена', zone: 'right', kind: 'id' },
    { field: 'ca_ar_partners_id', label: 'ID сертификационного центра', zone: 'right', kind: 'id' },
    { field: 'responsible_ar_employees_id', label: 'ID ответственного', zone: 'right', kind: 'id' },
  ],
  ENTITY_CODE,
  TEMPLATE_VERSION
);

function fieldValueFromRow(row, field) {
  switch (field) {
    case 'id': return row.id != null ? row.id : '';
    case 'code': return row.code || '';
    case 'domain_name': return row.domain_name || '';
    case 'ca_name': return row.ca_name || '';
    case 'issued_at': return row.issued_at ? String(row.issued_at).slice(0, 10) : '';
    case 'expires_at': return row.expires_at ? String(row.expires_at).slice(0, 10) : '';
    case 'wildcard_flag': return row.wildcard_flag ? 'да' : 'нет';
    case 'placement_url': return row.placement_url || '';
    case 'responsible_name': return row.responsible_name || '';
    case 'ar_domains_id': return row.ar_domains_id != null ? row.ar_domains_id : '';
    case 'ca_ar_partners_id': return row.ca_ar_partners_id != null ? row.ca_ar_partners_id : '';
    case 'responsible_ar_employees_id': return row.responsible_ar_employees_id != null ? row.responsible_ar_employees_id : '';
    default: return '';
  }
}

async function loadRefs(db, queries) {
  const [domains, partners, employees] = await Promise.all([
    db.query(queries.domains_select),
    db.query(queries.partners_select),
    db.query(queries.employees_select),
  ]);
  return {
    domains: buildNameIndex(domains.rows, (r) => r.name),
    partners: buildNameIndex(partners.rows, (r) => r.name),
    employees: buildNameIndex(employees.rows, (r) => r.full_name),
    _raw: {
      domains: domains.rows,
      partners: partners.rows,
      employees: employees.rows,
    },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_домены', rows: refs._raw.domains, nameFn: (r) => r.name, field: 'domain_name' },
    { sheetName: 'Справочник_партнеры', rows: refs._raw.partners, nameFn: (r) => r.name, field: 'ca_name' },
    { sheetName: 'Справочник_сотрудники', rows: refs._raw.employees, nameFn: (r) => r.full_name, field: 'responsible_name' },
  ];
}

async function findExisting(db, queries, code) {
  const r = await db.query(queries.certificates_get_by_code, [code]);
  return r.rows[0] || null;
}

function resolveFkIds(f, refs) {
  const domain = resolveOne(refs.domains, f.domain_name, 'Домен');
  const ca = f.ca_name ? resolveOptional(refs.partners, f.ca_name, 'Сертификационный центр') : null;
  const responsible = f.responsible_name ? resolveOptional(refs.employees, f.responsible_name, 'Ответственный') : null;
  return {
    ar_domains_id: domain.id,
    ca_ar_partners_id: ca ? ca.id : null,
    responsible_ar_employees_id: responsible ? responsible.id : null,
  };
}

function parseBool(value) {
  const s = String(value == null ? '' : value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'да'].includes(s);
}

async function create(db, ctx, f, refs) {
  const ids = resolveFkIds(f, refs);
  const r = await db.query(ctx.queries.certificates_insert, [
    ids.ar_domains_id,
    pgId(ids.ca_ar_partners_id),
    f.issued_at || '',
    f.expires_at || '',
    parseBool(f.wildcard_flag),
    f.placement_url || '',
    pgId(ids.responsible_ar_employees_id),
  ]);
  return { outFieldsPatch: { code: r.rows[0].code || '' } };
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    ar_domains_id: existing.ar_domains_id,
    ca_ar_partners_id: existing.ca_ar_partners_id,
    issued_at: existing.issued_at ? String(existing.issued_at).slice(0, 10) : '',
    expires_at: existing.expires_at ? String(existing.expires_at).slice(0, 10) : '',
    wildcard_flag: !!existing.wildcard_flag,
    placement_url: existing.placement_url || '',
    responsible_ar_employees_id: existing.responsible_ar_employees_id,
  };
  if (f.domain_name) merged.ar_domains_id = resolveOne(refs.domains, f.domain_name, 'Домен').id;
  if (f.ca_name) {
    const hit = resolveOptional(refs.partners, f.ca_name, 'Сертификационный центр');
    merged.ca_ar_partners_id = hit ? hit.id : null;
  }
  if (f.issued_at) merged.issued_at = f.issued_at;
  if (f.expires_at) merged.expires_at = f.expires_at;
  if (String(f.wildcard_flag || '').trim() !== '') merged.wildcard_flag = parseBool(f.wildcard_flag);
  if (f.placement_url) merged.placement_url = f.placement_url;
  if (f.responsible_name) {
    const hit = resolveOptional(refs.employees, f.responsible_name, 'Ответственный');
    merged.responsible_ar_employees_id = hit ? hit.id : null;
  }
  await db.query(ctx.queries.certificates_update, [
    merged.ar_domains_id,
    pgId(merged.ca_ar_partners_id),
    merged.issued_at || '',
    merged.expires_at || '',
    !!merged.wildcard_flag,
    merged.placement_url || '',
    pgId(merged.responsible_ar_employees_id),
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.certificates_select);
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
