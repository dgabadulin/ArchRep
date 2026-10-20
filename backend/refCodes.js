/**
 * Кэш кодов справочников ADR / статусов связи инкремента / статусов интеграционных потоков
 * / статусов систем / статусов функций (реестр и в заключении).
 * Загружается при старте (loadRefCodes); перезагрузка после изменения справочников через API.
 */
const adrStatusIdToCode = new Map();
const adrStatusCodeToId = new Map();
const incrRelStatusIdToCode = new Map();
const incrRelStatusCodeToId = new Map();
const flowStatusIdToCode = new Map();
const flowStatusCodeToId = new Map();
const sysStatusIdToCode = new Map();
const sysStatusCodeToId = new Map();
const sysFuncStatusIdToCode = new Map();
const sysFuncStatusCodeToId = new Map();
const incrSysFuncStatusIdToCode = new Map();
const incrSysFuncStatusCodeToId = new Map();
const incrSysStatusIdToCode = new Map();
const incrSysStatusCodeToId = new Map();

/**
 * Ключи уже выданных диагностик (`параметр|код|причина`): маппинги применяются на каждом сохранении
 * заключения, поэтому предупреждение печатается один раз на процесс — иначе лог забивается повторами.
 * Сбрасывается при перезагрузке справочников (`clearMaps`), чтобы после правки параметра диагностика вернулась.
 */
const warnedMapMisses = new Set();

function clearMaps() {
  for (const m of [
    adrStatusIdToCode, adrStatusCodeToId,
    incrRelStatusIdToCode, incrRelStatusCodeToId,
    flowStatusIdToCode, flowStatusCodeToId,
    sysStatusIdToCode, sysStatusCodeToId,
    sysFuncStatusIdToCode, sysFuncStatusCodeToId,
    incrSysFuncStatusIdToCode, incrSysFuncStatusCodeToId,
    incrSysStatusIdToCode, incrSysStatusCodeToId,
  ]) m.clear();
  warnedMapMisses.clear();
}

/**
 * Диагностика «статус взят не из маппинга, а по умолчанию»: молчаливый fallback скрывал расхождение
 * справочников статусов и параметров `ADR_*_STATUS_MAP` (задача: статусы — данными, а не хардкодом).
 * @param {string} label — код параметра маппинга (для поиска в «Настройки → Параметры»)
 * @param {string} reason — что именно не сошлось
 * @param {string|null} code — код статуса сущности в заключении
 * @param {number|null|undefined} fallbackId — подставленный id (null — статус не меняется)
 */
function warnMapFallback(label, reason, code, fallbackId) {
  const key = `${label}|${code || ''}|${reason}`;
  if (warnedMapMisses.has(key)) return;
  warnedMapMisses.add(key);
  console.warn(
    `[refCodes] ${label}: ${reason}${code ? ` — ${code}` : ''}. ` +
      `Применён статус по умолчанию (id: ${fallbackId == null ? 'нет — без изменений' : fallbackId}). ` +
      'Проверьте параметр в «Настройки → Параметры».',
  );
}

/**
 * @param {import('pg').Pool} pool
 */
async function loadRefCodes(pool) {
  clearMaps();
  const [a, b, c, d, e, f, g] = await Promise.all([
    pool.query('SELECT id, code FROM archrep.ar_adr_statuses WHERE code IS NOT NULL'),
    pool.query('SELECT id, code FROM archrep.ar_adr_increment_relation_statuses WHERE code IS NOT NULL'),
    pool.query('SELECT id, code FROM archrep.ar_integration_flow_statuses WHERE code IS NOT NULL'),
    pool.query('SELECT id, code FROM archrep.ar_system_statuses WHERE code IS NOT NULL'),
    pool.query('SELECT id, code FROM archrep.ar_system_function_statuses WHERE code IS NOT NULL'),
    pool.query('SELECT id, code FROM archrep.ar_adr_increment_system_function_statuses WHERE code IS NOT NULL'),
    pool.query('SELECT id, code FROM archrep.ar_adr_increment_system_statuses WHERE code IS NOT NULL'),
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
  for (const row of d.rows || []) {
    sysStatusIdToCode.set(Number(row.id), row.code);
    sysStatusCodeToId.set(row.code, Number(row.id));
  }
  for (const row of e.rows || []) {
    sysFuncStatusIdToCode.set(Number(row.id), row.code);
    sysFuncStatusCodeToId.set(row.code, Number(row.id));
  }
  for (const row of f.rows || []) {
    incrSysFuncStatusIdToCode.set(Number(row.id), row.code);
    incrSysFuncStatusCodeToId.set(row.code, Number(row.id));
  }
  for (const row of g.rows || []) {
    incrSysStatusIdToCode.set(Number(row.id), row.code);
    incrSysStatusCodeToId.set(row.code, Number(row.id));
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

function getSystemStatusIdByCode(code) {
  if (code == null || code === '') return null;
  return sysStatusCodeToId.get(String(code).trim()) ?? null;
}

function getSystemStatusCodeById(id) {
  if (id == null) return null;
  return sysStatusIdToCode.get(Number(id)) || null;
}

function getSysFuncStatusIdByCode(code) {
  if (code == null || code === '') return null;
  return sysFuncStatusCodeToId.get(String(code).trim()) ?? null;
}

function getIncrSysFuncStatusIdByCode(code) {
  if (code == null || code === '') return null;
  return incrSysFuncStatusCodeToId.get(String(code).trim()) ?? null;
}

function getIncrSysStatusIdByCode(code) {
  if (code == null || code === '') return null;
  return incrSysStatusCodeToId.get(String(code).trim()) ?? null;
}

/** Код статуса связи инкремента (ar_adr_increment_relation_statuses) по id. */
function getIncrRelStatusCodeById(id) {
  if (id == null) return null;
  return incrRelStatusIdToCode.get(Number(id)) || null;
}

/** id статуса связи инкремента по коду. */
function getIncrRelStatusIdByCode(code) {
  if (code == null || code === '') return null;
  return incrRelStatusCodeToId.get(String(code).trim()) ?? null;
}

/**
 * Разрешить id статуса из параметра-маппинга (формат code->code).
 * Пустое значение в маппинге → null (без изменений).
 *
 * Диагностика (issue #91): код, которого нет в маппинге или которого нет в целевом справочнике, раньше
 * молча заменялся на `fallbackId` — расхождение параметра и справочника не было видно. Теперь такой
 * случай пишется в консоль (`warnMapFallback`), а при `opts.strict` статус по умолчанию не подставляется (null).
 *
 * @param {object|null} map
 * @param {string|null} incrementStatusCode — код статуса «в рамках заключения»
 * @param {(code: string) => number|null} codeToId — резолвер id целевого справочника
 * @param {number|null} fallbackId — дефолтный id по коду
 * @param {{ label?: string, strict?: boolean }} [opts] — код параметра для диагностики и строгий режим
 */
function resolveStatusIdFromMap(map, incrementStatusCode, codeToId, fallbackId, opts = {}) {
  const label = opts.label || 'ADR_*_STATUS_MAP';
  const code = incrementStatusCode == null ? '' : String(incrementStatusCode).trim();
  const hasMap = Boolean(map) && typeof map === 'object' && Object.keys(map).length > 0;
  if (!code) {
    warnMapFallback(label, 'у сущности не задан статус в заключении', null, fallbackId);
    return fallbackId ?? null;
  }
  if (!hasMap) {
    warnMapFallback(label, 'параметр не задан или пуст', code, fallbackId);
    return fallbackId ?? null;
  }
  const targetCode = map[code];
  // в маппинге пустая строка → «без изменений»
  if (targetCode != null && String(targetCode).trim() === '') return null;
  if (targetCode != null) {
    const id = codeToId(targetCode);
    if (id != null) return id;
    warnMapFallback(label, `код «${targetCode}» не найден в целевом справочнике`, code, fallbackId);
    return opts.strict ? null : fallbackId ?? null;
  }
  warnMapFallback(label, 'статус заключения отсутствует в маппинге', code, fallbackId);
  return opts.strict ? null : fallbackId ?? null;
}

/**
 * Разрешить id статуса потока из параметра ADR_FLOW_STATUS_MAP (формат code->code).
 * @param {object} map - из getParam
 * @param {{ increment_relation_status_code?: string|null }} rel
 * @param {number} defaultId — крайний резерв (id «Запланирован») для баз без кодов статусов потоков
 * @param {{ label?: string, strict?: boolean, defaultCode?: string }} [opts] — код параметра для диагностики,
 *   строгий режим и код статуса потока по умолчанию (параметр `ADR_FLOW_DEFAULT_STATUS_CODE`)
 */
function resolveFlowStatusIdFromMap(map, rel, defaultId = 1, opts = {}) {
  const label = opts.label || 'ADR_FLOW_STATUS_MAP';
  const defaultCode = String(opts.defaultCode || 'FLOW_STATUS_1').trim();
  /**
   * Статус потока по умолчанию: код из параметра `ADR_FLOW_DEFAULT_STATUS_CODE`, иначе — исторический id
   * (`defaultId`, по умолчанию 1 — «Планируется к реализации»).
   * @returns {{ id: number|null, resolved: boolean }} resolved — код найден в справочнике статусов потоков
   */
  const defaultStatus = () => {
    const id = getFlowStatusIdByCode(defaultCode);
    return id != null ? { id, resolved: true } : { id: defaultId ?? null, resolved: false };
  };
  /**
   * Статус не определён маппингом: диагностика с фактическим исходом («известные» коды в маппинге,
   * но отсутствующие в справочнике, — самая частая причина) + строгий режим (`ADR_STATUS_MAP_STRICT`).
   */
  const miss = (reason, code) => {
    if (opts.strict) {
      warnMapFallback(label, `${reason} — строгий режим ADR_STATUS_MAP_STRICT=true`, code, null);
      return null;
    }
    const def = defaultStatus();
    const outcome = def.id == null
      ? 'статус по умолчанию не определён'
      : def.resolved
        ? `по коду ${defaultCode}`
        : `код по умолчанию «${defaultCode}» не найден в справочнике статусов потоков`;
    warnMapFallback(label, outcome ? `${reason} (${outcome})` : reason, code, def.id);
    return def.id;
  };
  const incCode = String((rel && rel.increment_relation_status_code) || '').trim();
  const entries = map && typeof map === 'object' ? Object.entries(map) : [];
  if (!entries.length) return miss('параметр не задан или пуст', incCode || null);
  if (!incCode) {
    const defCode = entries.find(([k]) => k === '' || k === '_default');
    if (defCode) {
      const id = getFlowStatusIdByCode(defCode[1]);
      if (id != null) return id;
      return miss(`код по умолчанию «${defCode[1]}» (ключ «${defCode[0]}») не найден в справочнике статусов потоков`, null);
    }
    return miss('у связи не задан статус в заключении', null);
  }
  const flowCode = map[incCode];
  if (flowCode == null || String(flowCode).trim() === '') return miss('статус связи отсутствует в маппинге', incCode);
  const id = getFlowStatusIdByCode(flowCode);
  if (id != null) return id;
  return miss(`код «${flowCode}» не найден в справочнике статусов потоков`, incCode);
}

module.exports = {
  loadRefCodes,
  getAdrStatusCodeById,
  getFlowStatusIdByCode,
  resolveFlowStatusIdFromMap,
  getSystemStatusIdByCode,
  getSystemStatusCodeById,
  getSysFuncStatusIdByCode,
  getIncrSysFuncStatusIdByCode,
  getIncrSysStatusIdByCode,
  getIncrRelStatusCodeById,
  getIncrRelStatusIdByCode,
  resolveStatusIdFromMap,
};
