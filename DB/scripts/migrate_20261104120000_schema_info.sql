-- Issue #96: версия схемы БД (маркер) + режим предупреждения о неприменённых миграциях.
--
-- Зачем маркер: prod-скрипты накатываются вручную (psql -f), поэтому public.pgmigrations
-- (node-pg-migrate) там пустая/устаревшая — по ней нельзя судить о версии схемы.
-- Каждый новый скрипт migrate_*.sql заканчивается upsert-ом в ar_schema_info (см. ниже),
-- поэтому маркер обновляется и при ручном накате, и через `npm run db:migrate` (demo).
--
-- Идемпотентно: CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING/UPDATE.

CREATE TABLE IF NOT EXISTS archrep.ar_schema_info (
  code text PRIMARY KEY,
  version text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text
);

COMMENT ON TABLE archrep.ar_schema_info IS
  'Версия схемы БД продукта (issue #96). Обновляется скриптами миграций, в т.ч. при ручном psql -f.';
COMMENT ON COLUMN archrep.ar_schema_info.code IS 'Код продукта/контура: core (ядро ИСАР)';
COMMENT ON COLUMN archrep.ar_schema_info.version IS 'Версия = 14-значный префикс последней применённой миграции';

-- Режим показа плашки «есть неприменённые миграции» в UI: off | admin | all.
-- На факты в GET /api/version параметр не влияет — там состояние схемы отдаётся всегда.
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'SYS_DB_SCHEMA_WARN_MODE',
  'Кому показывать предупреждение «код новее схемы БД»: off — никому; admin — только тем, кто может применить скрипты (settings_parameters:write / system_admin:restart); all — всем пользователям. Само состояние схемы всегда доступно в GET /api/version.',
  'admin',
  'string',
  'Система',
  false,
  false
)
ON CONFLICT (code) DO NOTHING;

-- Начальный маркер: этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261104120000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by;
