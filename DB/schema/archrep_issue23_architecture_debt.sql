-- Issue #23: реестр архитектурного долга.
-- Выполнять после archrep_adr_v2.sql и archrep_togaf_metamodel.sql (ar_adr_statuses, ar_metamodel_*).
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_issue23_architecture_debt.sql

BEGIN;

-- 1. Справочник типов архитектурного долга
CREATE TABLE IF NOT EXISTS archrep.ar_gap_types (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_gap_types_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_gap_types IS 'Тип архитектурного долга (отклонение, исключение)';

INSERT INTO archrep.ar_gap_types (name, description)
SELECT * FROM (VALUES
  ('Архитектурное отклонение', 'Отклонение от целевой архитектуры'),
  ('Архитектурное исключение', 'Временное исключение из правил')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_gap_types LIMIT 1);

-- 2. Справочник степеней влияния
CREATE TABLE IF NOT EXISTS archrep.ar_impact_level_types (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_impact_level_types_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_impact_level_types IS 'Степень влияния архитектурного долга';

INSERT INTO archrep.ar_impact_level_types (name, description)
SELECT * FROM (VALUES
  ('Критический', 'Критическое влияние'),
  ('Высокий', 'Высокая степень влияния'),
  ('Средний', 'Средняя степень влияния'),
  ('Низкий', 'Низкая степень влияния')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_impact_level_types LIMIT 1);

-- 3. Справочник состояний разрыва (арх.долга)
CREATE TABLE IF NOT EXISTS archrep.ar_gap_states (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_gap_states_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_gap_states IS 'Состояние разрыва / архитектурного долга';

INSERT INTO archrep.ar_gap_states (name, description)
SELECT * FROM (VALUES
  ('Выявлен', 'Долг выявлен'),
  ('Запланирован', 'Запланировано устранение'),
  ('В работе', 'В процессе устранения'),
  ('Закрыт', 'Устранён')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_gap_states LIMIT 1);

-- 4. Последовательность для кода записей долга
CREATE SEQUENCE IF NOT EXISTS archrep.ar_gaps_code_seq START WITH 1 INCREMENT BY 1;

-- 5. Реестр архитектурного долга (основная таблица)
CREATE TABLE IF NOT EXISTS archrep.ar_gaps (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  consequences text NULL,
  ar_impact_level_types_id int8 NULL,
  remediation_effort varchar NULL,
  target_date date NULL,
  ar_gap_states_id int8 NULL,
  resolved_date date NULL,
  ar_adr_statuses_id int8 NULL,
  ar_gap_types_id int8 NULL,
  source varchar NULL,
  responsible_person varchar NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  CONSTRAINT ar_gaps_pkey PRIMARY KEY (id),
  CONSTRAINT ar_gaps_code_key UNIQUE (code),
  CONSTRAINT ar_gaps_impact_fkey FOREIGN KEY (ar_impact_level_types_id) REFERENCES archrep.ar_impact_level_types (id) ON DELETE SET NULL,
  CONSTRAINT ar_gaps_state_fkey FOREIGN KEY (ar_gap_states_id) REFERENCES archrep.ar_gap_states (id) ON DELETE SET NULL,
  CONSTRAINT ar_gaps_adr_status_fkey FOREIGN KEY (ar_adr_statuses_id) REFERENCES archrep.ar_adr_statuses (id) ON DELETE SET NULL,
  CONSTRAINT ar_gaps_type_fkey FOREIGN KEY (ar_gap_types_id) REFERENCES archrep.ar_gap_types (id) ON DELETE SET NULL
);
COMMENT ON TABLE archrep.ar_gaps IS 'Реестр архитектурного долга (разрывы, отклонения)';

CREATE INDEX IF NOT EXISTS ar_gaps_code_idx ON archrep.ar_gaps (code);
CREATE INDEX IF NOT EXISTS ar_gaps_state_idx ON archrep.ar_gaps (ar_gap_states_id);
CREATE INDEX IF NOT EXISTS ar_gaps_impact_idx ON archrep.ar_gaps (ar_impact_level_types_id);
CREATE INDEX IF NOT EXISTS ar_gaps_type_idx ON archrep.ar_gaps (ar_gap_types_id);
CREATE INDEX IF NOT EXISTS ar_gaps_target_date_idx ON archrep.ar_gaps (target_date);

-- 6. Тип сущности gap в метамодели
INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'gap', 'Архитектурный долг', 'ar_gaps', 'Запись реестра архитектурного долга'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'gap');

-- 7. Типы связей для долга (gap → другие сущности)
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description)
SELECT 'gap_affects', 'Влияет на', 'Архитектурный долг влияет на сущность (систему, технологию и т.д.)'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_relation_types WHERE code = 'gap_affects');

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description)
SELECT 'related_to', 'Связан с', 'Связь долга с другой сущностью'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_relation_types WHERE code = 'related_to');

COMMIT;
