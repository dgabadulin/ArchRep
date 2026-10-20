-- Реестр доменов (#67): категория ОЕ org, статусы, ar_domains, FK на WR,
-- метамодель domain / web_resource_domain, триггер проекции, permissions, DISP.
-- Идемпотентно. См. docs/domain-registry-schema.md

-- ---------------------------------------------------------------------------
-- Категория ОЕ «Организация»
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_organization_unit_categories (code, name, description)
SELECT 'org', 'Организация', 'Юридическое лицо / организация-владелец домена'
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_organization_unit_categories c WHERE c.code = 'org'
);

-- ---------------------------------------------------------------------------
-- Справочник статусов домена
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archrep.ar_domain_statuses (
  id bigserial PRIMARY KEY,
  code varchar NOT NULL,
  name varchar NOT NULL,
  description text NULL,
  CONSTRAINT ar_domain_statuses_code_key UNIQUE (code)
);

INSERT INTO archrep.ar_domain_statuses (code, name, description)
SELECT v.code, v.name, v.description
FROM (VALUES
  ('delegated'::varchar, 'Делегирован'::varchar, 'Автосоздан из веб-ресурса / делегирован'::varchar),
  ('redirect', 'Редирект', 'Домен используется как редирект'),
  ('in_work', 'В работе', 'Рабочий домен'),
  ('rejected', 'Отказ', 'Отказ от использования / не продлевать'),
  ('reserved', 'Бронь', 'Забронирован, ещё не в работе')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_domain_statuses s WHERE s.code = v.code);

-- ---------------------------------------------------------------------------
-- Реестр доменов
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archrep.ar_domains (
  id bigserial PRIMARY KEY,
  name varchar NOT NULL,
  registrar_ar_partners_id int8 NULL,
  registered_at date NULL,
  expires_at date NULL,
  ar_domain_statuses_id int8 NOT NULL,
  purpose text NULL,
  company_ar_organization_units_id int8 NULL,
  business_owner_ar_employees_id int8 NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ar_domains_ar_domain_statuses_id_fkey
    FOREIGN KEY (ar_domain_statuses_id) REFERENCES archrep.ar_domain_statuses(id) ON DELETE RESTRICT,
  CONSTRAINT ar_domains_registrar_ar_partners_id_fkey
    FOREIGN KEY (registrar_ar_partners_id) REFERENCES archrep.ar_partners(id) ON DELETE SET NULL,
  CONSTRAINT ar_domains_company_ou_fkey
    FOREIGN KEY (company_ar_organization_units_id) REFERENCES archrep.ar_organization_units(id) ON DELETE SET NULL,
  CONSTRAINT ar_domains_business_owner_fkey
    FOREIGN KEY (business_owner_ar_employees_id) REFERENCES archrep.ar_employees(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ar_domains_name_lower_uidx
  ON archrep.ar_domains (lower(trim(name)));
CREATE INDEX IF NOT EXISTS ar_domains_status_id_idx ON archrep.ar_domains (ar_domain_statuses_id);
CREATE INDEX IF NOT EXISTS ar_domains_expires_at_idx ON archrep.ar_domains (expires_at);
CREATE INDEX IF NOT EXISTS ar_domains_company_id_idx ON archrep.ar_domains (company_ar_organization_units_id);

COMMENT ON TABLE archrep.ar_domains IS 'Реестр доменов (#67)';

-- ---------------------------------------------------------------------------
-- FK на веб-ресурсах
-- ---------------------------------------------------------------------------
ALTER TABLE archrep.ar_web_resources
  ADD COLUMN IF NOT EXISTS ar_domains_id int8 NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_web_resources_ar_domains_id_fkey'
  ) THEN
    ALTER TABLE archrep.ar_web_resources
      ADD CONSTRAINT ar_web_resources_ar_domains_id_fkey
      FOREIGN KEY (ar_domains_id) REFERENCES archrep.ar_domains(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ar_web_resources_ar_domains_id_idx
  ON archrep.ar_web_resources (ar_domains_id);

-- ---------------------------------------------------------------------------
-- Метамодель
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'domain', 'Домен', 'ar_domains', 'Домен второго уровня / host публикации'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'domain');

UPDATE archrep.ar_metamodel_entity_types SET import_allowed = true WHERE code = 'domain';

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'web_resource_domain', 'Размещен', 'Веб-ресурс размещён на домене', f.id, t.id
FROM archrep.ar_metamodel_entity_types f
CROSS JOIN archrep.ar_metamodel_entity_types t
WHERE f.code = 'web_resource' AND t.code = 'domain'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'web_resource_domain' AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
  );

-- ---------------------------------------------------------------------------
-- Проекция web_resource → domain по FK ar_domains_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_ar_web_resources_domain_metamodel_relations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.from_entity_type = 'web_resource'
      AND r.from_entity_id = OLD.id
      AND r.relation_type = 'web_resource_domain';
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'web_resource'
    AND r.from_entity_id = NEW.id
    AND r.relation_type = 'web_resource_domain';

  IF NEW.ar_domains_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      'web_resource', NEW.id, 'domain', NEW.ar_domains_id,
      'web_resource_domain', '', '',
      '{"projection":"fk","source":"ar_web_resources.ar_domains_id"}'::jsonb,
      NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_web_resources_domain_metamodel ON archrep.ar_web_resources;
CREATE TRIGGER trg_ar_web_resources_domain_metamodel
  AFTER INSERT OR UPDATE OF ar_domains_id
  ON archrep.ar_web_resources
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_web_resources_domain_metamodel_relations();

DROP TRIGGER IF EXISTS trg_ar_web_resources_domain_metamodel_del ON archrep.ar_web_resources;
CREATE TRIGGER trg_ar_web_resources_domain_metamodel_del
  AFTER DELETE ON archrep.ar_web_resources
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_web_resources_domain_metamodel_relations();

-- Backfill проекций (если FK уже заполнены)
INSERT INTO archrep.ar_metamodel_relations (
  from_entity_type, from_entity_id, to_entity_type, to_entity_id,
  relation_type, name, description, payload, displayed_name, reference_to_baserow
)
SELECT
  'web_resource', w.id, 'domain', w.ar_domains_id,
  'web_resource_domain', '', '',
  '{"projection":"fk","source":"ar_web_resources.ar_domains_id"}'::jsonb, NULL, NULL
FROM archrep.ar_web_resources w
WHERE w.ar_domains_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relations r
    WHERE r.relation_type = 'web_resource_domain'
      AND r.from_entity_type = 'web_resource'
      AND r.from_entity_id = w.id
  );

-- ---------------------------------------------------------------------------
-- Параметры
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'DISP_DOMAIN_TEMPLATE', 'Шаблон отображаемого имени домена в списках и на графе.', '{name}', 'string', 'Отображаемые имена', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DISP_DOMAIN_TEMPLATE');

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'DISP_DOMAIN_STATUS_TEMPLATE', 'Шаблон отображаемого имени статуса домена.', '{name}', 'string', 'Отображаемые имена', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DISP_DOMAIN_STATUS_TEMPLATE');

-- Порядок типов в анализаторе: domain после web_resource (если ещё нет)
UPDATE archrep.ar_settings_parameters
SET value = CASE
  WHEN value LIKE '%"domain"%' THEN value
  WHEN value LIKE '%"web_resource"%' THEN replace(value, '"web_resource"', '"web_resource","domain"')
  ELSE regexp_replace(value, '\]\s*$', ',"domain"]')
END,
updated_at = current_timestamp
WHERE code = 'GRAPH_ENTITY_ORDER'
  AND value IS NOT NULL
  AND value NOT LIKE '%"domain"%';

UPDATE archrep.ar_settings_parameters
SET value = CASE
  WHEN value LIKE '%"domain"%' THEN value
  WHEN trim(value) IN ('', '{}', 'null') THEN '{"domain":{"label":"Домен","icon":"AppWindow","listLabel":"Домены"}}'
  ELSE regexp_replace(trim(value), '\}\s*$', ',"domain":{"label":"Домен","icon":"AppWindow","listLabel":"Домены"}}')
END,
updated_at = current_timestamp
WHERE code = 'GRAPH_ENTITY_ICONS'
  AND value IS NOT NULL
  AND value NOT LIKE '%"domain"%';

-- ---------------------------------------------------------------------------
-- RBAC permissions (bootstrapAuth дополнит матрицу ролей)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_permissions (code, description, is_active) VALUES
  ('domain:read', 'Реестр доменов: чтение', true),
  ('domain:write', 'Реестр доменов: создание и изменение', true),
  ('domain:delete', 'Реестр доменов: удаление', true),
  ('domain:export', 'Реестр доменов: экспорт Excel', true)
ON CONFLICT (code) DO NOTHING;
