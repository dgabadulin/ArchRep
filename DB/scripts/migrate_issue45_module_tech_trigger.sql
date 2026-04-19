-- Issue #45: параметр MODULE_TECH_STACK_RELATION_CODE, разовый перенос tech-связей модулей на module_technology + subsystem,
-- триггер на archrep.ar_systems: при смене parent_ar_systems_id нормализовать строки ar_metamodel_relations (→ technology).
--
-- Требуется: ar_settings_parameters, ar_metamodel_relations, ar_metamodel_entity_types (system, subsystem, technology).
-- Тип связи module_technology (subsystem → technology) — создаётся скриптом, если ещё нет.
-- Резервная копия БД. После выполнения: перезапуск backend (кэш параметров).

BEGIN;

-- 1. Параметр для кода типа связи «модуль — технология»
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT
  'MODULE_TECH_STACK_RELATION_CODE',
  'Код типа связи метамодели для стека технологий модуля ИС (parent_ar_systems_id IS NOT NULL)',
  'module_technology',
  'string',
  'Метамодель',
  false,
  false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'MODULE_TECH_STACK_RELATION_CODE');

-- 2. Тип связи module_technology (subsystem → technology), если ещё не заведён
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT
  'module_technology',
  'Использует технологию (модуль)',
  'Связь модуля ИС с элементом технологического стека',
  fs.id,
  ts.id
FROM archrep.ar_metamodel_entity_types fs
CROSS JOIN archrep.ar_metamodel_entity_types ts
WHERE fs.code = 'subsystem'
  AND ts.code = 'technology'
  AND NOT EXISTS (
    SELECT 1
    FROM archrep.ar_metamodel_relation_types rt
    WHERE rt.code = 'module_technology'
      AND rt.from_entity_type_id = fs.id
      AND rt.to_entity_type_id = ts.id
  );

-- 3. Разовое исправление: у модулей связи с технологиями с кодом «корневой ИС» → module_technology + subsystem
DO $fix$
DECLARE
  v_sys text;
  v_mod text;
BEGIN
  SELECT trim(both from value) INTO v_sys FROM archrep.ar_settings_parameters WHERE code = 'SYS_TECH_STACK_RELATION_CODE' LIMIT 1;
  SELECT trim(both from value) INTO v_mod FROM archrep.ar_settings_parameters WHERE code = 'MODULE_TECH_STACK_RELATION_CODE' LIMIT 1;
  v_sys := COALESCE(NULLIF(v_sys, ''), 'system_technology');
  v_mod := COALESCE(NULLIF(v_mod, ''), 'module_technology');

  UPDATE archrep.ar_metamodel_relations r
  SET from_entity_type = 'subsystem',
      relation_type = v_mod,
      updated_at = current_timestamp
  FROM archrep.ar_systems s
  WHERE r.from_entity_id = s.id
    AND s.parent_ar_systems_id IS NOT NULL
    AND r.to_entity_type = 'technology'
    AND r.relation_type = v_sys;
END
$fix$;

-- 4. Функция триггера: при смене родителя переключить tech-связи этого ar_systems.id
CREATE OR REPLACE FUNCTION archrep.sync_tech_stack_relations_on_parent_change()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_sys text;
  v_mod text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF OLD.parent_ar_systems_id IS NOT DISTINCT FROM NEW.parent_ar_systems_id THEN
    RETURN NEW;
  END IF;

  SELECT trim(both from value) INTO v_sys FROM archrep.ar_settings_parameters WHERE code = 'SYS_TECH_STACK_RELATION_CODE' LIMIT 1;
  SELECT trim(both from value) INTO v_mod FROM archrep.ar_settings_parameters WHERE code = 'MODULE_TECH_STACK_RELATION_CODE' LIMIT 1;
  v_sys := COALESCE(NULLIF(v_sys, ''), 'system_technology');
  v_mod := COALESCE(NULLIF(v_mod, ''), 'module_technology');

  IF NEW.parent_ar_systems_id IS NULL THEN
    UPDATE archrep.ar_metamodel_relations r
    SET from_entity_type = 'system',
        relation_type = v_sys,
        updated_at = current_timestamp
    WHERE r.from_entity_id = NEW.id
      AND r.to_entity_type = 'technology'
      AND r.relation_type IN (v_sys, v_mod);
  ELSE
    UPDATE archrep.ar_metamodel_relations r
    SET from_entity_type = 'subsystem',
        relation_type = v_mod,
        updated_at = current_timestamp
    WHERE r.from_entity_id = NEW.id
      AND r.to_entity_type = 'technology'
      AND r.relation_type IN (v_sys, v_mod);
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_systems_sync_tech_stack_on_parent ON archrep.ar_systems;
CREATE TRIGGER trg_systems_sync_tech_stack_on_parent
  AFTER UPDATE OF parent_ar_systems_id ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE FUNCTION archrep.sync_tech_stack_relations_on_parent_change();

COMMIT;
