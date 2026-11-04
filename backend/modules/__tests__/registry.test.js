'use strict';

/**
 * Тесты реестра `archrep.isar_modules` (docs/modules-contract.md §5):
 * метаданные лицензии пишутся, ключ лицензии — нет; до применения миграции
 * метаданных реестр остаётся работоспособным (fail-open).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TABLE,
  UPSERT_SQL,
  SELECT_SQL,
  isMissingColumnError,
  isMissingTableError,
  loadModuleRecords,
  syncModuleRecord,
} = require('../registry');

const silent = { warn() {}, log() {}, error() {} };

function columnError() {
  const err = new Error('column "license_id" does not exist');
  err.code = '42703';
  return err;
}

test('UPSERT: пишет метаданные лицензии, но не сам ключ', () => {
  for (const column of ['license_id', 'license_kid', 'license_binding', 'license_checked_at']) {
    assert.match(UPSERT_SQL, new RegExp(column), `в UPSERT нет ${column}`);
  }
  assert.match(SELECT_SQL, /license_id/);
  assert.match(SELECT_SQL, /license_binding/);
  assert.doesNotMatch(UPSERT_SQL, /license_key|settings_json\s*=\s*EXCLUDED/);
});

test('syncModuleRecord: передаёт license_id/kid/binding и не передаёт ключ', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ code: 'drawio-pro' }] };
    },
  };

  const row = await syncModuleRecord(pool, {
    code: 'drawio-pro',
    name: 'DrawIO Pro',
    version: '0.1.0',
    coreVersion: '3.1.0',
    enabled: true,
    licensed: true,
    expiresAt: '2027-11-03T00:00:00.000Z',
    licenseId: 'LIC-2026-000001',
    licenseKid: 'isar-2026-01',
    licenseBinding: 'uuid:match',
    // даже если кто-то положит ключ в запись — в SQL-параметры он не попадает
    licenseKey: 'payload.signature',
  }, { logger: silent });

  assert.deepEqual(row, { code: 'drawio-pro' });
  assert.equal(calls.length, 1);
  const { sql, params } = calls[0];
  assert.match(sql, new RegExp(TABLE.replace('.', '\\.')));
  assert.deepEqual(params, [
    'drawio-pro',
    'DrawIO Pro',
    '0.1.0',
    '3.1.0',
    true,
    true,
    '2027-11-03T00:00:00.000Z',
    'LIC-2026-000001',
    'isar-2026-01',
    'uuid:match',
  ]);
  assert.ok(!params.some((p) => String(p).includes('payload.signature')));
});

test('syncModuleRecord: колонок лицензии нет → запись в legacy-форме + warning', async () => {
  const calls = [];
  const warnings = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) throw columnError();
      return { rows: [{ code: 'drawio-pro' }] };
    },
  };

  const row = await syncModuleRecord(pool, {
    code: 'drawio-pro',
    enabled: true,
    licensed: true,
    licenseId: 'LIC-2026-000001',
  }, { logger: { warn: (m) => warnings.push(m), log() {}, error() {} } });

  assert.deepEqual(row, { code: 'drawio-pro' });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].params.length, 7, 'legacy-форма без метаданных лицензии');
  assert.match(warnings[0], /migrate_20261105120000_isar_modules_license_meta\.sql/);
});

test('syncModuleRecord: таблицы нет → null и предупреждение (ядро живо)', async () => {
  const warnings = [];
  const pool = {
    async query() {
      const err = new Error('relation "archrep.isar_modules" does not exist');
      err.code = '42P01';
      throw err;
    },
  };
  const row = await syncModuleRecord(pool, { code: 'drawio-pro' }, {
    logger: { warn: (m) => warnings.push(m), log() {}, error() {} },
  });
  assert.equal(row, null);
  assert.match(warnings[0], /migrate_20261103120000_isar_modules\.sql/);
});

test('loadModuleRecords: карта code → строка; при отсутствии колонок — legacy-выборка', async () => {
  const rows = [{ code: 'a', licensed: true }, { code: 'b', licensed: false }];
  const ok = await loadModuleRecords({
    async query() {
      return { rows };
    },
  }, { logger: silent });
  assert.deepEqual([...ok.keys()], ['a', 'b']);

  let call = 0;
  const legacy = await loadModuleRecords({
    async query() {
      call += 1;
      if (call === 1) throw columnError();
      return { rows };
    },
  }, { logger: silent });
  assert.equal(call, 2);
  assert.equal(legacy.size, 2);

  const warnings = [];
  const missing = await loadModuleRecords({
    async query() {
      const err = new Error('relation does not exist');
      err.code = '42P01';
      throw err;
    },
  }, { logger: { warn: (m) => warnings.push(m), log() {}, error() {} } });
  assert.equal(missing.size, 0);
  assert.equal(warnings.length, 1);
});

test('предикаты ошибок различают отсутствие таблицы и колонки', async () => {
  assert.equal(isMissingTableError({ code: '42P01' }), true);
  assert.equal(isMissingColumnError({ code: '42703' }), true);
  assert.equal(isMissingColumnError({ code: '42P01' }), false);
  assert.equal(isMissingTableError(null), false);
});
