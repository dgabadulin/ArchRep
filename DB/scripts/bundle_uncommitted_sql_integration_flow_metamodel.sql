-- =============================================================================
-- Итоговый SQL по незакоммиченным изменениям (сборка): проекция потоков в метамодель
-- =============================================================================
-- Источники в рабочем дереве (до commit):
--   • DB/scripts/seed_settings_parameters_from_candidates.sql — строка DISP_INTEGRATION_FLOW_NAME
--   • DB/scripts/migrate_rename_dsip_to_disp_integration_flow_name.sql — UPDATE DSIP→DISP
--   • DB/schema/archrep_issue33_integration_flow_metamodel_projection.sql — DDL + функции + триггер
--
-- Порядок: сначала параметр (чтобы пересборка в конце части 2 уже видела шаблон),
--          затем DDL issue #33 (идемпотентен по IF NOT EXISTS / CREATE OR REPLACE).
--
-- После применения: перезапуск backend (кэш параметров).
-- Если DDL уже есть, а нужны только параметр и пересборка: migrate_issue35_integration_flow_metamodel.sql
--
-- psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/bundle_uncommitted_sql_integration_flow_metamodel.sql
-- =============================================================================
-- NOTICE «already exists / does not exist, skipping» при повторном прогоне — норма.
SET client_min_messages TO WARNING;

-- -----------------------------------------------------------------------------
-- ЧАСТЬ 1: параметры (сида + исправление опечатки DSIP_*)
-- -----------------------------------------------------------------------------
BEGIN;

UPDATE archrep.ar_settings_parameters
SET code = 'DISP_INTEGRATION_FLOW_NAME',
    description = COALESCE(description, '') || ' (код переименован с DSIP_INTEGRATION_FLOW_NAME)'
WHERE code = 'DSIP_INTEGRATION_FLOW_NAME';

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'DISP_INTEGRATION_FLOW_NAME',
  'Шаблон подписи ребра метамодели для проекции интеграционного потока (ar_metamodel_relations.displayed_name). Плейсхолдеры: {source_name},{target_name},{source_code},{target_code},{status_name},{event_type_name},{transferred_data},{transfer_method},{periodicity},{id}. Условные блоки [[...]] как у других DISP. См. docs/metamodel-projection-ar-integration-flows.md',
  '{source_name} → {target_name} [{status_name}]',
  'string',
  'Display',
  false,
  false
)
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- -----------------------------------------------------------------------------
-- ЧАСТЬ 2: Issue #33 — DDL, тип связи, функции, триггер, первичная пересборка
-- (копия DB/schema/archrep_issue33_integration_flow_metamodel_projection.sql)
-- -----------------------------------------------------------------------------
BEGIN;

-- Периодичность (если ещё не добавлена issue21)
ALTER TABLE archrep.ar_integration_flows
  ADD COLUMN IF NOT EXISTS periodicity varchar NULL;

ALTER TABLE archrep.ar_metamodel_relations
  ADD COLUMN IF NOT EXISTS reference_to_baserow bigint NULL;

ALTER TABLE archrep.ar_metamodel_relations
  ADD COLUMN IF NOT EXISTS displayed_name varchar NULL;

COMMENT ON COLUMN archrep.ar_metamodel_relations.reference_to_baserow IS 'Ссылка на строку источника проекции (для потоков: ar_integration_flows.id), без FK';
COMMENT ON COLUMN archrep.ar_metamodel_relations.displayed_name IS 'Вычисляемая подпись (параметр DISP_INTEGRATION_FLOW_NAME); в UI: displayed_name, иначе name';

CREATE INDEX IF NOT EXISTS ar_metamodel_relations_ref_baserow_idx
  ON archrep.ar_metamodel_relations (reference_to_baserow)
  WHERE reference_to_baserow IS NOT NULL;

DROP INDEX IF EXISTS archrep.ar_metamodel_rel_integration_flow_ref_uq;
CREATE UNIQUE INDEX IF NOT EXISTS ar_metamodel_rel_integration_flow_ref_uq
  ON archrep.ar_metamodel_relations (reference_to_baserow)
  WHERE relation_type = 'integration_flow' AND reference_to_baserow IS NOT NULL;

-- Тип связи system → system
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT
  'integration_flow',
  'Интеграционный поток',
  'Проекция из ar_integration_flows; синхронизация триггером и пересборкой',
  et.id,
  et.id
FROM archrep.ar_metamodel_entity_types et
WHERE et.code = 'system'
  AND NOT EXISTS (
    SELECT 1
    FROM archrep.ar_metamodel_relation_types rt
    WHERE rt.code = 'integration_flow'
      AND rt.from_entity_type_id = et.id
      AND rt.to_entity_type_id = et.id
  );

-- Шаблон: плейсхолдеры {source_name},{target_name},{source_code},{target_code},{status_name},{event_type_name},{transferred_data},{transfer_method},{periodicity},{id}
CREATE OR REPLACE FUNCTION archrep.integration_flow_metamodel_displayed_name(p_flow_id bigint)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tpl text;
  sn text := '';
  sc text := '';
  tn text := '';
  tc text := '';
  st text := '';
  etn text := '';
  td text := '';
  tm text := '';
  pr text := '';
  result text;
BEGIN
  IF p_flow_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.value INTO tpl
  FROM archrep.ar_settings_parameters p
  WHERE p.code = 'DISP_INTEGRATION_FLOW_NAME'
  LIMIT 1;

  SELECT
    COALESCE(s.name, ''),
    COALESCE(s.code, ''),
    COALESCE(t.name, ''),
    COALESCE(t.code, ''),
    COALESCE(fs.name, ''),
    COALESCE(fet.name, ''),
    COALESCE(f.transferred_data, ''),
    COALESCE(f.transfer_method, ''),
    COALESCE(f.periodicity, '')
  INTO sn, sc, tn, tc, st, etn, td, tm, pr
  FROM archrep.ar_integration_flows f
  LEFT JOIN archrep.ar_systems s ON s.id = f.source_ar_systems_id
  LEFT JOIN archrep.ar_systems t ON t.id = f.target_ar_systems_id
  LEFT JOIN archrep.ar_integration_flow_statuses fs ON fs.id = f.ar_integration_flow_statuses_id
  LEFT JOIN archrep.ar_integration_flow_event_types fet ON fet.id = f.ar_integration_flow_event_types_id
  WHERE f.id = p_flow_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF tpl IS NULL OR btrim(tpl) = '' THEN
    IF sn <> '' AND tn <> '' THEN
      RETURN sn || ' → ' || tn;
    END IF;
    RETURN 'Поток #' || p_flow_id::text;
  END IF;

  result := tpl;
  result := replace(result, '{source_name}', sn);
  result := replace(result, '{target_name}', tn);
  result := replace(result, '{source_code}', sc);
  result := replace(result, '{target_code}', tc);
  result := replace(result, '{status_name}', st);
  result := replace(result, '{event_type_name}', etn);
  result := replace(result, '{transferred_data}', td);
  result := replace(result, '{transfer_method}', tm);
  result := replace(result, '{periodicity}', pr);
  result := replace(result, '{id}', p_flow_id::text);

  RETURN left(result, 2000);
END;
$$;

COMMENT ON FUNCTION archrep.integration_flow_metamodel_displayed_name(bigint) IS 'Подпись ребра метамодели для потока; шаблон DISP_INTEGRATION_FLOW_NAME';

CREATE OR REPLACE FUNCTION archrep.upsert_integration_flow_metamodel_projection(p_flow_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_name text;
  v_disp text;
  v_src bigint;
  v_tgt bigint;
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

  v_name := 'Поток интеграции #' || p_flow_id::text;
  v_disp := archrep.integration_flow_metamodel_displayed_name(p_flow_id);

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'integration_flow'
    AND r.reference_to_baserow = p_flow_id;

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
    'system',
    v_src,
    'system',
    v_tgt,
    'integration_flow',
    v_name,
    NULL,
    v_disp,
    p_flow_id,
    jsonb_build_object('source_table', 'ar_integration_flows', 'source_id', p_flow_id)
  );
END;
$$;

COMMENT ON FUNCTION archrep.upsert_integration_flow_metamodel_projection(bigint) IS 'Одна проекция integration_flow по id потока; вызывается триггером и из rebuild';

CREATE OR REPLACE FUNCTION archrep.rebuild_integration_flow_metamodel_relations()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  fid bigint;
BEGIN
  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'integration_flow';

  FOR fid IN SELECT f.id FROM archrep.ar_integration_flows f ORDER BY f.id
  LOOP
    PERFORM archrep.upsert_integration_flow_metamodel_projection(fid);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION archrep.rebuild_integration_flow_metamodel_relations() IS 'Удаляет все проекции integration_flow и создаёт заново из ar_integration_flows';

CREATE OR REPLACE FUNCTION archrep.trg_ar_integration_flows_sync_metamodel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM archrep.upsert_integration_flow_metamodel_projection(NEW.id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_integration_flows_sync_metamodel ON archrep.ar_integration_flows;
CREATE TRIGGER trg_ar_integration_flows_sync_metamodel
  AFTER INSERT OR UPDATE ON archrep.ar_integration_flows
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.trg_ar_integration_flows_sync_metamodel();

-- Первичное заполнение проекций для уже существующих потоков
SELECT archrep.rebuild_integration_flow_metamodel_relations();

COMMIT;
