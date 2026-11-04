'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeVersion,
  pendingFrom,
  readSchemaState,
  getVersionInfo,
  readMigrationPrefixes,
} = require('../version');

test('normalizeVersion: чистый релиз', () => {
  assert.deepEqual(normalizeVersion('3.0.1'), { version: '3.0.1', channel: 'stable', dirty: false });
  assert.deepEqual(normalizeVersion('v3.0.1'), { version: '3.0.1', channel: 'stable', dirty: false });
});

test('normalizeVersion: git describe (коммиты после тега) → канал dev', () => {
  const r = normalizeVersion('v1.4.0-3-gabc1234');
  assert.equal(r.version, '1.4.0+3.gabc1234');
  assert.equal(r.channel, 'dev');
  assert.equal(r.dirty, false);
});

test('normalizeVersion: грязное дерево → +dirty.<commit>, канал dev', () => {
  const r = normalizeVersion('1.4.0-dirty', { commit: 'abc1234' });
  assert.equal(r.version, '1.4.0+dirty.abc1234');
  assert.equal(r.channel, 'dev');
  assert.equal(r.dirty, true);
});

test('normalizeVersion: пустое значение → 0.0.0', () => {
  assert.equal(normalizeVersion('').version, '0.0.0');
});

test('pendingFrom: миграции новее версии схемы', () => {
  const migrations = [
    { name: '20260101000000_a', prefix: '20260101000000' },
    { name: '20260201000000_b', prefix: '20260201000000' },
  ];
  assert.deepEqual(pendingFrom('20260101000000', migrations), ['20260201000000_b']);
  assert.deepEqual(pendingFrom('20260201000000', migrations), []);
  assert.equal(pendingFrom(null, migrations), null);
});

test('readSchemaState: маркер ar_schema_info имеет приоритет', async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      if (/ar_schema_info/.test(sql)) {
        return { rows: [{ version: '20261104120000', applied_at: '2026-11-04T10:00:00Z' }] };
      }
      throw new Error('unexpected query');
    },
  };
  const state = await readSchemaState(pool);
  assert.equal(state.source, 'schema_info');
  assert.equal(state.schema_version, '20261104120000');
  assert.deepEqual(state.pending, []);
  assert.equal(calls.length, 1);
});

test('readSchemaState: fallback на pgmigrations, если маркера нет', async () => {
  const pool = {
    async query(sql) {
      if (/ar_schema_info/.test(sql)) {
        const err = new Error('relation does not exist');
        err.code = '42P01';
        throw err;
      }
      return { rows: [{ name: '20261103120000_isar_modules', run_on: '2026-11-03T10:00:00Z' }] };
    },
  };
  const state = await readSchemaState(pool);
  assert.equal(state.source, 'pgmigrations');
  assert.equal(state.schema_version, '20261103120000');
  assert.ok(Array.isArray(state.pending));
});

test('readSchemaState: ни маркера, ни pgmigrations → unknown без pending', async () => {
  const pool = {
    async query() {
      const err = new Error('relation does not exist');
      err.code = '42P01';
      throw err;
    },
  };
  const state = await readSchemaState(pool);
  assert.deepEqual(state, { source: 'unknown', schema_version: null, applied_at: null, pending: null });
});

test('readSchemaState: без пула → unknown', async () => {
  const state = await readSchemaState(null);
  assert.equal(state.source, 'unknown');
  assert.equal(state.pending, null);
});

test('readMigrationPrefixes: реальные миграции репозитория', () => {
  const list = readMigrationPrefixes();
  assert.ok(list.length > 0);
  assert.ok(list.every((m) => /^\d{14}$/.test(m.prefix)));
});

test('getVersionInfo: форма ответа /api/version', async () => {
  const info = await getVersionInfo({
    env: { APP_VERSION: 'v3.0.1', APP_COMMIT: 'abc1234', APP_BUILD_TIME: '2026-11-02T20:00:00Z' },
    modules: { 'drawio-pro': { version: '0.1.0', enabled: true, licensed: true } },
    warnMode: 'off',
  });
  assert.equal(info.product, 'ИСАР');
  assert.equal(info.version, '3.0.1');
  assert.equal(info.channel, 'stable');
  assert.equal(info.commit, 'abc1234');
  assert.equal(info.build_time, '2026-11-02T20:00:00Z');
  assert.ok(info.contract_version);
  assert.equal(info.db.source, 'unknown');
  assert.equal(info.db.warn_mode, 'off');
  assert.equal(info.modules['drawio-pro'].licensed, true);
});
