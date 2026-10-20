const queries = require('./queries');

/**
 * Политика «связь управляется автоматически» (issue #81).
 *
 * Источник истины — справочник `ar_metamodel_relation_types.managed`:
 *  - true  — ребро создаётся/поддерживается триггером (проекция из реляционной модели)
 *            или карточкой-источником (стек технологий ИС); ручное создание/правка/удаление запрещены;
 *  - false — обычная ручная связь.
 *
 * Ключ — (code, from, to): один код может встречаться для нескольких пар (до миграции
 * 20261020120000 — `system_system_function` для system и subsystem).
 */
const CACHE_TTL_MS = 60 * 1000;
let cache = { expires: 0, rows: [] };

async function loadRelationTypes(pool) {
  if (cache.expires > Date.now()) return cache.rows;
  const res = await pool.query(queries.metamodel_relation_types_select);
  cache = { expires: Date.now() + CACHE_TTL_MS, rows: res.rows || [] };
  return cache.rows;
}

/**
 * @param {{ query: Function }} pool
 * @param {{ code?: string|null, from?: string|null, to?: string|null }} relationType
 * @returns {Promise<boolean>}
 */
async function isManagedRelationType(pool, relationType) {
  const code = relationType && relationType.code != null ? String(relationType.code).trim() : '';
  if (!code) return false;

  const from = relationType.from != null ? String(relationType.from).trim() : '';
  const to = relationType.to != null ? String(relationType.to).trim() : '';

  const rows = await loadRelationTypes(pool);
  const exact = from && to
    ? rows.find(
        (r) =>
          r.code === code &&
          r.from_entity_type_code === from &&
          r.to_entity_type_code === to
      )
    : null;
  if (exact) return exact.managed === true;

  // Пара не найдена — считаем управляемой, если этим кодом помечен хотя бы один тип в справочнике.
  return rows.some((r) => r.code === code && r.managed === true);
}

function clearRelationTypePolicyCache() {
  cache = { expires: 0, rows: [] };
}

module.exports = { isManagedRelationType, clearRelationTypePolicyCache };
