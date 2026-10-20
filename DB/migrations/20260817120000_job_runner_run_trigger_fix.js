/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS archrep.ar_job_runs;

    CREATE TABLE archrep.ar_job_runs (
      id                   bigserial PRIMARY KEY,
      job_id               bigint NOT NULL REFERENCES archrep.ar_jobs(id) ON DELETE CASCADE,
      started_at           timestamptz NOT NULL DEFAULT now(),
      finished_at          timestamptz NULL,
      status               varchar(32) NOT NULL,
      run_trigger          varchar(32) NOT NULL,
      message              text NULL,
      error_message        text NULL,
      result_json          jsonb NULL,
      triggered_by_user_id bigint NULL REFERENCES archrep.ar_app_users(id) ON DELETE SET NULL,
      CONSTRAINT ar_job_runs_status_chk CHECK (status IN ('running', 'success', 'failed')),
      CONSTRAINT ar_job_runs_run_trigger_chk CHECK (run_trigger IN ('schedule', 'manual'))
    );

    CREATE INDEX IF NOT EXISTS ar_job_runs_job_id_started_idx
      ON archrep.ar_job_runs (job_id, started_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS archrep.ar_job_runs;`);
};
