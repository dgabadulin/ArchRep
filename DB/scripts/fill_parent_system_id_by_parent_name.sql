-- Заполняет ar_systems.parent_ar_systems_id по ar_systems.parent_name.
-- Безопасный режим: обновляет только строки с ОДНОЗНАЧНЫМ совпадением parent_name -> parent.id.
-- Запуск:
--   psql -h ... -U ... -d ... -f DB/scripts/fill_parent_system_id_by_parent_name.sql
--
-- Примечание:
--   Скрипт рассчитан на схему archrep (боевую). Если нужно для archrep_test,
--   замените в скрипте "archrep." на "archrep_test.".

BEGIN;

-- 0) Диагностика до обновления
-- Всего строк-кандидатов к заполнению parent_ar_systems_id.
SELECT count(*) AS candidates_before
FROM archrep.ar_systems s
WHERE s.parent_ar_systems_id IS NULL
  AND NULLIF(btrim(s.parent_name), '') IS NOT NULL;

-- 1) Подготовить кандидатов для сопоставления parent_name -> parent.id.
-- Сопоставление по lower(trim(name)) = lower(trim(parent_name)).
-- Исключаем самоссылку.
WITH unresolved AS (
  SELECT s.id, s.parent_name
  FROM archrep.ar_systems s
  WHERE s.parent_ar_systems_id IS NULL
    AND NULLIF(btrim(s.parent_name), '') IS NOT NULL
),
matches AS (
  SELECT
    u.id AS child_id,
    p.id AS parent_id
  FROM unresolved u
  JOIN archrep.ar_systems p
    ON lower(btrim(p.name)) = lower(btrim(u.parent_name))
   AND p.id <> u.id
),
unique_matches AS (
  SELECT m.child_id, min(m.parent_id) AS parent_id
  FROM matches m
  GROUP BY m.child_id
  HAVING count(*) = 1
)
UPDATE archrep.ar_systems s
SET parent_ar_systems_id = u.parent_id
FROM unique_matches u
WHERE s.id = u.child_id
  AND s.parent_ar_systems_id IS NULL;

-- 2) Диагностика после обновления
SELECT count(*) AS still_unresolved_after
FROM archrep.ar_systems s
WHERE s.parent_ar_systems_id IS NULL
  AND NULLIF(btrim(s.parent_name), '') IS NOT NULL;

-- 3) Проблемные строки: нет совпадения / неоднозначные совпадения (дубли имен родителей)
WITH unresolved AS (
  SELECT s.id, s.code, s.name, s.parent_name
  FROM archrep.ar_systems s
  WHERE s.parent_ar_systems_id IS NULL
    AND NULLIF(btrim(s.parent_name), '') IS NOT NULL
),
match_counts AS (
  SELECT
    u.id,
    count(p.id) AS parent_candidates
  FROM unresolved u
  LEFT JOIN archrep.ar_systems p
    ON lower(btrim(p.name)) = lower(btrim(u.parent_name))
   AND p.id <> u.id
  GROUP BY u.id
)
SELECT u.id, u.code, u.name, u.parent_name, mc.parent_candidates
FROM unresolved u
JOIN match_counts mc ON mc.id = u.id
ORDER BY mc.parent_candidates DESC, u.id
LIMIT 200;

COMMIT;
