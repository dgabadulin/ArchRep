'use strict';

/**
 * Лицензионный гейт подключаемых модулей — формат ключа **v1**.
 *
 * Контракт формата: `docs/module-license-key.md` (единый источник правды),
 * совместимость с инструментом модуля: `isar-diagram-editor/tools/license/lib/license.js`
 * (`buildPayload` / `signPayload` / `verifyToken`).
 *
 * Контейнер: `<base64url(payload JSON)>.<base64url(Ed25519-подпись base64url(payload))>`
 * — подпись считается по **строке** base64url(payload), а не по исходному JSON.
 *
 * Правила проверки (v1):
 * 1. `v === 1`;
 * 2. `product` совпадает с `manifest.license.product || code`;
 * 3. публичный ключ выбирается по `kid`: `SYS_MODULE_LICENSE_PUBKEYS` (JSON {kid: base64 PEM})
 *    → `'*'` в том же JSON → одиночный `SYS_MODULE_LICENSE_PUBLIC_KEY`;
 * 4. подпись Ed25519 валидна;
 * 5. `nbf ≤ now ≤ exp`; после `exp` действует `grace_days` (licensed=true + warning);
 * 6. привязка `installation.mode`:
 *    - `any` — не проверяется;
 *    - `uuid` — `installation.uuid === SYS_INSTANCE_ID` (без SYS_INSTANCE_ID — отказ);
 *    - `derived` — `installation.ref === installRef()`; `strict:true` → отказ, иначе warning.
 *
 * Ключ хранится только в env (`SYS_MODULE_<code>_LICENSE`), в БД и во фронт не попадает.
 */

const crypto = require('crypto');
const os = require('os');

const VERSION = 1;
const DEFAULT_TTL_MS = 60_000;

const cache = new Map();
let unverifiedWarned = false;

/** Код модуля → имя env-переменной с ключом лицензии. */
function licenseEnvKey(code) {
  return `SYS_MODULE_${String(code || '').replace(/-/g, '_')}_LICENSE`;
}

/**
 * Идентификатор инсталляции для диагностики: явный `SYS_INSTANCE_ID`,
 * иначе `<hostname>:<DB_NAME>` (fallback). Для привязки `mode:"uuid"` требуется явный env.
 */
function defaultInstanceId(env = process.env) {
  const explicit = env.SYS_INSTANCE_ID;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  const host = env.COMPUTERNAME || env.HOSTNAME || 'isar';
  const db = env.DB_NAME || 'archrep';
  return `${host}:${db}`;
}

/** Параметры отпечатка инсталляции (те же, что в инструменте модуля). */
function installRefParams(env = process.env) {
  return {
    host: os.hostname(),
    port: env.PORT || env.API_PORT || 3000,
    db: env.DB_NAME || 'archrep',
  };
}

/**
 * `install_ref` = base64url(sha256("<host>:<port>:<db>".toLowerCase())).slice(0, 22).
 * В ключ попадает хэш, а не имена сервера/БД.
 */
function computeInstallRef({ host, port, db } = {}) {
  const raw = `${host || ''}:${port || ''}:${db || ''}`.toLowerCase();
  return crypto.createHash('sha256').update(raw, 'utf8').digest('base64url').slice(0, 22);
}

/** Итоговый `install_ref`: явный `SYS_INSTALL_REF` или вычисленный по host/port/db. */
function resolveInstallRef(env = process.env) {
  const explicit = env.SYS_INSTALL_REF;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  return computeInstallRef(installRefParams(env));
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromB64url(text) {
  return Buffer.from(String(text || ''), 'base64url');
}

function sha256(text, encoding = 'hex') {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest(encoding);
}
/** PEM из строки, base64 от PEM; иначе null. */
function normalizePem(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes('BEGIN PUBLIC KEY')) return raw;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.includes('BEGIN PUBLIC KEY')) return decoded;
  } catch (_) { /* не base64 — вернём null */ }
  return null;
}



/**
 * Публичные ключи из env. Терпимо к формату:
 * - `SYS_MODULE_LICENSE_PUBKEYS` — JSON `{"<kid>":"<base64 PEM>"}`;
 * - та же переменная как одиночный PEM/base64 → трактуется как `{"*": <ключ>}`;
 * - `SYS_MODULE_LICENSE_PUBLIC_KEY` — одиночный ключ для любого `kid` (fallback).
 * Ошибки разбора не ломают старт ядра: они попадают в `warnings`.
 *
 * @param {object} [env]
 * @returns {{keys: Record<string,string>, single: string|null, warnings: string[]}}
 */
function normalizePublicKeys(env = process.env) {
  const warnings = [];
  const keys = {};

  const rawMap = env.SYS_MODULE_LICENSE_PUBKEYS;
  if (rawMap && String(rawMap).trim()) {
    const raw = String(rawMap).trim();
    let map = null;
    let parsedOk = false;
    try {
      map = JSON.parse(raw);
      parsedOk = true;
    } catch (_) {
      // не JSON: возможно, это одиночный PEM/base64 — попробуем как ключ «*»
      const pem = normalizePem(raw);
      if (pem) keys['*'] = pem;
      else warnings.push('SYS_MODULE_LICENSE_PUBKEYS: не JSON и не PEM/base64 — переменная проигнорирована');
    }
    if (parsedOk) {
      if (map && typeof map === 'object' && !Array.isArray(map)) {
        for (const [kid, value] of Object.entries(map)) {
          const pem = normalizePem(value);
          if (pem) keys[String(kid)] = pem;
          else warnings.push(`SYS_MODULE_LICENSE_PUBKEYS: ключ «${kid}» не PEM/base64 — пропущен`);
        }
      } else {
        warnings.push('SYS_MODULE_LICENSE_PUBKEYS: ожидается JSON-объект {kid: base64 PEM}');
      }
    }
  }

  const single = normalizePem(env.SYS_MODULE_LICENSE_PUBLIC_KEY);
  if (env.SYS_MODULE_LICENSE_PUBLIC_KEY && String(env.SYS_MODULE_LICENSE_PUBLIC_KEY).trim() && !single) {
    warnings.push('SYS_MODULE_LICENSE_PUBLIC_KEY: не PEM/base64 — переменная проигнорирована');
  }

  return { keys, single, warnings };
}

/**
 * Разобрать контейнер ключа.
 * @param {string} token
 * @returns {{body:string, signature:string, payload:object}}
 * @throws {Error} если формат или payload не читаются
 */
function parseToken(token) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('ключ должен быть в формате <payload>.<signature>');
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(parts[0]).toString('utf8'));
  } catch (err) {
    throw new Error(`payload не читается: ${err.message}`);
  }
  if (!payload || typeof payload !== 'object') throw new Error('payload ключа пуст');
  return { body: parts[0], signature: parts[1], payload };
}

function fail(reason, extra = {}) {
  return { licensed: false, reason, warnings: [], ...extra };
}

/**
 * Проверить ключ лицензии по правилам v1.
 *
 * @param {string|null} key — содержимое `SYS_MODULE_<code>_LICENSE`
 * @param {{now?:Date, instanceId?:string, installRef?:string, product?:string,
 *   publicKeys?:object, publicKey?:string, allowUnverified?:boolean, env?:object}} [opts]
 * @returns {{licensed:boolean, reason?:string, warnings:string[], license_id?:string|null,
 *   kid?:string|null, product?:string, edition?:string, expires_at?:string|null, trial?:boolean,
 *   limits?:object, binding?:{mode:string|null, strict:boolean, match:boolean|null},
 *   payload?:object}}
 */
function verifyLicense(key, opts = {}) {
  const env = opts.env || process.env;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const warnings = [];

  if (key == null || String(key).trim() === '') {
    return fail('ключ лицензии не задан (env SYS_MODULE_<code>_LICENSE)');
  }

  let parsed;
  try {
    parsed = parseToken(key);
  } catch (err) {
    return fail(err.message);
  }
  const { body, signature, payload } = parsed;
  const meta = { license_id: payload.license_id || null, kid: payload.kid || null };

  if (Number(payload.v) !== VERSION) {
    return fail(`версия ключа «${payload.v}» не поддерживается (ожидается ${VERSION})`, { ...meta, warnings });
  }
  if (!payload.product) {
    return fail('в ключе нет product', { ...meta, warnings });
  }
  if (opts.product && String(payload.product) !== String(opts.product)) {
    return fail(`ключ выдан для «${payload.product}», требуется «${opts.product}»`, { ...meta, warnings });
  }
  if (!payload.license_id) warnings.push('в ключе нет license_id (учёт в реестре лицензий будет неполным)');
  if (!payload.kid) warnings.push('в ключе нет kid (ротация публичных ключей невозможна)');

  const allowUnverified = opts.allowUnverified != null
    ? Boolean(opts.allowUnverified)
    : String(env.SYS_MODULE_LICENSE_ALLOW_UNVERIFIED || '').toLowerCase() === 'true';

  if (allowUnverified) {
    if (!unverifiedWarned) {
      unverifiedWarned = true;
      console.warn('[modules][license] SYS_MODULE_LICENSE_ALLOW_UNVERIFIED=true: подпись НЕ проверяется ' +
        '(только для dev-стендов; на prod запрещено)');
    }
  } else {
    const keyring = opts.publicKeys && typeof opts.publicKeys === 'object'
      ? opts.publicKeys
      : normalizePublicKeys(env);
    const keys = keyring.keys || {};
    const singlePem = opts.publicKey != null ? normalizePem(opts.publicKey) : keyring.single;
    const pem = keys[payload.kid] || keys['*'] || singlePem || null;
    if (!pem) {
      return fail(
        `публичный ключ для kid «${payload.kid || '*'}» не найден ` +
        '(SYS_MODULE_LICENSE_PUBKEYS / SYS_MODULE_LICENSE_PUBLIC_KEY)',
        { ...meta, warnings },
      );
    }
    let valid = false;
    try {
      valid = crypto.verify(null, Buffer.from(body, 'utf8'), crypto.createPublicKey(pem), fromB64url(signature));
    } catch (err) {
      return fail(`подпись не проверена: ${err.message}`, { ...meta, warnings });
    }
    if (!valid) return fail('подпись ключа недействительна', { ...meta, warnings });
  }
  const nbf = payload.nbf ? new Date(payload.nbf) : null;
  if (nbf && !Number.isNaN(nbf.getTime()) && now.getTime() < nbf.getTime()) {
    return fail(`ключ ещё не действует (nbf ${payload.nbf})`, { ...meta, warnings });
  }
  const exp = payload.exp ? new Date(payload.exp) : null;
  if (!exp || Number.isNaN(exp.getTime())) {
    return fail('в ключе нет корректного срока действия (exp)', { ...meta, warnings });
  }
  const graceDays = Number.isFinite(Number(payload.grace_days)) ? Number(payload.grace_days) : 0;
  const graceUntil = new Date(exp.getTime() + graceDays * 86400000);
  if (now.getTime() > exp.getTime()) {
    if (now.getTime() > graceUntil.getTime()) {
      return fail(`срок действия ключа истёк (${exp.toISOString()})`, {
        ...meta,
        warnings,
        expires_at: exp.toISOString(),
      });
    }
    warnings.push(`срок действия истёк, действует grace до ${graceUntil.toISOString()}`);
  }

  const inst = payload.installation && typeof payload.installation === 'object'
    ? payload.installation
    : { mode: 'any' };
  const mode = String(inst.mode || 'any').toLowerCase();
  const strict = Boolean(inst.strict);
  let match = null;

  if (mode === 'uuid') {
    const expectedUuid = opts.instanceId != null
      ? String(opts.instanceId).trim()
      : String(env.SYS_INSTANCE_ID || '').trim();
    if (!inst.uuid) return fail('в ключе не задан installation.uuid', { ...meta, warnings });
    if (!expectedUuid) {
      return fail('на инсталляции не задан SYS_INSTANCE_ID (нужен для привязки mode:"uuid")', { ...meta, warnings });
    }
    if (String(inst.uuid) !== expectedUuid) {
      return fail(`ключ привязан к другой инсталляции (${inst.uuid})`, { ...meta, warnings });
    }
    match = true;
  } else if (mode === 'derived') {
    const actualRef = opts.installRef != null ? String(opts.installRef).trim() : resolveInstallRef(env);
    if (!inst.ref) return fail('в ключе не задан installation.ref', { ...meta, warnings });
    if (!actualRef) {
      warnings.push('install_ref не вычислен — привязка к факту не проверена');
    } else if (String(inst.ref) !== actualRef) {
      const msg = `install_ref не совпадает (ключ ${inst.ref}, факт ${actualRef})`;
      if (strict) return fail(msg, { ...meta, warnings });
      warnings.push(`${msg} — нестрогий режим`);
      match = false;
    } else {
      match = true;
    }
  } else if (mode !== 'any') {
    warnings.push(`installation.mode «${mode}» не поддерживается — привязка не проверена`);
  }

  return {
    licensed: true,
    warnings,
    license_id: payload.license_id || null,
    kid: payload.kid || null,
    product: String(payload.product),
    edition: String(payload.edition || 'standard'),
    expires_at: exp.toISOString(),
    trial: Boolean(payload.trial),
    limits: payload.limits && typeof payload.limits === 'object' ? payload.limits : {},
    binding: { mode, strict, match },
    payload,
  };
}

/**
 * Статус лицензии модуля по манифесту.
 * Бесплатный модуль (`license.required !== true`) всегда лицензирован.
 *
 * @param {{code:string, manifest?:object, now?:Date, instanceId?:string, installRef?:string,
 *   publicKeys?:object, publicKey?:string, env?:object, allowUnverified?:boolean}} opts
 */
function resolveLicense(opts) {
  const { code, manifest, env = process.env } = opts;
  const license = (manifest && manifest.license) || {};
  const product = license.product || code;
  if (license.required !== true) {
    return {
      licensed: true,
      edition: 'free',
      expires_at: null,
      reason: 'модуль без обязательной лицензии',
      license_id: null,
      kid: null,
      binding: { mode: null, strict: false, match: null },
      limits: {},
      warnings: [],
      product,
    };
  }
  const key = env[licenseEnvKey(code)];
  const result = verifyLicense(key, {
    now: opts.now,
    instanceId: opts.instanceId,
    installRef: opts.installRef,
    publicKeys: opts.publicKeys,
    publicKey: opts.publicKey,
    allowUnverified: opts.allowUnverified,
    env,
    product,
  });
  return { ...result, product };
}

/**
 * Кэшированный статус лицензии: ключ кэша — `code|sha256(ключ)` (ротация ключа
 * с той же длиной подхватывается сразу), TTL — минута.
 * @param {{code:string, manifest?:object, ttlMs?:number, env?:object}} opts
 */
function getLicenseStatus(opts) {
  const { code, manifest, ttlMs = DEFAULT_TTL_MS, env = process.env } = opts;
  const key = env[licenseEnvKey(code)] || '';
  const cacheKey = `${code}|${sha256(key)}`;
  const hit = cache.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.status;
  const status = resolveLicense({ code, manifest, env });
  cache.set(cacheKey, { at: now, status });
  return status;
}

function clearLicenseCache() {
  cache.clear();
  unverifiedWarned = false;
}

module.exports = {
  VERSION,
  DEFAULT_TTL_MS,
  licenseEnvKey,
  defaultInstanceId,
  installRefParams,
  computeInstallRef,
  resolveInstallRef,
  b64url,
  fromB64url,
  sha256,
  normalizePem,
  normalizePublicKeys,
  parseToken,
  verifyLicense,
  resolveLicense,
  getLicenseStatus,
  clearLicenseCache,
};

