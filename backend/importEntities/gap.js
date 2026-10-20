/**
 * Импорт: gap (архитектурный долг). Связи метамодели — вне плоского импорта.
 */
const { makeCatalog, buildNameIndex, resolveOptional, pgId } = require('../importLib/common');

const catalog = makeCatalog(
  [
    { field: 'id', label: 'ID', zone: 'lead' },
    { field: 'code', label: 'Код', zone: 'left' },
    { field: 'name', label: 'Название', zone: 'left', required: true },
    { field: 'description', label: 'Описание', zone: 'left' },
    { field: 'consequences', label: 'Последствия', zone: 'left' },
    { field: 'gap_type_name', label: 'Тип долга', zone: 'left', kind: 'ref' },
    { field: 'impact_level_name', label: 'Степень влияния', zone: 'left', kind: 'ref' },
    { field: 'gap_state_name', label: 'Состояние', zone: 'left', kind: 'ref' },
    { field: 'adr_status_name', label: 'Статус утверждения', zone: 'left', kind: 'ref' },
    { field: 'remediation_effort', label: 'Трудоёмкость устранения', zone: 'left' },
    { field: 'target_date', label: 'Целевая дата устранения', zone: 'left', kind: 'date' },
    { field: 'resolved_date', label: 'Фактическая дата устранения', zone: 'left', kind: 'date' },
    { field: 'responsible_person', label: 'Ответственное лицо', zone: 'left' },
    { field: 'source', label: 'Источник', zone: 'left' },
    { field: 'ar_gap_types_id', label: 'ID типа долга', zone: 'right' },
    { field: 'ar_impact_level_types_id', label: 'ID степени влияния', zone: 'right' },
    { field: 'ar_gap_states_id', label: 'ID состояния', zone: 'right' },
    { field: 'ar_adr_statuses_id', label: 'ID статуса утверждения', zone: 'right' },
  ],
  'gap',
  1
);

function fieldValueFromRow(row, field) {
  const map = {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    consequences: row.consequences,
    gap_type_name: row.gap_type_name,
    impact_level_name: row.impact_level_name,
    gap_state_name: row.gap_state_name,
    adr_status_name: row.adr_status_name,
    remediation_effort: row.remediation_effort,
    target_date: row.target_date ? String(row.target_date).slice(0, 10) : '',
    resolved_date: row.resolved_date ? String(row.resolved_date).slice(0, 10) : '',
    responsible_person: row.responsible_person,
    source: row.source,
    ar_gap_types_id: row.ar_gap_types_id,
    ar_impact_level_types_id: row.ar_impact_level_types_id,
    ar_gap_states_id: row.ar_gap_states_id,
    ar_adr_statuses_id: row.ar_adr_statuses_id,
  };
  const v = map[field];
  return v == null ? '' : v;
}

async function loadRefs(db, queries) {
  const [types, impacts, states, statuses] = await Promise.all([
    db.query(queries.gap_types_select),
    db.query(queries.impact_level_types_select),
    db.query(queries.gap_states_select),
    db.query(queries.adr_statuses_select),
  ]);
  return {
    gap_types: buildNameIndex(types.rows, (r) => r.name),
    impacts: buildNameIndex(impacts.rows, (r) => r.name),
    states: buildNameIndex(states.rows, (r) => r.name),
    statuses: buildNameIndex(statuses.rows, (r) => r.name),
    _raw: { types: types.rows, impacts: impacts.rows, states: states.rows, statuses: statuses.rows },
  };
}

async function loadRefSheetData(db, queries) {
  const refs = await loadRefs(db, queries);
  return [
    { sheetName: 'Справочник_типы_долга', rows: refs._raw.types, nameFn: (r) => r.name, field: 'gap_type_name' },
    { sheetName: 'Справочник_влияние', rows: refs._raw.impacts, nameFn: (r) => r.name, field: 'impact_level_name' },
    { sheetName: 'Справочник_состояния', rows: refs._raw.states, nameFn: (r) => r.name, field: 'gap_state_name' },
    { sheetName: 'Справочник_статусы_ADR', rows: refs._raw.statuses, nameFn: (r) => r.name, field: 'adr_status_name' },
  ];
}

async function findExisting(db, queries, code) {
  const r = await db.query(queries.gaps_get_by_code, [code]);
  return r.rows[0] || null;
}

function resolveIds(f, refs, base = {}) {
  const out = { ...base };
  if (f.gap_type_name) {
    const hit = resolveOptional(refs.gap_types, f.gap_type_name, 'Тип долга');
    out.ar_gap_types_id = hit ? hit.id : null;
  }
  if (f.impact_level_name) {
    const hit = resolveOptional(refs.impacts, f.impact_level_name, 'Степень влияния');
    out.ar_impact_level_types_id = hit ? hit.id : null;
  }
  if (f.gap_state_name) {
    const hit = resolveOptional(refs.states, f.gap_state_name, 'Состояние');
    out.ar_gap_states_id = hit ? hit.id : null;
  }
  if (f.adr_status_name) {
    const hit = resolveOptional(refs.statuses, f.adr_status_name, 'Статус утверждения');
    out.ar_adr_statuses_id = hit ? hit.id : null;
  }
  return out;
}

async function create(db, ctx, f, refs) {
  const ids = resolveIds(f, refs, {
    ar_gap_types_id: null,
    ar_impact_level_types_id: null,
    ar_gap_states_id: null,
    ar_adr_statuses_id: null,
  });
  const prefix = ctx.getParam('GAP_CODE_PREFIX', 'GAP-') || 'GAP-';
  const r = await db.query(ctx.queries.gaps_insert, [
    prefix,
    f.name,
    f.description || '',
    f.consequences || '',
    pgId(ids.ar_impact_level_types_id),
    f.remediation_effort || '',
    f.target_date || '',
    pgId(ids.ar_gap_states_id),
    f.resolved_date || '',
    pgId(ids.ar_adr_statuses_id),
    pgId(ids.ar_gap_types_id),
    f.source || '',
    f.responsible_person || '',
  ]);
  return { outFieldsPatch: { code: r.rows[0].code } };
}

async function update(db, ctx, existing, f, refs) {
  const merged = {
    name: existing.name,
    description: existing.description || '',
    consequences: existing.consequences || '',
    ar_impact_level_types_id: existing.ar_impact_level_types_id,
    remediation_effort: existing.remediation_effort || '',
    target_date: existing.target_date ? String(existing.target_date).slice(0, 10) : '',
    ar_gap_states_id: existing.ar_gap_states_id,
    resolved_date: existing.resolved_date ? String(existing.resolved_date).slice(0, 10) : '',
    ar_adr_statuses_id: existing.ar_adr_statuses_id,
    ar_gap_types_id: existing.ar_gap_types_id,
    source: existing.source || '',
    responsible_person: existing.responsible_person || '',
  };
  if (f.name) merged.name = f.name;
  if (f.description) merged.description = f.description;
  if (f.consequences) merged.consequences = f.consequences;
  if (f.remediation_effort) merged.remediation_effort = f.remediation_effort;
  if (f.target_date) merged.target_date = f.target_date;
  if (f.resolved_date) merged.resolved_date = f.resolved_date;
  if (f.source) merged.source = f.source;
  if (f.responsible_person) merged.responsible_person = f.responsible_person;
  Object.assign(merged, resolveIds(f, refs));
  await db.query(ctx.queries.gaps_update, [
    merged.name,
    merged.description,
    merged.consequences,
    pgId(merged.ar_impact_level_types_id),
    merged.remediation_effort,
    merged.target_date,
    pgId(merged.ar_gap_states_id),
    merged.resolved_date,
    pgId(merged.ar_adr_statuses_id),
    pgId(merged.ar_gap_types_id),
    merged.source,
    merged.responsible_person,
    existing.id,
  ]);
}

async function loadExportRows(db, queries) {
  const r = await db.query(queries.gaps_select);
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
