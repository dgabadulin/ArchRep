'use strict';

/**
 * Загрузчик подключаемых модулей (MVP контракта docs/modules-contract.md).
 *
 * Что делает:
 * 1. находит установленные модули (`@isar/<code>` в зависимостях / каталог `modules/<code>`);
 * 2. читает `module.json` (или legacy `manifest.json` — адаптер §16.6);
 * 3. проверяет `requiresCore` против версии ядра (несовпадение → модуль не запускается);
 * 4. вычисляет `enabled` (env `ENABLED_MODULES` → `isar_modules.enabled` → параметр `SYS_MODULE_*_ENABLED`);
 * 5. проверяет лицензию (ключ только в env) и синхронизирует статус в `isar_modules`;
 * 6. монтирует маршруты модуля **до** SPA-fallback ядра, с ядровым license-гейтом.
 *
 * Ошибка любого шага — fail-open для ядра (старт продолжается) и fail-closed для модуля
 * (`enabled=false` в реестре + запись в лог).
 */

const path = require('path');

const { satisfies } = require('./semver');
const {
  readManifest,
  resolveModulePackage,
  discoverModuleCodes,
} = require('./manifest');
const { getLicenseStatus } = require('./license');
const { loadModuleRecords, syncModuleRecord } = require('./registry');
const {
  modulePrefix,
  normalizeEndpoints,
  buildManifestResponse,
  mountDeclaredEndpoints,
  callRegister,
} = require('./adapters/legacy');

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

/** Реестр фактически подключённых модулей: code → запись (источник правды для /api/config). */
const REGISTRY = new Map();
/** Коды, для которых применён legacy-адаптер манифеста (для логов/диагностики). */
const LEGACY_CODES = new Set();

function resetModules() {
  REGISTRY.clear();
  LEGACY_CODES.clear();
}

/** Список из env: `a,b` / `a b` / `a;b`. */
function parseEnabledList(raw) {
  return String(raw == null ? '' : raw)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function envFlagName(code) {
  return `SYS_MODULE_${String(code || '').replace(/-/g, '_')}_ENABLED`;
}

/**
 * Override из env (аварийный переключатель §4):
 * `ENABLED_MODULES` задан → он авторитетен; иначе — `SYS_MODULE_<code>_ENABLED`.
 * @returns {boolean|null} null — override не задан
 */
function envEnabledOverride(code, env = process.env) {
  const list = env.ENABLED_MODULES;
  if (list != null && String(list).trim() !== '') {
    return parseEnabledList(list).includes(code);
  }
  const flag = env[envFlagName(code)];
  if (flag != null && String(flag).trim() !== '') {
    const v = String(flag).trim().toLowerCase();
    if (TRUE_VALUES.has(v)) return true;
    if (FALSE_VALUES.has(v)) return false;
  }
  return null;
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return null;
  const v = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return null;
}

/**
 * Компактное описание привязки лицензии для реестра/диагностики:
 * `any` | `uuid:match` | `uuid:mismatch` | `derived:match` | `derived:mismatch` (+ `:strict`).
 * @param {{mode?:string|null, strict?:boolean, match?:boolean|null}|null|undefined} binding
 * @returns {string|null}
 */
function describeBinding(binding) {
  if (!binding || !binding.mode) return null;
  const parts = [binding.mode];
  if (binding.match === true) parts.push('match');
  else if (binding.match === false) parts.push('mismatch');
  if (binding.strict) parts.push('strict');
  return parts.join(':');
}

/**
 * Итоговый `enabled`: env → БД → параметр БД → false.
 * @param {{code:string, dbRow?:object, getParam?:Function, env?:object}} opts
 */
function resolveEnabled({ code, dbRow, getParam, env = process.env }) {
  const override = envEnabledOverride(code, env);
  if (override != null) return { enabled: override, source: 'env' };
  if (dbRow && typeof dbRow.enabled === 'boolean') return { enabled: dbRow.enabled, source: 'db' };
  if (typeof getParam === 'function') {
    const p = asBoolean(getParam(envFlagName(code), null));
    if (p != null) return { enabled: p, source: 'param' };
  }
  return { enabled: false, source: 'default' };
}

function moduleLogger(code, base = console) {
  const prefix = `[modules][${code}]`;
  const wrap = (fn) => (...args) => fn.call(base, prefix, ...args);
  const info = wrap(base.log || console.log);
  return {
    info,
    log: info,
    warn: wrap(base.warn || console.warn),
    error: wrap(base.error || console.error),
    debug: wrap(base.debug || base.log || console.log),
  };
}

function readCoreVersion(rootDir) {
  try {
    const pkg = require(path.join(rootDir, 'package.json'));
    return String(pkg.version || '0.0.0');
  } catch (_) {
    return '0.0.0';
  }
}

/**
 * Публичный статус модуля для UI (contract §7.4): только несекретное.
 * Ключ лицензии и `settings_json` наружу не отдаются.
 */
function publicStatus(rec) {
  return {
    enabled: Boolean(rec.enabled),
    licensed: Boolean(rec.licensed),
    edition: rec.edition || null,
    expires_at: rec.expiresAt || null,
  };
}

/**
 * Секция `modules` для `GET /api/config` (источник правды для UI, §7.4/§16.6 #9).
 * @returns {Record<string, {enabled:boolean, licensed:boolean, edition:string|null, expires_at:string|null}>}
 */
function getPublicModulesConfig() {
  const out = {};
  for (const [code, rec] of REGISTRY) out[code] = publicStatus(rec);
  return out;
}

function getModuleStatus(code) {
  return REGISTRY.get(code) || null;
}

/**
 * Middleware ядрового гейта для маршрутов модуля:
 * выключен → 403, не лицензирован → 402 (§8, §10).
 */
function makeGate(rec) {
  return function moduleGate(req, res, next) {
    if (!rec.enabled) {
      return res.status(403).json({
        error: `Модуль «${rec.code}» выключен`,
        code: rec.code,
        enabled: false,
      });
    }
    if (!rec.licensed) {
      return res.status(402).json({
        error: `Модуль «${rec.code}» не лицензирован: ${rec.licenseReason || 'нет активной лицензии'}`,
        code: rec.code,
        licensed: false,
      });
    }
    return next();
  };
}

/**
 * `ctx` ядра (contract §6.1): модуль не читает таблицы ядра напрямую,
 * всё общение — через этот объект.
 *
 * @param {{app:object, rec:object, pool:object, getParam:Function, coreVersion:string,
 *   logger:object, gate:Function, menuRegistry?:Map}} opts
 */
function createCoreContext(opts) {
  const { app, rec, pool, getParam, coreVersion, logger, gate } = opts;
  const menuItems = [];
  const permissions = new Set(rec.manifest && rec.manifest.permissions ? rec.manifest.permissions : []);

  const registerRoutes = (routes) => {
    if (!app) return 0;
    // Legacy coreApi.registerRoutes({ prefix, handlers, middleware, info })
    if (routes && !Array.isArray(routes) && typeof routes === 'object' && routes.handlers) {
      const prefix = String(routes.prefix || modulePrefix(rec.code)).replace(/\/+$/, '');
      let mounted = 0;
      if (typeof routes.info === 'function') {
        app.get(`${prefix}/manifest`, (req, res) => res.json(buildManifestResponse(rec)));
        mounted += 1;
      }
      for (const [name, handler] of Object.entries(routes.handlers)) {
        if (typeof handler !== 'function') continue;
        app.post(`${prefix}/${name}`, gate, handler);
        mounted += 1;
      }
      return mounted;
    }
    // Контрактная форма: массив { method, path, handler, permission }
    const list = Array.isArray(routes) ? routes : [];
    let mounted = 0;
    for (const r of list) {
      const method = String((r && (r.method || 'GET'))).toLowerCase();
      const routePath = r && r.path;
      const handler = r && r.handler;
      if (!routePath || typeof handler !== 'function' || typeof app[method] !== 'function') continue;
      if (!String(routePath).startsWith(modulePrefix(rec.code))) {
        logger.warn(`маршрут «${routePath}» вне префикса ${modulePrefix(rec.code)} — пропущен`);
        continue;
      }
      app[method](routePath, gate, handler);
      mounted += 1;
    }
    return mounted;
  };

  const ctx = {
    db: pool,
    /** Контекст авторизации: пользователь и права текущего запроса (после auth-middleware ядра). */
    auth: {
      userFromRequest: (req) => (req ? { user: req.user, roles: req.roles, permissions: req.permissions } : null),
      getUser: (req) => (req ? req.user : null),
      hasPermission: (req, code) => {
        if (!req) return false;
        if (req.authEnabled === false) return true;
        const list = Array.isArray(req.permissions) ? req.permissions : [];
        return list.includes('*') || list.includes(code);
      },
    },
    /** Чтение параметров модуля (группа «Модули»): env → БД → дефолт делает сама ядровая getParam. */
    config: {
      get: (code, def) => (typeof getParam === 'function' ? getParam(code, def) : def),
      isEnabled: () => Boolean(rec.enabled),
      isLicensed: () => Boolean(rec.licensed),
    },
    logger,
    registerRoutes,
    addPermission(code) {
      if (!code) return false;
      permissions.add(String(code));
      return true;
    },
    menu(items) {
      for (const item of items || []) menuItems.push(item);
      return menuItems.length;
    },
    coreVersion,
    module: {
      code: rec.code,
      version: rec.manifest ? rec.manifest.version : null,
      enabled: Boolean(rec.enabled),
      licensed: Boolean(rec.licensed),
      status: () => buildManifestResponse(rec),
    },
  };
  ctx.__menuItems = menuItems;
  ctx.__permissions = permissions;
  return ctx;
}

function baseRecord(code) {
  return {
    code,
    name: code,
    version: '0.0.0',
    coreVersion: null,
    enabled: false,
    licensed: false,
    edition: null,
    expiresAt: null,
    licenseReason: null,
    manifest: null,
    legacy: false,
    dir: null,
    mounted: 0,
    error: null,
  };
}

/**
 * Подключить один модуль. Никогда не бросает: любая проблема → запись в лог + enabled=false.
 *
 * @param {{code:string, app:object, rootDir:string, modulesDir?:string, dbRows:Map<string,object>,
 *   pool:object, getParam:Function, coreVersion:string, logger:Console, env:object}} opts
 * @returns {Promise<object>} запись реестра
 */
async function registerOne(opts) {
  const { code, app, rootDir, modulesDir, dbRows, pool, getParam, coreVersion, logger, env } = opts;
  const log = moduleLogger(code, logger);
  const rec = baseRecord(code);
  rec.coreVersion = coreVersion;
  REGISTRY.set(code, rec);

  const persist = async () => {
    await syncModuleRecord(pool, {
      code: rec.code,
      name: rec.name,
      version: rec.version,
      coreVersion,
      enabled: rec.enabled,
      licensed: rec.licensed,
      expiresAt: rec.expiresAt,
      licenseId: rec.licenseId,
      licenseKid: rec.licenseKid,
      licenseBinding: rec.licenseBinding,
    }, { logger });
  };

  let found;
  try {
    found = resolveModulePackage({ rootDir, modulesDir, code });
  } catch (err) {
    found = null;
    log.error(`ошибка поиска пакета: ${err.message}`);
  }
  if (!found) {
    logger.warn(`[modules] ${code}: пакет не найден (@isar/${code} в зависимостях или modules/${code}) — модуль не запущен`);
    rec.error = 'package-not-found';
    await persist();
    return rec;
  }
  rec.dir = found.dir;

  if (found.requireError) {
    log.error(`ошибка require: ${found.requireError.message} — модуль не запущен, ядро продолжает работу`);
    rec.error = `require: ${found.requireError.message}`;
    await persist();
    return rec;
  }

  const read = readManifest(found.dir);
  if (!read.ok) {
    log.error(`манифест невалиден: ${read.errors.join('; ')} — модуль не запущен`);
    rec.error = 'invalid-manifest';
    await persist();
    return rec;
  }
  rec.manifest = read.manifest;
  rec.name = read.manifest.name;
  rec.version = read.manifest.version;
  rec.legacy = Boolean(read.legacy);
  if (read.legacy) {
    LEGACY_CODES.add(code);
    log.warn('используется legacy manifest.json (id/permissionsProvided/surface) — ядро применило адаптер; ' +
      'задача модулю: перейти на module.json по контракту §3');
  }

  const compat = satisfies(coreVersion, read.manifest.requiresCore);
  if (!compat.ok) {
    logger.warn(`[modules] ${code}: requires core ${read.manifest.requiresCore}, have ${coreVersion} — ` +
      `модуль не запущен (${compat.reason})`);
    rec.error = `core-version: ${compat.reason}`;
    await persist();
    return rec;
  }

  const enabledRes = resolveEnabled({ code, dbRow: dbRows.get(code), getParam, env });
  rec.enabled = enabledRes.enabled;
  rec.enabledSource = enabledRes.source;

  const lic = getLicenseStatus({ code, manifest: read.manifest, env });
  rec.licensed = Boolean(lic.licensed);
  rec.edition = lic.edition || null;
  rec.expiresAt = lic.expires_at || null;
  rec.licenseReason = lic.reason || null;
  rec.licenseId = lic.license_id || null;
  rec.licenseKid = lic.kid || null;
  rec.licenseBinding = describeBinding(lic.binding);
  rec.licenseWarnings = Array.isArray(lic.warnings) ? lic.warnings : [];
  for (const warning of rec.licenseWarnings) {
    log.warn(`лицензия: ${warning}`);
  }
  if (!rec.licensed) {
    logger.warn(`[modules] ${code}: лицензия не активна — ${lic.reason} (маршруты → 402, UI скрыт)`);
  }

  if (!rec.enabled) {
    log.info(`выключен (источник: ${enabledRes.source}); маршруты не монтируются`);
    await persist();
    return rec;
  }

  const exportsObj = found.exports;
  const endpoints = normalizeEndpoints(read.manifest);
  const expectsBackend = read.manifest.type === 'backend' || read.manifest.type === 'hybrid';
  if (expectsBackend && !exportsObj) {
    log.error('пакет не отдаёт backend-экспорты — модуль не запущен');
    rec.error = 'no-exports';
    rec.enabled = false;
    await persist();
    return rec;
  }

  const gate = makeGate(rec);
  const describe = () => buildManifestResponse(rec);
  const ctx = createCoreContext({ app, rec, pool, getParam, coreVersion, logger: log, gate });

  try {
    if (exportsObj && typeof exportsObj.handlers === 'object' && endpoints.length) {
      const mounted = mountDeclaredEndpoints(app, {
        code,
        manifest: read.manifest,
        exports: exportsObj,
        gate,
        describe,
        logger: log,
      });
      rec.mounted = mounted.mounted;
      rec.routes = endpoints.map((e) => `${e.method} ${e.path}`);
      for (const s of mounted.skipped) log.warn(`маршрут ${s.path} пропущен: ${s.reason}`);
      log.info(`маршруты смонтированы ядром (адаптер handlers): ${mounted.mounted}/${endpoints.length}`);
    } else {
      const coreApi = {
        version: coreVersion,
        registerRoutes: ctx.registerRoutes,
        registerEndpoints: (list) => ctx.registerRoutes(list),
        registerMenuItems: (items) => ctx.menu(items),
        moduleStatus: describe,
      };
      const res = callRegister({ exportsObj, app, ctx, coreApi });
      if (!res.ok) {
        log.error(`${res.reason} — модуль не запущен`);
        rec.error = res.reason;
        rec.enabled = false;
        await persist();
        return rec;
      }
      rec.routes = endpoints.map((e) => `${e.method} ${e.path}`);
      log.info('зарегистрирован через register({ app, ctx, coreApi })');
    }
  } catch (err) {
    log.error(`ошибка регистрации: ${err.message} — модуль выключен, ядро продолжает работу`);
    rec.error = err.message;
    rec.enabled = false;
    rec.licensed = false;
  }

  await persist();
  return rec;
}

/**
 * Подключить все установленные и включённые модули.
 * Вызывать **до** `app.use(express.static(...))` и `app.get('*')` — иначе SPA-fallback
 * перехватит `/api/<code>/*` (contract §6.1 п.4).
 *
 * @param {object} app — Express-приложение ядра
 * @param {{db?:object, pool?:object, getParam?:Function, config?:{get:Function}, logger?:Console,
 *   coreVersion?:string, rootDir?:string, modulesDir?:string, env?:object}} [ctx]
 */
async function registerModules(app, ctx = {}) {
  const rootDir = ctx.rootDir || path.resolve(__dirname, '..', '..');
  const logger = ctx.logger || console;
  const pool = ctx.db || ctx.pool || null;
  const env = ctx.env || process.env;
  const getParam = typeof ctx.getParam === 'function'
    ? ctx.getParam
    : (ctx.config && typeof ctx.config.get === 'function' ? ctx.config.get : null);
  const coreVersion = ctx.coreVersion || readCoreVersion(rootDir);
  const modulesDir = ctx.modulesDir || env.MODULES_DIR || path.join(rootDir, 'modules');

  REGISTRY.clear();
  LEGACY_CODES.clear();

  const dbRows = await loadModuleRecords(pool, { logger });
  const extraCodes = [...parseEnabledList(env.ENABLED_MODULES), ...dbRows.keys()];
  const codes = discoverModuleCodes({ rootDir, modulesDir, extraCodes });
  const logLine = typeof logger.log === 'function'
    ? logger.log.bind(logger)
    : (typeof logger.info === 'function' ? logger.info.bind(logger) : () => {});
  logLine(`[modules] версия ядра ${coreVersion}; кандидаты: ${codes.length ? codes.join(', ') : 'нет'}`);

  for (const code of codes) {
    await registerOne({
      code,
      app,
      rootDir,
      modulesDir,
      dbRows,
      pool,
      getParam,
      coreVersion,
      logger,
      env,
    });
  }

  const active = [...REGISTRY.values()].filter((r) => r.enabled && r.licensed).map((r) => r.code);
  logLine(`[modules] активно: ${active.length ? active.join(', ') : 'нет'}`);
  return { coreVersion, codes, modules: getPublicModulesConfig(), registry: REGISTRY };
}

/** Включён ли и лицензирован ли модуль (для UI/маршрутов). */
function isModuleActive(code) {
  const rec = REGISTRY.get(code);
  return Boolean(rec && rec.enabled && rec.licensed);
}

/**
 * Middleware «модуль активен» для собственных маршрутов ядра, зависящих от модуля.
 * @param {string} code
 */
function requireModuleActive(code) {
  return function moduleActive(req, res, next) {
    const rec = REGISTRY.get(code);
    if (!rec) return res.status(404).json({ error: `Модуль «${code}» не установлен`, code });
    return makeGate(rec)(req, res, next);
  };
}

/** Записи реестра (диагностика/тесты). */
function listModules() {
  return [...REGISTRY.values()];
}

/** Коды модулей, к манифестам которых пришлось применить legacy-адаптер. */
function legacyModuleCodes() {
  return [...LEGACY_CODES];
}

module.exports = {
  registerModules,
  getPublicModulesConfig,
  getModuleStatus,
  isModuleActive,
  requireModuleActive,
  listModules,
  legacyModuleCodes,
  resetModules,
  makeGate,
  createCoreContext,
  resolveEnabled,
  envEnabledOverride,
  parseEnabledList,
  moduleLogger,
  readCoreVersion,
  REGISTRY,
};
