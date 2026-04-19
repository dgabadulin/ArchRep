-- Миграция: метамодель TOGAF и бизнес-сущности (задача #14).
-- Схема archrep. Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_togaf_metamodel.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS archrep;

-- 1. Типы сущностей метамодели
CREATE TABLE IF NOT EXISTS archrep.ar_metamodel_entity_types (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  table_name varchar NULL,
  description text NULL,
  CONSTRAINT ar_metamodel_entity_types_pkey PRIMARY KEY (id),
  CONSTRAINT ar_metamodel_entity_types_code_key UNIQUE (code)
);
COMMENT ON TABLE archrep.ar_metamodel_entity_types IS 'Типы сущностей метамодели TOGAF';

INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT * FROM (VALUES
  ('system', 'Информационная система', 'ar_systems', 'Application Component'),
  ('technology', 'Технология', 'ar_technologies', 'Technology Component'),
  ('organization_unit', 'Организационная единица', 'ar_organization_units', NULL),
  ('actor', 'Актор', 'ar_actors', NULL),
  ('business_service', 'Бизнес-сервис (продукт)', 'ar_business_services', NULL),
  ('business_function', 'Бизнес-функция', 'ar_business_functions', NULL),
  ('principle', 'Принцип', 'ar_principles', NULL)
) AS v(code, name, table_name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types LIMIT 1);

-- 2. Типы связей метамодели
CREATE TABLE IF NOT EXISTS archrep.ar_metamodel_relation_types (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  from_entity_types varchar[] NULL,
  to_entity_types varchar[] NULL,
  CONSTRAINT ar_metamodel_relation_types_pkey PRIMARY KEY (id),
  CONSTRAINT ar_metamodel_relation_types_code_key UNIQUE (code)
);
COMMENT ON TABLE archrep.ar_metamodel_relation_types IS 'Типы связей метамодели TOGAF';

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description)
SELECT * FROM (VALUES
  ('realizes', 'Реализует', 'Бизнес-сервис реализуется приложением'),
  ('serves', 'Обслуживает', 'Приложение обслуживает сервис'),
  ('implements', 'Реализует', 'Реализация требования/решения'),
  ('composed_of', 'Включает', 'Состоит из'),
  ('assigned_to', 'Назначено', 'Назначено организации/роли'),
  ('depends_on', 'Зависит от', 'Зависимость'),
  ('manages', 'Управляет', 'Управляет сущностью'),
  ('owns', 'Владеет', 'Владелец')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_relation_types LIMIT 1);

-- 3. Универсальная таблица связей
CREATE TABLE IF NOT EXISTS archrep.ar_metamodel_relations (
  id bigserial NOT NULL,
  from_entity_type varchar NOT NULL,
  from_entity_id int8 NOT NULL,
  to_entity_type varchar NOT NULL,
  to_entity_id int8 NOT NULL,
  relation_type varchar NOT NULL,
  name varchar NULL,
  description text NULL,
  payload jsonb NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  CONSTRAINT ar_metamodel_relations_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_metamodel_relations IS 'Связи между объектами метамодели TOGAF';
CREATE INDEX IF NOT EXISTS ar_metamodel_relations_from_idx ON archrep.ar_metamodel_relations (from_entity_type, from_entity_id);
CREATE INDEX IF NOT EXISTS ar_metamodel_relations_to_idx ON archrep.ar_metamodel_relations (to_entity_type, to_entity_id);
CREATE INDEX IF NOT EXISTS ar_metamodel_relations_type_idx ON archrep.ar_metamodel_relations (relation_type);

-- 4. Справочник категорий организационных единиц
CREATE TABLE IF NOT EXISTS archrep.ar_organization_unit_categories (
  id bigserial NOT NULL,
  code varchar NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_organization_unit_categories_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_organization_unit_categories IS 'Категории организационных единиц (департамент, дирекция и т.д.)';

INSERT INTO archrep.ar_organization_unit_categories (code, name, description)
SELECT * FROM (VALUES
  ('dept', 'Департамент', NULL),
  ('dir', 'Дирекция', NULL),
  ('otdel', 'Отдел', NULL),
  ('other', 'Иное', NULL)
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_organization_unit_categories LIMIT 1);

-- 5. Справочник типов акторов
CREATE TABLE IF NOT EXISTS archrep.ar_actor_types (
  id bigserial NOT NULL,
  code varchar NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_actor_types_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_actor_types IS 'Типы акторов (внутренний, внешний, система)';

INSERT INTO archrep.ar_actor_types (code, name, description)
SELECT * FROM (VALUES
  ('internal', 'Внутренний', 'Сотрудник, подразделение'),
  ('external', 'Внешний', 'Партнёр, клиент'),
  ('system', 'Система', 'Внешняя или внутренняя система')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_actor_types LIMIT 1);

-- 6. Справочник статусов бизнес-сервисов
CREATE TABLE IF NOT EXISTS archrep.ar_business_service_statuses (
  id bigserial NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_business_service_statuses_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE archrep.ar_business_service_statuses IS 'Статусы бизнес-сервисов (продуктов)';

INSERT INTO archrep.ar_business_service_statuses (name, description)
SELECT * FROM (VALUES
  ('Разработка', NULL),
  ('В эксплуатации', NULL),
  ('Выведен', NULL)
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_business_service_statuses LIMIT 1);

-- 7. Организационные единицы
CREATE TABLE IF NOT EXISTS archrep.ar_organization_units (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  fullname varchar NULL,
  parent_id int8 NULL,
  description text NULL,
  leader varchar NULL,
  organization_unit_categories_id int8 NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  CONSTRAINT ar_organization_units_pkey PRIMARY KEY (id),
  CONSTRAINT ar_organization_units_code_key UNIQUE (code),
  CONSTRAINT ar_organization_units_parent_fkey FOREIGN KEY (parent_id) REFERENCES archrep.ar_organization_units (id) ON DELETE SET NULL,
  CONSTRAINT ar_organization_units_category_fkey FOREIGN KEY (organization_unit_categories_id) REFERENCES archrep.ar_organization_unit_categories (id) ON DELETE SET NULL
);
COMMENT ON TABLE archrep.ar_organization_units IS 'Организационные единицы (TOGAF)';
CREATE INDEX IF NOT EXISTS ar_organization_units_parent_idx ON archrep.ar_organization_units (parent_id);
CREATE INDEX IF NOT EXISTS ar_organization_units_category_idx ON archrep.ar_organization_units (organization_unit_categories_id);

-- 8. Акторы
CREATE TABLE IF NOT EXISTS archrep.ar_actors (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  organization_unit_id int8 NULL,
  actor_type_id int8 NULL,
  source varchar NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  CONSTRAINT ar_actors_pkey PRIMARY KEY (id),
  CONSTRAINT ar_actors_code_key UNIQUE (code),
  CONSTRAINT ar_actors_org_fkey FOREIGN KEY (organization_unit_id) REFERENCES archrep.ar_organization_units (id) ON DELETE SET NULL,
  CONSTRAINT ar_actors_type_fkey FOREIGN KEY (actor_type_id) REFERENCES archrep.ar_actor_types (id) ON DELETE SET NULL
);
COMMENT ON TABLE archrep.ar_actors IS 'Акторы/роли (TOGAF)';
CREATE INDEX IF NOT EXISTS ar_actors_org_idx ON archrep.ar_actors (organization_unit_id);
CREATE INDEX IF NOT EXISTS ar_actors_type_idx ON archrep.ar_actors (actor_type_id);

-- 9. Бизнес-сервисы (продукты)
CREATE TABLE IF NOT EXISTS archrep.ar_business_services (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  fullname varchar NULL,
  description text NULL,
  ar_organization_units_id int8 NULL,
  ar_business_service_statuses_id int8 NULL,
  source varchar NULL,
  category varchar NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  CONSTRAINT ar_business_services_pkey PRIMARY KEY (id),
  CONSTRAINT ar_business_services_code_key UNIQUE (code),
  CONSTRAINT ar_business_services_owner_fkey FOREIGN KEY (ar_organization_units_id) REFERENCES archrep.ar_organization_units (id) ON DELETE SET NULL,
  CONSTRAINT ar_business_services_status_fkey FOREIGN KEY (ar_business_service_statuses_id) REFERENCES archrep.ar_business_service_statuses (id) ON DELETE SET NULL
);
COMMENT ON TABLE archrep.ar_business_services IS 'Бизнес-сервисы / продукты компании (TOGAF)';
CREATE INDEX IF NOT EXISTS ar_business_services_owner_idx ON archrep.ar_business_services (ar_organization_units_id);
CREATE INDEX IF NOT EXISTS ar_business_services_status_idx ON archrep.ar_business_services (ar_business_service_statuses_id);

-- 10. Бизнес-функции
CREATE TABLE IF NOT EXISTS archrep.ar_business_functions (
  id bigserial NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  parent_id int8 NULL,
  ar_organization_units_id int8 NULL,
  source varchar NULL,
  category varchar NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp,
  CONSTRAINT ar_business_functions_pkey PRIMARY KEY (id),
  CONSTRAINT ar_business_functions_code_key UNIQUE (code),
  CONSTRAINT ar_business_functions_parent_fkey FOREIGN KEY (parent_id) REFERENCES archrep.ar_business_functions (id) ON DELETE SET NULL,
  CONSTRAINT ar_business_functions_owner_fkey FOREIGN KEY (ar_organization_units_id) REFERENCES archrep.ar_organization_units (id) ON DELETE SET NULL
);
COMMENT ON TABLE archrep.ar_business_functions IS 'Бизнес-функции / способности (TOGAF)';
CREATE INDEX IF NOT EXISTS ar_business_functions_parent_idx ON archrep.ar_business_functions (parent_id);
CREATE INDEX IF NOT EXISTS ar_business_functions_owner_idx ON archrep.ar_business_functions (ar_organization_units_id);

COMMIT;
