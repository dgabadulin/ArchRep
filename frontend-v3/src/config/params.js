/**
 * Параметры приложения из GET /api/config (issue #28).
 * Устанавливаются при старте в main.js; до загрузки используются значения по умолчанию.
 */
const DEFAULTS = {
  ARR_APP_BASE: '/',
  ARR_MENU_COOKIE: 'ar-v3-menu-expanded',
  ARR_COLS_COOKIE: 'ar_cols_',
  ARR_SORT_COOKIE: 'ar_sort_',
  ARR_COOKIE_MAX_DAYS: 365,
  ARR_SEARCH_PLACEHOLDER: 'Поиск по всем полям таблицы',
  GRAPH_LAYOUT_DEF: 'star',
  GRAPH_MAX_NODES: 200,
  GRAPH_INTEGRATION_FLOW_VISIBLE_MAX: 10,
  GRAPH_EDGE_FONTSZ: 10,
  GRAPH_VIEWBOX_MIN: 500,
  GRAPH_ENTITY_ORDER: ['system', 'web_resource', 'subsystem', 'technology', 'organization_unit', 'actor', 'employee', 'business_service', 'business_function', 'principle'],
  GRAPH_ENTITY_ICONS: null,
  GRAPH_COLLAPSED_SYSTEM_ICON: 'MonitorDot',
  ADR_CODE_MAXLEN: 15,
  SYS_CODE_MAXLEN: 32,
  /** Базовый URL Draw.io для embed (из /api/config). */
  DRAWIO_EMBED_BASE: '',
  /** URL iframe «Тех.радар» (из /api/config); до загрузки конфига — пусто. */
  TECH_RADAR_EMBED_URL: '',
  /** Keycloak SSO flags from GET /api/config (фаза B). */
  keycloak_enabled: false,
  keycloak_login_mode: 'button',
  keycloak_account_url: '',
}

let config = null

export function setConfig(c) {
  config = c && typeof c === 'object' ? { ...DEFAULTS, ...c } : { ...DEFAULTS }
}

export function getConfig() {
  return config || { ...DEFAULTS }
}
