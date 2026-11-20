-- Repair маркера версии схемы после трёх миграций, накатанных без upsert в ar_schema_info:
--   20261109120000_ai_attachments
--   20261119120000_registry_table_page_size_parameter
--   20261119130000_system_function_delete_cleanup
--
-- Скрипт НЕ меняет схему и НЕ заменяет сами миграции: он только доводит маркер
-- archrep.ar_schema_info до 20261120120000 после проверки, что эффекты трёх миграций
-- действительно есть в БД. Если проверка не проходит — скрипт падает, а не скрывает
-- реально неприменённую миграцию.
--
-- Идемпотентно: повторный запуск безопасен; upsert монотонный, поэтому маркер
-- не может откатиться назад.

DO $$
BEGIN
  IF to_regclass('archrep.ar_schema_info') IS NULL THEN
    RAISE EXCEPTION 'Нет archrep.ar_schema_info: сначала примените migrate_20261104120000_schema_info.sql';
  END IF;

  IF to_regclass('archrep.ar_settings_parameters') IS NULL THEN
    RAISE EXCEPTION 'Нет archrep.ar_settings_parameters: сначала примените базовую схему';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM archrep.ar_settings_parameters
     WHERE code = 'SYS_AI_ATTACHMENTS_ENABLED'
  ) THEN
    RAISE EXCEPTION 'Не применён migrate_20261109120000_ai_attachments.sql (нет SYS_AI_ATTACHMENTS_ENABLED)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM archrep.ar_settings_parameters
     WHERE code = 'ARR_TABLE_PAGE_SIZE'
  ) THEN
    RAISE EXCEPTION 'Не применён migrate_20261119120000_registry_table_page_size_parameter.sql (нет ARR_TABLE_PAGE_SIZE)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_ar_system_functions_delete_metamodel'
       AND tgrelid = to_regclass('archrep.ar_system_functions')
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Не применён migrate_20261119130000_system_function_delete_cleanup.sql (нет trg_ar_system_functions_delete_metamodel)';
  END IF;
END $$;

-- Версия схемы (issue #96): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261120120000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by
  WHERE version < EXCLUDED.version;
