-- Автосинхронизация связей "Модуль системы" по parent_ar_systems_id.
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_issue32_system_module_relations.sql

BEGIN;

-- 1) Создать тип связи "Модуль системы" (subsystem -> system), если его еще нет.
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT
  'system_module',
  'Модуль системы',
  'Связь формируется автоматически из ar_systems.parent_ar_systems_id',
  et_from.id,
  et_to.id
FROM archrep.ar_metamodel_entity_types et_from
JOIN archrep.ar_metamodel_entity_types et_to ON et_to.code = 'system'
WHERE et_from.code = 'subsystem'
  AND NOT EXISTS (
    SELECT 1
    FROM archrep.ar_metamodel_relation_types rt
    WHERE rt.code = 'system_module'
      AND rt.from_entity_type_id = et_from.id
      AND rt.to_entity_type_id = et_to.id
  );

-- 2) Удалить исторические дубли автосвязей (если есть), затем поставить уникальный индекс.
WITH d AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type
      ORDER BY id
    ) AS rn
  FROM archrep.ar_metamodel_relations
  WHERE relation_type = 'system_module'
    AND from_entity_type = 'subsystem'
    AND to_entity_type = 'system'
)
DELETE FROM archrep.ar_metamodel_relations r
USING d
WHERE r.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ar_metamodel_rel_system_module_uq
ON archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type)
WHERE relation_type = 'system_module'
  AND from_entity_type = 'subsystem'
  AND to_entity_type = 'system';

-- 3) Синхронизация при INSERT/UPDATE/DELETE систем.
CREATE OR REPLACE FUNCTION archrep.sync_system_module_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.relation_type = 'system_module'
      AND r.from_entity_type = 'subsystem'
      AND r.to_entity_type = 'system'
      AND (r.from_entity_id = OLD.id OR r.to_entity_id = OLD.id);
    RETURN OLD;
  END IF;

  -- Для системы всегда держим не больше одной автосвязи module.
  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'system_module'
    AND r.from_entity_type = 'subsystem'
    AND r.to_entity_type = 'system'
    AND r.from_entity_id = NEW.id;

  IF NEW.parent_ar_systems_id IS NOT NULL
     AND NEW.parent_ar_systems_id <> NEW.id THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type,
      from_entity_id,
      to_entity_type,
      to_entity_id,
      relation_type,
      name,
      description
    ) VALUES (
      'subsystem',
      NEW.id,
      'system',
      NEW.parent_ar_systems_id,
      'system_module',
      'Модуль системы',
      'Связь создана автоматически по parent_ar_systems_id'
    )
    ON CONFLICT (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type)
    WHERE relation_type = 'system_module'
      AND from_entity_type = 'subsystem'
      AND to_entity_type = 'system'
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_system_module_relation_upsert ON archrep.ar_systems;
CREATE TRIGGER trg_sync_system_module_relation_upsert
AFTER INSERT OR UPDATE OF parent_ar_systems_id ON archrep.ar_systems
FOR EACH ROW
EXECUTE FUNCTION archrep.sync_system_module_relation();

DROP TRIGGER IF EXISTS trg_sync_system_module_relation_delete ON archrep.ar_systems;
CREATE TRIGGER trg_sync_system_module_relation_delete
AFTER DELETE ON archrep.ar_systems
FOR EACH ROW
EXECUTE FUNCTION archrep.sync_system_module_relation();

-- 4) Первичная загрузка из уже существующих данных.
DELETE FROM archrep.ar_metamodel_relations r
WHERE r.relation_type = 'system_module'
  AND r.from_entity_type = 'subsystem'
  AND r.to_entity_type = 'system';

INSERT INTO archrep.ar_metamodel_relations (
  from_entity_type,
  from_entity_id,
  to_entity_type,
  to_entity_id,
  relation_type,
  name,
  description
)
SELECT
  'subsystem',
  s.id,
  'system',
  s.parent_ar_systems_id,
  'system_module',
  'Модуль системы',
  'Связь создана автоматически по parent_ar_systems_id'
FROM archrep.ar_systems s
WHERE s.parent_ar_systems_id IS NOT NULL
  AND s.parent_ar_systems_id <> s.id;

COMMIT;
