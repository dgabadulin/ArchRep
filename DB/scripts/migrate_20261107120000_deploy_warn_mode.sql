-- Параметр «кому показывать пометку о деплое не из релиза» (docs/versioning.md §4).
-- Значение читает GET /api/version (deploy.warn_mode) и страница «О системе».
--   off   — никому (пометка только в самом JSON);
--   admin — только тем, кто может применять скрипты/администрировать (по умолчанию);
--   all   — всем пользователям.
-- Идемпотентно.
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'SYS_DEPLOY_WARN_MODE',
  'Кому показывать пометку «деплой не из релиза» (state=ahead/dirty) на странице «О системе»: off — никому; admin — администраторам (по умолчанию); all — всем. Состояние деплоя всегда отдаётся в GET /api/version → deploy.state.',
  'admin',
  'string',
  'Система',
  false,
  false
)
ON CONFLICT (code) DO NOTHING;

-- Версия схемы (issue #96): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261107120000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by;
