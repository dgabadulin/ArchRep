-- Стабильные коды статусов системы в инкременте (для DRAWIO_NODE_STYLE.nodeStatusColor и API).
-- Префикс ADR_INCR_SYS_* — параллельно ADR_INCR_REL_* у статусов интеграций.
-- Выполнить один раз на существующей БД; идемпотентность по наличию колонки.

ALTER TABLE archrep.ar_adr_increment_system_statuses
  ADD COLUMN IF NOT EXISTS code varchar(64) NULL;

COMMENT ON COLUMN archrep.ar_adr_increment_system_statuses.code IS
  'Стабильный код для параметров и генерации схем (латиница, UPPER_SNAKE_CASE), см. docs/drawio-increment-diagram-parameters.md';

-- Привязка к существующим id (актуальный справочник см. в документации).
UPDATE archrep.ar_adr_increment_system_statuses SET code = 'ADR_INCR_SYS_CREATING' WHERE id = 1;
UPDATE archrep.ar_adr_increment_system_statuses SET code = 'ADR_INCR_SYS_IN_USE' WHERE id = 2;
UPDATE archrep.ar_adr_increment_system_statuses SET code = 'ADR_INCR_SYS_MODIFYING' WHERE id = 3;
UPDATE archrep.ar_adr_increment_system_statuses SET code = 'ADR_INCR_SYS_DECOMMISSIONING' WHERE id = 4;
UPDATE archrep.ar_adr_increment_system_statuses SET code = 'ADR_INCR_SYS_OTHER_SOLUTION' WHERE id = 5;

-- Если в БД другой набор id — поправьте UPDATE вручную перед NOT NULL.

ALTER TABLE archrep.ar_adr_increment_system_statuses
  ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ar_adr_increment_system_statuses_code_uidx
  ON archrep.ar_adr_increment_system_statuses USING btree (code);
