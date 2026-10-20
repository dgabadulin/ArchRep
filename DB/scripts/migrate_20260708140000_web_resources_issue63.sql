-- Issue #63: категория/стенд, привязка к ИС или модулю, subsystem_web_resource, удаление app_store_links.
-- Идемпотентно. См. docs/web-resource-registry-schema.md

-- ---------------------------------------------------------------------------
-- Справочник категорий веб-ресурса
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archrep.ar_web_resource_categories (
  id bigserial PRIMARY KEY,
  code varchar NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_web_resource_categories_code_key UNIQUE (code)
);

INSERT INTO archrep.ar_web_resource_categories (code, name, description)
SELECT v.code, v.name, v.description
FROM (VALUES
  ('Web-app'::varchar, 'Web-app'::varchar, 'Веб-приложение'::varchar),
  ('Промо/лендинг', 'Промо/лендинг', 'Промо-страница или лендинг'),
  ('API', 'API', 'Программный интерфейс (API)')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_web_resource_categories c WHERE c.code = v.code);

-- ---------------------------------------------------------------------------
-- Справочник типов стенда
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archrep.ar_web_resource_stage_types (
  id bigserial PRIMARY KEY,
  code varchar NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_web_resource_stage_types_code_key UNIQUE (code)
);

INSERT INTO archrep.ar_web_resource_stage_types (code, name, description)
SELECT v.code, v.name, v.description
FROM (VALUES
  ('prod'::varchar, 'prod'::varchar, 'Промышленный стенд'::varchar),
  ('test/stage', 'test/stage', 'Тестовый или предпромышленный стенд')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_web_resource_stage_types s WHERE s.code = v.code);

-- ---------------------------------------------------------------------------
-- ar_web_resources: новые FK, удаление app_store_links
-- ---------------------------------------------------------------------------
ALTER TABLE archrep.ar_web_resources
  ADD COLUMN IF NOT EXISTS ar_web_resource_categories_id int8 NULL,
  ADD COLUMN IF NOT EXISTS ar_web_resource_stage_types_id int8 NULL;

UPDATE archrep.ar_web_resources w
SET ar_web_resource_categories_id = c.id
FROM archrep.ar_web_resource_categories c
WHERE w.ar_web_resource_categories_id IS NULL AND c.code = 'Web-app';

UPDATE archrep.ar_web_resources w
SET ar_web_resource_stage_types_id = s.id
FROM archrep.ar_web_resource_stage_types s
WHERE w.ar_web_resource_stage_types_id IS NULL AND s.code = 'prod';

ALTER TABLE archrep.ar_web_resources DROP COLUMN IF EXISTS app_store_links;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_web_resources_ar_web_resource_categories_id_fkey'
  ) THEN
    ALTER TABLE archrep.ar_web_resources
      ADD CONSTRAINT ar_web_resources_ar_web_resource_categories_id_fkey
      FOREIGN KEY (ar_web_resource_categories_id) REFERENCES archrep.ar_web_resource_categories(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_web_resources_ar_web_resource_stage_types_id_fkey'
  ) THEN
    ALTER TABLE archrep.ar_web_resources
      ADD CONSTRAINT ar_web_resources_ar_web_resource_stage_types_id_fkey
      FOREIGN KEY (ar_web_resource_stage_types_id) REFERENCES archrep.ar_web_resource_stage_types(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE archrep.ar_web_resources
  ALTER COLUMN ar_web_resource_categories_id SET NOT NULL,
  ALTER COLUMN ar_web_resource_stage_types_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ar_web_resources_category_id_idx ON archrep.ar_web_resources (ar_web_resource_categories_id);
CREATE INDEX IF NOT EXISTS ar_web_resources_stage_type_id_idx ON archrep.ar_web_resources (ar_web_resource_stage_types_id);

-- ---------------------------------------------------------------------------
-- Метамодель: subsystem_web_resource
-- ---------------------------------------------------------------------------
UPDATE archrep.ar_metamodel_entity_types
SET description = 'Публикуемый веб-ресурс, привязанный к ИС или модулю'
WHERE code = 'web_resource';

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'subsystem_web_resource', 'Опубликован', 'Модуль ИС опубликовал веб-ресурс в сети Интернет', f.id, t.id
FROM archrep.ar_metamodel_entity_types f
CROSS JOIN archrep.ar_metamodel_entity_types t
WHERE f.code = 'subsystem' AND t.code = 'web_resource'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'subsystem_web_resource' AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
  );

-- ---------------------------------------------------------------------------
-- Проекция system | subsystem → web_resource по FK ar_systems_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_ar_web_resources_metamodel_relations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_id int8;
  v_from_type text;
  v_relation_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.to_entity_type = 'web_resource'
      AND r.to_entity_id = OLD.id
      AND r.relation_type IN ('system_web_resource', 'subsystem_web_resource');
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.to_entity_type = 'web_resource'
    AND r.to_entity_id = NEW.id
    AND r.relation_type IN ('system_web_resource', 'subsystem_web_resource');

  IF NEW.ar_systems_id IS NOT NULL THEN
    SELECT s.parent_ar_systems_id INTO v_parent_id
    FROM archrep.ar_systems s
    WHERE s.id = NEW.ar_systems_id;

    IF v_parent_id IS NULL THEN
      v_from_type := 'system';
      v_relation_type := 'system_web_resource';
    ELSE
      v_from_type := 'subsystem';
      v_relation_type := 'subsystem_web_resource';
    END IF;

    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      v_from_type, NEW.ar_systems_id, 'web_resource', NEW.id,
      v_relation_type, '', '', '{"projection":"fk","source":"ar_web_resources.ar_systems_id"}'::jsonb, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_web_resources_metamodel ON archrep.ar_web_resources;
CREATE TRIGGER trg_ar_web_resources_metamodel
  AFTER INSERT OR UPDATE OF ar_systems_id
  ON archrep.ar_web_resources
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_web_resources_metamodel_relations();

DROP TRIGGER IF EXISTS trg_ar_web_resources_metamodel_del ON archrep.ar_web_resources;
CREATE TRIGGER trg_ar_web_resources_metamodel_del
  AFTER DELETE ON archrep.ar_web_resources
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_web_resources_metamodel_relations();

-- Пересборка проекций (корневая ИС → system, модуль → subsystem)
DELETE FROM archrep.ar_metamodel_relations r
WHERE r.to_entity_type = 'web_resource'
  AND r.relation_type IN ('system_web_resource', 'subsystem_web_resource')
  AND COALESCE(r.payload->>'projection', '') = 'fk';

INSERT INTO archrep.ar_metamodel_relations (
  from_entity_type, from_entity_id, to_entity_type, to_entity_id,
  relation_type, name, description, payload, displayed_name, reference_to_baserow
)
SELECT
  CASE WHEN s.parent_ar_systems_id IS NULL THEN 'system' ELSE 'subsystem' END,
  w.ar_systems_id,
  'web_resource',
  w.id,
  CASE WHEN s.parent_ar_systems_id IS NULL THEN 'system_web_resource' ELSE 'subsystem_web_resource' END,
  '', '',
  '{"projection":"fk","source":"ar_web_resources.ar_systems_id"}'::jsonb,
  NULL,
  NULL
FROM archrep.ar_web_resources w
JOIN archrep.ar_systems s ON s.id = w.ar_systems_id;

-- ---------------------------------------------------------------------------
-- Параметры отображаемых имён справочников
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'DISP_WEB_RESOURCE_CATEGORY_TEMPLATE', 'Шаблон отображаемого имени категории веб-ресурса.', '{name}', 'string', 'Отображаемые имена', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DISP_WEB_RESOURCE_CATEGORY_TEMPLATE');

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'DISP_WEB_RESOURCE_STAGE_TYPE_TEMPLATE', 'Шаблон отображаемого имени типа стенда веб-ресурса.', '{name}', 'string', 'Отображаемые имена', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DISP_WEB_RESOURCE_STAGE_TYPE_TEMPLATE');
