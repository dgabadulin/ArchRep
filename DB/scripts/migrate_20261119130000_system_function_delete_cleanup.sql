-- Issue #76: удаление функции ИС должно убирать её связи метамодели.
-- Раньше функция sync_ar_system_functions_parent_metamodel() содержала ветку DELETE, но триггер
-- trg_ar_system_functions_parent_metamodel был создан только на INSERT OR UPDATE — при удалении
-- функции оставались «висячие» рёбра (system_system_function, actor_system_function и др.).
-- Идемпотентно; после наката перезапуск backend не требуется (SQL-функция/триггер).

CREATE OR REPLACE FUNCTION archrep.sync_ar_system_functions_parent_metamodel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  from_t text;
  sid bigint;
  v_code text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Функция может быть любым концом связи: проекция «система → функция» и ручные связи
    -- (например, actor_system_function). Удаляем все рёбра, ссылающиеся на функцию.
    DELETE FROM archrep.ar_metamodel_relations r
     WHERE (r.to_entity_type = 'system_function' AND r.to_entity_id = OLD.id)
        OR (r.from_entity_type = 'system_function' AND r.from_entity_id = OLD.id);
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
   WHERE r.relation_type IN ('system_system_function', 'subsystem_system_function')
     AND r.to_entity_type = 'system_function'
     AND r.to_entity_id = NEW.id;

  SELECT s.parent_ar_systems_id INTO sid
    FROM archrep.ar_systems s
   WHERE s.id = NEW.ar_systems_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  from_t := CASE WHEN sid IS NULL THEN 'system' ELSE 'subsystem' END;
  v_code := CASE WHEN sid IS NULL THEN 'system_system_function' ELSE 'subsystem_system_function' END;

  INSERT INTO archrep.ar_metamodel_relations (
    from_entity_type, from_entity_id, to_entity_type, to_entity_id,
    relation_type, name, description, payload, displayed_name, reference_to_baserow
  ) VALUES (
    from_t, NEW.ar_systems_id, 'system_function', NEW.id,
    v_code, '', '', NULL, NULL, NULL
  );

  RETURN NEW;
END;
$$;

-- Отдельный триггер на DELETE: существующий trg_ar_system_functions_parent_metamodel
-- отвечает только за INSERT/UPDATE проекции и не должен менять своё поведение.
DROP TRIGGER IF EXISTS trg_ar_system_functions_delete_metamodel ON archrep.ar_system_functions;
CREATE TRIGGER trg_ar_system_functions_delete_metamodel
  AFTER DELETE
  ON archrep.ar_system_functions
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_system_functions_parent_metamodel();

-- Разовая починка уже накопленных «висячих» рёбер после удалений до этой миграции.
DELETE FROM archrep.ar_metamodel_relations r
 WHERE (r.to_entity_type = 'system_function'
        AND NOT EXISTS (SELECT 1 FROM archrep.ar_system_functions f WHERE f.id = r.to_entity_id))
    OR (r.from_entity_type = 'system_function'
        AND NOT EXISTS (SELECT 1 FROM archrep.ar_system_functions f WHERE f.id = r.from_entity_id));
