-- Каталог инфраструктуры из Netbox (read-only) + задание синхронизации (issue #92).
-- Справочник типов, реестр серверов, проекции связей «ИС → сервер», параметры, RBAC, задание.
-- Идемпотентно. См. docs/infrastructure-registry-netbox.md

-- ---------------------------------------------------------------------------
-- Справочник типов объектов инфраструктуры
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archrep.ar_infrastructure_object_types (
  id          bigserial    PRIMARY KEY,
  code        varchar(64)  NOT NULL,
  name        varchar(255) NOT NULL,
  description text         NULL,
  CONSTRAINT ar_infrastructure_object_types_code_uq UNIQUE (code)
);

COMMENT ON TABLE archrep.ar_infrastructure_object_types IS
  'Справочник типов объектов инфраструктуры. Единица учёта — сервер; тип отражает способ размещения (виртуальный или физический).';
COMMENT ON COLUMN archrep.ar_infrastructure_object_types.code IS
  'Код типа (snake_case): virtual_server — ВМ из Netbox (virtualization.virtualmachine), physical_server — физический сервер (dcim.device).';
COMMENT ON COLUMN archrep.ar_infrastructure_object_types.name IS
  'Наименование типа для интерфейса: «Виртуальный сервер», «Физический сервер».';
COMMENT ON COLUMN archrep.ar_infrastructure_object_types.description IS
  'Пояснение к типу для справки (необязательно).';

INSERT INTO archrep.ar_infrastructure_object_types (code, name, description) VALUES
  ('virtual_server',  'Виртуальный сервер', 'Виртуальная машина из Netbox (virtualization.virtualmachine)'),
  ('physical_server', 'Физический сервер',  'Физическое устройство из Netbox (dcim.device)')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Реестр серверов инфраструктуры
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archrep.ar_infrastructure_objects (
  id                                bigserial     PRIMARY KEY,
  source                            varchar(32)   NOT NULL DEFAULT 'netbox',
  external_id                       bigint        NOT NULL,
  ar_infrastructure_object_types_id bigint        NOT NULL,
  name                              varchar(255)  NOT NULL,
  description                       text          NULL,
  primary_ip                        varchar(64)   NULL,
  status                            varchar(128)  NULL,
  site                              varchar(255)  NULL,
  cluster                           varchar(255)  NULL,
  platform                          varchar(255)  NULL,
  tenant                            varchar(255)  NULL,
  vcpus                             numeric(8,2)  NULL,
  memory_gb                         numeric(10,2) NULL,
  disk_gb                           numeric(10,2) NULL,
  netbox_updated_at                 timestamptz   NULL,
  synced_at                         timestamptz   NOT NULL DEFAULT now(),
  payload                           jsonb         NULL,
  CONSTRAINT ar_infrastructure_objects_natural_key
    UNIQUE (source, ar_infrastructure_object_types_id, external_id),
  CONSTRAINT ar_infrastructure_objects_type_fk
    FOREIGN KEY (ar_infrastructure_object_types_id)
    REFERENCES archrep.ar_infrastructure_object_types(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ar_infrastructure_objects_type_idx
  ON archrep.ar_infrastructure_objects (ar_infrastructure_object_types_id);
CREATE INDEX IF NOT EXISTS ar_infrastructure_objects_name_lower_idx
  ON archrep.ar_infrastructure_objects (lower(name));
CREATE INDEX IF NOT EXISTS ar_infrastructure_objects_status_idx
  ON archrep.ar_infrastructure_objects (status);
CREATE INDEX IF NOT EXISTS ar_infrastructure_objects_synced_idx
  ON archrep.ar_infrastructure_objects (synced_at);

COMMENT ON TABLE archrep.ar_infrastructure_objects IS
  'Реестр серверов инфраструктуры, синхронизируемый из Netbox. В ИСАР доступен только для чтения; связи с ИС хранятся в ar_metamodel_relations.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.source IS
  'Система-источник данных. Сейчас всегда netbox; оставлено для будущих CMDB и для естественного ключа.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.external_id IS
  'Идентификатор объекта в системе-источнике (Netbox id). Вместе с source и типом образует естественный ключ синхронизации.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.ar_infrastructure_object_types_id IS
  'Тип объекта инфраструктуры (справочник ar_infrastructure_object_types): виртуальный или физический сервер.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.name IS
  'Наименование сервера в Netbox (для устройств совпадает с хостнеймом).';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.description IS
  'Описание объекта из Netbox (description/comments), если заполнено.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.primary_ip IS
  'Основной IP-адрес из Netbox (primary_ip4 без маски). Используется для поиска и идентификации сервера.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.status IS
  'Статус объекта в Netbox в человекочитаемом виде (например «Active», «Planned», «Offline»).';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.site IS
  'Площадка/ЦОД из Netbox (site.name).';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.cluster IS
  'Кластер виртуализации из Netbox (cluster.name); для физических серверов пусто.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.platform IS
  'Платформа/ОС из Netbox (platform.name).';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.tenant IS
  'Арендатор/владелец в Netbox (tenant.name), если используется.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.vcpus IS
  'Количество vCPU из Netbox; для физических серверов пусто.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.memory_gb IS
  'Объём оперативной памяти в ГБ (Netbox memory в МБ пересчитывается в ГБ при синхронизации).';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.disk_gb IS
  'Объём диска в ГБ из Netbox; для физических серверов может быть пусто.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.netbox_updated_at IS
  'Дата последнего изменения объекта в Netbox (last_updated) — для оценки актуальности данных.';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.synced_at IS
  'Метка времени последней успешной синхронизации строки. Используется для удаления неактуальных записей (synced_at < времени прогона).';
COMMENT ON COLUMN archrep.ar_infrastructure_objects.payload IS
  'Исходный JSON объекта Netbox, включая теги IS:<код>. Нужен для диагностики (какие теги не нашли ИС) и расширения без миграций.';


-- ---------------------------------------------------------------------------
-- Метамодель: тип сущности и типы связей
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description, disp_param_name, import_allowed)
SELECT 'infrastructure_object', 'Сервер инфраструктуры', 'ar_infrastructure_objects',
       'Сервер (виртуальный или физический), синхронизируемый из Netbox; связь с ИС — по тегу IS:<код>',
       'DISP_INFRA_TEMPLATE', false
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'infrastructure_object'
);

UPDATE archrep.ar_metamodel_entity_types
   SET name = 'Сервер инфраструктуры',
       table_name = 'ar_infrastructure_objects',
       description = 'Сервер (виртуальный или физический), синхронизируемый из Netbox; связь с ИС — по тегу IS:<код>',
       disp_param_name = 'DISP_INFRA_TEMPLATE',
       import_allowed = false
 WHERE code = 'infrastructure_object';

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'system_infrastructure', 'Размещена на',
       'ИС размещена на сервере; связь создаётся синхронизацией Netbox по тегу IS:<код>',
       f.id, t.id
FROM archrep.ar_metamodel_entity_types f
CROSS JOIN archrep.ar_metamodel_entity_types t
WHERE f.code = 'system' AND t.code = 'infrastructure_object'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'system_infrastructure'
      AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
  );

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'subsystem_infrastructure', 'Размещена на',
       'Модуль ИС размещён на сервере; связь создаётся синхронизацией Netbox по тегу IS:<код>',
       f.id, t.id
FROM archrep.ar_metamodel_entity_types f
CROSS JOIN archrep.ar_metamodel_entity_types t
WHERE f.code = 'subsystem' AND t.code = 'infrastructure_object'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'subsystem_infrastructure'
      AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
  );

UPDATE archrep.ar_metamodel_relation_types
   SET managed = true
 WHERE code IN ('system_infrastructure', 'subsystem_infrastructure');

CREATE UNIQUE INDEX IF NOT EXISTS ar_metamodel_relations_infrastructure_uq
  ON archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type)
  WHERE to_entity_type = 'infrastructure_object'
    AND relation_type IN ('system_infrastructure', 'subsystem_infrastructure');


-- ---------------------------------------------------------------------------
-- Параметры
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT v.code, v.description, v.value, v.value_type, v.group_name, false, false
FROM (VALUES
  ('NETBOX_URL'::varchar,
   'Базовый URL Netbox (например https://netbox.example.com). Токен задаётся только переменной окружения NETBOX_TOKEN.'::varchar,
   ''::varchar, 'string'::varchar, 'Инфраструктура'::varchar),
  ('NETBOX_TAG_PREFIX',
   'Префикс имени тега Netbox, по которому сервер привязывается к ИС (по умолчанию IS:).',
   'IS:', 'string', 'Инфраструктура'),
  ('NETBOX_INCLUDE_VMS',
   'Импортировать виртуальные машины Netbox (virtualization.virtualmachine).',
   'true', 'boolean', 'Инфраструктура'),
  ('NETBOX_INCLUDE_DEVICES',
   'Импортировать физические устройства Netbox (dcim.device).',
   'true', 'boolean', 'Инфраструктура'),
  ('NETBOX_PAGE_SIZE',
   'Количество объектов на страницу при чтении Netbox API.',
   '100', 'number', 'Инфраструктура'),
  ('NETBOX_VERIFY_TLS',
   'Проверять TLS-сертификат Netbox. false — только для стендов с самоподписанным сертификатом.',
   'true', 'boolean', 'Инфраструктура'),
  ('NETBOX_REQUEST_TIMEOUT_MS',
   'Таймаут HTTP-запроса к Netbox, миллисекунды.',
   '30000', 'number', 'Инфраструктура'),
  ('DISP_INFRA_TEMPLATE',
   'Шаблон отображаемого имени сервера инфраструктуры в списках и на графе. Разрешённые поля: {name}, {primary_ip}, {status}, {site}, {type_name}.',
   '{name}', 'string', 'Отображаемые имена')
) AS v(code, description, value, value_type, group_name)
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_settings_parameters p WHERE p.code = v.code
);

-- ---------------------------------------------------------------------------
-- RBAC: просмотр каталога (запуск синхронизации — существующее jobs:execute)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_permissions (code, description, is_active) VALUES
  ('infrastructure:read', 'Каталог инфраструктуры: чтение', true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Задание синхронизации (включается после настройки NETBOX_URL и NETBOX_TOKEN)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_jobs (code, name, description, handler, interval_seconds, enabled)
VALUES (
  'infrastructure_sync',
  'Синхронизация каталога инфраструктуры (Netbox)',
  'Читает ВМ и физические серверы из Netbox, обновляет каталог и связи с ИС по тегам IS:<код>; удаляет записи, исчезнувшие из Netbox.',
  'infrastructure_sync',
  86400,
  false
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  handler = EXCLUDED.handler,
  interval_seconds = EXCLUDED.interval_seconds;


-- ---------------------------------------------------------------------------
-- Целостность связей «ИС → сервер»
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.cleanup_infrastructure_object_relations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM archrep.ar_metamodel_relations r
   WHERE r.to_entity_type = 'infrastructure_object'
     AND r.to_entity_id = OLD.id
     AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_infrastructure_objects_cleanup ON archrep.ar_infrastructure_objects;
CREATE TRIGGER trg_ar_infrastructure_objects_cleanup
  AFTER DELETE ON archrep.ar_infrastructure_objects
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.cleanup_infrastructure_object_relations();

CREATE OR REPLACE FUNCTION archrep.sync_infrastructure_relations_on_system_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM archrep.ar_metamodel_relations r
   WHERE r.from_entity_type IN ('system', 'subsystem')
     AND r.from_entity_id = OLD.id
     AND r.to_entity_type = 'infrastructure_object'
     AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_systems_infrastructure_cleanup ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_infrastructure_cleanup
  AFTER DELETE ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_infrastructure_relations_on_system_delete();

CREATE OR REPLACE FUNCTION archrep.sync_infrastructure_relations_on_system_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_ar_systems_id IS DISTINCT FROM OLD.parent_ar_systems_id THEN
    UPDATE archrep.ar_metamodel_relations r
       SET from_entity_type = CASE WHEN NEW.parent_ar_systems_id IS NULL THEN 'system' ELSE 'subsystem' END,
           relation_type = CASE
             WHEN NEW.parent_ar_systems_id IS NULL THEN 'system_infrastructure'
             ELSE 'subsystem_infrastructure'
           END,
           updated_at = current_timestamp
     WHERE r.from_entity_type IN ('system', 'subsystem')
       AND r.from_entity_id = NEW.id
       AND r.to_entity_type = 'infrastructure_object'
       AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_systems_infrastructure_parent ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_infrastructure_parent
  AFTER UPDATE OF parent_ar_systems_id ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_infrastructure_relations_on_system_parent();

-- ---------------------------------------------------------------------------
-- Поиск по связям: подпись объекта инфраструктуры
-- ---------------------------------------------------------------------------
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
    WHEN 'infrastructure_object' THEN
      (SELECT concat_ws(' ', o.name, o.primary_ip, o.status, o.site, t.name)
         FROM archrep.ar_infrastructure_objects o
         JOIN archrep.ar_infrastructure_object_types t ON t.id = o.ar_infrastructure_object_types_id
        WHERE o.id = p_entity_id)
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION archrep.metamodel_entity_search_text(text, bigint) IS
  'Поисковый текст объекта метамодели для реестра связей (/metamodel-relations): код/наименование по фактическому DDL реестра. Неизвестный код типа → NULL.';

-- ---------------------------------------------------------------------------
-- Анализатор зависимостей: порядок и иконка типа
-- ---------------------------------------------------------------------------
UPDATE archrep.ar_settings_parameters
SET value = CASE
  WHEN value LIKE '%"infrastructure_object"%' THEN value
  WHEN value LIKE '%"technology"%' THEN replace(value, '"technology"', '"technology","infrastructure_object"')
  ELSE regexp_replace(value, '\]\s*$', ',"infrastructure_object"]')
END,
updated_at = current_timestamp
WHERE code = 'GRAPH_ENTITY_ORDER'
  AND value IS NOT NULL
  AND value NOT LIKE '%"infrastructure_object"%';

UPDATE archrep.ar_settings_parameters
SET value = CASE
  WHEN value LIKE '%"infrastructure_object"%' THEN value
  WHEN trim(value) IN ('', '{}', 'null') THEN '{"infrastructure_object":{"label":"Сервер инфраструктуры","icon":"Server","listLabel":"Инфраструктура"}}'
  ELSE regexp_replace(trim(value), '\}\s*$', ',"infrastructure_object":{"label":"Сервер инфраструктуры","icon":"Server","listLabel":"Инфраструктура"}}')
END,
updated_at = current_timestamp
WHERE code = 'GRAPH_ENTITY_ICONS'
  AND value IS NOT NULL
  AND value NOT LIKE '%"infrastructure_object"%';


