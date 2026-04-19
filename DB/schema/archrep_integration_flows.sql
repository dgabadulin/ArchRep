-- Миграция: реестр интеграционных потоков (задача #10).
-- Схема archrep. Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_integration_flows.sql

BEGIN;

-- 1. Тип инициирующего события (справочник: По событию, По расписанию)
CREATE TABLE IF NOT EXISTS archrep.ar_integration_flow_event_types (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description varchar NULL,
  CONSTRAINT ar_integration_flow_event_types_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_integration_flow_event_types IS 'Тип инициирующего события интеграции: по событию или по расписанию';

INSERT INTO archrep.ar_integration_flow_event_types (name, description)
SELECT * FROM (VALUES
  ('По событию', 'Инициируется по наступлению события'),
  ('По расписанию', 'Инициируется по расписанию')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_integration_flow_event_types LIMIT 1);

-- 2. Статусы интеграционных потоков
CREATE TABLE IF NOT EXISTS archrep.ar_integration_flow_statuses (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description varchar NULL,
  CONSTRAINT ar_integration_flow_statuses_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_integration_flow_statuses IS 'Статусы интеграционных потоков';

INSERT INTO archrep.ar_integration_flow_statuses (name, description)
SELECT * FROM (VALUES
  ('планируется к реализации', NULL),
  ('в процессе реализации', NULL),
  ('в промышленной эксплуатации', NULL),
  ('исключена', NULL),
  ('реализация отменена', NULL)
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_integration_flow_statuses LIMIT 1);

-- 3. Интеграционные потоки
CREATE TABLE IF NOT EXISTS archrep.ar_integration_flows (
  id bigserial NOT NULL,
  source_ar_systems_id int8 NOT NULL,
  target_ar_systems_id int8 NOT NULL,
  ar_integration_flow_event_types_id int8 NULL,
  transferred_data text NULL,
  transfer_method text NULL,
  ar_integration_flow_statuses_id int8 NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  CONSTRAINT ar_integration_flows_pkey PRIMARY KEY (id),
  CONSTRAINT ar_integration_flows_source_fkey FOREIGN KEY (source_ar_systems_id) REFERENCES archrep.ar_systems (id) ON DELETE CASCADE,
  CONSTRAINT ar_integration_flows_target_fkey FOREIGN KEY (target_ar_systems_id) REFERENCES archrep.ar_systems (id) ON DELETE CASCADE,
  CONSTRAINT ar_integration_flows_event_type_fkey FOREIGN KEY (ar_integration_flow_event_types_id) REFERENCES archrep.ar_integration_flow_event_types (id) ON DELETE SET NULL,
  CONSTRAINT ar_integration_flows_status_fkey FOREIGN KEY (ar_integration_flow_statuses_id) REFERENCES archrep.ar_integration_flow_statuses (id) ON DELETE SET NULL
);
COMMENT ON TABLE archrep.ar_integration_flows IS 'Реестр интеграционных потоков между системами';
COMMENT ON COLUMN archrep.ar_integration_flows.source_ar_systems_id IS 'Система-источник (FK)';
COMMENT ON COLUMN archrep.ar_integration_flows.target_ar_systems_id IS 'Система-получатель (FK)';
COMMENT ON COLUMN archrep.ar_integration_flows.ar_integration_flow_event_types_id IS 'Тип инициирующего события (FK)';
COMMENT ON COLUMN archrep.ar_integration_flows.transferred_data IS 'Передаваемые данные';
COMMENT ON COLUMN archrep.ar_integration_flows.transfer_method IS 'Способ передачи';
COMMENT ON COLUMN archrep.ar_integration_flows.ar_integration_flow_statuses_id IS 'Статус интеграционного потока (FK)';

CREATE INDEX IF NOT EXISTS ar_integration_flows_source_idx ON archrep.ar_integration_flows (source_ar_systems_id);
CREATE INDEX IF NOT EXISTS ar_integration_flows_target_idx ON archrep.ar_integration_flows (target_ar_systems_id);
CREATE INDEX IF NOT EXISTS ar_integration_flows_status_idx ON archrep.ar_integration_flows (ar_integration_flow_statuses_id);

COMMIT;
