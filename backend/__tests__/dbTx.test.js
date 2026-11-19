'use strict';

/**
 * Тесты безопасной транзакции (`backend/dbTx.js`).
 *
 * Регрессия прода: `PUT /full` вызывал `client.release()` дважды, `pg-pool`
 * бросал `Release called on client which has already been released to the pool`,
 * Node завершал процесс, nginx отдавал 502. Helper обязан:
 *  - освобождать клиент ровно один раз на успехе и на ошибке;
 *  - не падать, если `release()` сам бросает;
 *  - возвращать 503 при недоступности пула;
 *  - сохранять стадию ошибки для диагностики.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { withTransaction, HttpError } = require('../dbTx.js');

function fakePool({ connectError = null, releaseError = null } = {}) {
  const calls = { connects: 0, queries: [], releases: 0 };
  const client = {
    async query(sql) {
      calls.queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
    release() {
      calls.releases += 1;
      if (releaseError) throw releaseError;
    },
  };
  const pool = {
    async connect() {
      calls.connects += 1;
      if (connectError) throw connectError;
      return client;
    },
  };
  return { pool, calls };
}

test('withTransaction: commit и ровно один release', async () => {
  const { pool, calls } = fakePool();
  const out = await withTransaction(pool, async (client, stage) => {
    stage('work');
    return { ok: true };
  });
  assert.deepEqual(out, { ok: true });
  assert.equal(calls.connects, 1);
  assert.equal(calls.releases, 1);
  assert.deepEqual(calls.queries, ['BEGIN', 'COMMIT']);
});

test('withTransaction: ошибка handler — rollback, один release, stage', async () => {
  const { pool, calls } = fakePool();
  await assert.rejects(
    () => withTransaction(pool, async (_client, stage) => {
      stage('recreate-increments');
      throw new Error('boom');
    }),
    (err) => {
      assert.equal(err.message, 'boom');
      assert.equal(err.statusCode, 500);
      assert.equal(err.stage, 'recreate-increments');
      return true;
    },
  );
  assert.equal(calls.releases, 1);
  assert.deepEqual(calls.queries, ['BEGIN', 'ROLLBACK']);
});

test('withTransaction: HttpError сохраняет 404 и не превращается в 500', async () => {
  const { pool } = fakePool();
  await assert.rejects(
    () => withTransaction(pool, async () => {
      throw new HttpError(404, 'Not found');
    }),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.equal(err.message, 'Not found');
      return true;
    },
  );
});

test('withTransaction: ошибка pool.connect — 503 DB_UNAVAILABLE', async () => {
  const { pool, calls } = fakePool({ connectError: new Error('ECONNREFUSED') });
  await assert.rejects(
    () => withTransaction(pool, async () => ({ ok: true })),
    (err) => {
      assert.equal(err.statusCode, 503);
      assert.equal(err.code, 'DB_UNAVAILABLE');
      assert.equal(err.stage, 'connect');
      return true;
    },
  );
  assert.equal(calls.releases, 0);
});

test('withTransaction: бросающий release не роняет транзакцию', async () => {
  const { pool, calls } = fakePool({ releaseError: new Error('already released') });
  const out = await withTransaction(pool, async () => ({ ok: 1 }));
  assert.deepEqual(out, { ok: 1 });
  assert.equal(calls.releases, 1);
});

test('withTransaction: ошибка ROLLBACK не заменяет исходную ошибку', async () => {
  const { pool } = fakePool();
  const client = await pool.connect();
  client.query = async (sql) => {
    if (sql === 'ROLLBACK') throw new Error('rollback failed');
    return { rows: [], rowCount: 0 };
  };
  await assert.rejects(
    () => withTransaction(pool, async () => { throw new Error('original'); }),
    /original/,
  );
});
