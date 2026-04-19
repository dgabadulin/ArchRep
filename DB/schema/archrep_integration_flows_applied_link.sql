-- Задача #20 п.5–6: связь реестра интеграций с архитектурным заключением и связью инкремента.
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_integration_flows_applied_link.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'archrep' AND table_name = 'ar_integration_flows' AND column_name = 'ar_adrs_applied_id') THEN
    ALTER TABLE archrep.ar_integration_flows ADD COLUMN ar_adrs_applied_id int8 NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'archrep' AND table_name = 'ar_integration_flows' AND column_name = 'ar_adr_increment_relation_id') THEN
    ALTER TABLE archrep.ar_integration_flows ADD COLUMN ar_adr_increment_relation_id int8 NULL;
  END IF;
END $$;

COMMENT ON COLUMN archrep.ar_integration_flows.ar_adrs_applied_id IS 'Архитектурное заключение, при утверждении которого создана запись (FK ar_adrs_applied)';
COMMENT ON COLUMN archrep.ar_integration_flows.ar_adr_increment_relation_id IS 'Связь инкремента (ar_adr_increment_relations), по которой создана запись; одна связь — не более одной записи в реестре';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'archrep' AND t.relname = 'ar_integration_flows' AND c.conname = 'ar_integration_flows_applied_fkey'
  ) THEN
    ALTER TABLE archrep.ar_integration_flows
      ADD CONSTRAINT ar_integration_flows_applied_fkey
      FOREIGN KEY (ar_adrs_applied_id) REFERENCES archrep.ar_adrs_applied(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'archrep' AND t.relname = 'ar_integration_flows' AND c.conname = 'ar_integration_flows_relation_fkey'
  ) THEN
    ALTER TABLE archrep.ar_integration_flows
      ADD CONSTRAINT ar_integration_flows_relation_fkey
      FOREIGN KEY (ar_adr_increment_relation_id) REFERENCES archrep.ar_adr_increment_relations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ar_integration_flows_applied_idx ON archrep.ar_integration_flows (ar_adrs_applied_id);
CREATE INDEX IF NOT EXISTS ar_integration_flows_relation_idx ON archrep.ar_integration_flows (ar_adr_increment_relation_id);

COMMIT;
