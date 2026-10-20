-- issue #81: поиск по связям объектов управления.
-- Источник полей для поиска — каталог типов метамодели: table_name + disp_param_name (DISP_*-шаблон типа).
-- Структура хранения связей не меняется; добавляется колонка каталога и обновляется функция поиска.

ALTER TABLE archrep.ar_metamodel_entity_types
  ADD COLUMN IF NOT EXISTS disp_param_name text;

-- CHECK'и добавляем как NOT VALID: не блокируем накат, если в конкретной БД table_name заполнен нестандартно.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_metamodel_entity_types_table_name_format'
  ) THEN
    ALTER TABLE archrep.ar_metamodel_entity_types
      ADD CONSTRAINT ar_metamodel_entity_types_table_name_format
      CHECK (table_name IS NULL OR table_name ~ '^[a-z_][a-z0-9_]*$') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_metamodel_entity_types_disp_param_format'
  ) THEN
    ALTER TABLE archrep.ar_metamodel_entity_types
      ADD CONSTRAINT ar_metamodel_entity_types_disp_param_format
      CHECK (disp_param_name IS NULL OR disp_param_name ~ '^DISP_[A-Z0-9_]+$') NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN archrep.ar_metamodel_entity_types.disp_param_name IS
  'Код параметра DISP_* (ar_settings_parameters): шаблон подписи типа; его плейсхолдеры задают поля поиска в реестре связей. NULL → {name}.';

-- Сид «код типа → DISP-шаблон» (совпадает с backend/displayName.js → ENTITY_TO_TEMPLATE).
-- Не перезаписываем уже настроенные значения (идемпотентно).
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_SYSTEM_TEMPLATE'           WHERE code = 'system'              AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_SUBSYSTEM_TEMPLATE'        WHERE code = 'subsystem'           AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_SUBSYSTEM_TEMPLATE'        WHERE code = 'system_child'        AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_TECHNOLOGY_TEMPLATE'       WHERE code = 'technology'          AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_ORG_UNIT_TEMPLATE'         WHERE code = 'organization_unit'   AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_ACTOR_TEMPLATE'            WHERE code = 'actor'               AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_BUSINESS_SERVICE_TEMPLATE' WHERE code = 'business_service'    AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_BUSINESS_FUNCTION_TEMPLATE' WHERE code = 'business_function'  AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_GAP_TEMPLATE'              WHERE code = 'gap'                 AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_ADRA_TEMPLATE'             WHERE code = 'applied'             AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_ADRP_TEMPLATE'             WHERE code = 'adr_principle'       AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_EMPLOYEE_TEMPLATE'         WHERE code = 'employee'            AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_PARTNER_TEMPLATE'          WHERE code = 'partner'             AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_WEB_RESOURCE_TEMPLATE'     WHERE code = 'web_resource'        AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_DOMAIN_TEMPLATE'           WHERE code = 'domain'              AND disp_param_name IS NULL;
UPDATE archrep.ar_metamodel_entity_types SET disp_param_name = 'DISP_CERTIFICATE_TEMPLATE'      WHERE code = 'certificate'         AND disp_param_name IS NULL;

-- Поисковый текст объекта метамодели для реестра связей (/metamodel-relations).
-- «Простые» типы обслуживаются по каталогу: table_name + disp_param_name → плейсхолдеры шаблона → поля.
-- «Сложные» типы (поля из JOIN/вычисляемые) — явные ветки ниже; при добавлении такого типа нужна ветка.
CREATE OR REPLACE FUNCTION archrep.metamodel_entity_search_text(p_entity_type text, p_entity_id bigint)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_type   text := lower(btrim(coalesce(p_entity_type, '')));
  v_table  text;
  v_disp   text;
  v_tpl    text;
  v_fields text[];
  v_expr   text;
  v_result text;
BEGIN
  IF p_entity_id IS NULL OR v_type = '' THEN
    RETURN NULL;
  END IF;

  -- «Сложные» типы: часть плейсхолдеров DISP_* приходит из JOIN/вычисляемых полей,
  -- поэтому здесь явные ветки с полным текстом (не зависят от шаблона).
  IF v_type = 'web_resource' THEN
    SELECT concat_ws(' ', w.code, w.short_name, w.purpose, w.publication_url,
                          w.publication_request_number,
                          st.name, st.code, cat.name, cat.code, sg.name, sg.code,
                          s.name, s.code, s.fullname, ps.name)
      INTO v_result
      FROM archrep.ar_web_resources w
      JOIN archrep.ar_systems s ON s.id = w.ar_systems_id
      LEFT JOIN archrep.ar_systems ps ON ps.id = s.parent_ar_systems_id
      JOIN archrep.ar_web_resource_statuses st ON st.id = w.ar_web_resource_statuses_id
      JOIN archrep.ar_web_resource_categories cat ON cat.id = w.ar_web_resource_categories_id
      JOIN archrep.ar_web_resource_stage_types sg ON sg.id = w.ar_web_resource_stage_types_id
     WHERE w.id = p_entity_id;
    RETURN v_result;
  ELSIF v_type = 'domain' THEN
    SELECT concat_ws(' ', d.name, d.purpose, st.name, st.code, p.name, o.name, e.full_name)
      INTO v_result
      FROM archrep.ar_domains d
      JOIN archrep.ar_domain_statuses st ON st.id = d.ar_domain_statuses_id
      LEFT JOIN archrep.ar_partners p ON p.id = d.registrar_ar_partners_id
      LEFT JOIN archrep.ar_organization_units o ON o.id = d.company_ar_organization_units_id
      LEFT JOIN archrep.ar_employees e ON e.id = d.business_owner_ar_employees_id
     WHERE d.id = p_entity_id;
    RETURN v_result;
  ELSIF v_type = 'certificate' THEN
    SELECT concat_ws(' ', c.code, c.placement_url, d.name, p.name, e.full_name)
      INTO v_result
      FROM archrep.ar_certificates c
      JOIN archrep.ar_domains d ON d.id = c.ar_domains_id
      LEFT JOIN archrep.ar_partners p ON p.id = c.ca_ar_partners_id
      LEFT JOIN archrep.ar_employees e ON e.id = c.responsible_ar_employees_id
     WHERE c.id = p_entity_id;
    RETURN v_result;
  ELSIF v_type = 'employee' THEN
    SELECT concat_ws(' ', e.full_name, e.employee_number, e.email,
                          CASE WHEN e.active THEN 'active' ELSE 'inactive' END)
      INTO v_result
      FROM archrep.ar_employees e
     WHERE e.id = p_entity_id;
    RETURN v_result;
  END IF;

  -- «Простые» типы: таблица и DISP-шаблон берутся из каталога.
  SELECT et.table_name, et.disp_param_name
    INTO v_table, v_disp
    FROM archrep.ar_metamodel_entity_types et
   WHERE et.code = v_type;

  IF v_table IS NULL
     OR v_table !~ '^[a-z_][a-z0-9_]*$'
     OR to_regclass(format('archrep.%I', v_table)) IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT sp.value
    INTO v_tpl
    FROM archrep.ar_settings_parameters sp
   WHERE sp.code = v_disp;

  v_tpl := coalesce(nullif(btrim(v_tpl), ''), '{name}');

  -- Поля = плейсхолдеры шаблона + code/name (базовое покрытие для шаблонов без них).
  -- to_jsonb(t)->>'field' для отсутствующего поля даёт NULL (не ошибку), поэтому набор полей
  -- может опережать состав таблицы: поиск просто не будет матчить отсутствующие значения.
  v_fields := ARRAY(
    SELECT DISTINCT f
      FROM unnest(
             ARRAY(SELECT m[1] FROM regexp_matches(v_tpl, '\{([a-zA-Z0-9_]+)\}', 'g') m)
             || ARRAY['code', 'name']
           ) AS f
     WHERE f ~ '^[a-zA-Z_][a-zA-Z0-9_]*$'
  );

  SELECT string_agg(format('to_jsonb(t)->>%L', f), ', ')
    INTO v_expr
    FROM unnest(v_fields) AS f;

  EXECUTE format('SELECT concat_ws('' '', %s) FROM archrep.%I t WHERE t.id = $1', v_expr, v_table)
    INTO v_result
    USING p_entity_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION archrep.metamodel_entity_search_text(text, bigint) IS
  'Поисковый текст объекта метамодели для реестра связей (/metamodel-relations): каталог типов (table_name + disp_param_name), плюс явные ветки для типов с JOIN-полями. Неизвестный код типа → NULL.';

