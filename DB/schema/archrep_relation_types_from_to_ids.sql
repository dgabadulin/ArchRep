-- Типы связей метамодели: одна строка = одна пара (code, from_entity_type_id, to_entity_type_id).
-- Поля from_entity_type_id, to_entity_type_id с FK на ar_metamodel_entity_types(id).
-- Если нужно очистить таблицу — раскомментируйте TRUNCATE ниже.
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_relation_types_from_to_ids.sql

BEGIN;

-- Опционально: очистить таблицу (раскомментируйте, если данные не нужны)
-- TRUNCATE TABLE archrep.ar_metamodel_relation_types;

-- Удаляем старые колонки и ограничение уникальности по code
ALTER TABLE archrep.ar_metamodel_relation_types
  DROP COLUMN IF EXISTS from_entity_types,
  DROP COLUMN IF EXISTS to_entity_types;

ALTER TABLE archrep.ar_metamodel_relation_types
  DROP CONSTRAINT IF EXISTS ar_metamodel_relation_types_code_key;

-- Добавляем колонки nullable, чтобы не падать на существующих строках
ALTER TABLE archrep.ar_metamodel_relation_types
  ADD COLUMN IF NOT EXISTS from_entity_type_id int8,
  ADD COLUMN IF NOT EXISTS to_entity_type_id int8;

-- Заполняем существующие строки: берём первый тип сущности как временное значение (потом поправите вручную)
UPDATE archrep.ar_metamodel_relation_types r
SET
  from_entity_type_id = COALESCE(r.from_entity_type_id, (SELECT id FROM archrep.ar_metamodel_entity_types ORDER BY id LIMIT 1)),
  to_entity_type_id   = COALESCE(r.to_entity_type_id,   (SELECT id FROM archrep.ar_metamodel_entity_types ORDER BY id LIMIT 1))
WHERE r.from_entity_type_id IS NULL OR r.to_entity_type_id IS NULL;

-- Теперь можно требовать NOT NULL
ALTER TABLE archrep.ar_metamodel_relation_types
  ALTER COLUMN from_entity_type_id SET NOT NULL,
  ALTER COLUMN to_entity_type_id SET NOT NULL;

ALTER TABLE archrep.ar_metamodel_relation_types
  ADD CONSTRAINT ar_metamodel_relation_types_from_fkey
    FOREIGN KEY (from_entity_type_id) REFERENCES archrep.ar_metamodel_entity_types(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ar_metamodel_relation_types_to_fkey
    FOREIGN KEY (to_entity_type_id) REFERENCES archrep.ar_metamodel_entity_types(id) ON DELETE RESTRICT;

-- Уникальность: одна пара (code, from, to) — одна строка
ALTER TABLE archrep.ar_metamodel_relation_types
  ADD CONSTRAINT ar_metamodel_relation_types_code_from_to_key
    UNIQUE (code, from_entity_type_id, to_entity_type_id);

CREATE INDEX IF NOT EXISTS ar_metamodel_relation_types_from_idx
  ON archrep.ar_metamodel_relation_types (from_entity_type_id);
CREATE INDEX IF NOT EXISTS ar_metamodel_relation_types_to_idx
  ON archrep.ar_metamodel_relation_types (to_entity_type_id);

COMMENT ON COLUMN archrep.ar_metamodel_relation_types.from_entity_type_id IS 'Тип сущности «от» (FK в ar_metamodel_entity_types)';
COMMENT ON COLUMN archrep.ar_metamodel_relation_types.to_entity_type_id IS 'Тип сущности «к» (FK в ar_metamodel_entity_types)';

COMMIT;
