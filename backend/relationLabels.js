const queries = require('./queries');
const { applyDisplayName } = require('./displayName');

/**
 * Подписи концов связей метамодели (ar_metamodel_relations.from/to_entity_type).
 *
 * Ребро хранит только пару (тип, id), поэтому подпись резолвится по реестру-источнику.
 * select — ключ queries.js без параметров: переиспользуется как подзапрос
 * (`SELECT * FROM (<select>) q WHERE q.id = ANY($1::bigint[])`), поэтому подпись уважает
 * объединённые поля (owner_name, status_name, ...), на которые опираются шаблоны DISP_*.
 * entity — ключ ENTITY_TO_TEMPLATE (backend/displayName.js).
 *
 * Новый тип-конец: добавить запись здесь, ветку в archrep.metamodel_entity_search_text
 * (DB/scripts/migrate_20261019120000_metamodel_entity_search_text.sql) и в RELATION_END_META
 * (backend/ai/tools.js). См. docs/adding-new-entity-type.md.
 */
const RELATION_END_SOURCES = {
  system: { select: 'systems_select', entity: 'system' },
  subsystem: { select: 'systems_select', entity: 'subsystem' },
  system_child: { select: 'systems_select', entity: 'system_child' },
  technology: { select: 'technologies_select', entity: 'technology' },
  infrastructure_object: { select: 'infrastructure_objects_label_select', entity: 'infrastructure_object' },
  organization_unit: { select: 'togaf_organization_units_select', entity: 'org_unit' },
  actor: { select: 'togaf_actors_select', entity: 'actor' },
  business_service: { select: 'togaf_business_services_select', entity: 'business_service' },
  business_function: { select: 'togaf_business_functions_select', entity: 'business_function' },
  principle: { select: 'principles_select', entity: null },
  gap: { select: 'gaps_select', entity: 'gap' },
  applied: { select: 'adrs_applied_select', entity: 'adra' },
  adr_principle: { select: 'adrs_principle_select', entity: 'adrp' },
  web_resource: { select: 'web_resources_select', entity: 'web_resource' },
  domain: { select: 'domains_select', entity: 'domain' },
  certificate: { select: 'certificates_select', entity: 'certificate' },
  employee: { select: 'employees_select', entity: 'employee' },
  partner: { select: 'partners_select', entity: 'partner' },
  system_function: { select: 'system_functions_select', entity: null },
};

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;
/** @type {Map<string, { label: string|null, expires: number }>} */
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.label;
}

function cacheSet(key, label) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
  cache.set(key, { label, expires: Date.now() + CACHE_TTL_MS });
}

/** Подпись строки реестра: display_name (DISP_*) → name → short_name → full_name → code → task_name. */
function labelOfRow(row, entityKey) {
  if (!row) return null;
  const withDisplay = entityKey ? applyDisplayName(row, entityKey) : row;
  const candidates = [
    withDisplay && withDisplay.display_name,
    row.display_name,
    row.name,
    row.short_name,
    row.full_name,
    row.code,
    row.task_name,
  ];
  for (const value of candidates) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return null;
}

async function fetchLabels(pool, entityType, ids) {
  const source = RELATION_END_SOURCES[entityType];
  const select = source ? queries[source.select] : null;
  if (!select) return new Map();
  const res = await pool.query(`SELECT * FROM (${select}) q WHERE q.id = ANY($1::bigint[])`, [ids]);
  const labels = new Map();
  for (const row of res.rows) {
    const label = labelOfRow(row, source.entity);
    if (label) labels.set(Number(row.id), label);
  }
  return labels;
}

/**
 * Пакетный резолв подписей: { 'system:12' → 'СЭД (СЭД-1)' }.
 * Тип вне карты, отсутствующий объект и ошибка чтения реестра → подписи нет (null в ответе API).
 *
 * @param {{ query: Function }} pool
 * @param {{ entityType: string, entityId: number|string }[]} pairs
 * @returns {Promise<Map<string, string>>}
 */
async function resolveRelationEndLabels(pool, pairs) {
  const result = new Map();
  /** @type {Map<string, Set<number>>} */
  const wanted = new Map();

  for (const pair of pairs || []) {
    const entityType = String((pair && pair.entityType) || '').trim();
    const entityId = Number(pair && pair.entityId);
    if (!entityType || !Number.isFinite(entityId)) continue;
    const key = `${entityType}:${entityId}`;
    const cached = cacheGet(key);
    if (cached !== undefined) {
      if (cached) result.set(key, cached);
      continue;
    }
    if (!wanted.has(entityType)) wanted.set(entityType, new Set());
    wanted.get(entityType).add(entityId);
  }

  await Promise.all(
    [...wanted.entries()].map(async ([entityType, ids]) => {
      const idList = [...ids];
      try {
        const labels = await fetchLabels(pool, entityType, idList);
        for (const id of idList) {
          const key = `${entityType}:${id}`;
          const label = labels.get(id) || null;
          cacheSet(key, label);
          if (label) result.set(key, label);
        }
      } catch (err) {
        // Нет права на реестр / нет таблицы: связи всё равно должны открываться.
        console.error(`[relationLabels] ${entityType}: ${err.message}`);
      }
    })
  );

  return result;
}

/** Наименование типа связи: DISP_META_REL_TYPE_TEMPLATE; без пары в справочнике — код. */
function relationTypeDisplayName(row) {
  if (!row) return null;
  const code = row.relation_type != null ? String(row.relation_type).trim() : '';
  const name = row.relation_type_name != null ? String(row.relation_type_name).trim() : '';
  if (!code) return name || null;
  if (!name) return code;
  const rendered = applyDisplayName({ code, name }, 'meta_relation_type');
  return (rendered && rendered.display_name) || name;
}

function withLabels(row, labels) {
  if (!row) return row;
  return {
    ...row,
    from_entity_name: labels.get(`${row.from_entity_type}:${row.from_entity_id}`) || null,
    to_entity_name: labels.get(`${row.to_entity_type}:${row.to_entity_id}`) || null,
    relation_type_display_name: relationTypeDisplayName(row),
  };
}

function pairsOfRows(rows) {
  const pairs = [];
  for (const row of rows || []) {
    pairs.push({ entityType: row.from_entity_type, entityId: row.from_entity_id });
    pairs.push({ entityType: row.to_entity_type, entityId: row.to_entity_id });
  }
  return pairs;
}

/** Обогащение списка связей read-only полями для отображения. */
async function enrichRelationRows(pool, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return list;
  const labels = await resolveRelationEndLabels(pool, pairsOfRows(list));
  return list.map((row) => withLabels(row, labels));
}

/** Обогащение одной связи (форма редактирования). */
async function enrichRelationRow(pool, row) {
  if (!row) return row;
  const labels = await resolveRelationEndLabels(pool, pairsOfRows([row]));
  return withLabels(row, labels);
}

module.exports = {
  RELATION_END_SOURCES,
  resolveRelationEndLabels,
  relationTypeDisplayName,
  enrichRelationRow,
  enrichRelationRows,
};

