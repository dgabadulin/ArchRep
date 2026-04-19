-- Issue #31: стабильные коды справочников ADR / статусов связи инкремента / статусов потоков (вариант B).
-- Запуск после archrep_adr_v2, archrep_integration_flows. Идемпотентно по ADD COLUMN IF NOT EXISTS.
-- psql -h ... -U ... -d ... -f DB/schema/archrep_issue31_adr_ref_codes.sql

BEGIN;

-- --- ar_adr_statuses ---
ALTER TABLE archrep.ar_adr_statuses ADD COLUMN IF NOT EXISTS code varchar(64) NULL;

UPDATE archrep.ar_adr_statuses SET code = 'ADR_STATUS_DRAFT' WHERE name = 'Черновик' AND (code IS NULL OR code = '');
UPDATE archrep.ar_adr_statuses SET code = 'ADR_STATUS_APPROVED_ARCH' WHERE name = 'Утверждено архитектором' AND (code IS NULL OR code = '');
UPDATE archrep.ar_adr_statuses SET code = 'ADR_STATUS_APPROVED_COUNCIL' WHERE name = 'Утверждено арх.советом' AND (code IS NULL OR code = '');

UPDATE archrep.ar_adr_statuses SET code = 'ADR_STATUS_' || id::text WHERE code IS NULL OR trim(code) = '';

ALTER TABLE archrep.ar_adr_statuses ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ar_adr_statuses_code_uidx ON archrep.ar_adr_statuses (code);

COMMENT ON COLUMN archrep.ar_adr_statuses.code IS 'Стабильный код для параметров и интеграций (латиница, UPPER_SNAKE_CASE)';

-- --- ar_adr_increment_relation_statuses ---
ALTER TABLE archrep.ar_adr_increment_relation_statuses ADD COLUMN IF NOT EXISTS code varchar(64) NULL;

UPDATE archrep.ar_adr_increment_relation_statuses SET code = 'ADR_INCR_REL_CREATING' WHERE name = 'Создается' AND (code IS NULL OR code = '');
UPDATE archrep.ar_adr_increment_relation_statuses SET code = 'ADR_INCR_REL_MODIFYING' WHERE name = 'Модифицируется' AND (code IS NULL OR code = '');
UPDATE archrep.ar_adr_increment_relation_statuses SET code = 'ADR_INCR_REL_IN_USE' WHERE name = 'Используется' AND (code IS NULL OR code = '');
UPDATE archrep.ar_adr_increment_relation_statuses SET code = 'ADR_INCR_REL_REMOVING' WHERE name = 'Удаляется' AND (code IS NULL OR code = '');
UPDATE archrep.ar_adr_increment_relation_statuses SET code = 'ADR_INCR_REL_PLANNED' WHERE name = 'Запланирована' AND (code IS NULL OR code = '');
UPDATE archrep.ar_adr_increment_relation_statuses SET code = 'ADR_INCR_REL_IMPLEMENTING' WHERE name = 'В реализации' AND (code IS NULL OR code = '');
UPDATE archrep.ar_adr_increment_relation_statuses SET code = 'ADR_INCR_REL_DONE' WHERE name = 'Реализована' AND (code IS NULL OR code = '');

UPDATE archrep.ar_adr_increment_relation_statuses SET code = 'ADR_INCR_REL_' || id::text WHERE code IS NULL OR trim(code) = '';

ALTER TABLE archrep.ar_adr_increment_relation_statuses ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ar_adr_incr_rel_st_code_uidx ON archrep.ar_adr_increment_relation_statuses (code);

COMMENT ON COLUMN archrep.ar_adr_increment_relation_statuses.code IS 'Стабильный код статуса связи в инкременте (параметр ADR_FLOW_STATUS_MAP)';

-- --- ar_integration_flow_statuses ---
ALTER TABLE archrep.ar_integration_flow_statuses ADD COLUMN IF NOT EXISTS code varchar(64) NULL;

UPDATE archrep.ar_integration_flow_statuses SET code = 'FLOW_STATUS_PLANNED' WHERE name = 'планируется к реализации' AND (code IS NULL OR code = '');
UPDATE archrep.ar_integration_flow_statuses SET code = 'FLOW_STATUS_IN_PROGRESS' WHERE name = 'в процессе реализации' AND (code IS NULL OR code = '');
UPDATE archrep.ar_integration_flow_statuses SET code = 'FLOW_STATUS_PRODUCTION' WHERE name = 'в промышленной эксплуатации' AND (code IS NULL OR code = '');
UPDATE archrep.ar_integration_flow_statuses SET code = 'FLOW_STATUS_EXCLUDED' WHERE name = 'исключена' AND (code IS NULL OR code = '');
UPDATE archrep.ar_integration_flow_statuses SET code = 'FLOW_STATUS_CANCELLED' WHERE name = 'реализация отменена' AND (code IS NULL OR code = '');

UPDATE archrep.ar_integration_flow_statuses SET code = 'FLOW_STATUS_' || id::text WHERE code IS NULL OR trim(code) = '';

ALTER TABLE archrep.ar_integration_flow_statuses ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ar_integration_flow_statuses_code_uidx ON archrep.ar_integration_flow_statuses (code);

COMMENT ON COLUMN archrep.ar_integration_flow_statuses.code IS 'Стабильный код статуса потока (значения в ADR_FLOW_STATUS_MAP)';

COMMIT;
