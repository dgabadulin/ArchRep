-- Обновление параметров в БД после внедрения кодов (issue #31).
-- Запуск вручную на существующих инсталляциях, где уже есть старые ADR_* по именам.
-- psql -h ... -U ... -d ... -f DB/scripts/migrate_settings_params_adr_codes.sql

BEGIN;

UPDATE archrep.ar_settings_parameters
SET description = 'JSON: код статуса связи инкремента → код статуса потока. Legacy: русские имена → id.',
    value = '{"ADR_INCR_REL_CREATING":"FLOW_STATUS_PLANNED","ADR_INCR_REL_MODIFYING":"FLOW_STATUS_PRODUCTION","ADR_INCR_REL_IN_USE":"FLOW_STATUS_PRODUCTION","ADR_INCR_REL_REMOVING":"FLOW_STATUS_EXCLUDED","ADR_INCR_REL_PLANNED":"FLOW_STATUS_PLANNED","ADR_INCR_REL_IMPLEMENTING":"FLOW_STATUS_IN_PROGRESS","ADR_INCR_REL_DONE":"FLOW_STATUS_PRODUCTION"}',
    value_type = 'json',
    updated_at = now()
WHERE code = 'ADR_FLOW_STATUS_MAP';

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'ADR_APPROVED_STATUS_CODES', 'Коды статусов заключения (ar_adr_statuses.code) для создания потоков.', '["ADR_STATUS_APPROVED_ARCH","ADR_STATUS_APPROVED_COUNCIL"]', 'json', 'ADR', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'ADR_APPROVED_STATUS_CODES');

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'ADR_DRAFT_STATUS_CODE', 'Код статуса черновика (ar_adr_statuses.code).', 'ADR_STATUS_DRAFT', 'string', 'ADR', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'ADR_DRAFT_STATUS_CODE');

COMMIT;
