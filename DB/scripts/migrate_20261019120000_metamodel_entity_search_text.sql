-- Поиск по связям объектов управления по наименованиям концов (реестр /metamodel-relations).
-- Изменений структуры хранения нет: добавляется только STABLE-функция.
-- Поля реестров взяты по фактическому DDL; подписи для отображения рендерит backend/displayName.js (DISP_*).

CREATE OR REPLACE FUNCTION archrep.metamodel_entity_search_text(p_entity_type text, p_entity_id bigint)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(btrim(coalesce(p_entity_type, '')))
    WHEN 'system' THEN
      (SELECT concat_ws(' ', s.code, s.name, s.fullname) FROM archrep.ar_systems s WHERE s.id = p_entity_id)
    WHEN 'subsystem' THEN
      (SELECT concat_ws(' ', s.code, s.name, s.fullname) FROM archrep.ar_systems s WHERE s.id = p_entity_id)
    WHEN 'system_child' THEN
      (SELECT concat_ws(' ', s.code, s.name, s.fullname) FROM archrep.ar_systems s WHERE s.id = p_entity_id)
    WHEN 'technology' THEN
      (SELECT t.name FROM archrep.ar_technologies t WHERE t.id = p_entity_id)
    WHEN 'organization_unit' THEN
      (SELECT concat_ws(' ', o.code, o.name, o.fullname, o.leader) FROM archrep.ar_organization_units o WHERE o.id = p_entity_id)
    WHEN 'actor' THEN
      (SELECT concat_ws(' ', a.code, a.name) FROM archrep.ar_actors a WHERE a.id = p_entity_id)
    WHEN 'business_service' THEN
      (SELECT concat_ws(' ', b.code, b.name, b.fullname) FROM archrep.ar_business_services b WHERE b.id = p_entity_id)
    WHEN 'business_function' THEN
      (SELECT concat_ws(' ', f.code, f.name) FROM archrep.ar_business_functions f WHERE f.id = p_entity_id)
    WHEN 'principle' THEN
      (SELECT p.name FROM archrep.ar_principles p WHERE p.id = p_entity_id)
    WHEN 'gap' THEN
      (SELECT concat_ws(' ', g.code, g.name) FROM archrep.ar_gaps g WHERE g.id = p_entity_id)
    WHEN 'applied' THEN
      (SELECT concat_ws(' ', a.code, a.task_name) FROM archrep.ar_adrs_applied a WHERE a.id = p_entity_id)
    WHEN 'adr_principle' THEN
      (SELECT concat_ws(' ', p.code, p.name) FROM archrep.ar_adrs_principle p WHERE p.id = p_entity_id)
    WHEN 'web_resource' THEN
      (SELECT concat_ws(' ', w.code, w.short_name, w.purpose) FROM archrep.ar_web_resources w WHERE w.id = p_entity_id)
    WHEN 'domain' THEN
      (SELECT concat_ws(' ', d.name, d.purpose) FROM archrep.ar_domains d WHERE d.id = p_entity_id)
    WHEN 'certificate' THEN
      (SELECT concat_ws(' ', c.code, c.placement_url) FROM archrep.ar_certificates c WHERE c.id = p_entity_id)
    WHEN 'employee' THEN
      (SELECT concat_ws(' ', e.full_name, e.employee_number, e.email) FROM archrep.ar_employees e WHERE e.id = p_entity_id)
    WHEN 'partner' THEN
      (SELECT p.name FROM archrep.ar_partners p WHERE p.id = p_entity_id)
    WHEN 'system_function' THEN
      (SELECT sf.name FROM archrep.ar_system_functions sf WHERE sf.id = p_entity_id)
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION archrep.metamodel_entity_search_text(text, bigint) IS
  'Поисковый текст объекта метамодели для реестра связей (/metamodel-relations): код/наименование по фактическому DDL реестра. Неизвестный код типа → NULL.';
