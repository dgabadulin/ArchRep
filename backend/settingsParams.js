/**
 * Загрузка настроечных параметров из БД (ar_settings_parameters).
 * Приоритет: переменная окружения (если задана для параметра) → параметр из БД → значение по умолчанию.
 * Используется после loadParams(pool) при старте приложения.
 */
const settingsSelect = `SELECT code, value, value_type FROM archrep.ar_settings_parameters`;

const cache = new Map();

function parseValue(value, valueType) {
  if (value == null || value === '') return undefined;
  const t = (valueType || 'string').toLowerCase();
  if (t === 'number') return Number(value);
  if (t === 'boolean') return value === true || value === 'true' || value === '1';
  if (t === 'json') {
    try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return value; }
  }
  if (t === 'string_list') {
    try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return []; }
  }
  return String(value);
}

/**
 * Загрузить все параметры из БД в кэш. Вызывать при старте после создания pool.
 * @param {import('pg').Pool} pool
 */
async function loadParams(pool) {
  try {
    const r = await pool.query(settingsSelect);
    cache.clear();
    for (const row of r.rows || []) {
      cache.set(row.code, parseValue(row.value, row.value_type));
    }
  } catch (err) {
    console.warn('Settings params load failed (table may not exist):', err.message);
  }
}

/**
 * Получить значение параметра по коду. После loadParams() — синхронно из кэша.
 * @param {string} code — код параметра (например ARR_SERVER_PORT, GAP_CODE_PREFIX, TECH_RADAR_EMBED_URL, SYS_TECH_STACK_RELATION_CODE, MODULE_TECH_STACK_RELATION_CODE)
 * @param {*} defaultValue — значение по умолчанию, если параметр не задан
 * @returns {*}
 */
function getParam(code, defaultValue) {
  if (cache.has(code)) {
    const v = cache.get(code);
    return v !== undefined && v !== '' ? v : defaultValue;
  }
  return defaultValue;
}

module.exports = { loadParams, getParam };
