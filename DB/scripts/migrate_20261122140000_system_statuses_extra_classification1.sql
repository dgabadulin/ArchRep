-- Статусы систем: дополнительная классификация справочника (issue #130).
-- Текстовая метка для группировки статусов (например, «Эксплуатация», «Вывод из эксплуатации»).
-- Поле необязательное: существующие записи остаются с NULL, заполняется вручную в «Справочниках».
-- Идемпотентно. После применения: перезапуск backend (запросы справочника читают новую колонку).

ALTER TABLE archrep.ar_system_statuses
  ADD COLUMN IF NOT EXISTS extra_classification1 VARCHAR(255) NULL;

COMMENT ON COLUMN archrep.ar_system_statuses.extra_classification1 IS
  'Доп.классификация1: текстовая метка для группировки статусов систем';

-- Версия схемы (issue #130): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261122140000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by
  WHERE archrep.ar_schema_info.version < EXCLUDED.version;
