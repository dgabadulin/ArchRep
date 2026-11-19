'use strict';

/**
 * Безопасные транзакции поверх `pg.Pool`.
 *
 * Зачем: в Express 4 + Node 20 ошибка вне `try` (например, `pool.connect()`)
 * или повторный `client.release()` в `catch` роняют процесс. Docker `restart: always`
 * поднимает контейнер, а nginx в это время отдаёт 502. Здесь клиент освобождается
 * ровно один раз в `finally`, а исходная ошибка сохраняется со стадией транзакции.
 */

/** Ожидаемая HTTP-ошибка внутри транзакции (404/400/409). */
class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ code?: string, extra?: object }} [opts]
   */
  constructor(statusCode, message, opts = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    if (opts.code) this.code = opts.code;
    if (opts.extra && typeof opts.extra === 'object') Object.assign(this, opts.extra);
  }
}

/** Ошибка недоступности БД — 503, без деталей подключения в ответе. */
function dbUnavailableError(cause) {
  const err = new Error('База данных временно недоступна. Повторите попытку.');
  err.name = 'DbUnavailableError';
  err.statusCode = 503;
  err.code = 'DB_UNAVAILABLE';
  err.stage = 'connect';
  err.cause = cause;
  return err;
}

/**
 * Выполнить `handler(client, stage)` в транзакции.
 *
 * @template T
 * @param {{ connect: Function }} pool
 * @param {(client: any, stage: (name: string) => void) => Promise<T>} handler
 * @param {{ stage?: string }} [opts]
 * @returns {Promise<T>}
 */
async function withTransaction(pool, handler, opts = {}) {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[dbTx] pool.connect failed:', err && err.message);
    throw dbUnavailableError(err);
  }

  let released = false;
  let stageName = opts.stage || 'transaction';
  const stage = (name) => {
    stageName = name || stageName;
  };
  const releaseOnce = () => {
    if (released) return;
    released = true;
    try {
      client.release();
    } catch (err) {
      // Повторный/сломанный release не должен ронять процесс.
      console.error('[dbTx] client.release failed:', err && err.message);
    }
  };

  try {
    stage('begin');
    await client.query('BEGIN');
    const result = await handler(client, stage);
    stage('commit');
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Если COMMIT уже прошёл, ROLLBACK может быть бессмысленным, но он безопасен:
    // клиент ещё не освобождён, ошибки ROLLBACK игнорируем.
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* connection may be broken — release below */
    }
    if (err && typeof err === 'object') {
      if (err.stage == null) err.stage = stageName;
      if (err.statusCode == null) err.statusCode = 500;
    }
    throw err;
  } finally {
    releaseOnce();
  }
}

/**
 * Единый ответ на ошибку транзакционного маршрута.
 * @param {import('express').Response} res
 * @param {any} err
 * @param {string} fallback
 */
function sendTransactionError(res, err, fallback) {
  if (res.headersSent) {
    console.error('[dbTx] response already sent; error:', err && err.message);
    return;
  }
  const status = Number(err && err.statusCode) || 500;
  const body = {
    error: (err && err.message) || fallback,
  };
  if (err && err.code) body.code = err.code;
  if (err && err.stage) body.stage = err.stage;
  res.status(status).json(body);
}

module.exports = {
  HttpError,
  dbUnavailableError,
  withTransaction,
  sendTransactionError,
};
