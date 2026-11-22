'use strict';

/**
 * Дашборд «Карта ИТ ландшафта» (ранее «Целевая архитектура: матрица») — данные только
 * из целевой матрицы (связи, созданные импортом `architecture_capability_matrix`).
 *
 * Матрица строится на пересечении двух типов связей:
 * - `system_business_function` — система реализует бизнес-функцию (строки);
 * - `system_business_service` — система обеспечивает продукт (колонки).
 *
 * @see docs/dashboards-echarts.md
 */

const { getParam } = require('./settingsParams');

const MATRIX_SOURCE = 'architecture_capability_matrix';
const PRODUCT_ORDER_PARAM = 'ARR_TARGET_MATRIX_ORDER';
/** Порядок строк (бизнес-способностей): JSON `[{"code":"...","order":1}]` (issue #127). */
const FUNCTION_ORDER_PARAM = 'ARR_TARGET_MATRIX_FUNCTION_ORDER';

const SQL_FUNCTIONS = `
  SELECT DISTINCT
    bf.id,
    bf.code,
    bf.name,
    bf.parent_id,
    parent.name AS parent_name
  FROM archrep.ar_metamodel_relations r
  JOIN archrep.ar_business_functions bf
    ON bf.id = r.to_entity_id
  LEFT JOIN archrep.ar_business_functions parent
    ON parent.id = bf.parent_id
  WHERE r.relation_type = 'system_business_function'
    AND r.to_entity_type = 'business_function'
    AND r.payload->>'source' = $1
  ORDER BY parent.name NULLS FIRST, bf.name
`;

const SQL_PRODUCTS = `
  SELECT DISTINCT
    bs.id,
    bs.code,
    bs.name,
    bs.fullname
  FROM archrep.ar_metamodel_relations r
  JOIN archrep.ar_business_services bs
    ON bs.id = r.to_entity_id
  WHERE r.relation_type = 'system_business_service'
    AND r.to_entity_type = 'business_service'
    AND r.payload->>'source' = $1
  ORDER BY bs.name
`;

const SQL_SYSTEMS = `
  SELECT DISTINCT
    s.id,
    s.code,
    s.name,
    ss.name AS status
  FROM archrep.ar_metamodel_relations r
  JOIN archrep.ar_systems s
    ON s.id = r.from_entity_id
  LEFT JOIN archrep.ar_system_statuses ss
    ON ss.id = s.ar_system_statuses_id
  WHERE r.relation_type IN ('system_business_function', 'system_business_service')
    AND r.from_entity_type = 'system'
    AND r.payload->>'source' = $1
  ORDER BY s.name
`;

const SQL_FUNCTION_RELATIONS = `
  SELECT DISTINCT
    r.from_entity_id AS system_id,
    r.to_entity_id AS function_id
  FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'system_business_function'
    AND r.from_entity_type = 'system'
    AND r.to_entity_type = 'business_function'
    AND r.payload->>'source' = $1
`;

const SQL_PRODUCT_RELATIONS = `
  SELECT DISTINCT
    r.from_entity_id AS system_id,
    r.to_entity_id AS business_service_id
  FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'system_business_service'
    AND r.from_entity_type = 'system'
    AND r.to_entity_type = 'business_service'
    AND r.payload->>'source' = $1
`;

/**
 * Цветовая легенда матрицы:
 * - green — система в промышленной или опытной эксплуатации;
 * - orange — новая или планируемая система;
 * - neutral — прочие статусы (в т.ч. пустой).
 *
 * @param {string|null|undefined} status — название статуса системы
 * @returns {'green'|'orange'|'neutral'}
 */
function classifySystemStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return 'neutral';

  // Вывод из эксплуатации и архив — не «новая/планируемая» система.
  if (/вывод|выведен|архив/.test(value)) return 'neutral';
  if (/промышленн|опытн/.test(value)) return 'green';
  if (/планир|внедр|нов(ая|ое|ые|ых|ую|ой|ый|ого|ому)|проектир|разработ/.test(value)) return 'orange';
  return 'neutral';
}

function orderList(raw) {
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    // Не JSON — допускаем список через запятую.
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

/**
 * Порядок колонок из системного параметра `ARR_TARGET_MATRIX_ORDER`
 * (коды или названия бизнес-сервисов). Без параметра — порядок реестра.
 *
 * @param {object[]} products
 * @param {*} rawOrder
 * @returns {object[]}
 */
function sortProductsByParam(products, rawOrder) {
  const ordered = orderList(rawOrder);
  if (!ordered.length) return [...(products || [])];

  const rank = new Map();
  ordered.forEach((value, index) => {
    rank.set(value, index);
    rank.set(value.toLowerCase(), index);
  });

  const rankOf = (product) => {
    const code = String(product?.code || '').trim();
    const name = String(product?.name || '').trim();
    if (code && rank.has(code)) return rank.get(code);
    if (code && rank.has(code.toLowerCase())) return rank.get(code.toLowerCase());
    if (name && rank.has(name)) return rank.get(name);
    if (name && rank.has(name.toLowerCase())) return rank.get(name.toLowerCase());
    return null;
  };

  return (products || [])
    .map((product, index) => ({ product, index, rank: rankOf(product) }))
    .sort((a, b) => {
      if (a.rank == null && b.rank == null) return a.index - b.index;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      return a.rank - b.rank;
    })
    .map((item) => item.product);
}

/** Разобрать параметр порядка строк: массив строк или объектов `{code|name, order}`. */
function parseFunctionOrder(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = [];
    }
  }
  if (!Array.isArray(value)) return [];
  const entries = [];
  value.forEach((item, index) => {
    if (item == null) return;
    if (typeof item === 'string') {
      const key = item.trim();
      if (key) entries.push({ key, rank: index });
      return;
    }
    if (typeof item === 'object') {
      const key = String(item.code ?? item.name ?? '').trim();
      if (!key) return;
      const order = Number(item.order);
      entries.push({ key, rank: Number.isFinite(order) ? order : index });
    }
  });
  return entries;
}

/**
 * Порядок строк из системного параметра `ARR_TARGET_MATRIX_FUNCTION_ORDER`
 * (issue #127): JSON-массив `[{"code":"...","order":1}]`; допускаются строки (код/название).
 * Способности вне списка идут после, сохраняя порядок backend-запроса.
 *
 * @param {object[]} functions
 * @param {*} rawOrder
 * @returns {object[]}
 */
function sortFunctionsByParam(functions, rawOrder) {
  const entries = parseFunctionOrder(rawOrder);
  if (!entries.length) return [...(functions || [])];

  const rank = new Map();
  for (const entry of entries) rank.set(entry.key.toLowerCase(), entry.rank);

  const rankOf = (fn) => {
    const code = String(fn?.code || '').trim();
    const name = String(fn?.name || '').trim();
    if (code && rank.has(code.toLowerCase())) return rank.get(code.toLowerCase());
    if (name && rank.has(name.toLowerCase())) return rank.get(name.toLowerCase());
    return null;
  };

  return (functions || [])
    .map((fn, index) => ({ fn, index, rank: rankOf(fn) }))
    .sort((a, b) => {
      if (a.rank == null && b.rank == null) return a.index - b.index;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.index - b.index;
    })
    .map((item) => item.fn);
}

/**
 * @param {import('pg').Pool} pool
 */
async function buildTargetArchitectureMatrix(pool) {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('buildTargetArchitectureMatrix: pool is required');
  }

  const [functions, products, systems, functionRelations, productRelations] = await Promise.all([
    pool.query(SQL_FUNCTIONS, [MATRIX_SOURCE]),
    pool.query(SQL_PRODUCTS, [MATRIX_SOURCE]),
    pool.query(SQL_SYSTEMS, [MATRIX_SOURCE]),
    pool.query(SQL_FUNCTION_RELATIONS, [MATRIX_SOURCE]),
    pool.query(SQL_PRODUCT_RELATIONS, [MATRIX_SOURCE]),
  ]);

  return {
    source: MATRIX_SOURCE,
    functions: sortFunctionsByParam(functions.rows || [], getParam(FUNCTION_ORDER_PARAM, [])),
    products: sortProductsByParam(products.rows || [], getParam(PRODUCT_ORDER_PARAM, [])),
    systems: (systems.rows || []).map((row) => ({
      ...row,
      tone: classifySystemStatus(row.status),
    })),
    functionRelations: functionRelations.rows || [],
    productRelations: productRelations.rows || [],
  };
}

module.exports = {
  MATRIX_SOURCE,
  PRODUCT_ORDER_PARAM,
  FUNCTION_ORDER_PARAM,
  SQL_FUNCTIONS,
  SQL_PRODUCTS,
  SQL_SYSTEMS,
  SQL_FUNCTION_RELATIONS,
  SQL_PRODUCT_RELATIONS,
  classifySystemStatus,
  sortProductsByParam,
  sortFunctionsByParam,
  buildTargetArchitectureMatrix,
};
