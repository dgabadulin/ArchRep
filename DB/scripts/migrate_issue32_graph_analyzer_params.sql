-- Issue #32: данные анализатора зависимостей — тип subsystem в порядке сущностей и иконках графа.
-- Идемпотентно: subsystem не дублируется; ключи JSON не перезаписываются, если уже заданы.
-- Запуск: psql -h ... -U ... -d ... -f DB/scripts/migrate_issue32_graph_analyzer_params.sql

-- 1) GRAPH_ENTITY_ORDER: вставить "subsystem" сразу после первого вхождения "system", иначе — в конец массива.
DO $ord$
DECLARE
  v text;
  arr jsonb;
  result jsonb := '[]'::jsonb;
  elem text;
  had_subsystem boolean := false;
  placed boolean := false;
BEGIN
  SELECT value INTO v FROM archrep.ar_settings_parameters WHERE code = 'GRAPH_ENTITY_ORDER';
  IF NOT FOUND THEN
    RAISE NOTICE 'migrate_issue32: GRAPH_ENTITY_ORDER отсутствует, пропуск порядка сущностей';
    RETURN;
  END IF;

  BEGIN
    arr := v::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'migrate_issue32: GRAPH_ENTITY_ORDER не JSON-массив, пропуск: %', SQLERRM;
    RETURN;
  END;

  IF jsonb_typeof(arr) <> 'array' THEN
    RAISE NOTICE 'migrate_issue32: GRAPH_ENTITY_ORDER не массив, пропуск';
    RETURN;
  END IF;

  FOR elem IN SELECT jsonb_array_elements_text(arr)
  LOOP
    IF elem = 'subsystem' THEN
      had_subsystem := true;
    END IF;
  END LOOP;

  IF had_subsystem THEN
    RAISE NOTICE 'migrate_issue32: subsystem уже есть в GRAPH_ENTITY_ORDER';
    RETURN;
  END IF;

  FOR elem IN SELECT jsonb_array_elements_text(arr)
  LOOP
    result := result || jsonb_build_array(elem);
    IF elem = 'system' THEN
      result := result || jsonb_build_array('subsystem');
      placed := true;
    END IF;
  END LOOP;

  IF NOT placed THEN
    result := result || jsonb_build_array('subsystem');
  END IF;

  UPDATE archrep.ar_settings_parameters
  SET value = result::text,
      updated_at = now()
  WHERE code = 'GRAPH_ENTITY_ORDER';

  RAISE NOTICE 'migrate_issue32: GRAPH_ENTITY_ORDER обновлён (добавлен subsystem)';
END
$ord$;

-- 2) GRAPH_ENTITY_ICONS: добавить subsystem и (при отсутствии) system_child с тем же набором полей.
DO $ico$
DECLARE
  v text;
  j jsonb;
  changed boolean := false;
  sub jsonb := jsonb_build_object(
    'label', 'Модуль системы',
    'icon', 'Puzzle',
    'listLabel', 'Модули систем'
  );
BEGIN
  SELECT value INTO v FROM archrep.ar_settings_parameters WHERE code = 'GRAPH_ENTITY_ICONS';
  IF NOT FOUND THEN
    RAISE NOTICE 'migrate_issue32: GRAPH_ENTITY_ICONS отсутствует, пропуск иконок';
    RETURN;
  END IF;

  BEGIN
    j := v::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'migrate_issue32: GRAPH_ENTITY_ICONS не JSON, пропуск: %', SQLERRM;
    RETURN;
  END;

  IF jsonb_typeof(j) <> 'object' THEN
    RAISE NOTICE 'migrate_issue32: GRAPH_ENTITY_ICONS не объект, пропуск';
    RETURN;
  END IF;

  IF NOT (j ? 'subsystem') THEN
    j := j || jsonb_build_object('subsystem', sub);
    changed := true;
  END IF;

  IF NOT (j ? 'system_child') THEN
    j := j || jsonb_build_object('system_child', COALESCE(j->'subsystem', sub));
    changed := true;
  END IF;

  IF changed THEN
    UPDATE archrep.ar_settings_parameters
    SET value = j::text,
        updated_at = now()
    WHERE code = 'GRAPH_ENTITY_ICONS';
    RAISE NOTICE 'migrate_issue32: GRAPH_ENTITY_ICONS обновлён (subsystem / system_child)';
  ELSE
    RAISE NOTICE 'migrate_issue32: subsystem/system_child уже заданы в GRAPH_ENTITY_ICONS';
  END IF;
END
$ico$;
