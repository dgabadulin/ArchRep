/**
 * Параметры приложения из GET /api/config (issue #28).
 * Устанавливаются при старте в main.js; до загрузки используются значения по умолчанию.
 */
const DEFAULTS = {
  ARR_APP_BASE: '/',
  ARR_MENU_COOKIE: 'ar-v3-menu-expanded',
  ARR_COLS_COOKIE: 'ar_cols_',
  ARR_SORT_COOKIE: 'ar_sort_',
  ARR_FILTER_COOKIE: 'ar_filters_',
  ARR_COOKIE_MAX_DAYS: 365,
  ARR_SEARCH_PLACEHOLDER: 'Поиск по всем полям таблицы',
  GRAPH_LAYOUT_DEF: 'star',
  GRAPH_MAX_NODES: 200,
  GRAPH_INTEGRATION_FLOW_VISIBLE_MAX: 10,
  GRAPH_EDGE_FONTSZ: 10,
  GRAPH_VIEWBOX_MIN: 500,
  GRAPH_ENTITY_ORDER: ['system', 'web_resource', 'domain', 'subsystem', 'technology', 'infrastructure_object', 'organization_unit', 'actor', 'employee', 'business_service', 'business_function', 'principle'],
  GRAPH_ENTITY_ICONS: null,
  GRAPH_COLLAPSED_SYSTEM_ICON: 'MonitorDot',
  ADR_CODE_MAXLEN: 15,
  SYS_CODE_MAXLEN: 32,
  /**
   * Статусы контура заключения (issue #91): коды справочников, а не строки в коде форм.
   * Дефолты должны совпадать с официальными сидами в DB/scripts (группа ADR).
   */
  ADR_INCR_SYS_NEW_STATUS_CODE: 'ADR_INCR_SYS_CREATING',
  ADR_INCR_SYSFUNC_NEW_STATUS_CODE: 'ADR_INCR_SYSFUNC_CREATING',
  ADR_INCR_REL_NEW_STATUS_CODE: 'ADR_INCR_REL_CREATING',
  /** Код статуса системы «в решении» для системы реестра (по умолчанию в пикере статуса формы). */
  ADR_INCR_SYS_DEFAULT_STATUS_CODE: 'ADR_INCR_SYS_IN_USE',
  /** Код статуса связи для потока из реестра (модалка интеграций). */
  ADR_INCR_REL_EXISTING_STATUS_CODE: 'ADR_INCR_REL_IN_USE',
  /** Коды статусов заключения, при которых форма разрешает править решения/системы/связи. */
  ADR_EDITABLE_STATUS_CODES: ['ADR_STATUS_DRAFT'],
  /** Базовый URL Draw.io для embed (из /api/config). */
  DRAWIO_EMBED_BASE: '',
  /** URL iframe «Тех.радар» (из /api/config); до загрузки конфига — пусто. */
  TECH_RADAR_EMBED_URL: '',
  /** Keycloak SSO flags from GET /api/config (фаза B). */
  keycloak_enabled: false,
  keycloak_login_mode: 'button',
  keycloak_account_url: '',
  /** ИИ-архитектор (issue #78): публичные параметры панели (группа «ИИ-архитектор» в настройках). */
  SYS_AI_ENABLED: false,
  /** SYS_AI_MODEL: имя модели в дефолтах не хранится — приходит из /api/config (env или параметр БД). */
  SYS_AI_MODEL: '',
  SYS_AI_TITLE: 'ИИ-архитектор',
  SYS_AI_PANEL_WIDTH: 400,
  SYS_AI_HISTORY_LIMIT: 20,
  /** Максимум id в фокусе экрана «Анализ зависимостей» (диплинк ИИ-архитектора `?entity=&ids=`). */
  SYS_AI_FOCUS_MAX_IDS: 50,
}

let config = null

export function setConfig(c) {
  config = c && typeof c === 'object' ? { ...DEFAULTS, ...c } : { ...DEFAULTS }
}

export function getConfig() {
  return config || { ...DEFAULTS }
}
