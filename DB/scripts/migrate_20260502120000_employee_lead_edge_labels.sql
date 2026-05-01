-- Единые подписи типов связей «лид» (ИТ / владелец) и очистка displayed_name
-- у проекций system|subsystem → employee; триггер на ar_employees с шаблоном
-- DISP_EMPLOYEE_TEMPLATE для этих рёбер не используется.
-- Накатывать на БД, где уже выполнен migrate_20260501120000_ar_employees_system_leads.sql
-- в старой редакции. Идемпотентно (повторный UPDATE безопасен).

UPDATE archrep.ar_metamodel_relation_types rt
SET name = v.name,
    description = v.description
FROM (
  VALUES
    ('system_it_lead'::varchar, 'Ответственный от ИТ'::varchar, 'Ответственный от ИТ (корневая система)'::varchar),
    ('subsystem_it_lead', 'Ответственный от ИТ', 'Ответственный от ИТ (модуль)'),
    ('system_business_lead', 'Владелец системы', 'Владелец системы (корневая система)'),
    ('subsystem_business_lead', 'Владелец системы', 'Владелец системы (модуль)')
) AS v(code, name, description)
WHERE rt.code = v.code;

UPDATE archrep.ar_metamodel_relations r
SET displayed_name = NULL,
    updated_at = current_timestamp
WHERE r.from_entity_type IN ('system', 'subsystem')
  AND r.to_entity_type = 'employee'
  AND r.relation_type IN (
    'system_it_lead',
    'subsystem_it_lead',
    'system_business_lead',
    'subsystem_business_lead'
  );

DROP TRIGGER IF EXISTS trg_ar_employees_metamodel_disp ON archrep.ar_employees;

DROP FUNCTION IF EXISTS archrep.sync_employee_metamodel_displayed_names();

DROP FUNCTION IF EXISTS archrep.employee_metamodel_displayed_name(bigint);

CREATE OR REPLACE FUNCTION archrep.sync_system_employee_metamodel_relations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sys_it text;
  sub_it text;
  sys_bl text;
  sub_bl text;
  from_type text;
  it_code text;
  bl_code text;
BEGIN
  sys_it := COALESCE(
    (SELECT NULLIF(trim(value), '') FROM archrep.ar_settings_parameters WHERE code = 'SYSTEM_IT_LEAD_RELATION_CODE' LIMIT 1),
    'system_it_lead'
  );
  sub_it := COALESCE(
    (SELECT NULLIF(trim(value), '') FROM archrep.ar_settings_parameters WHERE code = 'SUBSYSTEM_IT_LEAD_RELATION_CODE' LIMIT 1),
    'subsystem_it_lead'
  );
  sys_bl := COALESCE(
    (SELECT NULLIF(trim(value), '') FROM archrep.ar_settings_parameters WHERE code = 'SYSTEM_BUSINESS_LEAD_RELATION_CODE' LIMIT 1),
    'system_business_lead'
  );
  sub_bl := COALESCE(
    (SELECT NULLIF(trim(value), '') FROM archrep.ar_settings_parameters WHERE code = 'SUBSYSTEM_BUSINESS_LEAD_RELATION_CODE' LIMIT 1),
    'subsystem_business_lead'
  );

  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.from_entity_id = OLD.id
      AND r.from_entity_type IN ('system', 'subsystem')
      AND r.to_entity_type = 'employee'
      AND r.relation_type IN (sys_it, sub_it, sys_bl, sub_bl);
    RETURN OLD;
  END IF;

  from_type := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN 'system' ELSE 'subsystem' END;
  it_code := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN sys_it ELSE sub_it END;
  bl_code := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN sys_bl ELSE sub_bl END;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_id = NEW.id
    AND r.from_entity_type IN ('system', 'subsystem')
    AND r.to_entity_type = 'employee'
    AND r.relation_type IN (sys_it, sub_it, sys_bl, sub_bl);

  IF NEW.it_lead_employee_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      from_type, NEW.id, 'employee', NEW.it_lead_employee_id,
      it_code, '', '', NULL, NULL, NULL
    );
  END IF;

  IF NEW.business_lead_employee_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      from_type, NEW.id, 'employee', NEW.business_lead_employee_id,
      bl_code, '', '', NULL, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;
