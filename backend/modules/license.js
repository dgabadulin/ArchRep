'use strict';

/**
 * Лицензионный гейт подключаемых модулей (docs/modules-contract.md §10, §16.3).
 *
 * Правила:
 * - ключ хранится **только в env** `SYS_MODULE_<code>_LICENSE` (дефисы → подчёркивания);
 * - в БД (`isar_modules`) и во фронт попадает только статус: licensed / edition / expires_at;
 * - проверка **офлайн**: подпись Ed25519, публичный ключ — в env ядра
 *   `SYS_MODULE_LICENSE_PUBLIC_KEY` (PEM; допускается base64 от PEM);
 * - формат ключа — отдельная спека (§16.3). До неё используется контейнер
 *   `<base64url(payload)>.<base64url(signature)>`, где payload — JSON:
 *   `{ product, instance_id, exp, edition, trial, limit }`.
 *
 * Без настроенного публичного ключа ключ не принимается (fail-closed), кроме
 * dev-режима `SYS_MODULE_LICENSE_ALLOW_UNVERIFIED=true` — он нужен, чтобы поднять
 * модуль до выпуска спек-инструмента подписи. В лог пишется предупреждение без секретов.
 */

const crypto = require('crypto');

const DEFAULT_TTL_MS = 60_000;
const cache = new Map();

/** Код модуля → имя env-переменной с ключом лицензии. */
function licenseEnvKey(code) {
  return `SYS_MODULE_${String(code || '').replace(/-/g, '_')}_LICENSE`;
}

/** Идентификатор инсталляции: env `SYS_INSTANCE_ID`, иначе hostname + имя БД. */
function defaultInstanceId() {
  const explicit = process.env.SYS_INSTANCE_ID;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  const host = process.env.COMPUTERNAME || process.env.HOSTNAME || 'isar';
  const db = process.env.DB_NAME || 'archrep';
  return `${host}:${db}`;
}

function decodeBase64Url(text) {
  const s = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64');
}

function normalizePublicKey(pem) {
  if (!pem) return null;
  const raw = String(pem).trim();
  if (raw.includes('BEGIN PUBLIC KEY')) return raw;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.includes('BEGIN PUBLIC KEY')) return decoded;
  } catch (_) { /* не base64 — ниже вернём null */ }
  return null;
}

/** `exp` из ключа: ISO-строка или epoch (сек/мс) → ISO | null. */
function normalizeExpiry(exp) {
  if (exp == null || exp === '') return null;
  if (typeof exp === 'string' && !/^\d+$/.test(exp)) {
    const d = new Date(exp);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const n = Number(exp);
  if (!Number.isFinite(n)) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Проверить ключ лицензии.
 *
 * @param {string|null} key — содержимое `SYS_MODULE_<code>_LICENSE`
 * @param {{instanceId?:string, now?:Date, publicKey?:string, product?:string, allowUnverified?:boolean}} [opts]
 * @returns {{licensed:boolean, reason?:string, edition?:string, expires_at?:string|null,
 *   trial?:boolean, limit?:number|null, product?:string|null, payload?:object|null}}
 */
function verifyLicense(key, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const instanceId = opts.instanceId || defaultInstanceId();
  const publicKeyPem = normalizePublicKey(
    opts.publicKey != null ? opts.publicKey : process.env.SYS_MODULE_LICENSE_PUBLIC_KEY,
  );
  const allowUnverified = opts.allowUnverified != null
    ? Boolean(opts.allowUnverified)
    : String(process.env.SYS_MODULE_LICENSE_ALLOW_UNVERIFIED || '').toLowerCase() === 'true';

  if (key == null || String(key).trim() === '') {
    return { licensed: false, reason: 'ключ лицензии не задан (env SYS_MODULE_<code>_LICENSE)' };
  }

  const parts = String(key).trim().split('.');
  if (parts.length !== 2) {
    return { licensed: false, reason: 'формат ключа неверен: ожидается <payload>.<signature> (base64url)' };
  }

  let payload;
  try {
    payload = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
  } catch (_) {
    return { licensed: false, reason: 'payload ключа не читается (не JSON/base64url)' };
  }
  if (!payload || typeof payload !== 'object') {
    return { licensed: false, reason: 'payload ключа пуст' };
  }

  if (!publicKeyPem) {
    if (!allowUnverified) {
      return {
        licensed: false,
        reason: 'публичный ключ не настроен (SYS_MODULE_LICENSE_PUBLIC_KEY) — ключ не может быть проверен',
      };
    }
    console.warn('[modules][license] SYS_MODULE_LICENSE_PUBLIC_KEY не задан: подпись НЕ проверяется ' +
      '(dev-режим SYS_MODULE_LICENSE_ALLOW_UNVERIFIED=true)');
  } else {
    let valid = false;
    try {
      valid = crypto.verify(
        null,
        Buffer.from(parts[0], 'utf8'),
        crypto.createPublicKey(publicKeyPem),
        decodeBase64Url(parts[1]),
      );
    } catch (err) {
      return { licensed: false, reason: `подпись не проверена: ${err.message}` };
    }
    if (!valid) return { licensed: false, reason: 'подпись ключа недействительна' };
  }

  if (payload.product && opts.product && String(payload.product) !== String(opts.product)) {
    return { licensed: false, reason: `ключ выдан для продукта «${payload.product}», требуется «${opts.product}»` };
  }

  const boundTo = payload.instance_id;
  if (boundTo && String(boundTo) !== '*' && String(boundTo) !== String(instanceId)) {
    return { licensed: false, reason: `ключ привязан к другой инсталляции (${boundTo})` };
  }

  const expiresAt = normalizeExpiry(payload.exp);
  if (payload.exp != null && !expiresAt) {
    return { licensed: false, reason: 'срок действия ключа (exp) не читается' };
  }
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) {
    return { licensed: false, reason: `срок действия ключа истёк (${expiresAt})`, expires_at: expiresAt };
  }

  return {
    licensed: true,
    edition: String(payload.edition || 'standard'),
    expires_at: expiresAt,
    trial: Boolean(payload.trial),
    limit: payload.limit != null ? Number(payload.limit) : null,
    product: payload.product ? String(payload.product) : null,
    payload,
  };
}

/**
 * Статус лицензии модуля по манифесту.
 * Бесплатный модуль (`license.required !== true`) всегда лицензирован.
 *
 * @param {{code:string, manifest?:object, now?:Date, instanceId?:string, publicKey?:string, env?:object}} opts
 */
function resolveLicense(opts) {
  const { code, manifest, env = process.env } = opts;
  const license = (manifest && manifest.license) || {};
  const product = license.product || code;
  if (license.required !== true) {
    return { licensed: true, edition: 'free', expires_at: null, reason: 'модуль без обязательной лицензии' };
  }
  const key = env[licenseEnvKey(code)];
  const result = verifyLicense(key, {
    now: opts.now,
    instanceId: opts.instanceId,
    publicKey: opts.publicKey,
    product,
    allowUnverified: opts.allowUnverified,
  });
  return { ...result, product };
}

/**
 * Кэшированный статус лицензии (проверка Ed25519 дешёвая, но env читается на каждый
 * `/api/config` — кэш на минуту; `clearLicenseCache()` сбрасывает после смены env/тестов).
 * @param {{code:string, manifest?:object, ttlMs?:number}} opts
 */
function getLicenseStatus(opts) {
  const { code, manifest, ttlMs = DEFAULT_TTL_MS } = opts;
  const key = `${code}|${(process.env[licenseEnvKey(code)] || '').length}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.status;
  const status = resolveLicense({ code, manifest });
  cache.set(key, { at: now, status });
  return status;
}

function clearLicenseCache() {
  cache.clear();
}

module.exports = {
  DEFAULT_TTL_MS,
  licenseEnvKey,
  defaultInstanceId,
  normalizeExpiry,
  verifyLicense,
  resolveLicense,
  getLicenseStatus,
  clearLicenseCache,
};
