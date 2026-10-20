-- Job Runner (#68): ar_jobs, ar_job_runs, CHK_* parameters, seed domain_expiration_check.

CREATE TABLE IF NOT EXISTS archrep.ar_jobs (
  id                bigserial PRIMARY KEY,
  code              varchar(128) NOT NULL,
  name              varchar(255) NOT NULL,
  description       text NULL,
  handler           varchar(128) NOT NULL,
  interval_seconds  int NOT NULL,
  enabled           boolean NOT NULL DEFAULT true,
  last_started_at   timestamptz NULL,
  last_finished_at  timestamptz NULL,
  last_success_at   timestamptz NULL,
  last_status       varchar(32) NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ar_jobs_code_uq UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS archrep.ar_job_runs (
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

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'CHK_DOMAIN_EXPIRATION',
  'Порог в днях: домены с expires_at от сегодня до сегодня+N попадают в уведомление (Job Runner).',
  '30',
  'number',
  'Проверки',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  "group" = EXCLUDED."group";

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'CHK_DOMAIN_EXPIRATION_EMAIL',
  'Получатель email-уведомления об истекающих доменах. Несколько адресов через запятую.',
  '',
  'string',
  'Проверки',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  "group" = EXCLUDED."group";

INSERT INTO archrep.ar_permissions (code, description, is_active) VALUES
  ('jobs:read', 'Задания: просмотр списка и истории', true),
  ('jobs:execute', 'Задания: ручной запуск и вкл/выкл', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO archrep.ar_jobs (code, name, description, handler, interval_seconds, enabled)
VALUES (
  'domain_expiration_check',
  'Проверка сроков доменов',
  'Email со списком доменов, истекающих в течение CHK_DOMAIN_EXPIRATION дней (исключая rejected и уже истёкшие).',
  'domain_expiration_check',
  259200,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  handler = EXCLUDED.handler,
  interval_seconds = EXCLUDED.interval_seconds;
