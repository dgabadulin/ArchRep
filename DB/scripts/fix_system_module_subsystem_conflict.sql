-- Фикс для ошибки:
--   there is no unique or exclusion constraint matching the ON CONFLICT specification
-- Причина: триггер sync_system_module_relation использует ON CONFLICT для
-- (from_entity_type='subsystem', to_entity_type='system'), а уникальный индекс
-- был создан для (from_entity_type='system', to_entity_type='system').
--
-- Запуск:
--   psql -h ... -U ... -d ... -f DB/scripts/fix_system_module_subsystem_conflict.sql

BEGIN;

-- 0) Убедиться, что есть тип связи subsystem -> system в справочнике relation_types.
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

-- 1) Перевести исторические system->system связи этого типа в subsystem->system.
UPDATE archrep.ar_metamodel_relations r
SET from_entity_type = 'subsystem'
WHERE r.relation_type = 'system_module'
  AND r.from_entity_type = 'system'
  AND r.to_entity_type = 'system';

-- 2) Удалить дубли для целевого ключа subsystem->system.
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

-- 3) Пересоздать правильный partial unique index под ON CONFLICT в триггере.
DROP INDEX IF EXISTS archrep.ar_metamodel_rel_system_module_uq;
CREATE UNIQUE INDEX IF NOT EXISTS ar_metamodel_rel_system_module_uq
ON archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type)
WHERE relation_type = 'system_module'
  AND from_entity_type = 'subsystem'
  AND to_entity_type = 'system';

COMMIT;

