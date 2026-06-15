-- Реестр веб-ресурсов: ar_web_resources, статусы, метамодель web_resource / system_web_resource,
-- проекция связи по FK ar_systems_id, параметры WR_CODE_PREFIX и DISP_WEB_RESOURCE_TEMPLATE.
-- Идемпотентно. См. docs/web-resource-registry-schema.md

-- ---------------------------------------------------------------------------
-- Справочник статусов
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archrep.ar_web_resource_statuses (
  id bigserial PRIMARY KEY,
  code varchar NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_web_resource_statuses_code_key UNIQUE (code)
);

INSERT INTO archrep.ar_web_resource_statuses (code, name, description)
SELECT v.code, v.name, v.description
FROM (VALUES
  ('draft'::varchar, 'Черновик'::varchar, 'Запись создана, публикация не завершена'::varchar),
  ('published', 'Опубликован', 'Веб-ресурс опубликован в сети Интернет'),
  ('unpublished', 'Снят с публикации', 'Веб-ресурс снят с публикации')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_web_resource_statuses s WHERE s.code = v.code);

-- ---------------------------------------------------------------------------
-- Реестр
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS archrep.ar_web_resources_code_seq;

CREATE TABLE IF NOT EXISTS archrep.ar_web_resources (
  id bigserial PRIMARY KEY,
  code varchar NOT NULL,
  short_name varchar NOT NULL,
  purpose text NULL,
  publication_url varchar NULL,
  app_store_links text NULL,
  ar_systems_id int8 NOT NULL,
  publication_request_number varchar NULL,
  publication_date date NULL,
  ar_web_resource_statuses_id int8 NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ar_web_resources_code_key UNIQUE (code),
  CONSTRAINT ar_web_resources_ar_systems_id_fkey
    FOREIGN KEY (ar_systems_id) REFERENCES archrep.ar_systems(id) ON DELETE RESTRICT,
  CONSTRAINT ar_web_resources_ar_web_resource_statuses_id_fkey
    FOREIGN KEY (ar_web_resource_statuses_id) REFERENCES archrep.ar_web_resource_statuses(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ar_web_resources_ar_systems_id_idx ON archrep.ar_web_resources (ar_systems_id);
CREATE INDEX IF NOT EXISTS ar_web_resources_status_id_idx ON archrep.ar_web_resources (ar_web_resource_statuses_id);
CREATE INDEX IF NOT EXISTS ar_web_resources_publication_date_idx ON archrep.ar_web_resources (publication_date);

COMMENT ON TABLE archrep.ar_web_resources IS 'Реестр веб-ресурсов Общества';

-- ---------------------------------------------------------------------------
-- Метамодель
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'web_resource', 'Веб-ресурс', 'ar_web_resources', 'Публикуемый веб-ресурс, привязанный к корневой ИС'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'web_resource');

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'system_web_resource', 'Опубликован', 'ИС опубликовала веб-ресурс в сети Интернет', f.id, t.id
FROM archrep.ar_metamodel_entity_types f
CROSS JOIN archrep.ar_metamodel_entity_types t
WHERE f.code = 'system' AND t.code = 'web_resource'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'system_web_resource' AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
  );

-- ---------------------------------------------------------------------------
-- Проекция system → web_resource по FK
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_ar_web_resources_metamodel_relations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.to_entity_type = 'web_resource'
      AND r.to_entity_id = OLD.id
      AND r.relation_type = 'system_web_resource';
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.to_entity_type = 'web_resource'
    AND r.to_entity_id = NEW.id
    AND r.relation_type = 'system_web_resource';

  IF NEW.ar_systems_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      'system', NEW.ar_systems_id, 'web_resource', NEW.id,
      'system_web_resource', '', '', '{"projection":"fk","source":"ar_web_resources.ar_systems_id"}'::jsonb, NULL, NULL
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

-- Backfill (пусто на новой установке)
INSERT INTO archrep.ar_metamodel_relations (
  from_entity_type, from_entity_id, to_entity_type, to_entity_id,
  relation_type, name, description, payload, displayed_name, reference_to_baserow
)
SELECT
  'system', w.ar_systems_id, 'web_resource', w.id,
  'system_web_resource', '', '', '{"projection":"fk","source":"ar_web_resources.ar_systems_id"}'::jsonb, NULL, NULL
FROM archrep.ar_web_resources w
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'system_web_resource'
    AND r.to_entity_type = 'web_resource'
    AND r.to_entity_id = w.id
);

-- ---------------------------------------------------------------------------
-- Параметры приложения
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'WR_CODE_PREFIX', 'Префикс кода при автогенерации записи реестра веб-ресурсов (например WR-1, WR-2).', 'WR-', 'string', 'Веб-ресурсы', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'WR_CODE_PREFIX');

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'DISP_WEB_RESOURCE_TEMPLATE', 'Шаблон отображаемого имени веб-ресурса в списках и на графе.', '{short_name}', 'string', 'Отображаемые имена', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DISP_WEB_RESOURCE_TEMPLATE');

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'DISP_WEB_RESOURCE_STATUS_TEMPLATE', 'Шаблон отображаемого имени статуса веб-ресурса.', '{name}', 'string', 'Отображаемые имена', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DISP_WEB_RESOURCE_STATUS_TEMPLATE');
