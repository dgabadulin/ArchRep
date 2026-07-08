/**
 * Главная страница: KPI из параметра ARR_HOME_KPI_TILES + аккордеон по типам метамодели.
 * @see docs/home-dashboard-catalog-metrics.md
 */

const { getParam } = require('./settingsParams');
const queries = require('./queries');

/** Имена функций archrep.*() без скобок — только whitelist. */
const ALLOWED_COUNT_FUNCTIONS = new Set([
  'dashboard_home_systems_total',
  'dashboard_home_systems_with_parent',
  'dashboard_home_integration_flows',
  'dashboard_home_technologies_total',
  'dashboard_home_technologies_foreign_null_flag',
  'dashboard_home_gaps_total',
  'dashboard_home_gaps_closed',
]);

const RE_SAFE_FN = /^[a-z][a-z0-9_]*$/;

/** Коды сущностей, уже отражённые в KPI — не показывать в аккордеоне. */
const ACCORDION_EXCLUDED_ENTITY_CODES = new Set(['system', 'technology', 'gap']);

/** Подсчёт строк для аккордеона: code метамодели → безопасный SQL (только SELECT COUNT). */
const ACCORDION_COUNT_SQL = {
  organization_unit: 'SELECT COUNT(*)::bigint AS c FROM archrep.ar_organization_units',
  actor: 'SELECT COUNT(*)::bigint AS c FROM archrep.ar_actors',
  business_service: 'SELECT COUNT(*)::bigint AS c FROM archrep.ar_business_services',
  business_function: 'SELECT COUNT(*)::bigint AS c FROM archrep.ar_business_functions',
  principle: 'SELECT COUNT(*)::bigint AS c FROM archrep.ar_principles',
  web_resource: 'SELECT COUNT(*)::bigint AS c FROM archrep.ar_web_resources',
};

const DEFAULT_KPI_TILES = [
  {
    titleTpl: 'Информационные системы',
    countFn: 'archrep.dashboard_home_systems_total',
    footerTpl: 'в т.ч. {n} подсистем и модулей',
    footerFn: 'archrep.dashboard_home_systems_with_parent',
    icon: 'desktop',
  },
  {
    titleTpl: 'Интеграционные потоки',
    countFn: 'archrep.dashboard_home_integration_flows',
    footerTpl: null,
    footerFn: null,
    icon: 'share',
  },
  {
    titleTpl: 'Технологические компоненты',
    countFn: 'archrep.dashboard_home_technologies_total',
    footerTpl: 'в т.ч. {n} иностранных',
    footerFn: 'archrep.dashboard_home_technologies_foreign_null_flag',
    icon: 'radar',
  },
  {
    titleTpl: 'Архитектурные отклонения',
    countFn: 'archrep.dashboard_home_gaps_total',
    footerTpl: 'в т.ч. {n} закрытых',
    footerFn: 'archrep.dashboard_home_gaps_closed',
    icon: 'debt',
  },
];

function parseQualifiedFn(qualified) {
  if (typeof qualified !== 'string' || !qualified.trim()) return null;
  const s = qualified.trim();
  if (!s.startsWith('archrep.')) return null;
  const name = s.slice('archrep.'.length);
  if (!RE_SAFE_FN.test(name) || !ALLOWED_COUNT_FUNCTIONS.has(name)) return null;
  return name;
}

function applyTpl(tpl, total, n) {
  if (tpl == null || tpl === '') return '';
  return String(tpl)
    .replace(/\{total\}/g, total != null ? String(total) : '')
    .replace(/\{n\}/g, n != null ? String(n) : '');
}

async function execCount(pool, qualifiedFn) {
  const fn = parseQualifiedFn(qualifiedFn);
  if (!fn) return null;
  try {
    const q = `SELECT archrep.${fn}() AS c`;
    const r = await pool.query(q);
    const v = r.rows[0]?.c;
    if (v == null) return null;
    const n = typeof v === 'bigint' ? Number(v) : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    console.warn(`home-stats count ${fn}:`, e.message);
    return null;
  }
}

function normalizeKpiConfig(raw) {
  if (Array.isArray(raw) && raw.length > 0) return raw;
  return DEFAULT_KPI_TILES;
}

/**
 * @param {import('pg').Pool} pool
 */
async function buildHomeStats(pool) {
  const raw = getParam('ARR_HOME_KPI_TILES', null);
  let tilesConfig = DEFAULT_KPI_TILES;
  if (raw != null) {
    if (Array.isArray(raw)) tilesConfig = raw;
    else if (typeof raw === 'string') {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p) && p.length) tilesConfig = p;
      } catch {
        /* keep default */
      }
    }
  }
  tilesConfig = normalizeKpiConfig(tilesConfig);

  const kpiTiles = [];
  for (const tile of tilesConfig) {
    if (!tile || typeof tile !== 'object') continue;
    const countFn = tile.countFn;
    if (parseQualifiedFn(countFn) == null) continue;
    const primary = await execCount(pool, countFn);
    if (primary == null) {
      kpiTiles.push({
        title: applyTpl(tile.titleTpl || '', 0, null),
        primary: null,
        footer: null,
        error: true,
        icon: typeof tile.icon === 'string' ? tile.icon : null,
      });
      continue;
    }

    let footer = null;
    let secondary = null;
    if (tile.footerFn && tile.footerTpl) {
      secondary = await execCount(pool, tile.footerFn);
      if (secondary != null) footer = applyTpl(tile.footerTpl, primary, secondary);
    }

    const title = applyTpl(tile.titleTpl || '', primary, secondary);

    kpiTiles.push({
      title,
      primary: primary != null ? primary : 0,
      footer,
      icon: typeof tile.icon === 'string' ? tile.icon : null,
    });
  }

  const accordion = [];
  try {
    const et = await pool.query(queries.metamodel_entity_types_select);
    for (const row of et.rows || []) {
      const code = (row.code || '').trim();
      if (!code || ACCORDION_EXCLUDED_ENTITY_CODES.has(code)) continue;
      const sql = ACCORDION_COUNT_SQL[code];
      if (!sql) continue;
      const cr = await pool.query(sql);
      const c = cr.rows[0]?.c;
      const n = c != null ? Number(typeof c === 'bigint' ? c : c) : 0;
      accordion.push({
        entityTypeCode: code,
        label: row.name || code,
        count: Number.isFinite(n) ? n : 0,
      });
    }
  } catch (e) {
    console.warn('home-stats accordion:', e.message);
  }

  accordion.sort((a, b) => String(a.label).localeCompare(String(b.label), 'ru'));

  return { kpiTiles, accordion };
}

module.exports = {
  buildHomeStats,
  ALLOWED_COUNT_FUNCTIONS,
  DEFAULT_KPI_TILES,
};
