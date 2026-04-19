-- FK: удаление функции каталога не должно молча снимать выбор в заключениях.
-- Было: ON DELETE CASCADE на ar_adr_increment_system_functions.ar_system_functions_id
-- Стало: ON DELETE RESTRICT — сначала убрать функцию в UI заключения, либо API вернёт 409 с перечнем ADR.

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class rel ON c.conrelid = rel.oid
  JOIN pg_namespace n ON rel.relnamespace = n.oid
  JOIN pg_class ref ON c.confrelid = ref.oid
  JOIN pg_namespace rn ON ref.relnamespace = rn.oid
  WHERE n.nspname = 'archrep'
    AND rel.relname = 'ar_adr_increment_system_functions'
    AND rn.nspname = 'archrep'
    AND ref.relname = 'ar_system_functions'
    AND c.contype = 'f';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE archrep.ar_adr_increment_system_functions DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE archrep.ar_adr_increment_system_functions
  ADD CONSTRAINT ar_adr_increment_system_functions_ar_system_functions_fk
  FOREIGN KEY (ar_system_functions_id)
  REFERENCES archrep.ar_system_functions (id)
  ON DELETE RESTRICT;
