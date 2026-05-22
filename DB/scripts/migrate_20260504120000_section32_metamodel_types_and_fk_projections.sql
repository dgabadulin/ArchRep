-- §3.2 demo-full-model-entities-matrix: типы сущностей partner / system_function / adr_principle,
-- типы связей ar_metamodel_relation_types (коды как в md и exports/demo-full-model-metamodel-relation-types-section32.csv),
-- проекции в ar_metamodel_relations по FK (партнёры ИС/модуля/технологии, владелец OU→продукт/способность, функция ИС→родитель ИС).
-- Идемпотентно: IF NOT EXISTS, NOT EXISTS, DROP IF EXISTS + CREATE.
-- После наката: перезапуск backend (кэш типов метамодели при наличии).

-- ---------------------------------------------------------------------------
-- Типы сущностей метамодели (при отсутствии)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'partner', 'Партнёр', 'ar_partners', 'Контрагент (вендор, интегратор, поддержка)'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'partner');

INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'system_function', 'Функция ИС', 'ar_system_functions', 'Прикладная функция в каталоге ИС'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'system_function');

INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'adr_principle', 'ADRP (прикладной принцип)', 'ar_adrs_principle', 'Архитектурное решение-принцип'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'adr_principle');

-- ---------------------------------------------------------------------------
-- Типы связей §3.2 (без автоматической проекции, кроме отдельных триггеров ниже)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT v.code, v.name, v.description, f.id, t.id
FROM (
  SELECT * FROM (VALUES
    ('organization_unit_business_service'::varchar, 'Отвечает за'::varchar, 'Орг. единица владеет бизнес-сервисом'::varchar, 'organization_unit'::varchar, 'business_service'::varchar),
    ('organization_unit_business_function', 'Отвечает за', 'Орг. единица владеет бизнес-функцией', 'organization_unit', 'business_function'),
    ('actor_business_function', 'Отвечает за', 'Заинтересованное лицо исполняет бизнес-функцию', 'actor', 'business_function'),
    ('business_function_business_service', 'Поддерживает сервис', 'Бизнес-функция обеспечивает бизнес-сервис', 'business_function', 'business_service'),
    ('system_business_service', 'Обеспечивает продукт', 'ИС реализует бизнес-сервис', 'system', 'business_service'),
    ('system_business_function', 'Реализует бизнес-функцию', 'ИС реализует бизнес-функцию', 'system', 'business_function'),
    ('system_system_function', 'Содержит функцию ИС', 'Система включает функцию ИС; FK ar_system_functions.ar_systems_id', 'system', 'system_function'),
    ('system_function_business_function', 'Реализует бизнес-функцию', 'Функция ИС покрывает бизнес-функцию', 'system_function', 'business_function'),
    ('system_function_business_service', 'Обеспечивает продукт', 'Функция ИС обеспечивает бизнес-сервис', 'system_function', 'business_service'),
    ('actor_system_function', 'Использует функцию ИС', 'Действующее лицо опирается на возможность системы', 'actor', 'system_function'),
    ('adr_applied_adr_principle', 'Соблюдает принцип', 'ADRA опирается на ADRP', 'applied', 'adr_principle'),
    ('system_partner_vendor', 'Вендор', 'Корневая ИС — вендор; проекция FK vendor_ar_partners_id', 'system', 'partner'),
    ('system_partner_implementer', 'Интегратор', 'Корневая ИС — интегратор; проекция FK supplier_ar_partners_id', 'system', 'partner'),
    ('system_partner_supporter', 'Поддерживает', 'Корневая ИС — поддержка; проекция FK supporter_ar_partners_id', 'system', 'partner'),
    ('subsystem_partner_vendor', 'Вендор', 'Модуль — вендор; проекция FK vendor_ar_partners_id', 'subsystem', 'partner'),
    ('subsystem_partner_implementer', 'Интегратор', 'Модуль — интегратор; проекция FK supplier_ar_partners_id', 'subsystem', 'partner'),
    ('subsystem_partner_supporter', 'Поддерживает', 'Модуль — поддержка; проекция FK supporter_ar_partners_id', 'subsystem', 'partner'),
    ('technology_partner_vendor', 'Вендор', 'Технология — вендор; проекция FK vendor_ar_partners_id (ar_technologies)', 'technology', 'partner')
  ) AS x(code, name, description, from_code, to_code)
) v
JOIN archrep.ar_metamodel_entity_types f ON f.code = v.from_code
JOIN archrep.ar_metamodel_entity_types t ON t.code = v.to_code
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relation_types r
  WHERE r.code = v.code AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
);

-- Дубли system_system_function для направления subsystem → system_function (та же FK на ar_systems)
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'system_system_function', 'Содержит функцию ИС', 'Модуль включает функцию ИС; FK ar_system_functions.ar_systems_id', sf.id, tf.id
FROM archrep.ar_metamodel_entity_types sf
CROSS JOIN archrep.ar_metamodel_entity_types tf
WHERE sf.code = 'subsystem' AND tf.code = 'system_function'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'system_system_function' AND r.from_entity_type_id = sf.id AND r.to_entity_type_id = tf.id
  );

-- ---------------------------------------------------------------------------
-- Проекция: ИС / модуль → partner (ar_systems)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_ar_systems_partner_metamodel_relations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  from_t text;
  v_code text;
  s_code text;
  i_code text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.from_entity_id = OLD.id
      AND r.from_entity_type IN ('system', 'subsystem')
      AND r.to_entity_type = 'partner'
      AND r.relation_type IN (
        'system_partner_vendor', 'system_partner_implementer', 'system_partner_supporter',
        'subsystem_partner_vendor', 'subsystem_partner_implementer', 'subsystem_partner_supporter'
      );
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_id = NEW.id
    AND r.from_entity_type IN ('system', 'subsystem')
    AND r.to_entity_type = 'partner'
    AND r.relation_type IN (
      'system_partner_vendor', 'system_partner_implementer', 'system_partner_supporter',
      'subsystem_partner_vendor', 'subsystem_partner_implementer', 'subsystem_partner_supporter'
    );

  from_t := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN 'system' ELSE 'subsystem' END;
  v_code := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN 'system_partner_vendor' ELSE 'subsystem_partner_vendor' END;
  s_code := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN 'system_partner_implementer' ELSE 'subsystem_partner_implementer' END;
  i_code := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN 'system_partner_supporter' ELSE 'subsystem_partner_supporter' END;

  IF NEW.vendor_ar_partners_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      from_t, NEW.id, 'partner', NEW.vendor_ar_partners_id,
      v_code, '', '', NULL, NULL, NULL
    );
  END IF;
  IF NEW.supplier_ar_partners_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      from_t, NEW.id, 'partner', NEW.supplier_ar_partners_id,
      s_code, '', '', NULL, NULL, NULL
    );
  END IF;
  IF NEW.supporter_ar_partners_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      from_t, NEW.id, 'partner', NEW.supporter_ar_partners_id,
      i_code, '', '', NULL, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_systems_partner_metamodel ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_partner_metamodel
  AFTER INSERT OR UPDATE OF vendor_ar_partners_id, supplier_ar_partners_id, supporter_ar_partners_id, parent_ar_systems_id
  ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_systems_partner_metamodel_relations();

DROP TRIGGER IF EXISTS trg_ar_systems_partner_metamodel_del ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_partner_metamodel_del
  AFTER DELETE ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_systems_partner_metamodel_relations();

-- ---------------------------------------------------------------------------
-- Проекция: technology → partner (ar_technologies.vendor_ar_partners_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_ar_technologies_vendor_partner_metamodel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.from_entity_type = 'technology'
      AND r.from_entity_id = OLD.id
      AND r.relation_type = 'technology_partner_vendor';
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'technology'
    AND r.from_entity_id = NEW.id
    AND r.relation_type = 'technology_partner_vendor';

  IF NEW.vendor_ar_partners_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      'technology', NEW.id, 'partner', NEW.vendor_ar_partners_id,
      'technology_partner_vendor', '', '', NULL, NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_technologies_vendor_partner_metamodel ON archrep.ar_technologies;
CREATE TRIGGER trg_ar_technologies_vendor_partner_metamodel
  AFTER INSERT OR UPDATE OF vendor_ar_partners_id
  ON archrep.ar_technologies
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_technologies_vendor_partner_metamodel();

DROP TRIGGER IF EXISTS trg_ar_technologies_vendor_partner_metamodel_del ON archrep.ar_technologies;
CREATE TRIGGER trg_ar_technologies_vendor_partner_metamodel_del
  AFTER DELETE ON archrep.ar_technologies
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_technologies_vendor_partner_metamodel();

-- ---------------------------------------------------------------------------
-- Проекция: system|subsystem → system_function (ar_system_functions.ar_systems_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_ar_system_functions_parent_metamodel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  from_t text;
  sid bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.relation_type = 'system_system_function'
      AND r.to_entity_type = 'system_function'
      AND r.to_entity_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'system_system_function'
    AND r.to_entity_type = 'system_function'
    AND r.to_entity_id = NEW.id;

  SELECT s.parent_ar_systems_id INTO sid FROM archrep.ar_systems s WHERE s.id = NEW.ar_systems_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  from_t := CASE WHEN sid IS NULL THEN 'system' ELSE 'subsystem' END;

  INSERT INTO archrep.ar_metamodel_relations (
    from_entity_type, from_entity_id, to_entity_type, to_entity_id,
    relation_type, name, description, payload, displayed_name, reference_to_baserow
  ) VALUES (
    from_t, NEW.ar_systems_id, 'system_function', NEW.id,
    'system_system_function', '', '', NULL, NULL, NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_system_functions_parent_metamodel ON archrep.ar_system_functions;
CREATE TRIGGER trg_ar_system_functions_parent_metamodel
  AFTER INSERT OR UPDATE OF ar_systems_id
  ON archrep.ar_system_functions
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_system_functions_parent_metamodel();

DROP TRIGGER IF EXISTS trg_ar_system_functions_parent_metamodel_del ON archrep.ar_system_functions;
CREATE TRIGGER trg_ar_system_functions_parent_metamodel_del
  AFTER DELETE ON archrep.ar_system_functions
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_system_functions_parent_metamodel();

-- При смене parent_ar_systems_id у ИС пересобрать рёбра функций, привязанных к этой строке
CREATE OR REPLACE FUNCTION archrep.sync_ar_system_functions_after_system_parent_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.parent_ar_systems_id IS DISTINCT FROM OLD.parent_ar_systems_id THEN
    UPDATE archrep.ar_system_functions f
    SET ar_systems_id = f.ar_systems_id
    WHERE f.ar_systems_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_systems_rebuild_sf_metamodel ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_rebuild_sf_metamodel
  AFTER UPDATE OF parent_ar_systems_id
  ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_system_functions_after_system_parent_change();

-- ---------------------------------------------------------------------------
-- Проекция: organization_unit → business_service (FK на стороне продукта)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_business_service_org_unit_metamodel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.relation_type = 'organization_unit_business_service'
      AND r.to_entity_type = 'business_service'
      AND r.to_entity_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'organization_unit_business_service'
    AND r.to_entity_type = 'business_service'
    AND r.to_entity_id = NEW.id;

  IF NEW.ar_organization_units_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      'organization_unit', NEW.ar_organization_units_id, 'business_service', NEW.id,
      'organization_unit_business_service', '', '', NULL, NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bs_ou_metamodel ON archrep.ar_business_services;
CREATE TRIGGER trg_bs_ou_metamodel
  AFTER INSERT OR UPDATE OF ar_organization_units_id
  ON archrep.ar_business_services
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_business_service_org_unit_metamodel();

DROP TRIGGER IF EXISTS trg_bs_ou_metamodel_del ON archrep.ar_business_services;
CREATE TRIGGER trg_bs_ou_metamodel_del
  AFTER DELETE ON archrep.ar_business_services
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_business_service_org_unit_metamodel();

-- ---------------------------------------------------------------------------
-- Проекция: organization_unit → business_function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_business_function_org_unit_metamodel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.relation_type = 'organization_unit_business_function'
      AND r.to_entity_type = 'business_function'
      AND r.to_entity_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'organization_unit_business_function'
    AND r.to_entity_type = 'business_function'
    AND r.to_entity_id = NEW.id;

  IF NEW.ar_organization_units_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      'organization_unit', NEW.ar_organization_units_id, 'business_function', NEW.id,
      'organization_unit_business_function', '', '', NULL, NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bf_ou_metamodel ON archrep.ar_business_functions;
CREATE TRIGGER trg_bf_ou_metamodel
  AFTER INSERT OR UPDATE OF ar_organization_units_id
  ON archrep.ar_business_functions
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_business_function_org_unit_metamodel();

DROP TRIGGER IF EXISTS trg_bf_ou_metamodel_del ON archrep.ar_business_functions;
CREATE TRIGGER trg_bf_ou_metamodel_del
  AFTER DELETE ON archrep.ar_business_functions
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_business_function_org_unit_metamodel();

-- ---------------------------------------------------------------------------
-- Первичный пересчёт (идемпотентно через DELETE+INSERT в функциях при «триггерном» UPDATE)
-- ---------------------------------------------------------------------------
UPDATE archrep.ar_systems s
SET
  vendor_ar_partners_id = s.vendor_ar_partners_id,
  supplier_ar_partners_id = s.supplier_ar_partners_id,
  supporter_ar_partners_id = s.supporter_ar_partners_id;

UPDATE archrep.ar_technologies t
SET vendor_ar_partners_id = t.vendor_ar_partners_id;

UPDATE archrep.ar_business_services b
SET ar_organization_units_id = b.ar_organization_units_id;

UPDATE archrep.ar_business_functions f
SET ar_organization_units_id = f.ar_organization_units_id;

UPDATE archrep.ar_system_functions sf
SET ar_systems_id = sf.ar_systems_id;
