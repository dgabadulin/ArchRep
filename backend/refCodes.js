/**
 * Кэш кодов справочников ADR / статусов связи инкремента / статусов интеграционных потоков.
 * Загружается при старте (loadRefCodes); перезагрузка после изменения справочников через API.
 */
const adrStatusIdToCode = new Map();
const adrStatusCodeToId = new Map();
const incrRelStatusIdToCode = new Map();
const incrRelStatusCodeToId = new Map();
const flowStatusIdToCode = new Map();
const flowStatusCodeToId = new Map();

function clearMaps() {
  adrStatusIdToCode.clear();
  adrStatusCodeToId.clear();
  incrRelStatusIdToCode.clear();
  incrRelStatusCodeToId.clear();
  flowStatusIdToCode.clear();
  flowStatusCodeToId.clear();
}

/**
 * @param {import('pg').Pool} pool
 */
async function loadRefCodes(pool) {
  clearMaps();
  const [a, b, c] = await Promise.all([
    pool.query('SELECT id, code FROM archrep.ar_adr_statuses WHERE code IS NOT NULL'),
    pool.query('SELECT id, code FROM archrep.ar_adr_increment_relation_statuses WHERE code IS NOT NULL'),
    pool.query('SELECT id, code FROM archrep.ar_integration_flow_statuses WHERE code IS NOT NULL'),
  ]);
  for (const row of a.rows || []) {
    adrStatusIdToCode.set(Number(row.id), row.code);
    adrStatusCodeToId.set(row.code, Number(row.id));
  }
  for (const row of b.rows || []) {
    incrRelStatusIdToCode.set(Number(row.id), row.code);
    incrRelStatusCodeToId.set(row.code, Number(row.id));
  }
  for (const row of c.rows || []) {
    flowStatusIdToCode.set(Number(row.id), row.code);
    flowStatusCodeToId.set(row.code, Number(row.id));
  }
}

function getAdrStatusCodeById(id) {
  if (id == null) return null;
  return adrStatusIdToCode.get(Number(id)) || null;
}

function getFlowStatusIdByCode(code) {
  if (code == null || code === '') return null;
  return flowStatusCodeToId.get(String(code).trim()) ?? null;
}

/**
 * Разрешить id статуса потока из параметра ADR_FLOW_STATUS_MAP (формат code->code).
 * @param {object} map - из getParam
 * @param {{ increment_relation_status_code?: string|null }} rel
 * @param {number} defaultId
 */
function resolveFlowStatusIdFromMap(map, rel, defaultId = 1) {
  if (!map || typeof map !== 'object') return getFlowStatusIdByCode('FLOW_STATUS_PLANNED') || defaultId;
  const entries = Object.entries(map);
  if (entries.length === 0) return getFlowStatusIdByCode('FLOW_STATUS_PLANNED') || defaultId;
  const incCode = (rel.increment_relation_status_code || '').trim();
  if (!incCode) {
    const defCode = entries.find(([k]) => k === '' || k === '_default');
    if (defCode) {
      const id = getFlowStatusIdByCode(defCode[1]);
      if (id != null) return id;
    }
    return getFlowStatusIdByCode('FLOW_STATUS_PLANNED') || defaultId;
  }
  const flowCode = map[incCode];
  if (flowCode == null || flowCode === '') {
    return getFlowStatusIdByCode('FLOW_STATUS_PLANNED') || defaultId;
  }
  const id = getFlowStatusIdByCode(flowCode);
  return id != null ? id : getFlowStatusIdByCode('FLOW_STATUS_PLANNED') || defaultId;
}

module.exports = {
  loadRefCodes,
  getAdrStatusCodeById,
  getFlowStatusIdByCode,
  resolveFlowStatusIdFromMap,
};
