-- Архитектурные решения (ADR). Схема archrep (для archrep_test замените archrep на archrep_test).
-- Запуск: psql -f DB/schema/archrep_adr.sql

CREATE SCHEMA IF NOT EXISTS archrep;

-- Справочник статусов системы в решении
CREATE TABLE IF NOT EXISTS archrep.ar_adr_system_statuses (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description varchar NULL,
  CONSTRAINT ar_adr_system_statuses_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_adr_system_statuses IS 'Статус системы в рамках архитектурного решения';
COMMENT ON COLUMN archrep.ar_adr_system_statuses.name IS 'Наименование';
COMMENT ON COLUMN archrep.ar_adr_system_statuses.description IS 'Описание';

-- Справочник статусов интеграции в решении
CREATE TABLE IF NOT EXISTS archrep.ar_adr_relation_statuses (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description varchar NULL,
  CONSTRAINT ar_adr_relation_statuses_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_adr_relation_statuses IS 'Статус интеграции в рамках архитектурного решения';
COMMENT ON COLUMN archrep.ar_adr_relation_statuses.name IS 'Наименование';
COMMENT ON COLUMN archrep.ar_adr_relation_statuses.description IS 'Описание';

-- Последовательность для автонумерации решений
CREATE SEQUENCE IF NOT EXISTS archrep.ar_adrs_number_seq START WITH 1 INCREMENT BY 1;

-- Реестр архитектурных решений
CREATE TABLE IF NOT EXISTS archrep.ar_adrs (
  id bigserial NOT NULL,
  number integer NOT NULL DEFAULT nextval('archrep.ar_adrs_number_seq'::regclass),
  name varchar NOT NULL,
  description varchar NULL,
  context varchar NULL,
  decision varchar NULL,
  consequences varchar NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  CONSTRAINT ar_adrs_pkey PRIMARY KEY (id),
  CONSTRAINT ar_adrs_number_key UNIQUE (number)
);
COMMENT ON TABLE archrep.ar_adrs IS 'Реестр архитектурных решений';
COMMENT ON COLUMN archrep.ar_adrs.number IS 'Номер решения (автонумерация)';
COMMENT ON COLUMN archrep.ar_adrs.name IS 'Наименование решения';
COMMENT ON COLUMN archrep.ar_adrs.description IS 'Краткое описание';
COMMENT ON COLUMN archrep.ar_adrs.context IS 'Контекст';
COMMENT ON COLUMN archrep.ar_adrs.decision IS 'Решение';
COMMENT ON COLUMN archrep.ar_adrs.consequences IS 'Последствия';

CREATE INDEX IF NOT EXISTS ar_adrs_name_idx ON archrep.ar_adrs (name);
CREATE INDEX IF NOT EXISTS ar_adrs_number_idx ON archrep.ar_adrs (number);

-- Системы, участвующие в решении
CREATE TABLE IF NOT EXISTS archrep.ar_adr_systems (
  id bigserial NOT NULL,
  ar_adrs_id int8 NOT NULL,
  ar_systems_id int8 NOT NULL,
  ar_adr_system_statuses_id int8 NULL,
  comment varchar NULL,
  CONSTRAINT ar_adr_systems_pkey PRIMARY KEY (id),
  CONSTRAINT ar_adr_systems_ar_adrs_fkey FOREIGN KEY (ar_adrs_id) REFERENCES archrep.ar_adrs (id) ON DELETE CASCADE,
  CONSTRAINT ar_adr_systems_ar_systems_fkey FOREIGN KEY (ar_systems_id) REFERENCES archrep.ar_systems (id) ON DELETE CASCADE,
  CONSTRAINT ar_adr_systems_status_fkey FOREIGN KEY (ar_adr_system_statuses_id) REFERENCES archrep.ar_adr_system_statuses (id),
  CONSTRAINT ar_adr_systems_uniq UNIQUE (ar_adrs_id, ar_systems_id)
);
COMMENT ON TABLE archrep.ar_adr_systems IS 'Системы, участвующие в архитектурном решении';
COMMENT ON COLUMN archrep.ar_adr_systems.ar_adrs_id IS 'Архитектурное решение';
COMMENT ON COLUMN archrep.ar_adr_systems.ar_systems_id IS 'Система';
COMMENT ON COLUMN archrep.ar_adr_systems.ar_adr_system_statuses_id IS 'Статус участия';
COMMENT ON COLUMN archrep.ar_adr_systems.comment IS 'Примечание / роль';

CREATE INDEX IF NOT EXISTS ar_adr_systems_adr_idx ON archrep.ar_adr_systems (ar_adrs_id);
CREATE INDEX IF NOT EXISTS ar_adr_systems_system_idx ON archrep.ar_adr_systems (ar_systems_id);

-- Интеграции, участвующие в реализации решения
CREATE TABLE IF NOT EXISTS archrep.ar_adr_relation (
  id bigserial NOT NULL,
  ar_adrs_id int8 NOT NULL,
  from_ar_systems_id int8 NULL,
  to_ar_systems_id int8 NULL,
  name varchar NULL,
  description varchar NULL,
  ar_adr_relation_statuses_id int8 NULL,
  CONSTRAINT ar_adr_relation_pkey PRIMARY KEY (id),
  CONSTRAINT ar_adr_relation_ar_adrs_fkey FOREIGN KEY (ar_adrs_id) REFERENCES archrep.ar_adrs (id) ON DELETE CASCADE,
  CONSTRAINT ar_adr_relation_from_fkey FOREIGN KEY (from_ar_systems_id) REFERENCES archrep.ar_systems (id) ON DELETE SET NULL,
  CONSTRAINT ar_adr_relation_to_fkey FOREIGN KEY (to_ar_systems_id) REFERENCES archrep.ar_systems (id) ON DELETE SET NULL,
  CONSTRAINT ar_adr_relation_status_fkey FOREIGN KEY (ar_adr_relation_statuses_id) REFERENCES archrep.ar_adr_relation_statuses (id)
);
COMMENT ON TABLE archrep.ar_adr_relation IS 'Интеграции для реализации архитектурного решения';
COMMENT ON COLUMN archrep.ar_adr_relation.from_ar_systems_id IS 'Система-источник';
COMMENT ON COLUMN archrep.ar_adr_relation.to_ar_systems_id IS 'Система-приёмник';
COMMENT ON COLUMN archrep.ar_adr_relation.name IS 'Наименование интеграции';
COMMENT ON COLUMN archrep.ar_adr_relation.description IS 'Описание';
COMMENT ON COLUMN archrep.ar_adr_relation.ar_adr_relation_statuses_id IS 'Статус интеграции';

CREATE INDEX IF NOT EXISTS ar_adr_relation_adr_idx ON archrep.ar_adr_relation (ar_adrs_id);

-- Начальные значения справочников (идемпотентно)
INSERT INTO archrep.ar_adr_system_statuses (name, description)
SELECT * FROM (VALUES ('Участник', 'Система участвует в реализации решения'), ('Затрагиваемая', 'Система затрагивается решением')) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_adr_system_statuses LIMIT 1);

INSERT INTO archrep.ar_adr_relation_statuses (name, description)
SELECT * FROM (VALUES ('Запланирована', 'Интеграция запланирована'), ('В реализации', 'В процессе реализации'), ('Реализована', 'Интеграция реализована')) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_adr_relation_statuses LIMIT 1);
