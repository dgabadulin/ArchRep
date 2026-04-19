-- Хранимая процедура: перенос данных из temp_for_import_integration_flows в ar_integration_flows.
-- Для каждой строки временной таблицы ищет системы from/to в ar_systems по коду, краткому или полному наименованию и записывает поток.
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_proc_import_integration_flows.sql

CREATE OR REPLACE PROCEDURE archrep.import_integration_flows_from_temp(
  OUT inserted_count bigint,
  OUT skipped_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted bigint;
  v_skipped bigint;
BEGIN
  -- Вставка в ar_integration_flows: для каждой строки temp находим id систем по code, name, fullname (без учёта регистра)
  WITH ins AS (
    INSERT INTO archrep.ar_integration_flows (
      source_ar_systems_id,
      target_ar_systems_id,
      transferred_data,
      transfer_method,
      periodicity
    )
    SELECT
      src.id,
      tgt.id,
      NULLIF(trim(t.transferred_data), ''),
      NULLIF(trim(t.transfer_metod), ''),
      NULLIF(trim(t.periodicity), '')
    FROM archrep.temp_for_import_integration_flows t
    LEFT JOIN LATERAL (
      SELECT id FROM archrep.ar_systems
      WHERE trim(t.system_from) IS NOT NULL AND trim(t.system_from) <> ''
        AND (code = trim(t.system_from) OR lower(code) = lower(trim(t.system_from))
             OR name = trim(t.system_from) OR lower(name) = lower(trim(t.system_from))
             OR fullname = trim(t.system_from) OR (fullname IS NOT NULL AND lower(fullname) = lower(trim(t.system_from))))
      LIMIT 1
    ) src(id) ON true
    LEFT JOIN LATERAL (
      SELECT id FROM archrep.ar_systems
      WHERE trim(t.system_to) IS NOT NULL AND trim(t.system_to) <> ''
        AND (code = trim(t.system_to) OR lower(code) = lower(trim(t.system_to))
             OR name = trim(t.system_to) OR lower(name) = lower(trim(t.system_to))
             OR fullname = trim(t.system_to) OR (fullname IS NOT NULL AND lower(fullname) = lower(trim(t.system_to))))
      LIMIT 1
    ) tgt(id) ON true
    WHERE src.id IS NOT NULL
      AND tgt.id IS NOT NULL
    RETURNING id
  )
  SELECT count(*)::bigint INTO v_inserted FROM ins;

  -- Строки, пропущенные из‑за ненайденной системы-источника или системы-получателя
  SELECT count(*)::bigint INTO v_skipped
  FROM archrep.temp_for_import_integration_flows t
  WHERE (trim(t.system_from) IS NOT NULL AND trim(t.system_from) <> '')
    AND (trim(t.system_to) IS NOT NULL AND trim(t.system_to) <> '')
    AND NOT (
      EXISTS (
        SELECT 1 FROM archrep.ar_systems s
        WHERE s.code = trim(t.system_from) OR lower(s.code) = lower(trim(t.system_from))
           OR s.name = trim(t.system_from) OR lower(s.name) = lower(trim(t.system_from))
           OR s.fullname = trim(t.system_from) OR (s.fullname IS NOT NULL AND lower(s.fullname) = lower(trim(t.system_from)))
      )
      AND EXISTS (
        SELECT 1 FROM archrep.ar_systems s
        WHERE s.code = trim(t.system_to) OR lower(s.code) = lower(trim(t.system_to))
           OR s.name = trim(t.system_to) OR lower(s.name) = lower(trim(t.system_to))
           OR s.fullname = trim(t.system_to) OR (s.fullname IS NOT NULL AND lower(s.fullname) = lower(trim(t.system_to)))
      )
    );

  inserted_count := v_inserted;
  skipped_count := v_skipped;
END;
$$;

COMMENT ON PROCEDURE archrep.import_integration_flows_from_temp(bigint, bigint) IS
  'Переносит записи из temp_for_import_integration_flows в ar_integration_flows, подставляя source_ar_systems_id и target_ar_systems_id по совпадению system_from/system_to с кодом, кратким (name) или полным (fullname) наименованием в ar_systems. inserted_count — число вставленных строк, skipped_count — число строк, пропущенных из‑за ненайденной системы.';

-- Пример вызова:
-- CALL archrep.import_integration_flows_from_temp(NULL, NULL);
-- или с выводом результата:
-- DO $$ DECLARE ins bigint; sk bigint; BEGIN CALL archrep.import_integration_flows_from_temp(ins, sk); RAISE NOTICE 'Вставлено: %, пропущено: %', ins, sk; END $$;
