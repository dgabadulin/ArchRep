-- Переименование опечатки DSIP_* → DISP_INTEGRATION_FLOW_NAME (issue #33).
-- Для одного прогона вместе с массовой пересборкой проекций используйте:
--   DB/scripts/migrate_issue35_integration_flow_metamodel.sql
-- psql ... -f DB/scripts/migrate_rename_dsip_to_disp_integration_flow_name.sql

BEGIN;

UPDATE archrep.ar_settings_parameters
SET code = 'DISP_INTEGRATION_FLOW_NAME',
    description = COALESCE(description, '') || ' (код переименован с DSIP_INTEGRATION_FLOW_NAME)'
WHERE code = 'DSIP_INTEGRATION_FLOW_NAME';

-- Обновить тело функции, если миграция issue33 уже была без переименования:
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

COMMIT;
