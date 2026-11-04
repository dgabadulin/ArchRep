'use strict';

/**
 * Тесты лицензионного гейта ядра — формат ключа v1 (docs/module-license-key.md).
 *
 * Ключи собираются тем же способом, что и в инструменте модуля
 * (isar-diagram-editor/tools/license/lib/license.js): подпись Ed25519 по строке base64url(payload).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  VERSION,
  verifyLicense,
  resolveLicense,
  getLicenseStatus,
  clearLicenseCache,
  licenseEnvKey,
  defaultInstanceId,
  computeInstallRef,
  resolveInstallRef,
  normalizePublicKeys,
} = require('../license');

const NOW = new Date('2026-12-01T00:00:00.000Z');
const KID = 'isar-2026-01';

function keyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

function publicPem(pair) {
  return pair.publicKey.export({ type: 'spki', format: 'pem' });
}

function publicB64(pair) {
  return Buffer.from(publicPem(pair), 'utf8').toString('base64');
}

/** Контейнер `<base64url(payload)>.<base64url(signature)>` — как в tools/license модуля. */
function sign(payload, privateKey) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.sign(null, Buffer.from(body, 'utf8'), privateKey).toString('base64url');
  return `${body}.${signature}`;
}

/** Payload v1 по умолчанию: привязан к inst-1, действует 2026-11-04 … 2027-11-03. */
function payloadV1(over = {}) {
  return {
    v: VERSION,
    license_id: 'LIC-2026-000001',
    kid: KID,
    product: 'drawio-pro',
    customer: { id: 'cust_001', name: 'ООО «Пример»' },
    edition: 'standard',
    features: ['adr-diagram'],
    limits: { users: 50 },
    installation: { mode: 'uuid', uuid: 'inst-1', strict: false },
    iat: '2026-11-04T00:00:00.000Z',
    nbf: '2026-11-04T00:00:00.000Z',
    exp: '2027-11-03T00:00:00.000Z',
    grace_days: 14,
    trial: false,
    ...over,
  };
}

/** env как в prod: SYS_INSTANCE_ID + набор публичных ключей по kid. */
function envWith(pubkeys = {}, extra = {}) {
  return {
    SYS_INSTANCE_ID: 'inst-1',
    SYS_MODULE_LICENSE_PUBKEYS: JSON.stringify(pubkeys),
    ...extra,
  };
}

function verifyDefault(key, opts = {}) {
  const { pubB64, ...rest } = opts;
  return verifyLicense(key, { now: NOW, product: 'drawio-pro', env: envWith({ [KID]: pubB64 }), ...rest });
}
test('v1: валидный ключ, привязка uuid совпала', () => {
  const pair = keyPair();
  const key = sign(payloadV1(), pair.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(pair) });

  assert.equal(res.licensed, true);
  assert.equal(res.license_id, 'LIC-2026-000001');
  assert.equal(res.kid, KID);
  assert.equal(res.product, 'drawio-pro');
  assert.equal(res.edition, 'standard');
  assert.equal(res.expires_at, '2027-11-03T00:00:00.000Z');
  assert.equal(res.trial, false);
  assert.deepEqual(res.limits, { users: 50 });
  assert.deepEqual(res.binding, { mode: 'uuid', strict: false, match: true });
  assert.deepEqual(res.warnings, []);
});

test('v1: публичный ключ в JSON может быть PEM, base64 или «*»', () => {
  const pair = keyPair();
  const key = sign(payloadV1(), pair.privateKey);

  const asPem = verifyLicense(key, {
    now: NOW,
    product: 'drawio-pro',
    env: envWith({ [KID]: publicPem(pair) }),
  });
  assert.equal(asPem.licensed, true);

  const asStar = verifyLicense(key, {
    now: NOW,
    product: 'drawio-pro',
    env: envWith({ '*': publicB64(pair) }),
  });
  assert.equal(asStar.licensed, true, 'ключ «*» подходит любому kid');

  const wholeVarIsPem = verifyLicense(key, {
    now: NOW,
    product: 'drawio-pro',
    env: { SYS_INSTANCE_ID: 'inst-1', SYS_MODULE_LICENSE_PUBKEYS: publicPem(pair) },
  });
  assert.equal(wholeVarIsPem.licensed, true, 'PUBKEYS как одиночный PEM трактуется как «*»');
});

test('v1: одиночный SYS_MODULE_LICENSE_PUBLIC_KEY — fallback для любого kid', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ kid: 'isar-2027-01' }), pair.privateKey);
  const res = verifyLicense(key, {
    now: NOW,
    product: 'drawio-pro',
    env: { SYS_INSTANCE_ID: 'inst-1', SYS_MODULE_LICENSE_PUBLIC_KEY: publicB64(pair) },
  });
  assert.equal(res.licensed, true);
  assert.equal(res.kid, 'isar-2027-01');
});

test('v1: неизвестный kid → отказ с понятной причиной', () => {
  const pair = keyPair();
  const foreign = keyPair();
  const key = sign(payloadV1({ kid: 'isar-2099-01' }), pair.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(foreign) });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /публичный ключ для kid «isar-2099-01» не найден/);
});

test('v1: неверная подпись (чужой приватный ключ)', () => {
  const mine = keyPair();
  const foreign = keyPair();
  const key = sign(payloadV1(), foreign.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(mine) });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /подпись/);
});

test('v1: неверный product', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ product: 'other-module' }), pair.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(pair) });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /ключ выдан для «other-module»/);
});

test('v1: неподдерживаемая версия ключа и старый формат', () => {
  const pair = keyPair();
  const v2 = sign(payloadV1({ v: 2 }), pair.privateKey);
  const resV2 = verifyDefault(v2, { pubB64: publicB64(pair) });
  assert.equal(resV2.licensed, false);
  assert.match(resV2.reason, /версия ключа/);

  // «старый» payload без v (прежний формат ядра)
  const legacy = sign({ product: 'drawio-pro', instance_id: '*', exp: '2027-11-03Z' }, pair.privateKey);
  const resLegacy = verifyDefault(legacy, { pubB64: publicB64(pair) });
  assert.equal(resLegacy.licensed, false);
  assert.match(resLegacy.reason, /версия ключа/);
});

test('v1: чужой instance_id и отсутствие SYS_INSTANCE_ID', () => {
  const pair = keyPair();
  const key = sign(payloadV1(), pair.privateKey);

  const other = verifyDefault(key, {
    pubB64: publicB64(pair),
    env: { SYS_INSTANCE_ID: 'inst-2', SYS_MODULE_LICENSE_PUBKEYS: JSON.stringify({ [KID]: publicB64(pair) }) },
  });
  assert.equal(other.licensed, false);
  assert.match(other.reason, /привязан к другой инсталляции \(inst-1\)/);

  const missing = verifyDefault(key, {
    pubB64: publicB64(pair),
    env: { SYS_MODULE_LICENSE_PUBKEYS: JSON.stringify({ [KID]: publicB64(pair) }) },
  });
  assert.equal(missing.licensed, false);
  assert.match(missing.reason, /не задан SYS_INSTANCE_ID/);
});

test('v1: nbf в будущем → отказ', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ nbf: '2099-01-01T00:00:00.000Z', exp: '2099-12-31T00:00:00.000Z' }), pair.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(pair) });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /ещё не действует/);
});

test('v1: grace-период после exp — лицензия действует с предупреждением', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ exp: '2026-11-20T00:00:00.000Z', grace_days: 14 }), pair.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(pair) });
  assert.equal(res.licensed, true);
  assert.match(res.warnings.join(' '), /действует grace до 2026-12-04/);
  assert.equal(res.expires_at, '2026-11-20T00:00:00.000Z');
});

test('v1: exp истёк и grace закончился → отказ', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ exp: '2026-10-01T00:00:00.000Z', grace_days: 14 }), pair.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(pair) });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /срок действия ключа истёк/);
  assert.equal(res.expires_at, '2026-10-01T00:00:00.000Z');
});

test('v1: в ключе нет exp → отказ', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ exp: undefined }), pair.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(pair) });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /нет корректного срока действия \(exp\)/);
});

test('v1: mode:"derived" — совпадение install_ref', () => {
  const pair = keyPair();
  const ref = 'k3JdQ2abcDEF1234567890';
  const key = sign(payloadV1({ installation: { mode: 'derived', ref, strict: true } }), pair.privateKey);
  const res = verifyDefault(key, { pubB64: publicB64(pair), installRef: ref });
  assert.equal(res.licensed, true);
  assert.deepEqual(res.binding, { mode: 'derived', strict: true, match: true });
});

test('v1: mode:"derived" — несовпадение: strict:true отказ, strict:false warning', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ installation: { mode: 'derived', ref: 'ref-in-key', strict: true } }), pair.privateKey);
  const strict = verifyDefault(key, { pubB64: publicB64(pair), installRef: 'ref-fact' });
  assert.equal(strict.licensed, false);
  assert.match(strict.reason, /install_ref не совпадает/);

  const softKey = sign(payloadV1({ installation: { mode: 'derived', ref: 'ref-in-key', strict: false } }), pair.privateKey);
  const soft = verifyDefault(softKey, { pubB64: publicB64(pair), installRef: 'ref-fact' });
  assert.equal(soft.licensed, true);
  assert.deepEqual(soft.binding, { mode: 'derived', strict: false, match: false });
  assert.match(soft.warnings.join(' '), /нестрогий режим/);
});

test('v1: mode:"any" — привязка не проверяется', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ installation: { mode: 'any' } }), pair.privateKey);
  const res = verifyDefault(key, {
    pubB64: publicB64(pair),
    env: { SYS_MODULE_LICENSE_PUBKEYS: JSON.stringify({ [KID]: publicB64(pair) }) },
  });
  assert.equal(res.licensed, true);
  assert.deepEqual(res.binding, { mode: 'any', strict: false, match: null });
});

test('install_ref: та же формула, что в инструменте модуля', () => {
  const expected = crypto
    .createHash('sha256')
    .update('isar-prod-01:3000:archrep', 'utf8')
    .digest('base64url')
    .slice(0, 22);
  assert.equal(computeInstallRef({ host: 'ISAR-PROD-01', port: 3000, db: 'archrep' }), expected);
  assert.equal(resolveInstallRef({ SYS_INSTALL_REF: 'explicit-ref' }), 'explicit-ref');
  assert.equal(resolveInstallRef({ SYS_INSTALL_REF: '' }).length, 22);
});

test('resolveLicense: бесплатный модуль лицензирован без ключа', () => {
  const res = resolveLicense({ code: 'free-mod', manifest: { license: { required: false } }, env: {} });
  assert.equal(res.licensed, true);
  assert.equal(res.edition, 'free');
  assert.equal(res.expires_at, null);
  assert.equal(res.license_id, null);
  assert.deepEqual(res.binding, { mode: null, strict: false, match: null });
});

test('resolveLicense: ключ берётся только из env SYS_MODULE_<code>_LICENSE', () => {
  assert.equal(licenseEnvKey('drawio-pro'), 'SYS_MODULE_drawio_pro_LICENSE');
  const pair = keyPair();
  const key = sign(payloadV1(), pair.privateKey);
  const env = envWith({ [KID]: publicB64(pair) }, { SYS_MODULE_drawio_pro_LICENSE: key });
  const res = resolveLicense({
    code: 'drawio-pro',
    manifest: { license: { required: true, product: 'drawio-pro' } },
    env,
    now: NOW,
  });
  assert.equal(res.licensed, true);
  assert.equal(res.license_id, 'LIC-2026-000001');
  assert.equal(res.product, 'drawio-pro');
});

test('resolveLicense: product по умолчанию = код модуля', () => {
  const pair = keyPair();
  const key = sign(payloadV1({ product: 'self-mod' }), pair.privateKey);
  const env = envWith({ [KID]: publicB64(pair) }, { SYS_MODULE_self_mod_LICENSE: key });
  const res = resolveLicense({ code: 'self-mod', manifest: { license: { required: true } }, env, now: NOW });
  assert.equal(res.licensed, true);
});

test('resolveLicense: без ключа в env модуль не лицензирован', () => {
  const res = resolveLicense({
    code: 'drawio-pro',
    manifest: { license: { required: true } },
    env: {},
  });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /ключ лицензии не задан/);
});

test('verifyLicense: dev-режим allowUnverified пропускает подпись', () => {
  const pair = keyPair();
  const body = sign(payloadV1(), pair.privateKey).split('.')[0];
  const res = verifyLicense(`${body}.not-a-signature`, {
    now: NOW,
    product: 'drawio-pro',
    allowUnverified: true,
    env: { SYS_INSTANCE_ID: 'inst-1' },
  });
  assert.equal(res.licensed, true);
});

test('verifyLicense: без публичного ключа — fail-closed', () => {
  const pair = keyPair();
  const key = sign(payloadV1(), pair.privateKey);
  const res = verifyLicense(key, {
    now: NOW,
    product: 'drawio-pro',
    allowUnverified: false,
    env: { SYS_INSTANCE_ID: 'inst-1' },
  });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /публичный ключ для kid/);
});

test('normalizePublicKeys: терпимость к форматам и warning вместо падения', () => {
  const pair = keyPair();
  const ok = normalizePublicKeys({ SYS_MODULE_LICENSE_PUBKEYS: JSON.stringify({ kid1: publicB64(pair) }) });
  assert.deepEqual(Object.keys(ok.keys), ['kid1']);
  assert.deepEqual(ok.warnings, []);

  const broken = normalizePublicKeys({ SYS_MODULE_LICENSE_PUBKEYS: '{не json}', SYS_MODULE_LICENSE_PUBLIC_KEY: 'abc' });
  assert.deepEqual(broken.keys, {});
  assert.equal(broken.single, null);
  assert.equal(broken.warnings.length, 2);
});

test('getLicenseStatus: ротация ключа той же длины подхватывается сразу (кэш по sha256)', () => {
  clearLicenseCache();
  const pair = keyPair();
  const valid = sign(payloadV1({ exp: '2027-11-03T00:00:00.000Z' }), pair.privateKey);
  const expired = sign(payloadV1({ exp: '2000-01-01T00:00:00.000Z' }), pair.privateKey);
  assert.equal(valid.length, expired.length, 'ключи одинаковой длины — прежний кэш по длине не различил бы их');

  const manifest = { license: { required: true, product: 'drawio-pro' } };
  const env = envWith({ [KID]: publicB64(pair) }, { SYS_MODULE_drawio_pro_LICENSE: valid });

  assert.equal(getLicenseStatus({ code: 'drawio-pro', manifest, env, ttlMs: 60_000 }).licensed, true);
  env.SYS_MODULE_drawio_pro_LICENSE = expired;
  const second = getLicenseStatus({ code: 'drawio-pro', manifest, env, ttlMs: 60_000 });
  assert.equal(second.licensed, false);
  assert.match(second.reason, /истёк/);
  clearLicenseCache();
});

test('getLicenseStatus: кэш живёт ttl и сбрасывается clearLicenseCache', () => {
  clearLicenseCache();
  const pair = keyPair();
  const key = sign(payloadV1(), pair.privateKey);
  const manifest = { license: { required: true, product: 'drawio-pro' } };
  const env = envWith({ [KID]: publicB64(pair) }, { SYS_MODULE_drawio_pro_LICENSE: key });

  const first = getLicenseStatus({ code: 'drawio-pro', manifest, env, ttlMs: 60_000 });
  assert.equal(first.licensed, true);
  env.SYS_INSTANCE_ID = 'inst-2'; // без сброса кэша статус берётся из кэша
  assert.equal(getLicenseStatus({ code: 'drawio-pro', manifest, env, ttlMs: 60_000 }).licensed, true);
  clearLicenseCache();
  assert.equal(getLicenseStatus({ code: 'drawio-pro', manifest, env, ttlMs: 60_000 }).licensed, false);
});

test('defaultInstanceId: fallback <host>:<DB_NAME>, но SYS_INSTANCE_ID приоритетнее', () => {
  assert.equal(defaultInstanceId({ SYS_INSTANCE_ID: 'inst-explicit', DB_NAME: 'archrep' }), 'inst-explicit');
  const fallback = defaultInstanceId({ DB_NAME: 'archrep2', COMPUTERNAME: 'srv-01' });
  assert.equal(fallback, 'srv-01:archrep2');
});

