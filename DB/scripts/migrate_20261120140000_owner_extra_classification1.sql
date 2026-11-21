-- Функциональные вертикали: дополнительная классификация справочника владельцев/направлений.
-- Поле заполняется best-effort по наименованию существующих записей; пустые записи
-- можно классифицировать вручную. Идемпотентно. После применения: перезапуск backend.

ALTER TABLE archrep.ar_system_owners
  ADD COLUMN IF NOT EXISTS extra_classification1 VARCHAR(255) NULL;

COMMENT ON TABLE archrep.ar_system_owners IS
  'Справочник функциональных вертикалей (направления/владельцы систем)';
COMMENT ON COLUMN archrep.ar_system_owners.name IS 'Наименование функциональной вертикали';
COMMENT ON COLUMN archrep.ar_system_owners.leader IS 'Руководитель направления';
COMMENT ON COLUMN archrep.ar_system_owners.extra_classification1 IS
  'Доп.классификация1: функциональная вертикаль верхнего уровня';

-- Точные названия из согласованного перечня.
UPDATE archrep.ar_system_owners
SET extra_classification1 = CASE
  WHEN lower(trim(name)) = lower('Производство и операции') THEN 'Производство и операции'
  WHEN lower(trim(name)) = lower('Финансы и экономика') THEN 'Финансы и экономика'
  WHEN lower(trim(name)) = lower('Персонал (HR)') THEN 'Персонал (HR)'
  WHEN lower(trim(name)) = lower('Продажи и клиентский сервис') THEN 'Продажи и клиентский сервис'
  WHEN lower(trim(name)) = lower('Закупки и логистика') THEN 'Закупки и логистика'
  WHEN lower(trim(name)) = lower('Технический блок и инжиниринг') THEN 'Технический блок и инжиниринг'
  WHEN lower(trim(name)) = lower('ИТ') THEN 'ИТ'
  WHEN lower(trim(name)) = lower('Безопасность') THEN 'Безопасность'
  WHEN lower(trim(name)) = lower('Административно-правовой блок') THEN 'Административно-правовой блок'
  WHEN lower(trim(name)) = lower('Управляющая компания') THEN 'Управляющая компания'
  ELSE extra_classification1
END
WHERE extra_classification1 IS NULL OR trim(extra_classification1) = '';

-- Best-effort по ключевым словам для исторических названий направлений.
UPDATE archrep.ar_system_owners
SET extra_classification1 = CASE
  WHEN name ILIKE '%производ%' OR name ILIKE '%операц%' THEN 'Производство и операции'
  WHEN name ILIKE '%финанс%' OR name ILIKE '%эконом%' OR name ILIKE '%бухгал%' THEN 'Финансы и экономика'
  WHEN name ILIKE '%персонал%' OR name ILIKE '%HR%' OR name ILIKE '%hr%' THEN 'Персонал (HR)'
  WHEN name ILIKE '%продаж%' OR name ILIKE '%клиент%' OR name ILIKE '%реализ%' OR name ILIKE '%Маркет%' OR name ILIKE '%САС%' OR name ILIKE '%сайты%' THEN 'Продажи и клиентский сервис'
  WHEN name ILIKE '%закуп%' OR name ILIKE '%логист%' OR name ILIKE '%снабж%' THEN 'Закупки и логистика'
  WHEN name ILIKE '%Управление ППО%' OR name ILIKE '%инжинир%' OR name ILIKE '%инженер%' THEN 'Технический блок и инжиниринг'
  WHEN name ILIKE 'Аналит%' OR name ILIKE '% ит%' OR name ILIKE '%ит %' OR name ILIKE '%Инфра%' OR name ILIKE '%цифров%' THEN 'ИТ'
  WHEN name ILIKE '%безопас%' THEN 'Безопасность'
  WHEN name ILIKE '%администр%' OR name ILIKE '%правов%' OR name ILIKE '%юрид%' THEN 'Административно-правовой блок'
  WHEN name ILIKE '%управляющ%' THEN 'Управляющая компания'
  ELSE extra_classification1
END
WHERE extra_classification1 IS NULL OR trim(extra_classification1) = '';

-- Версия схемы (issue #123): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261120140000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by
  WHERE archrep.ar_schema_info.version < EXCLUDED.version;
