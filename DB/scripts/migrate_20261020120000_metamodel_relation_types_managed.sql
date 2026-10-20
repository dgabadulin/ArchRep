-- «Проекционные» типы связей метамодели (issue #81, продолжение).
-- Связи, которые создаются/поддерживаются триггерами из реляционной модели или другой формой
-- (стек технологий на карточке ИС). Ручное создание/правка/удаление из формы связей запрещены.

ALTER TABLE archrep.ar_metamodel_relation_types
  ADD COLUMN IF NOT EXISTS managed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN archrep.ar_metamodel_relation_types.managed IS
  'Связь создаётся и поддерживается вне формы связей: триггером из реляционной модели (проекция) или карточкой-источником (system_technology). Ручное создание/правка/удаление запрещены.';

-- 1) Убираем дубль кода: направление «модуль → функция ИС» получает собственный код
--    (см. migrate_20260504120000_section32_metamodel_types_and_fk_projections.sql — там дубль сделан намеренно).
UPDATE archrep.ar_metamodel_relation_types rt
   SET code = 'subsystem_system_function'
  FROM archrep.ar_metamodel_entity_types f, archrep.ar_metamodel_entity_types t
 WHERE rt.code = 'system_system_function'
   AND f.code = 'subsystem'
   AND t.code = 'system_function'
   AND rt.from_entity_type_id = f.id
   AND rt.to_entity_type_id = t.id
   AND NOT EXISTS (
     SELECT 1 FROM archrep.ar_metamodel_relation_types x
      WHERE x.code = 'subsystem_system_function'
        AND x.from_entity_type_id = f.id
        AND x.to_entity_type_id = t.id
   );

UPDATE archrep.ar_metamodel_relations
   SET relation_type = 'subsystem_system_function'
 WHERE relation_type = 'system_system_function'
   AND from_entity_type = 'subsystem';

-- 2) Сид «управляется автоматически» (идемпотентно).
UPDATE archrep.ar_metamodel_relation_types SET managed = true
 WHERE code IN (
   'system_module',
   'integration_flow',
   'integration_flow_system_module',
   'integration_flow_module_system',
   'integration_flow_module_module',
   'system_it_lead', 'subsystem_it_lead',
   'system_business_lead', 'subsystem_business_lead',
   'system_partner_vendor', 'system_partner_implementer', 'system_partner_supporter',
   'subsystem_partner_vendor', 'subsystem_partner_implementer', 'subsystem_partner_supporter',
   'technology_partner_vendor',
   'system_system_function', 'subsystem_system_function',
   'organization_unit_business_service', 'organization_unit_business_function',
   'system_web_resource', 'subsystem_web_resource', 'web_resource_domain',
   'certificate_domain', 'certificate_employee_responsible',
   'system_technology', 'module_technology'
 );

-- Триггер функции ИС: код типа связи теперь зависит от направления (system|subsystem),
-- как у остальных пар (`system_it_lead` / `subsystem_it_lead` и т.п.).
CREATE OR REPLACE FUNCTION archrep.sync_ar_system_functions_parent_metamodel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  from_t text;
  sid bigint;
  v_code text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
     WHERE r.relation_type IN ('system_system_function', 'subsystem_system_function')
       AND r.to_entity_type = 'system_function'
       AND r.to_entity_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
   WHERE r.relation_type IN ('system_system_function', 'subsystem_system_function')
     AND r.to_entity_type = 'system_function'
     AND r.to_entity_id = NEW.id;

  SELECT s.parent_ar_systems_id INTO sid
    FROM archrep.ar_systems s
   WHERE s.id = NEW.ar_systems_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  from_t := CASE WHEN sid IS NULL THEN 'system' ELSE 'subsystem' END;
  v_code := CASE WHEN sid IS NULL THEN 'system_system_function' ELSE 'subsystem_system_function' END;

  INSERT INTO archrep.ar_metamodel_relations (
    from_entity_type, from_entity_id, to_entity_type, to_entity_id,
    relation_type, name, description, payload, displayed_name, reference_to_baserow
  ) VALUES (
    from_t, NEW.ar_systems_id, 'system_function', NEW.id,
    v_code, '', '', NULL, NULL, NULL
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION archrep.sync_ar_system_functions_parent_metamodel() IS
  'Проекция ar_system_functions.ar_systems_id → ar_metamodel_relations: system_system_function (корневая ИС) / subsystem_system_function (модуль); managed = true.';

