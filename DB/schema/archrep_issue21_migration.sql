-- Задача #21: доработка модели данных (external_system, periodicity)
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_issue21_migration.sql

BEGIN;

-- 1. ar_systems: признак внешней системы
ALTER TABLE archrep.ar_systems
  ADD COLUMN IF NOT EXISTS external_system boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN archrep.ar_systems.external_system IS 'Признак внешней системы или сервиса';

-- 2. ar_integration_flows: периодичность передачи
ALTER TABLE archrep.ar_integration_flows
  ADD COLUMN IF NOT EXISTS periodicity text NULL;
COMMENT ON COLUMN archrep.ar_integration_flows.periodicity IS 'Периодичность передачи информации';

COMMIT;
