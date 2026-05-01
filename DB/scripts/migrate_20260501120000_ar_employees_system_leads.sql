-- Сотрудники (ar_employees), FK на ИС (it_lead_employee_id / business_lead_employee_id),
-- проекции в ar_metamodel_relations через триггер; подпись рёбер графа — из типа связи (name), не displayed_name.
-- DISP_EMPLOYEE_TEMPLATE — для списков/карточек сотрудников; коды связей — в настройках SYSTEM_*_RELATION_CODE.
-- Идемпотентно где возможно (IF NOT EXISTS, NOT EXISTS).
-- Уникальность «по фамилии» (первое слово full_name) — только выражение в индексе, отдельной колонки нет.
-- После применения: перезапуск backend (кэш ar_settings_parameters).

-- ---------------------------------------------------------------------------
-- Таблица сотрудников
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archrep.ar_employees (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(512) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE archrep.ar_employees IS 'Сотрудник (карточка для ответственных; логин — в будущем ar_users)';

-- Снятие устаревшей колонки surname, если миграция накатывалась ранней версией скрипта
ALTER TABLE archrep.ar_employees DROP COLUMN IF EXISTS surname;

DROP INDEX IF EXISTS archrep.ar_employees_surname_lower_uidx;
DROP INDEX IF EXISTS archrep.ar_employees_first_word_lower_uidx;

-- Уникальный индекс по первому слову full_name создаётся в конце файла после согласования данных.

-- ---------------------------------------------------------------------------
-- FK на ИС (после таблицы сотрудников)
-- ---------------------------------------------------------------------------
ALTER TABLE archrep.ar_systems
  ADD COLUMN IF NOT EXISTS it_lead_employee_id BIGINT REFERENCES archrep.ar_employees (id) ON DELETE SET NULL;
ALTER TABLE archrep.ar_systems
  ADD COLUMN IF NOT EXISTS business_lead_employee_id BIGINT REFERENCES archrep.ar_employees (id) ON DELETE SET NULL;

COMMENT ON COLUMN archrep.ar_systems.it_lead_employee_id IS 'Ответственный от ИТ (FK → ar_employees)';
COMMENT ON COLUMN archrep.ar_systems.business_lead_employee_id IS 'Владелец системы / ответственный от бизнеса (FK → ar_employees)';

-- ---------------------------------------------------------------------------
-- Параметры
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES
  (
    'DISP_EMPLOYEE_TEMPLATE',
    'Шаблон видимого имени сотрудника: {full_name}, {status} (active/inactive); условные блоки [[ ]].',
    '{full_name} [[({status})]]',
    'string',
    'Отображение',
    false,
    false
  ),
  (
    'SYSTEM_IT_LEAD_RELATION_CODE',
    'Код связи метамодели: ИС (корень) → сотрудник (ИТ-лид).',
    'system_it_lead',
    'string',
    'Метамодель',
    false,
    false
  ),
  (
    'SUBSYSTEM_IT_LEAD_RELATION_CODE',
    'Код связи: модуль ИС → сотрудник (ИТ-лид).',
    'subsystem_it_lead',
    'string',
    'Метамодель',
    false,
    false
  ),
  (
    'SYSTEM_BUSINESS_LEAD_RELATION_CODE',
    'Код связи: ИС (корень) → сотрудник (бизнес-лид).',
    'system_business_lead',
    'string',
    'Метамодель',
    false,
    false
  ),
  (
    'SUBSYSTEM_BUSINESS_LEAD_RELATION_CODE',
    'Код связи: модуль ИС → сотрудник (бизнес-лид).',
    'subsystem_business_lead',
    'string',
    'Метамодель',
    false,
    false
  )
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Тип сущности employee и типы связей
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'employee', 'Сотрудник', 'ar_employees', 'Справочник сотрудников (ответственные ИТ/бизнес)'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'employee');

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT v.code, v.name, v.description, v.from_id, v.to_id
FROM (
  SELECT 'system_it_lead'::varchar AS code,
         'Ответственный от ИТ'::varchar AS name,
         'Ответственный от ИТ (корневая система)'::varchar AS description,
         s.id AS from_id,
         e.id AS to_id
  FROM archrep.ar_metamodel_entity_types s
  CROSS JOIN archrep.ar_metamodel_entity_types e
  WHERE s.code = 'system' AND e.code = 'employee'
  UNION ALL
  SELECT 'subsystem_it_lead', 'Ответственный от ИТ', 'Ответственный от ИТ (модуль)', s.id, e.id
  FROM archrep.ar_metamodel_entity_types s
  CROSS JOIN archrep.ar_metamodel_entity_types e
  WHERE s.code = 'subsystem' AND e.code = 'employee'
  UNION ALL
  SELECT 'system_business_lead', 'Владелец системы', 'Владелец системы (корневая система)', s.id, e.id
  FROM archrep.ar_metamodel_entity_types s
  CROSS JOIN archrep.ar_metamodel_entity_types e
  WHERE s.code = 'system' AND e.code = 'employee'
  UNION ALL
  SELECT 'subsystem_business_lead', 'Владелец системы', 'Владелец системы (модуль)', s.id, e.id
  FROM archrep.ar_metamodel_entity_types s
  CROSS JOIN archrep.ar_metamodel_entity_types e
  WHERE s.code = 'subsystem' AND e.code = 'employee'
) v
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relation_types r
  WHERE r.code = v.code AND r.from_entity_type_id = v.from_id AND r.to_entity_type_id = v.to_id
);

-- ---------------------------------------------------------------------------
-- Имя: archrep.normalize_lead_text
-- Назначение: нормализация одной строки it_lead/business_lead при переносе в
--   справочник: схлопывание пробелов; если символов «.» больше двух — взять
--   только первого человека (первые два «.» в стиле «Фамилия И.О.»).
-- Примечание: используется только в блоке однократного сопоставления данных ниже;
--   после него функция удаляется (см. конец файла).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.normalize_lead_text(p_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
  ndots int;
  m text[];
BEGIN
  IF p_input IS NULL THEN
    RETURN NULL;
  END IF;
  s := trim(regexp_replace(p_input, '\s+', ' ', 'g'));
  IF s = '' THEN
    RETURN NULL;
  END IF;
  ndots := length(s) - length(replace(s, '.', ''));
  IF ndots > 2 THEN
    m := regexp_match(s, '^(.+?\..+?\.)');
    IF m IS NOT NULL AND length(trim(m[1])) > 0 THEN
      s := trim(m[1]);
    END IF;
  END IF;
  RETURN s;
END;
$$;

-- ---------------------------------------------------------------------------
-- Имя: archrep.sync_system_employee_metamodel_relations
-- Назначение: поддерживать проекции в ar_metamodel_relations при INSERT/UPDATE/DELETE
--   строки ar_systems по FK it_lead_employee_id и business_lead_employee_id (и смене модуля/корня).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archrep.sync_system_employee_metamodel_relations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sys_it text;
  sub_it text;
  sys_bl text;
  sub_bl text;
  from_type text;
  it_code text;
  bl_code text;
BEGIN
  sys_it := COALESCE(
    (SELECT NULLIF(trim(value), '') FROM archrep.ar_settings_parameters WHERE code = 'SYSTEM_IT_LEAD_RELATION_CODE' LIMIT 1),
    'system_it_lead'
  );
  sub_it := COALESCE(
    (SELECT NULLIF(trim(value), '') FROM archrep.ar_settings_parameters WHERE code = 'SUBSYSTEM_IT_LEAD_RELATION_CODE' LIMIT 1),
    'subsystem_it_lead'
  );
  sys_bl := COALESCE(
    (SELECT NULLIF(trim(value), '') FROM archrep.ar_settings_parameters WHERE code = 'SYSTEM_BUSINESS_LEAD_RELATION_CODE' LIMIT 1),
    'system_business_lead'
  );
  sub_bl := COALESCE(
    (SELECT NULLIF(trim(value), '') FROM archrep.ar_settings_parameters WHERE code = 'SUBSYSTEM_BUSINESS_LEAD_RELATION_CODE' LIMIT 1),
    'subsystem_business_lead'
  );

  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.from_entity_id = OLD.id
      AND r.from_entity_type IN ('system', 'subsystem')
      AND r.to_entity_type = 'employee'
      AND r.relation_type IN (sys_it, sub_it, sys_bl, sub_bl);
    RETURN OLD;
  END IF;

  from_type := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN 'system' ELSE 'subsystem' END;
  it_code := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN sys_it ELSE sub_it END;
  bl_code := CASE WHEN NEW.parent_ar_systems_id IS NULL THEN sys_bl ELSE sub_bl END;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_id = NEW.id
    AND r.from_entity_type IN ('system', 'subsystem')
    AND r.to_entity_type = 'employee'
    AND r.relation_type IN (sys_it, sub_it, sys_bl, sub_bl);

  IF NEW.it_lead_employee_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      from_type, NEW.id, 'employee', NEW.it_lead_employee_id,
      it_code, '', '', NULL, NULL, NULL
    );
  END IF;

  IF NEW.business_lead_employee_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      from_type, NEW.id, 'employee', NEW.business_lead_employee_id,
      bl_code, '', '', NULL, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_systems_employee_metamodel ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_employee_metamodel
  AFTER INSERT OR UPDATE OF it_lead_employee_id, business_lead_employee_id, parent_ar_systems_id
  ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_system_employee_metamodel_relations();

DROP TRIGGER IF EXISTS trg_ar_systems_employee_metamodel_del ON archrep.ar_systems;
CREATE TRIGGER trg_ar_systems_employee_metamodel_del
  AFTER DELETE ON archrep.ar_systems
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_system_employee_metamodel_relations();

-- ---------------------------------------------------------------------------
-- Данные: дедуп по первому слову full_name (max длина нормализованной строки), FK
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_employees (full_name, active)
SELECT d.full_name, true
FROM (
  SELECT DISTINCT ON (sk)
    full_name,
    lower(split_part(full_name, ' ', 1)) AS sk
  FROM (
    SELECT archrep.normalize_lead_text(trim(v)) AS full_name,
           lower(split_part(archrep.normalize_lead_text(trim(v)), ' ', 1)) AS sk
    FROM (
      SELECT it_lead AS v FROM archrep.ar_systems WHERE it_lead IS NOT NULL AND trim(it_lead) <> ''
      UNION
      SELECT business_lead FROM archrep.ar_systems WHERE business_lead IS NOT NULL AND trim(business_lead) <> ''
    ) q
    WHERE archrep.normalize_lead_text(trim(v)) IS NOT NULL
  ) x
  ORDER BY sk, length(full_name) DESC, full_name DESC
) d
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_employees e
  WHERE lower(trim(split_part(e.full_name, ' ', 1))) = d.sk
);

-- Дубликаты по первому слову full_name (например после снятия колонки surname): оставляем строку с max длиной full_name, при равенстве — меньший id
DELETE FROM archrep.ar_employees e
WHERE EXISTS (
  SELECT 1 FROM archrep.ar_employees o
  WHERE o.id <> e.id
    AND lower(trim(split_part(o.full_name, ' ', 1))) = lower(trim(split_part(e.full_name, ' ', 1)))
    AND (
      length(o.full_name) > length(e.full_name)
      OR (length(o.full_name) = length(e.full_name) AND o.id < e.id)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ar_employees_first_word_lower_uidx
  ON archrep.ar_employees ((lower(trim(split_part(full_name, ' ', 1)))));

COMMENT ON INDEX archrep.ar_employees_first_word_lower_uidx IS
  'Одна строка на «фамилию» = первое слово full_name (lower(trim)); дедуп при импорте из legacy-текстов.';

UPDATE archrep.ar_systems s
SET it_lead_employee_id = e.id
FROM archrep.ar_employees e
WHERE s.it_lead IS NOT NULL AND trim(s.it_lead) <> ''
  AND archrep.normalize_lead_text(trim(s.it_lead)) IS NOT NULL
  AND lower(trim(split_part(e.full_name, ' ', 1)))
    = lower(split_part(archrep.normalize_lead_text(trim(s.it_lead)), ' ', 1));

UPDATE archrep.ar_systems s
SET business_lead_employee_id = e.id
FROM archrep.ar_employees e
WHERE s.business_lead IS NOT NULL AND trim(s.business_lead) <> ''
  AND archrep.normalize_lead_text(trim(s.business_lead)) IS NOT NULL
  AND lower(trim(split_part(e.full_name, ' ', 1)))
    = lower(split_part(archrep.normalize_lead_text(trim(s.business_lead)), ' ', 1));

-- Явно дергаем триггер проекций для всех строк ИС
UPDATE archrep.ar_systems s
SET it_lead_employee_id = s.it_lead_employee_id;

-- ---------------------------------------------------------------------------
-- Имя: archrep.normalize_lead_text (удаление)
-- Назначение: функция была только для однократного сопоставления legacy-текстов
--   со справочником; после выполнения блока данных она не используется.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS archrep.normalize_lead_text(text);
