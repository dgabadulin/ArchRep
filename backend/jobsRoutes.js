'use strict';

const express = require('express');

/**
 * @param {import('pg').Pool} pool
 * @param {object} queries
 * @param {ReturnType<import('./jobs/runner').createJobRunner>} jobRunner
 */
function createJobsRouter(pool, queries, jobRunner) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const r = await pool.query(queries.jobs_select);
      res.json(r.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  router.get('/:id/runs', async (req, res) => {
    try {
      const jobId = Number(req.params.id);
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const job = await pool.query(queries.jobs_get, [jobId]);
      if (job.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      const runs = await pool.query(queries.job_runs_select_by_job, [jobId, limit, offset]);
      res.json(runs.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  router.post('/:id/run', async (req, res) => {
    try {
      const jobId = Number(req.params.id);
      const userId = req.user && req.user.id != null ? Number(req.user.id) : null;
      const result = await jobRunner.runJobById(jobId, {
        trigger: 'manual',
        triggeredByUserId: userId,
      });
      res.json(result);
    } catch (err) {
      if (err.code === 'JOB_BUSY') {
        return res.status(409).json({ error: err.message });
      }
      console.error(err);
      res.status(err.status || 500).json({ error: err.message || 'Run failed' });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const jobId = Number(req.params.id);
      const enabled = req.body && req.body.enabled;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled (boolean) required' });
      }
      const r = await pool.query(queries.jobs_update_enabled, [jobId, enabled]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  return router;
}

module.exports = { createJobsRouter };
