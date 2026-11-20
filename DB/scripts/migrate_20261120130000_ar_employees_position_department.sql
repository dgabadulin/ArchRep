-- Справочник сотрудников: должность и подразделение.
-- Ключом синхронизации становится табельный номер, поэтому уникальность
-- по первому слову ФИО снимается (однофамильцы допустимы), остаётся обычный индекс.
-- Идемпотентно. После применения: перезапуск backend.

ALTER TABLE archrep.ar_employees
  ADD COLUMN IF NOT EXISTS position VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS department VARCHAR(512) NULL;

COMMENT ON COLUMN archrep.ar_employees.position IS 'Должность сотрудника (текстом, из HR-выгрузки)';
COMMENT ON COLUMN archrep.ar_employees.department IS 'Подразделение сотрудника (текстом, из HR-выгрузки)';

DROP INDEX IF EXISTS archrep.ar_employees_first_word_lower_uidx;

CREATE INDEX IF NOT EXISTS ar_employees_first_word_lower_idx
  ON archrep.ar_employees ((lower(trim(split_part(full_name, ' ', 1)))));

COMMENT ON INDEX archrep.ar_employees_first_word_lower_idx IS
  'Поиск по первому слову ФИО; уникальность больше не требуется — ключ синхронизации employee_number.';

-- Версия схемы (issue #122): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261120130000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by
  WHERE archrep.ar_schema_info.version < EXCLUDED.version;
