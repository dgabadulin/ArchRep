-- Очистка операционных данных archrep (демо / песочница).
-- Порядок DELETE согласован с FK из DB/schema (ADR v2, интеграции, метамодель, issue #44/#52).
--
-- Не трогает: ar_settings_parameters, типы метамодели, справочники ADR/TOGAF (статусы, org_units и т.д.).
--
-- Запуск вручную:
--   SELECT archrep.purge_operational_data();
-- С удалением классификаторов (по умолчанию они сохраняются):
--   SELECT archrep.purge_operational_data(p_include_classificators := true);
--
-- psql ... -f DB/scripts/archrep_fn_purge_operational_data.sql

CREATE OR REPLACE FUNCTION archrep.purge_operational_data(
  p_include_classificators boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  n int;
BEGIN
  -- 1. Связи экземпляров метамодели (в т.ч. system_technology, integration_flow*)
  DELETE FROM archrep.ar_metamodel_relations;

  -- 2. Реестр интеграционных потоков (триггеры INSERT/UPDATE не срабатывают на DELETE)
  DELETE FROM archrep.ar_integration_flows;

  -- 3. Явно: связь «функция в строке системы инкремента» (RESTRICT на ar_system_functions)
  DELETE FROM archrep.ar_adr_increment_system_functions;

  -- 4. Прикладные заключения → каскадом инкременты, диаграммы, системы в инкременте, связи инкремента
  DELETE FROM archrep.ar_adrs_applied;

  -- 5. ADR принципиальные
  DELETE FROM archrep.ar_adrs_principle;

  -- 6. Архитектурный долг
  DELETE FROM archrep.ar_gaps;

  -- 7. Каталог принципов (не путать со справочниками статусов ADR)
  DELETE FROM archrep.ar_principles;

  -- 8. Акторы TOGAF
  DELETE FROM archrep.ar_actors;

  -- 9. Бизнес-сервисы / продукты
  DELETE FROM archrep.ar_business_services;

  -- 10. Бизнес-функции (самоссылка parent_id — удаляем снизу вверх)
  LOOP
    DELETE FROM archrep.ar_business_functions bf
    WHERE NOT EXISTS (
      SELECT 1 FROM archrep.ar_business_functions ch WHERE ch.parent_id = bf.id
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
  END LOOP;

  -- 11. Функции ИС (после удаления связей с инкрементом)
  DELETE FROM archrep.ar_system_functions;

  -- 12. Легаси-связь система–технология (если таблица ещё есть после migrate_issue44)
  BEGIN
    DELETE FROM archrep.ar_systems_technologies;
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
  END;

  -- 13. Системы и модули (parent_ar_systems_id — сначала листья)
  LOOP
    DELETE FROM archrep.ar_systems s
    WHERE NOT EXISTS (
      SELECT 1 FROM archrep.ar_systems c WHERE c.parent_ar_systems_id = s.id
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
  END LOOP;

  -- 13b. Сотрудники (после ИС: FK на ar_employees обнуляется, строки можно удалить)
  DELETE FROM archrep.ar_employees;

  -- 14. Технологии каталога
  DELETE FROM archrep.ar_technologies;

  -- 15. Партнёры (после систем/технологий, если были FK)
  DELETE FROM archrep.ar_partners;

  -- 16. Направления владения ИС
  DELETE FROM archrep.ar_system_owners;

  -- 17. Классификаторы (опционально; API в репозитории ещё есть)
  IF p_include_classificators THEN
    DELETE FROM archrep.ar_classificators;
  END IF;

  RETURN;
END;
$fn$;

COMMENT ON FUNCTION archrep.purge_operational_data(boolean) IS
  'Удаляет операционные данные archrep по согласованному списку таблиц; справочники метамодели/настройки не затрагивает. p_include_classificators=true — также удалить ar_classificators (по умолчанию false).';
