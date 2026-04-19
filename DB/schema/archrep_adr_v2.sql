-- Миграция: принципиальные и прикладные решения (ADRP / ADRA).
-- Выполнять после archrep_adr.sql. Схема archrep.
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_adr_v2.sql

BEGIN;

-- 1. Справочник статусов решения (общий для принципиальных и прикладных)
CREATE TABLE IF NOT EXISTS archrep.ar_adr_statuses (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description varchar NULL,
  CONSTRAINT ar_adr_statuses_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_adr_statuses IS 'Статус архитектурного решения (черновик, утверждено и т.д.)';

INSERT INTO archrep.ar_adr_statuses (name, description)
SELECT * FROM (VALUES
  ('Черновик', 'Черновик решения'),
  ('Утверждено архитектором', 'Утверждено архитектором'),
  ('Утверждено арх.советом', 'Утверждено архитектурным советом')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_adr_statuses LIMIT 1);

-- 2. Справочник типов инкремента
CREATE TABLE IF NOT EXISTS archrep.ar_adr_increment_types (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description varchar NULL,
  CONSTRAINT ar_adr_increment_types_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_adr_increment_types IS 'Тип инкремента: временное решение, целевое решение';

INSERT INTO archrep.ar_adr_increment_types (name, description)
SELECT * FROM (VALUES
  ('Временное решение', 'Временное (инкрементальное) решение'),
  ('Целевое решение', 'Целевое решение')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_adr_increment_types LIMIT 1);

-- 3. Последовательности для кодов
CREATE SEQUENCE IF NOT EXISTS archrep.adrp_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS archrep.adra_code_seq START WITH 1 INCREMENT BY 1;

-- 4. Принципиальные решения
CREATE TABLE IF NOT EXISTS archrep.ar_adrs_principle (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  context varchar NULL,
  decision varchar NULL,
  consequences varchar NULL,
  ar_adr_statuses_id int8 NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  author varchar NULL,
  CONSTRAINT ar_adrs_principle_pkey PRIMARY KEY (id),
  CONSTRAINT ar_adrs_principle_code_key UNIQUE (code),
  CONSTRAINT ar_adrs_principle_status_fkey FOREIGN KEY (ar_adr_statuses_id) REFERENCES archrep.ar_adr_statuses (id)
);
COMMENT ON TABLE archrep.ar_adrs_principle IS 'Принципиальные архитектурные решения (ADR)';
CREATE INDEX IF NOT EXISTS ar_adrs_principle_code_idx ON archrep.ar_adrs_principle (code);
CREATE INDEX IF NOT EXISTS ar_adrs_principle_status_idx ON archrep.ar_adrs_principle (ar_adr_statuses_id);

-- 5. Прикладные решения
CREATE TABLE IF NOT EXISTS archrep.ar_adrs_applied (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  task_name varchar NULL,
  task_link varchar NULL,
  conclusion varchar NULL,
  ar_adr_statuses_id int8 NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  author varchar NULL,
  CONSTRAINT ar_adrs_applied_pkey PRIMARY KEY (id),
  CONSTRAINT ar_adrs_applied_code_key UNIQUE (code),
  CONSTRAINT ar_adrs_applied_status_fkey FOREIGN KEY (ar_adr_statuses_id) REFERENCES archrep.ar_adr_statuses (id)
);
COMMENT ON TABLE archrep.ar_adrs_applied IS 'Прикладные архитектурные решения';
CREATE INDEX IF NOT EXISTS ar_adrs_applied_code_idx ON archrep.ar_adrs_applied (code);
CREATE INDEX IF NOT EXISTS ar_adrs_applied_status_idx ON archrep.ar_adrs_applied (ar_adr_statuses_id);

-- 6. Инкременты прикладного решения
CREATE TABLE IF NOT EXISTS archrep.ar_adr_increments (
  id bigserial NOT NULL,
  ar_adrs_applied_id int8 NOT NULL,
  order_index integer NOT NULL DEFAULT 1,
  name varchar NULL,
  ar_adr_increment_types_id int8 NULL,
  CONSTRAINT ar_adr_increments_pkey PRIMARY KEY (id),
  CONSTRAINT ar_adr_increments_applied_fkey FOREIGN KEY (ar_adrs_applied_id) REFERENCES archrep.ar_adrs_applied (id) ON DELETE CASCADE,
  CONSTRAINT ar_adr_increments_type_fkey FOREIGN KEY (ar_adr_increment_types_id) REFERENCES archrep.ar_adr_increment_types (id)
);
COMMENT ON TABLE archrep.ar_adr_increments IS 'Инкременты прикладного решения (временные и целевые)';
CREATE INDEX IF NOT EXISTS ar_adr_increments_applied_idx ON archrep.ar_adr_increments (ar_adrs_applied_id);

-- 7. Переименование справочников (статус системы/интеграции в инкременте)
ALTER TABLE IF EXISTS archrep.ar_adr_system_statuses RENAME TO ar_adr_increment_system_statuses;
ALTER TABLE IF EXISTS archrep.ar_adr_relation_statuses RENAME TO ar_adr_increment_relation_statuses;

-- 8. Удаление старых таблиц (связи с ar_adrs)
DROP TABLE IF EXISTS archrep.ar_adr_systems CASCADE;
DROP TABLE IF EXISTS archrep.ar_adr_relation CASCADE;
DROP TABLE IF EXISTS archrep.ar_adrs CASCADE;
DROP SEQUENCE IF EXISTS archrep.ar_adrs_number_seq CASCADE;

-- 9. Таблица систем в инкременте
CREATE TABLE IF NOT EXISTS archrep.ar_adr_increment_systems (
  id bigserial NOT NULL,
  ar_adr_increment_id int8 NOT NULL,
  ar_systems_id int8 NOT NULL,
  ar_adr_increment_system_statuses_id int8 NULL,
  comment varchar NULL,
  CONSTRAINT ar_adr_increment_systems_pkey PRIMARY KEY (id),
  CONSTRAINT ar_adr_increment_systems_increment_fkey FOREIGN KEY (ar_adr_increment_id) REFERENCES archrep.ar_adr_increments (id) ON DELETE CASCADE,
  CONSTRAINT ar_adr_increment_systems_system_fkey FOREIGN KEY (ar_systems_id) REFERENCES archrep.ar_systems (id) ON DELETE CASCADE,
  CONSTRAINT ar_adr_increment_systems_status_fkey FOREIGN KEY (ar_adr_increment_system_statuses_id) REFERENCES archrep.ar_adr_increment_system_statuses (id),
  CONSTRAINT ar_adr_increment_systems_uniq UNIQUE (ar_adr_increment_id, ar_systems_id)
);
COMMENT ON TABLE archrep.ar_adr_increment_systems IS 'Системы в инкременте прикладного решения';
CREATE INDEX IF NOT EXISTS ar_adr_increment_systems_increment_idx ON archrep.ar_adr_increment_systems (ar_adr_increment_id);

-- 10. Таблица интеграций в инкременте
CREATE TABLE IF NOT EXISTS archrep.ar_adr_increment_relations (
  id bigserial NOT NULL,
  ar_adr_increment_id int8 NOT NULL,
  from_ar_systems_id int8 NULL,
  to_ar_systems_id int8 NULL,
  name varchar NULL,
  description varchar NULL,
  ar_adr_increment_relation_statuses_id int8 NULL,
  CONSTRAINT ar_adr_increment_relations_pkey PRIMARY KEY (id),
  CONSTRAINT ar_adr_increment_relations_increment_fkey FOREIGN KEY (ar_adr_increment_id) REFERENCES archrep.ar_adr_increments (id) ON DELETE CASCADE,
  CONSTRAINT ar_adr_increment_relations_from_fkey FOREIGN KEY (from_ar_systems_id) REFERENCES archrep.ar_systems (id) ON DELETE SET NULL,
  CONSTRAINT ar_adr_increment_relations_to_fkey FOREIGN KEY (to_ar_systems_id) REFERENCES archrep.ar_systems (id) ON DELETE SET NULL,
  CONSTRAINT ar_adr_increment_relations_status_fkey FOREIGN KEY (ar_adr_increment_relation_statuses_id) REFERENCES archrep.ar_adr_increment_relation_statuses (id)
);
COMMENT ON TABLE archrep.ar_adr_increment_relations IS 'Интеграции в инкременте прикладного решения';
CREATE INDEX IF NOT EXISTS ar_adr_increment_relations_increment_idx ON archrep.ar_adr_increment_relations (ar_adr_increment_id);

COMMIT;
