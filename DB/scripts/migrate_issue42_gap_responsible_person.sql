-- Issue #42: поле «Ответственное лицо» (ФИО, текст) в реестре архитектурного долга.
-- Выполнить на существующей БД после archrep_issue23_architecture_debt.sql
-- psql ... -f DB/scripts/migrate_issue42_gap_responsible_person.sql

BEGIN;

ALTER TABLE archrep.ar_gaps
  ADD COLUMN IF NOT EXISTS responsible_person varchar NULL;

COMMENT ON COLUMN archrep.ar_gaps.responsible_person IS 'Ответственное лицо (ФИО), опционально';

COMMIT;
