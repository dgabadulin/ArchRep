-- Связь «ИС → организация-владелец» (issue #126).
-- 1) FK archrep.ar_systems.owner_ar_organization_units_id → ar_organization_units (ON DELETE SET NULL).
-- 2) Тип связи organization_unit → system «Владеет» (код owns_system), managed = true: строку создаёт проекция.
-- 3) Триггер-проекция: изменение FK поддерживает строку в ar_metamodel_relations.
-- Идемпотентно: ADD COLUMN IF NOT EXISTS / NOT EXISTS / DROP TRIGGER IF EXISTS.
-- После применения: перезапуск backend (кэш справочника типов связей — relationTypePolicy).

ALTER TABLE archrep.ar_systems
  ADD COLUMN IF NOT EXISTS owner_ar_organization_units_id bigint;

ALTER TABLE archrep.ar_systems
  DROP CONSTRAINT IF EXISTS ar_systems_owner_org_unit_fkey;
ALTER TABLE archrep.ar_systems
  ADD CONSTRAINT ar_systems_owner_org_unit_fkey
  FOREIGN KEY (owner_ar_organization_units_id)
  REFERENCES archrep.ar_organization_units (id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ar_systems_owner_org_unit_idx
  ON archrep.ar_systems (owner_ar_organization_units_id);

INSERT INTO archrep.ar_metamodel_relation_types
  (code, name, description, from_entity_type_id, to_entity_type_id, managed)
SELECT 'owns_system', 'Владеет',
       'Организация-владелец ИС; проекция FK ar_systems.owner_ar_organization_units_id',
       f.id, t.id, true
FROM archrep.ar_metamodel_entity_types f
CROSS JOIN archrep.ar_metamodel_entity_types t
WHERE f.code = 'organization_unit' AND t.code = 'system'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'owns_system'
      AND r.from_entity_type_id = f.id
      AND r.to_entity_type_id = t.id
  );

CREATE OR REPLACE FUNCTION archrep.sync_system_owner_org_unit_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.to_entity_type = 'system'
      AND r.to_entity_id = OLD.id
      AND r.from_entity_type = 'organization_unit'
      AND r.relation_type = 'owns_system';
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.to_entity_type = 'system'
    AND r.to_entity_id = NEW.id
    AND r.from_entity_type = 'organization_unit'
    AND r.relation_type = 'owns_system';

  IF NEW.owner_ar_organization_units_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      'organization_unit', NEW.owner_ar_organization_units_id,
      'system', NEW.id,
      'owns_system', '', '', NULL, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_systems_owner_org_unit ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_owner_org_unit
  AFTER INSERT OR UPDATE OF owner_ar_organization_units_id
  ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_system_owner_org_unit_relation();

DROP TRIGGER IF EXISTS trg_ar_systems_owner_org_unit_del ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_owner_org_unit_del
  AFTER DELETE ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_system_owner_org_unit_relation();

-- Бэкфилл для уже заполненных FK (на пустой колонке ничего не делает; повторный накат безопасен).
INSERT INTO archrep.ar_metamodel_relations (
  from_entity_type, from_entity_id, to_entity_type, to_entity_id,
  relation_type, name, description, payload, displayed_name, reference_to_baserow
)
SELECT 'organization_unit', s.owner_ar_organization_units_id, 'system', s.id,
       'owns_system', '', '', NULL, NULL, NULL
FROM archrep.ar_systems s
WHERE s.owner_ar_organization_units_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relations r
    WHERE r.from_entity_type = 'organization_unit'
      AND r.from_entity_id = s.owner_ar_organization_units_id
      AND r.to_entity_type = 'system'
      AND r.to_entity_id = s.id
      AND r.relation_type = 'owns_system'
  );

-- Версия схемы (issue #126): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261122120000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by
  WHERE archrep.ar_schema_info.version < EXCLUDED.version;
