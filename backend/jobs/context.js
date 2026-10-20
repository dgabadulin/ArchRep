'use strict';

const { getParam } = require('../settingsParams');

/**
 * @typedef {object} JobContext
 * @property {import('pg').Pool} pool
 * @property {object} queries
 * @property {string} jobCode
 * @property {number} jobId
 * @property {number} runId
 * @property {'schedule'|'manual'} trigger
 * @property {number|null} triggeredByUserId
 * @property {(code: string, defaultValue?: *) => *} getParam
 * @property {(message: string) => void} log
 */

/**
 * @param {object} opts
 * @param {import('pg').Pool} opts.pool
 * @param {object} opts.queries
 * @param {object} opts.job
 * @param {number} opts.runId
 * @param {'schedule'|'manual'} opts.trigger
 * @param {number|null} [opts.triggeredByUserId]
 * @param {string[]} [opts.logLines]
 * @returns {JobContext}
 */
function createJobContext({ pool, queries, job, runId, trigger, triggeredByUserId = null, logLines = [] }) {
  return {
    pool,
    queries,
    jobCode: job.code,
    jobId: job.id,
    runId,
    trigger,
    triggeredByUserId,
    getParam: (code, defaultValue) => getParam(code, defaultValue),
    log(message) {
      if (message) logLines.push(String(message));
    },
  };
}

module.exports = { createJobContext };
