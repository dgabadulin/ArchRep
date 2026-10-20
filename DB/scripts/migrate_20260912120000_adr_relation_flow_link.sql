-- issue #74: связь интеграции в архитектурном заключении ссылается на существующий
-- интеграционный поток реестра (или создаёт новый) и хранит реестровые поля (предлагаемые значения).
-- Идемпотентно; прод — psql -f, демо — npm run db:migrate (DB/migrations/20260912120000_adr_relation_flow_link.js).

-- 1. Ссылка на поток реестра + реестровые поля связи
ALTER TABLE archrep.ar_adr_increment_relations
  ADD COLUMN IF NOT EXISTS ar_integration_flows_id bigint,
  ADD COLUMN IF NOT EXISTS transferred_data text,
  ADD COLUMN IF NOT EXISTS transfer_method text,
  ADD COLUMN IF NOT EXISTS periodicity text,
  ADD COLUMN IF NOT EXISTS ar_integration_flow_event_types_id bigint;

-- 2. FK на поток реестра (при удалении потока связь остаётся, ссылка обнуляется)
DO $$
BEGIN
  ALTER TABLE archrep.ar_adr_increment_relations
    ADD CONSTRAINT ar_adr_increment_relations_flow_fkey
    FOREIGN KEY (ar_integration_flows_id) REFERENCES archrep.ar_integration_flows(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. FK на тип инициирующего события потока
DO $$
BEGIN
  ALTER TABLE archrep.ar_adr_increment_relations
    ADD CONSTRAINT ar_adr_increment_relations_flow_event_type_fkey
    FOREIGN KEY (ar_integration_flow_event_types_id) REFERENCES archrep.ar_integration_flow_event_types(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Индексы
CREATE INDEX IF NOT EXISTS adr_increment_relations_flow_idx
  ON archrep.ar_adr_increment_relations (ar_integration_flows_id);
CREATE INDEX IF NOT EXISTS integration_flows_pair_idx
  ON archrep.ar_integration_flows (source_ar_systems_id, target_ar_systems_id);

-- 5. Backfill: старый маппинг name → transferred_data, description → transfer_method
UPDATE archrep.ar_adr_increment_relations
SET transferred_data = COALESCE(transferred_data, name),
    transfer_method = COALESCE(transfer_method, description)
WHERE (transferred_data IS NULL AND name IS NOT NULL)
   OR (transfer_method IS NULL AND description IS NOT NULL);

-- 6. Backfill ссылки на поток: для связей, уже созданных заключением (поток связан через ar_adr_increment_relation_id)
UPDATE archrep.ar_adr_increment_relations r
SET ar_integration_flows_id = f.id
FROM archrep.ar_integration_flows f
WHERE f.ar_adr_increment_relation_id = r.id
  AND r.ar_integration_flows_id IS NULL;
