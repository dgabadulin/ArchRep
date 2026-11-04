'use strict';

/**
 * Адаптеры подключения модулей (docs/modules-contract.md §6, §16.6).
 *
 * Контракт ядра — `register({ app, ctx })`. Реальные модули (например `@isar/drawio-pro`
 * v0.1.0) экспортируют `register({ app, coreApi })`, игнорируют `ctx` и/или отдают
 * `handlers` + `manifest.endpoints`. Здесь собраны обе формы, чтобы **не патчить модуль**:
 *
 * 1) `mountDeclaredEndpoints()` — если модуль объявил endpoints и отдал handlers,
 *    ядро монтирует их само: под общим auth-middleware ядра (routePermissions),
 *    с ядровым license-гейтом и подменой `/manifest` на статус ядра;
 * 2) `callRegister()` — иначе вызывается `register({ app, ctx, db, auth, coreApi })`
 *    (объектная форма расширяема: старые поля остаются доступными).
 */

const METHOD_ALIASES = ['get', 'post', 'put', 'patch', 'delete'];

function modulePrefix(code) {
  return `/api/${code}`;
}

/**
 * Привести endpoints/routes манифеста к общему виду.
 * @param {object} manifest
 * @returns {Array<{method:string, path:string, action:string, permission:string|null}>}
 */
function normalizeEndpoints(manifest) {
  const out = [];
  const push = (raw) => {
    if (!raw || typeof raw !== 'object') return;
    const method = String(raw.method || 'GET').toUpperCase();
    const path = String(raw.path || '').trim();
    if (!path) return;
    const action = raw.action || raw.handler || path.split('/').filter(Boolean).pop() || '';
    out.push({ method, path, action, permission: raw.permission || raw.requiredPermission || null });
  };
  for (const ep of manifest.endpoints || []) push(ep);
  for (const rt of manifest.routes || []) push(rt);
  return out;
}

/**
 * Найти обработчик модуля по имени действия (`parse`, `validate`, `payload`…).
 * @param {object} exportsObj
 * @param {string} action
 * @returns {Function|null}
 */
function pickHandler(exportsObj, action) {
  const handlers = exportsObj && exportsObj.handlers;
  if (!handlers || typeof handlers !== 'object' || !action) return null;
  if (typeof handlers[action] === 'function') return handlers[action];
  const camel = String(action).replace(/-([a-z0-9])/g, (_m, ch) => ch.toUpperCase());
  if (typeof handlers[camel] === 'function') return handlers[camel];
  return null;
}

/** Ответ `/api/<code>/manifest` — статус **ядра**, а не модуля (модуль отдаёт active: true). */
function buildManifestResponse(rec) {
  const exportsObj = rec.exports || {};
  let info = {};
  try {
    if (typeof exportsObj.moduleInfo === 'function') info = exportsObj.moduleInfo() || {};
  } catch (_) { /* модуль может бросить — отдаём минимум */ }
  const licensed = Boolean(rec.licensed);
  return {
    ...info,
    code: rec.code,
    name: info.name || (rec.manifest && rec.manifest.name) || rec.code,
    version: info.version || (rec.manifest && rec.manifest.version) || null,
    active: Boolean(rec.enabled && licensed),
    enabled: Boolean(rec.enabled),
    licensed,
    edition: rec.edition || null,
    expires_at: rec.expiresAt || null,
    /** Причина неактивности — без секретов (для UI-подсказки «модуль выключен/не лицензирован»). */
    reason: rec.enabled ? (licensed ? null : rec.licenseReason || 'лицензия не активна') : 'модуль выключен',
  };
}

/**
 * Смонтировать объявленные модулем маршруты через ядро.
 *
 * @param {object} app — Express
 * @param {{code:string, manifest:object, exports:object, gate:Function,
 *   describe:()=>object, logger?:Console}} opts
 * @returns {{mounted:number, skipped:Array<{path:string, reason:string}>}}
 */
function mountDeclaredEndpoints(app, opts) {
  const { code, manifest, exports, gate, describe, logger = console } = opts;
  const endpoints = normalizeEndpoints(manifest);
  const skipped = [];
  let mounted = 0;
  if (!app || typeof app.get !== 'function') return { mounted, skipped };

  for (const ep of endpoints) {
    const method = String(ep.method || 'GET').toLowerCase();
    if (!METHOD_ALIASES.includes(method)) {
      skipped.push({ path: ep.path, reason: `метод ${ep.method} не поддерживается` });
      continue;
    }
    if (!ep.path.startsWith(modulePrefix(code))) {
      skipped.push({ path: ep.path, reason: `маршрут вне префикса ${modulePrefix(code)}` });
      continue;
    }
    if (method === 'get' && /\/manifest$/.test(ep.path)) {
      app.get(ep.path, (req, res) => res.json(describe()));
      mounted += 1;
      continue;
    }
    const handler = pickHandler(exports, ep.action);
    if (!handler) {
      skipped.push({ path: ep.path, reason: `handlers.${ep.action} не найден` });
      continue;
    }
    app[method](ep.path, gate, (req, res, next) => {
      try {
        return handler(req, res, next);
      } catch (err) {
        logger.error(`[modules][${code}] handler ${ep.method} ${ep.path}: ${err.message}`);
        return next(err);
      }
    });
    mounted += 1;
  }
  return { mounted, skipped };
}

/**
 * Вызвать штатный `register()` модуля (объектная форма §6.2 + legacy-поля).
 * @param {{exports:object, app:object, ctx:object, coreApi:object}} opts
 * @returns {{ok:boolean, reason?:string}}
 */
function callRegister({ exportsObj, app, ctx, coreApi }) {
  if (!exportsObj || typeof exportsObj.register !== 'function') {
    return { ok: false, reason: 'register() не экспортируется' };
  }
  // ВАЖНО: и контрактная, и legacy-форма в одном вызове — модуль берёт то, что знает.
  exportsObj.register({ app, ctx, db: ctx && ctx.db, auth: ctx && ctx.auth, coreApi });
  return { ok: true };
}

module.exports = {
  modulePrefix,
  normalizeEndpoints,
  pickHandler,
  buildManifestResponse,
  mountDeclaredEndpoints,
  callRegister,
};
