'use strict';

const { getHandler } = require('./handlers');
const { createJobContext } = require('./context');

const TICK_MS = 60 * 1000;

function createJobRunner(pool, queries) {
  let timer = null;
  let ticking = false;

  async function tryAdvisoryLock(client, code) {
    const r = await client.query('SELECT pg_try_advisory_lock(hashtext($1::text)) AS ok', [code]);
    return Boolean(r.rows[0]?.ok);
  }

  async function releaseAdvisoryLock(client, code) {
    await client.query('SELECT pg_advisory_unlock(hashtext($1::text))', [code]);
  }

  async function executeJob(job, { trigger = 'schedule', triggeredByUserId = null } = {}) {
    const handler = getHandler(job.code);
    if (!handler) {
      const err = new Error(`Unknown handler: ${job.code}`);
      err.code = 'UNKNOWN_HANDLER';
      throw err;
    }

    const client = await pool.connect();
    let locked = false;
    let runId = null;
    const logLines = [];

    try {
      locked = await tryAdvisoryLock(client, job.code);
      if (!locked) {
        const err = new Error(`Задание «${job.code}» уже выполняется`);
        err.code = 'JOB_BUSY';
        err.status = 409;
        throw err;
      }

      await client.query(queries.jobs_touch_start, [job.id]);
      const runIns = await client.query(queries.job_runs_insert, [
        job.id,
        trigger,
        triggeredByUserId,
      ]);
      runId = runIns.rows[0].id;

      const ctx = createJobContext({
        pool,
        queries,
        job,
        runId,
        trigger,
        triggeredByUserId,
        logLines,
      });

      let result;
      try {
        result = await handler(ctx);
      } catch (handlerErr) {
        const msg = handlerErr.message || String(handlerErr);
        await client.query(queries.job_runs_finish, [runId, 'failed', null, msg, null]);
        await client.query(queries.jobs_touch_finish, [job.id, 'failed']);
        throw handlerErr;
      }

      const message =
        (result && result.message) ||
        (logLines.length ? logLines.join('; ') : 'OK');
      const resultJson = result && typeof result === 'object' ? result : { value: result };

      await client.query(queries.job_runs_finish, [
        runId,
        'success',
        message,
        null,
        resultJson,
      ]);
      await client.query(queries.jobs_touch_finish, [job.id, 'success']);

      return { runId, status: 'success', message, result: resultJson };
    } finally {
      if (locked) {
        try {
          await releaseAdvisoryLock(client, job.code);
        } catch (_) {
          /* ignore */
        }
      }
      client.release();
    }
  }

  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const due = await pool.query(queries.jobs_select_due);
      for (const job of due.rows) {
        try {
          await executeJob(job, { trigger: 'schedule' });
        } catch (err) {
          if (err.code === 'JOB_BUSY') continue;
          console.error(`[job runner] ${job.code} failed:`, err.message);
        }
      }
    } catch (err) {
      console.error('[job runner] tick error:', err.message);
    } finally {
      ticking = false;
    }
  }

  function start() {
    if (timer) return;
    tick().catch(() => {});
    timer = setInterval(() => {
      tick().catch(() => {});
    }, TICK_MS);
    if (typeof timer.unref === 'function') timer.unref();
    console.log('[job runner] started');
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function runJobById(jobId, { trigger = 'manual', triggeredByUserId = null } = {}) {
    const r = await pool.query(queries.jobs_get, [jobId]);
    if (r.rowCount === 0) {
      const err = new Error('Job not found');
      err.status = 404;
      throw err;
    }
    return executeJob(r.rows[0], { trigger, triggeredByUserId });
  }

  return {
    start,
    stop,
    tick,
    executeJob,
    runJobById,
  };
}

module.exports = { createJobRunner, TICK_MS };
