'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { verifyLicense, resolveLicense, licenseEnvKey, defaultInstanceId } = require('../license');

/** Сгенерировать Ed25519-ключи и подписать payload (как это будет делать инструмент вендора). */
function makeSignedKey(payload, privateKey) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.sign(null, Buffer.from(body, 'utf8'), privateKey).toString('base64url');
  return `${body}.${signature}`;
}

function keyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

test('verifyLicense: валидный ключ Ed25519', () => {
  const { publicKey, privateKey } = keyPair();
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  const key = makeSignedKey(
    { product: 'drawio-pro', instance_id: 'inst-1', exp: '2099-01-01T00:00:00Z', edition: 'enterprise' },
    privateKey,
  );
  const res = verifyLicense(key, { instanceId: 'inst-1', publicKey: pem, product: 'drawio-pro' });
  assert.equal(res.licensed, true);
  assert.equal(res.edition, 'enterprise');
  assert.equal(res.expires_at, '2099-01-01T00:00:00.000Z');
});

test('verifyLicense: просроченный ключ', () => {
  const { publicKey, privateKey } = keyPair();
  const key = makeSignedKey(
    { product: 'drawio-pro', instance_id: 'inst-1', exp: '2020-01-01T00:00:00Z' },
    privateKey,
  );
  const res = verifyLicense(key, { instanceId: 'inst-1', publicKey: publicKey.export({ type: 'spki', format: 'pem' }) });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /истёк/);
});

test('verifyLicense: чужой instance_id', () => {
  const { publicKey, privateKey } = keyPair();
  const key = makeSignedKey({ product: 'drawio-pro', instance_id: 'other-host' }, privateKey);
  const res = verifyLicense(key, {
    instanceId: 'inst-1',
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
  });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /другой инсталляции/);
});

test('verifyLicense: подпись недействительна (чужой приватный ключ)', () => {
  const a = keyPair();
  const b = keyPair();
  const key = makeSignedKey({ instance_id: 'inst-1' }, b.privateKey);
  const res = verifyLicense(key, {
    instanceId: 'inst-1',
    publicKey: a.publicKey.export({ type: 'spki', format: 'pem' }),
  });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /подпись/);
});

test('verifyLicense: без ключа и без публичного ключа — fail-closed', () => {
  assert.equal(verifyLicense(null, { publicKey: null, allowUnverified: false }).licensed, false);
  const body = Buffer.from(JSON.stringify({ instance_id: 'inst-1' }), 'utf8').toString('base64url');
  const res = verifyLicense(`${body}.sig`, { publicKey: null, allowUnverified: false });
  assert.equal(res.licensed, false);
  assert.match(res.reason, /публичный ключ не настроен/);
});

test('verifyLicense: dev-режим allowUnverified пропускает подпись', () => {
  const body = Buffer.from(JSON.stringify({ instance_id: 'inst-1' }), 'utf8').toString('base64url');
  const res = verifyLicense(`${body}.x`, { instanceId: 'inst-1', allowUnverified: true, publicKey: null });
  assert.equal(res.licensed, true);
});

test('resolveLicense: бесплатный модуль лицензирован без ключа', () => {
  const res = resolveLicense({ code: 'free-mod', manifest: { license: { required: false } }, env: {} });
  assert.equal(res.licensed, true);
  assert.equal(res.edition, 'free');
});

test('resolveLicense: ключ берётся только из env SYS_MODULE_<code>_LICENSE', () => {
  assert.equal(licenseEnvKey('drawio-pro'), 'SYS_MODULE_drawio_pro_LICENSE');
  const { publicKey, privateKey } = keyPair();
  const key = makeSignedKey({ instance_id: defaultInstanceId() }, privateKey);
  const env = { SYS_MODULE_drawio_pro_LICENSE: key };
  const res = resolveLicense({
    code: 'drawio-pro',
    manifest: { license: { required: true, product: 'drawio-pro' } },
    env,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
  });
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
