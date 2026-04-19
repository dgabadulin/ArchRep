-- Issue #56: проекции ar_integration_flows в метамодель с учётом модулей (system/subsystem по parent_ar_systems_id).
-- Одна строка потока -> одна строка ar_metamodel_relations с корректным relation_type и концами.
-- Синхрон при INSERT/UPDATE потока и при смене parent_ar_systems_id у ar_systems.
--
-- Предусловия: выполнены DB/schema/archrep_issue33_integration_flow_metamodel_projection.sql
--   (колонки reference_to_baserow, displayed_name; функция integration_flow_metamodel_displayed_name).
--
-- psql ... -f DB/scripts/migrate_issue56_integration_flow_module_projections.sql

SET client_min_messages TO WARNING;

BEGIN;

-- Типы связей (ОТ/К по кодам сущностей system / subsystem)
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT
  'integration_flow_system_module',
  'Интеграционный поток (Система → Модуль)',
  'Проекция из ar_integration_flows; синхронизация триггером и пересборкой',
  sys_et.id,
  sub_et.id
FROM archrep.ar_metamodel_entity_types sys_et
CROSS JOIN archrep.ar_metamodel_entity_types sub_et
WHERE sys_et.code = 'system'
  AND sub_et.code = 'subsystem'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types rt
    WHERE rt.code = 'integration_flow_system_module'
      AND rt.from_entity_type_id = sys_et.id
      AND rt.to_entity_type_id = sub_et.id
  );

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT
  'integration_flow_module_system',
  'Интеграционный поток (Модуль → Система)',
  'Проекция из ar_integration_flows; синхронизация триггером и пересборкой',
  sub_et.id,
  sys_et.id
FROM archrep.ar_metamodel_entity_types sys_et
CROSS JOIN archrep.ar_metamodel_entity_types sub_et
WHERE sys_et.code = 'system'
  AND sub_et.code = 'subsystem'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types rt
    WHERE rt.code = 'integration_flow_module_system'
      AND rt.from_entity_type_id = sub_et.id
      AND rt.to_entity_type_id = sys_et.id
  );

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT
  'integration_flow_module_module',
  'Интеграционный поток (Модуль → Модуль)',
  'Проекция из ar_integration_flows; синхронизация триггером и пересборкой',
  sub_a.id,
  sub_b.id
FROM archrep.ar_metamodel_entity_types sub_a
CROSS JOIN archrep.ar_metamodel_entity_types sub_b
WHERE sub_a.code = 'subsystem'
  AND sub_b.code = 'subsystem'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types rt
    WHERE rt.code = 'integration_flow_module_module'
      AND rt.from_entity_type_id = sub_a.id
      AND rt.to_entity_type_id = sub_b.id
  );

-- Один поток — одна проекция; тип строки может меняться (system/subsystem)
DROP INDEX IF EXISTS archrep.ar_metamodel_rel_integration_flow_ref_uq;
CREATE UNIQUE INDEX IF NOT EXISTS ar_metamodel_rel_iflow_proj_ref_uq
  ON archrep.ar_metamodel_relations (reference_to_baserow)
  WHERE reference_to_baserow IS NOT NULL
    AND relation_type IN (
      'integration_flow',
      'integration_flow_system_module',
      'integration_flow_module_system',
      'integration_flow_module_module'
    );

CREATE OR REPLACE FUNCTION archrep.upsert_integration_flow_metamodel_projection(p_flow_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text;
  v_disp text;
  v_src bigint;
  v_tgt bigint;
  v_from_type text;
  v_to_type text;
  v_rel_type text;
BEGIN
  IF p_flow_id IS NULL THEN
    RETURN;
  END IF;

  SELECT f.source_ar_systems_id, f.target_ar_systems_id
  INTO v_src, v_tgt
  FROM archrep.ar_integration_flows f
  WHERE f.id = p_flow_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    CASE
      WHEN s.parent_ar_systems_id IS NOT NULL AND s.parent_ar_systems_id <> s.id THEN 'subsystem'
      ELSE 'system'
    END
  INTO v_from_type
  FROM archrep.ar_systems s
  WHERE s.id = v_src;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    CASE
      WHEN s.parent_ar_systems_id IS NOT NULL AND s.parent_ar_systems_id <> s.id THEN 'subsystem'
      ELSE 'system'
    END
  INTO v_to_type
  FROM archrep.ar_systems s
  WHERE s.id = v_tgt;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_rel_type := CASE
    WHEN v_from_type = 'system' AND v_to_type = 'system' THEN 'integration_flow'
    WHEN v_from_type = 'system' AND v_to_type = 'subsystem' THEN 'integration_flow_system_module'
    WHEN v_from_type = 'subsystem' AND v_to_type = 'system' THEN 'integration_flow_module_system'
    ELSE 'integration_flow_module_module'
  END;

  v_name := 'Поток интеграции #' || p_flow_id::text;
  v_disp := archrep.integration_flow_metamodel_displayed_name(p_flow_id);

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.reference_to_baserow = p_flow_id
    AND r.relation_type IN (
      'integration_flow',
      'integration_flow_system_module',
      'integration_flow_module_system',
      'integration_flow_module_module'
    );

  INSERT INTO archrep.ar_metamodel_relations (
    from_entity_type,
    from_entity_id,
    to_entity_type,
    to_entity_id,
    relation_type,
    name,
    description,
    displayed_name,
    reference_to_baserow,
    payload
  )
  VALUES (
    v_from_type,
    v_src,
    v_to_type,
    v_tgt,
    v_rel_type,
    v_name,
    NULL,
    v_disp,
    p_flow_id,
    jsonb_build_object('source_table', 'ar_integration_flows', 'source_id', p_flow_id)
  );
END;
$$;

COMMENT ON FUNCTION archrep.upsert_integration_flow_metamodel_projection(bigint) IS 'Проекция одного потока: тип связи и концы по фактическому модулю/системе (parent_ar_systems_id)';

CREATE OR REPLACE FUNCTION archrep.rebuild_integration_flow_metamodel_relations()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  fid bigint;
BEGIN
  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type IN (
    'integration_flow',
    'integration_flow_system_module',
    'integration_flow_module_system',
    'integration_flow_module_module'
  );

  FOR fid IN SELECT f.id FROM archrep.ar_integration_flows f ORDER BY f.id
  LOOP
    PERFORM archrep.upsert_integration_flow_metamodel_projection(fid);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION archrep.rebuild_integration_flow_metamodel_relations() IS 'Удаляет все проекции интеграционных потоков и создаёт заново из ar_integration_flows';

CREATE OR REPLACE FUNCTION archrep.trg_ar_systems_resync_integration_flow_projections()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  fid bigint;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF OLD.parent_ar_systems_id IS NOT DISTINCT FROM NEW.parent_ar_systems_id THEN
    RETURN NEW;
  END IF;

  FOR fid IN
    SELECT f.id
    FROM archrep.ar_integration_flows f
    WHERE f.source_ar_systems_id = NEW.id OR f.target_ar_systems_id = NEW.id
  LOOP
    PERFORM archrep.upsert_integration_flow_metamodel_projection(fid);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_systems_resync_integration_flow_projections ON archrep.ar_systems;
CREATE TRIGGER trg_systems_resync_integration_flow_projections
  AFTER UPDATE OF parent_ar_systems_id ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE FUNCTION archrep.trg_ar_systems_resync_integration_flow_projections();

SELECT archrep.rebuild_integration_flow_metamodel_relations();

COMMIT;
