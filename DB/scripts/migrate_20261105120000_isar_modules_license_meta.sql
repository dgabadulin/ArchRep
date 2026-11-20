-- Метаданные лицензии модулей в archrep.isar_modules (история; удалено в v4.0.0;
-- формат ключа — v1).
--
-- Что добавляется:
--   license_id          — идентификатор ключа из payload (LIC-2026-000001) для сверки с реестром лицензий;
--   license_kid         — идентификатор пары подписи (ротация публичных ключей);
--   license_binding     — как ключ привязан к инсталляции: any | uuid:match | uuid:mismatch | derived:match ...
--   license_checked_at  — когда ядро последний раз проверяло ключ.
--
-- Ключ лицензии и публичный ключ в БД НЕ пишутся (только env SYS_MODULE_<code>_LICENSE /
-- SYS_MODULE_LICENSE_PUBKEYS). Идемпотентно: повторный запуск безопасен.
ALTER TABLE archrep.isar_modules
  ADD COLUMN IF NOT EXISTS license_id text,
  ADD COLUMN IF NOT EXISTS license_kid text,
  ADD COLUMN IF NOT EXISTS license_binding text,
  ADD COLUMN IF NOT EXISTS license_checked_at timestamptz;

COMMENT ON COLUMN archrep.isar_modules.license_id IS
  'license_id из проверенного ключа (v1). Ключ в БД не хранится (удалено в v4.0.0)';
COMMENT ON COLUMN archrep.isar_modules.license_kid IS
  'kid ключа — по нему выбирается публичный ключ в SYS_MODULE_LICENSE_PUBKEYS';
COMMENT ON COLUMN archrep.isar_modules.license_binding IS
  'Привязка ключа к инсталляции: any | uuid:match | uuid:mismatch | derived:match | derived:mismatch (+ :strict)';
COMMENT ON COLUMN archrep.isar_modules.license_checked_at IS
  'Время последней проверки лицензии ядром (синхронизируется при старте API)';

-- Диагностика: модули, у которых лицензия истекла/истекает в ближайшие 30 дней.
CREATE INDEX IF NOT EXISTS isar_modules_license_expires_idx
  ON archrep.isar_modules (license_expires_at);

-- Версия схемы (issue #96): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261105120000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by;
