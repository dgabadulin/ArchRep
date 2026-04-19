-- Начальные данные для справочников реестра интеграций (задача #10).
-- Запускать, если таблицы уже есть, но пустые. Идемпотентно: вставка только при отсутствии записей.
-- psql -h ... -U ... -d ... -f DB/schema/archrep_integration_flows_seed.sql

BEGIN;

-- Типы инициирующего события
INSERT INTO archrep.ar_integration_flow_event_types (name, description)
SELECT v.name, v.description
FROM (VALUES
  ('По событию', 'Инициируется по наступлению события'),
  ('По расписанию', 'Инициируется по расписанию')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_integration_flow_event_types LIMIT 1);

-- Статусы интеграционных потоков
INSERT INTO archrep.ar_integration_flow_statuses (name, description)
SELECT v.name, v.description
FROM (VALUES
  ('планируется к реализации', NULL),
  ('в процессе реализации', NULL),
  ('в промышленной эксплуатации', NULL),
  ('исключена', NULL),
  ('реализация отменена', NULL)
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_integration_flow_statuses LIMIT 1);

COMMIT;
