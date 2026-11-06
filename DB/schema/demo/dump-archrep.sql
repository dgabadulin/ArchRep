--
-- PostgreSQL database dump
--

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 17.0

-- Started on 2026-04-23 10:13:18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4021 (class 1262 OID 16384)
-- Name: archrep; Type: DATABASE; Schema: -; Owner: isar
--

CREATE DATABASE archrep WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE archrep OWNER TO isar;

\connect archrep

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 17153)
-- Name: archrep; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA archrep;


ALTER SCHEMA archrep OWNER TO postgres;

--
-- TOC entry 306 (class 1255 OID 17154)
-- Name: dashboard_home_gaps_closed(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.dashboard_home_gaps_closed() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
  SELECT COUNT(*)::bigint
  FROM archrep.ar_gaps g
  WHERE g.resolved_date IS NOT NULL
$$;


ALTER FUNCTION archrep.dashboard_home_gaps_closed() OWNER TO postgres;

--
-- TOC entry 4022 (class 0 OID 0)
-- Dependencies: 306
-- Name: FUNCTION dashboard_home_gaps_closed(); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.dashboard_home_gaps_closed() IS 'KPI главной: долг с заполненной resolved_date';


--
-- TOC entry 307 (class 1255 OID 17155)
-- Name: dashboard_home_gaps_total(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.dashboard_home_gaps_total() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$ SELECT COUNT(*)::bigint FROM archrep.ar_gaps $$;


ALTER FUNCTION archrep.dashboard_home_gaps_total() OWNER TO postgres;

--
-- TOC entry 4023 (class 0 OID 0)
-- Dependencies: 307
-- Name: FUNCTION dashboard_home_gaps_total(); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.dashboard_home_gaps_total() IS 'KPI главной: всего записей арх. долга';


--
-- TOC entry 308 (class 1255 OID 17156)
-- Name: dashboard_home_integration_flows(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.dashboard_home_integration_flows() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$ SELECT COUNT(*)::bigint FROM archrep.ar_integration_flows $$;


ALTER FUNCTION archrep.dashboard_home_integration_flows() OWNER TO postgres;

--
-- TOC entry 4024 (class 0 OID 0)
-- Dependencies: 308
-- Name: FUNCTION dashboard_home_integration_flows(); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.dashboard_home_integration_flows() IS 'KPI главной: строки ar_integration_flows';


--
-- TOC entry 309 (class 1255 OID 17157)
-- Name: dashboard_home_systems_total(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.dashboard_home_systems_total() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$ SELECT COUNT(*)::bigint FROM archrep.ar_systems $$;


ALTER FUNCTION archrep.dashboard_home_systems_total() OWNER TO postgres;

--
-- TOC entry 4025 (class 0 OID 0)
-- Dependencies: 309
-- Name: FUNCTION dashboard_home_systems_total(); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.dashboard_home_systems_total() IS 'KPI главной: всего записей в ar_systems';


--
-- TOC entry 310 (class 1255 OID 17158)
-- Name: dashboard_home_systems_with_parent(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.dashboard_home_systems_with_parent() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
  SELECT COUNT(*)::bigint
  FROM archrep.ar_systems s
  WHERE s.parent_ar_systems_id IS NOT NULL
    AND s.parent_ar_systems_id <> s.id
$$;


ALTER FUNCTION archrep.dashboard_home_systems_with_parent() OWNER TO postgres;

--
-- TOC entry 4026 (class 0 OID 0)
-- Dependencies: 310
-- Name: FUNCTION dashboard_home_systems_with_parent(); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.dashboard_home_systems_with_parent() IS 'KPI главной: подсистемы/модули (parent_ar_systems_id задан и не самоссылка)';


--
-- TOC entry 311 (class 1255 OID 17159)
-- Name: dashboard_home_technologies_foreign_null_flag(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.dashboard_home_technologies_foreign_null_flag() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$
  SELECT COUNT(*)::bigint
  FROM archrep.ar_technologies t
  WHERE t.domestic_flag IS NULL
$$;


ALTER FUNCTION archrep.dashboard_home_technologies_foreign_null_flag() OWNER TO postgres;

--
-- TOC entry 4027 (class 0 OID 0)
-- Dependencies: 311
-- Name: FUNCTION dashboard_home_technologies_foreign_null_flag(); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.dashboard_home_technologies_foreign_null_flag() IS 'KPI главной: технологии с domestic_flag IS NULL (иностранные по умолчанию)';


--
-- TOC entry 312 (class 1255 OID 17160)
-- Name: dashboard_home_technologies_total(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.dashboard_home_technologies_total() RETURNS bigint
    LANGUAGE sql STABLE
    AS $$ SELECT COUNT(*)::bigint FROM archrep.ar_technologies $$;


ALTER FUNCTION archrep.dashboard_home_technologies_total() OWNER TO postgres;

--
-- TOC entry 4028 (class 0 OID 0)
-- Dependencies: 312
-- Name: FUNCTION dashboard_home_technologies_total(); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.dashboard_home_technologies_total() IS 'KPI главной: всего технологий';


--
-- TOC entry 324 (class 1255 OID 17161)
-- Name: integration_flow_metamodel_displayed_name(bigint); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.integration_flow_metamodel_displayed_name(p_flow_id bigint) RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  tpl text;
  sn text := '';
  sc text := '';
  tn text := '';
  tc text := '';
  st text := '';
  etn text := '';
  td text := '';
  tm text := '';
  pr text := '';
  result text;
BEGIN
  IF p_flow_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.value INTO tpl
  FROM archrep.ar_settings_parameters p
  WHERE p.code = 'DISP_INTEGRATION_FLOW_NAME'
  LIMIT 1;

  SELECT
    COALESCE(s.name, ''),
    COALESCE(s.code, ''),
    COALESCE(t.name, ''),
    COALESCE(t.code, ''),
    COALESCE(fs.name, ''),
    COALESCE(fet.name, ''),
    COALESCE(f.transferred_data, ''),
    COALESCE(f.transfer_method, ''),
    COALESCE(f.periodicity, '')
  INTO sn, sc, tn, tc, st, etn, td, tm, pr
  FROM archrep.ar_integration_flows f
  LEFT JOIN archrep.ar_systems s ON s.id = f.source_ar_systems_id
  LEFT JOIN archrep.ar_systems t ON t.id = f.target_ar_systems_id
  LEFT JOIN archrep.ar_integration_flow_statuses fs ON fs.id = f.ar_integration_flow_statuses_id
  LEFT JOIN archrep.ar_integration_flow_event_types fet ON fet.id = f.ar_integration_flow_event_types_id
  WHERE f.id = p_flow_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF tpl IS NULL OR btrim(tpl) = '' THEN
    IF sn <> '' AND tn <> '' THEN
      RETURN sn || ' → ' || tn;
    END IF;
    RETURN 'Поток #' || p_flow_id::text;
  END IF;

  result := tpl;
  result := replace(result, '{source_name}', sn);
  result := replace(result, '{target_name}', tn);
  result := replace(result, '{source_code}', sc);
  result := replace(result, '{target_code}', tc);
  result := replace(result, '{status_name}', st);
  result := replace(result, '{event_type_name}', etn);
  result := replace(result, '{transferred_data}', td);
  result := replace(result, '{transfer_method}', tm);
  result := replace(result, '{periodicity}', pr);
  result := replace(result, '{id}', p_flow_id::text);

  RETURN left(result, 2000);
END;
$$;


ALTER FUNCTION archrep.integration_flow_metamodel_displayed_name(p_flow_id bigint) OWNER TO postgres;

--
-- TOC entry 4029 (class 0 OID 0)
-- Dependencies: 324
-- Name: FUNCTION integration_flow_metamodel_displayed_name(p_flow_id bigint); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.integration_flow_metamodel_displayed_name(p_flow_id bigint) IS 'Подпись ребра метамодели для потока; шаблон DISP_INTEGRATION_FLOW_NAME';


--
-- TOC entry 332 (class 1255 OID 17947)
-- Name: purge_operational_data(boolean); Type: FUNCTION; Schema: archrep; Owner: isar
--

CREATE FUNCTION archrep.purge_operational_data(p_include_classificators boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION archrep.purge_operational_data(p_include_classificators boolean) OWNER TO isar;

--
-- TOC entry 4030 (class 0 OID 0)
-- Dependencies: 332
-- Name: FUNCTION purge_operational_data(p_include_classificators boolean); Type: COMMENT; Schema: archrep; Owner: isar
--

COMMENT ON FUNCTION archrep.purge_operational_data(p_include_classificators boolean) IS 'Удаляет операционные данные archrep по согласованному списку таблиц; справочники метамодели/настройки не затрагивает. p_include_classificators=true — также удалить ar_classificators (по умолчанию false).';


--
-- TOC entry 325 (class 1255 OID 17162)
-- Name: rebuild_integration_flow_metamodel_relations(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.rebuild_integration_flow_metamodel_relations() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  fid bigint;
BEGIN
  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type IN (
    'integration_flow',
    'integration_flow_system_module',
    'integration_flow_module_system',
    'integration_flow_module_module'
  );

  FOR fid IN SELECT f.id FROM archrep.ar_integration_flows f ORDER BY f.id
  LOOP
    PERFORM archrep.upsert_integration_flow_metamodel_projection(fid);
  END LOOP;
END;
$$;


ALTER FUNCTION archrep.rebuild_integration_flow_metamodel_relations() OWNER TO postgres;

--
-- TOC entry 4031 (class 0 OID 0)
-- Dependencies: 325
-- Name: FUNCTION rebuild_integration_flow_metamodel_relations(); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.rebuild_integration_flow_metamodel_relations() IS 'Удаляет все проекции интеграционных потоков и создаёт заново из ar_integration_flows';


--
-- TOC entry 326 (class 1255 OID 17163)
-- Name: replace_and_delete_partner(bigint, bigint); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.replace_and_delete_partner(idfordel bigint, idforrepl bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    rows_updated_systems INT := 0;
    rows_updated_technologies INT := 0;
BEGIN
    -- Шаг 1: Замена всех вхождений idForDel на idForRepl в таблице ar_systems
    UPDATE archrep.ar_systems
    SET 
        vendor_ar_partners_id = CASE WHEN vendor_ar_partners_id = idForDel THEN idForRepl ELSE vendor_ar_partners_id END,
        supplier_ar_partners_id = CASE WHEN supplier_ar_partners_id = idForDel THEN idForRepl ELSE supplier_ar_partners_id END,
        supporter_ar_partners_id = CASE WHEN supporter_ar_partners_id = idForDel THEN idForRepl ELSE supporter_ar_partners_id END
    WHERE 
        vendor_ar_partners_id = idForDel
        OR supplier_ar_partners_id = idForDel
        OR supporter_ar_partners_id = idForDel;

    -- Получаем количество обновленных строк в таблице ar_systems
    GET DIAGNOSTICS rows_updated_systems = ROW_COUNT;

    -- Выводим информацию о замене в таблице ar_systems
    RAISE NOTICE 'Updated % rows in ar_systems (vendor_ar_partners_id = % -> %)', rows_updated_systems, idForDel, idForRepl;

    -- Шаг 2: Замена всех вхождений idForDel на idForRepl в таблице ar_technologies
    UPDATE archrep.ar_technologies
    SET 
        vendor_ar_partners_id = CASE WHEN vendor_ar_partners_id = idForDel THEN idForRepl ELSE vendor_ar_partners_id END
    WHERE 
        vendor_ar_partners_id = idForDel;

    -- Получаем количество обновленных строк в таблице ar_technologies
    GET DIAGNOSTICS rows_updated_technologies = ROW_COUNT;

    -- Выводим информацию о замене в таблице ar_technologies
    RAISE NOTICE 'Updated % rows in ar_technologies (vendor_ar_partners_id = % -> %)', rows_updated_technologies, idForDel, idForRepl;

    -- Шаг 3: Удаление записи с id = idForDel из таблицы ar_partners
    DELETE FROM archrep.ar_partners
    WHERE id = idForDel;

    -- Выводим информацию об удалении записи из таблицы ar_partners
    RAISE NOTICE 'Deleted partner with id = %', idForDel;

    -- Если все прошло успешно, изменения фиксируются автоматически
    -- В случае ошибки транзакция откатится (ROLLBACK)
END;
$$;


ALTER FUNCTION archrep.replace_and_delete_partner(idfordel bigint, idforrepl bigint) OWNER TO postgres;

--
-- TOC entry 327 (class 1255 OID 17164)
-- Name: sync_system_module_relation(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.sync_system_module_relation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.relation_type = 'system_module'
      AND r.from_entity_type = 'subsystem'
      AND r.to_entity_type = 'system'
      AND (r.from_entity_id = OLD.id OR r.to_entity_id = OLD.id);
    RETURN OLD;
  END IF;

  -- Для системы всегда держим не больше одной автосвязи module.
  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.relation_type = 'system_module'
    AND r.from_entity_type = 'subsystem'
    AND r.to_entity_type = 'system'
    AND r.from_entity_id = NEW.id;

  IF NEW.parent_ar_systems_id IS NOT NULL
     AND NEW.parent_ar_systems_id <> NEW.id THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type,
      from_entity_id,
      to_entity_type,
      to_entity_id,
      relation_type,
      name,
      description
    ) VALUES (
      'subsystem',
      NEW.id,
      'system',
      NEW.parent_ar_systems_id,
      'system_module',
      'Модуль системы',
      'Связь создана автоматически по parent_ar_systems_id'
    )
    ON CONFLICT (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type)
    WHERE relation_type = 'system_module'
      AND from_entity_type = 'subsystem'
      AND to_entity_type = 'system'
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION archrep.sync_system_module_relation() OWNER TO postgres;

--
-- TOC entry 328 (class 1255 OID 17165)
-- Name: sync_tech_stack_relations_on_parent_change(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.sync_tech_stack_relations_on_parent_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_sys text;
  v_mod text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF OLD.parent_ar_systems_id IS NOT DISTINCT FROM NEW.parent_ar_systems_id THEN
    RETURN NEW;
  END IF;

  SELECT trim(both from value) INTO v_sys FROM archrep.ar_settings_parameters WHERE code = 'SYS_TECH_STACK_RELATION_CODE' LIMIT 1;
  SELECT trim(both from value) INTO v_mod FROM archrep.ar_settings_parameters WHERE code = 'MODULE_TECH_STACK_RELATION_CODE' LIMIT 1;
  v_sys := COALESCE(NULLIF(v_sys, ''), 'system_technology');
  v_mod := COALESCE(NULLIF(v_mod, ''), 'module_technology');

  IF NEW.parent_ar_systems_id IS NULL THEN
    UPDATE archrep.ar_metamodel_relations r
    SET from_entity_type = 'system',
        relation_type = v_sys,
        updated_at = current_timestamp
    WHERE r.from_entity_id = NEW.id
      AND r.to_entity_type = 'technology'
      AND r.relation_type IN (v_sys, v_mod);
  ELSE
    UPDATE archrep.ar_metamodel_relations r
    SET from_entity_type = 'subsystem',
        relation_type = v_mod,
        updated_at = current_timestamp
    WHERE r.from_entity_id = NEW.id
      AND r.to_entity_type = 'technology'
      AND r.relation_type IN (v_sys, v_mod);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION archrep.sync_tech_stack_relations_on_parent_change() OWNER TO postgres;

--
-- TOC entry 329 (class 1255 OID 17166)
-- Name: trg_ar_integration_flows_sync_metamodel(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.trg_ar_integration_flows_sync_metamodel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM archrep.upsert_integration_flow_metamodel_projection(NEW.id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION archrep.trg_ar_integration_flows_sync_metamodel() OWNER TO postgres;

--
-- TOC entry 330 (class 1255 OID 17167)
-- Name: trg_ar_systems_resync_integration_flow_projections(); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.trg_ar_systems_resync_integration_flow_projections() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  fid bigint;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF OLD.parent_ar_systems_id IS NOT DISTINCT FROM NEW.parent_ar_systems_id THEN
    RETURN NEW;
  END IF;

  FOR fid IN
    SELECT f.id
    FROM archrep.ar_integration_flows f
    WHERE f.source_ar_systems_id = NEW.id OR f.target_ar_systems_id = NEW.id
  LOOP
    PERFORM archrep.upsert_integration_flow_metamodel_projection(fid);
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION archrep.trg_ar_systems_resync_integration_flow_projections() OWNER TO postgres;

--
-- TOC entry 331 (class 1255 OID 17168)
-- Name: upsert_integration_flow_metamodel_projection(bigint); Type: FUNCTION; Schema: archrep; Owner: postgres
--

CREATE FUNCTION archrep.upsert_integration_flow_metamodel_projection(p_flow_id bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_name text;
  v_disp text;
  v_src bigint;
  v_tgt bigint;
  v_from_type text;
  v_to_type text;
  v_rel_type text;
BEGIN
  IF p_flow_id IS NULL THEN
    RETURN;
  END IF;

  SELECT f.source_ar_systems_id, f.target_ar_systems_id
  INTO v_src, v_tgt
  FROM archrep.ar_integration_flows f
  WHERE f.id = p_flow_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    CASE
      WHEN s.parent_ar_systems_id IS NOT NULL AND s.parent_ar_systems_id <> s.id THEN 'subsystem'
      ELSE 'system'
    END
  INTO v_from_type
  FROM archrep.ar_systems s
  WHERE s.id = v_src;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    CASE
      WHEN s.parent_ar_systems_id IS NOT NULL AND s.parent_ar_systems_id <> s.id THEN 'subsystem'
      ELSE 'system'
    END
  INTO v_to_type
  FROM archrep.ar_systems s
  WHERE s.id = v_tgt;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_rel_type := CASE
    WHEN v_from_type = 'system' AND v_to_type = 'system' THEN 'integration_flow'
    WHEN v_from_type = 'system' AND v_to_type = 'subsystem' THEN 'integration_flow_system_module'
    WHEN v_from_type = 'subsystem' AND v_to_type = 'system' THEN 'integration_flow_module_system'
    ELSE 'integration_flow_module_module'
  END;

  v_name := 'Поток интеграции #' || p_flow_id::text;
  v_disp := archrep.integration_flow_metamodel_displayed_name(p_flow_id);

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.reference_to_baserow = p_flow_id
    AND r.relation_type IN (
      'integration_flow',
      'integration_flow_system_module',
      'integration_flow_module_system',
      'integration_flow_module_module'
    );

  INSERT INTO archrep.ar_metamodel_relations (
    from_entity_type,
    from_entity_id,
    to_entity_type,
    to_entity_id,
    relation_type,
    name,
    description,
    displayed_name,
    reference_to_baserow,
    payload
  )
  VALUES (
    v_from_type,
    v_src,
    v_to_type,
    v_tgt,
    v_rel_type,
    v_name,
    NULL,
    v_disp,
    p_flow_id,
    jsonb_build_object('source_table', 'ar_integration_flows', 'source_id', p_flow_id)
  );
END;
$$;


ALTER FUNCTION archrep.upsert_integration_flow_metamodel_projection(p_flow_id bigint) OWNER TO postgres;

--
-- TOC entry 4032 (class 0 OID 0)
-- Dependencies: 331
-- Name: FUNCTION upsert_integration_flow_metamodel_projection(p_flow_id bigint); Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON FUNCTION archrep.upsert_integration_flow_metamodel_projection(p_flow_id bigint) IS 'Проекция одного потока: тип связи и концы по фактическому модулю/системе (parent_ar_systems_id)';


--
-- TOC entry 216 (class 1259 OID 17169)
-- Name: adra_code_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.adra_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.adra_code_seq OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 17170)
-- Name: adrp_code_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.adrp_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.adrp_code_seq OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 17171)
-- Name: ar_actor_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_actor_types (
    id bigint NOT NULL,
    code character varying,
    name character varying NOT NULL,
    description text
);


ALTER TABLE archrep.ar_actor_types OWNER TO postgres;

--
-- TOC entry 4033 (class 0 OID 0)
-- Dependencies: 218
-- Name: TABLE ar_actor_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_actor_types IS 'Типы акторов (внутренний, внешний, система)';


--
-- TOC entry 219 (class 1259 OID 17176)
-- Name: ar_actor_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_actor_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_actor_types_id_seq OWNER TO postgres;

--
-- TOC entry 4034 (class 0 OID 0)
-- Dependencies: 219
-- Name: ar_actor_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_actor_types_id_seq OWNED BY archrep.ar_actor_types.id;


--
-- TOC entry 220 (class 1259 OID 17177)
-- Name: ar_actors; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_actors (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    organization_unit_id bigint,
    actor_type_id bigint,
    source character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE archrep.ar_actors OWNER TO postgres;

--
-- TOC entry 4035 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE ar_actors; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_actors IS 'Акторы/роли (TOGAF)';


--
-- TOC entry 221 (class 1259 OID 17184)
-- Name: ar_actors_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_actors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_actors_id_seq OWNER TO postgres;

--
-- TOC entry 4036 (class 0 OID 0)
-- Dependencies: 221
-- Name: ar_actors_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_actors_id_seq OWNED BY archrep.ar_actors.id;


--
-- TOC entry 222 (class 1259 OID 17185)
-- Name: ar_adr_increment_diagrams; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_increment_diagrams (
    id bigint NOT NULL,
    ar_adr_increment_id bigint NOT NULL,
    version_no integer NOT NULL,
    mxfile text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_edited_by text
);


ALTER TABLE archrep.ar_adr_increment_diagrams OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 17192)
-- Name: ar_adr_increment_diagrams_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_increment_diagrams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_increment_diagrams_id_seq OWNER TO postgres;

--
-- TOC entry 4037 (class 0 OID 0)
-- Dependencies: 223
-- Name: ar_adr_increment_diagrams_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_increment_diagrams_id_seq OWNED BY archrep.ar_adr_increment_diagrams.id;


--
-- TOC entry 224 (class 1259 OID 17193)
-- Name: ar_adr_increment_relation_statuses; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_increment_relation_statuses (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying,
    code character varying(64) NOT NULL
);


ALTER TABLE archrep.ar_adr_increment_relation_statuses OWNER TO postgres;

--
-- TOC entry 4038 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE ar_adr_increment_relation_statuses; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adr_increment_relation_statuses IS 'Статус интеграции в рамках архитектурного решения';


--
-- TOC entry 4039 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN ar_adr_increment_relation_statuses.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_adr_increment_relation_statuses.name IS 'Наименование';


--
-- TOC entry 4040 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN ar_adr_increment_relation_statuses.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_adr_increment_relation_statuses.description IS 'Описание';


--
-- TOC entry 4041 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN ar_adr_increment_relation_statuses.code; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_adr_increment_relation_statuses.code IS 'Стабильный код статуса связи в инкременте (параметр ADR_FLOW_STATUS_MAP)';


--
-- TOC entry 225 (class 1259 OID 17198)
-- Name: ar_adr_increment_relations; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_increment_relations (
    id bigint NOT NULL,
    ar_adr_increment_id bigint NOT NULL,
    from_ar_systems_id bigint,
    to_ar_systems_id bigint,
    name character varying,
    description character varying,
    ar_adr_increment_relation_statuses_id bigint
);


ALTER TABLE archrep.ar_adr_increment_relations OWNER TO postgres;

--
-- TOC entry 4042 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE ar_adr_increment_relations; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adr_increment_relations IS 'Интеграции в инкременте прикладного решения';


--
-- TOC entry 226 (class 1259 OID 17203)
-- Name: ar_adr_increment_relations_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_increment_relations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_increment_relations_id_seq OWNER TO postgres;

--
-- TOC entry 4043 (class 0 OID 0)
-- Dependencies: 226
-- Name: ar_adr_increment_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_increment_relations_id_seq OWNED BY archrep.ar_adr_increment_relations.id;


--
-- TOC entry 227 (class 1259 OID 17204)
-- Name: ar_adr_increment_system_functions; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_increment_system_functions (
    id bigint NOT NULL,
    ar_adr_increment_system_id bigint NOT NULL,
    ar_system_functions_id bigint NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE archrep.ar_adr_increment_system_functions OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 17208)
-- Name: ar_adr_increment_system_functions_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_increment_system_functions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_increment_system_functions_id_seq OWNER TO postgres;

--
-- TOC entry 4044 (class 0 OID 0)
-- Dependencies: 228
-- Name: ar_adr_increment_system_functions_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_increment_system_functions_id_seq OWNED BY archrep.ar_adr_increment_system_functions.id;


--
-- TOC entry 229 (class 1259 OID 17209)
-- Name: ar_adr_increment_system_statuses; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_increment_system_statuses (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying,
    code character varying(64) NOT NULL
);


ALTER TABLE archrep.ar_adr_increment_system_statuses OWNER TO postgres;

--
-- TOC entry 4045 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE ar_adr_increment_system_statuses; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adr_increment_system_statuses IS 'Статус системы в рамках архитектурного решения';


--
-- TOC entry 4046 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN ar_adr_increment_system_statuses.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_adr_increment_system_statuses.name IS 'Наименование';


--
-- TOC entry 4047 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN ar_adr_increment_system_statuses.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_adr_increment_system_statuses.description IS 'Описание';


--
-- TOC entry 4048 (class 0 OID 0)
-- Dependencies: 229
-- Name: COLUMN ar_adr_increment_system_statuses.code; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_adr_increment_system_statuses.code IS 'Стабильный код для параметров и генерации схем (латиница, UPPER_SNAKE_CASE), см. docs/drawio-increment-diagram-parameters.md';


--
-- TOC entry 230 (class 1259 OID 17214)
-- Name: ar_adr_increment_systems; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_increment_systems (
    id bigint NOT NULL,
    ar_adr_increment_id bigint NOT NULL,
    ar_systems_id bigint NOT NULL,
    ar_adr_increment_system_statuses_id bigint,
    comment character varying
);


ALTER TABLE archrep.ar_adr_increment_systems OWNER TO postgres;

--
-- TOC entry 4049 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE ar_adr_increment_systems; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adr_increment_systems IS 'Системы в инкременте прикладного решения';


--
-- TOC entry 231 (class 1259 OID 17219)
-- Name: ar_adr_increment_systems_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_increment_systems_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_increment_systems_id_seq OWNER TO postgres;

--
-- TOC entry 4050 (class 0 OID 0)
-- Dependencies: 231
-- Name: ar_adr_increment_systems_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_increment_systems_id_seq OWNED BY archrep.ar_adr_increment_systems.id;


--
-- TOC entry 232 (class 1259 OID 17220)
-- Name: ar_adr_increment_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_increment_types (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying
);


ALTER TABLE archrep.ar_adr_increment_types OWNER TO postgres;

--
-- TOC entry 4051 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE ar_adr_increment_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adr_increment_types IS 'Тип инкремента: временное решение, целевое решение';


--
-- TOC entry 233 (class 1259 OID 17225)
-- Name: ar_adr_increment_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_increment_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_increment_types_id_seq OWNER TO postgres;

--
-- TOC entry 4052 (class 0 OID 0)
-- Dependencies: 233
-- Name: ar_adr_increment_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_increment_types_id_seq OWNED BY archrep.ar_adr_increment_types.id;


--
-- TOC entry 234 (class 1259 OID 17226)
-- Name: ar_adr_increments; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_increments (
    id bigint NOT NULL,
    ar_adrs_applied_id bigint NOT NULL,
    order_index integer DEFAULT 1 NOT NULL,
    name character varying,
    ar_adr_increment_types_id bigint
);


ALTER TABLE archrep.ar_adr_increments OWNER TO postgres;

--
-- TOC entry 4053 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE ar_adr_increments; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adr_increments IS 'Инкременты прикладного решения (временные и целевые)';


--
-- TOC entry 235 (class 1259 OID 17232)
-- Name: ar_adr_increments_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_increments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_increments_id_seq OWNER TO postgres;

--
-- TOC entry 4054 (class 0 OID 0)
-- Dependencies: 235
-- Name: ar_adr_increments_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_increments_id_seq OWNED BY archrep.ar_adr_increments.id;


--
-- TOC entry 236 (class 1259 OID 17233)
-- Name: ar_adr_relation_statuses_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_relation_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_relation_statuses_id_seq OWNER TO postgres;

--
-- TOC entry 4055 (class 0 OID 0)
-- Dependencies: 236
-- Name: ar_adr_relation_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_relation_statuses_id_seq OWNED BY archrep.ar_adr_increment_relation_statuses.id;


--
-- TOC entry 237 (class 1259 OID 17234)
-- Name: ar_adr_statuses; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adr_statuses (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying,
    code character varying(64) NOT NULL
);


ALTER TABLE archrep.ar_adr_statuses OWNER TO postgres;

--
-- TOC entry 4056 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE ar_adr_statuses; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adr_statuses IS 'Статус архитектурного решения (черновик, утверждено и т.д.)';


--
-- TOC entry 4057 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN ar_adr_statuses.code; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_adr_statuses.code IS 'Стабильный код для параметров и интеграций (латиница, UPPER_SNAKE_CASE)';


--
-- TOC entry 238 (class 1259 OID 17239)
-- Name: ar_adr_statuses_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_statuses_id_seq OWNER TO postgres;

--
-- TOC entry 4058 (class 0 OID 0)
-- Dependencies: 238
-- Name: ar_adr_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_statuses_id_seq OWNED BY archrep.ar_adr_statuses.id;


--
-- TOC entry 239 (class 1259 OID 17240)
-- Name: ar_adr_system_statuses_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adr_system_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adr_system_statuses_id_seq OWNER TO postgres;

--
-- TOC entry 4059 (class 0 OID 0)
-- Dependencies: 239
-- Name: ar_adr_system_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adr_system_statuses_id_seq OWNED BY archrep.ar_adr_increment_system_statuses.id;


--
-- TOC entry 240 (class 1259 OID 17241)
-- Name: ar_adrs_applied; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adrs_applied (
    id bigint NOT NULL,
    code character varying NOT NULL,
    task_name character varying,
    task_link character varying,
    conclusion character varying,
    ar_adr_statuses_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    author character varying
);


ALTER TABLE archrep.ar_adrs_applied OWNER TO postgres;

--
-- TOC entry 4060 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE ar_adrs_applied; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adrs_applied IS 'Прикладные архитектурные решения';


--
-- TOC entry 241 (class 1259 OID 17248)
-- Name: ar_adrs_applied_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adrs_applied_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adrs_applied_id_seq OWNER TO postgres;

--
-- TOC entry 4061 (class 0 OID 0)
-- Dependencies: 241
-- Name: ar_adrs_applied_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adrs_applied_id_seq OWNED BY archrep.ar_adrs_applied.id;


--
-- TOC entry 242 (class 1259 OID 17249)
-- Name: ar_adrs_principle; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_adrs_principle (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    context character varying,
    decision character varying,
    consequences character varying,
    ar_adr_statuses_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    author character varying
);


ALTER TABLE archrep.ar_adrs_principle OWNER TO postgres;

--
-- TOC entry 4062 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE ar_adrs_principle; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_adrs_principle IS 'Принципиальные архитектурные решения (ADR)';


--
-- TOC entry 243 (class 1259 OID 17256)
-- Name: ar_adrs_principle_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_adrs_principle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_adrs_principle_id_seq OWNER TO postgres;

--
-- TOC entry 4063 (class 0 OID 0)
-- Dependencies: 243
-- Name: ar_adrs_principle_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_adrs_principle_id_seq OWNED BY archrep.ar_adrs_principle.id;


--
-- TOC entry 244 (class 1259 OID 17257)
-- Name: ar_business_functions; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_business_functions (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    parent_id bigint,
    ar_organization_units_id bigint,
    source character varying,
    category character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE archrep.ar_business_functions OWNER TO postgres;

--
-- TOC entry 4064 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE ar_business_functions; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_business_functions IS 'Бизнес-функции / способности (TOGAF)';


--
-- TOC entry 245 (class 1259 OID 17264)
-- Name: ar_business_functions_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_business_functions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_business_functions_id_seq OWNER TO postgres;

--
-- TOC entry 4065 (class 0 OID 0)
-- Dependencies: 245
-- Name: ar_business_functions_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_business_functions_id_seq OWNED BY archrep.ar_business_functions.id;


--
-- TOC entry 246 (class 1259 OID 17265)
-- Name: ar_business_service_statuses; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_business_service_statuses (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description text
);


ALTER TABLE archrep.ar_business_service_statuses OWNER TO postgres;

--
-- TOC entry 4066 (class 0 OID 0)
-- Dependencies: 246
-- Name: TABLE ar_business_service_statuses; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_business_service_statuses IS 'Статусы бизнес-сервисов (продуктов)';


--
-- TOC entry 247 (class 1259 OID 17270)
-- Name: ar_business_service_statuses_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_business_service_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_business_service_statuses_id_seq OWNER TO postgres;

--
-- TOC entry 4067 (class 0 OID 0)
-- Dependencies: 247
-- Name: ar_business_service_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_business_service_statuses_id_seq OWNED BY archrep.ar_business_service_statuses.id;


--
-- TOC entry 248 (class 1259 OID 17271)
-- Name: ar_business_services; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_business_services (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    fullname character varying,
    description text,
    ar_organization_units_id bigint,
    ar_business_service_statuses_id bigint,
    source character varying,
    category character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE archrep.ar_business_services OWNER TO postgres;

--
-- TOC entry 4068 (class 0 OID 0)
-- Dependencies: 248
-- Name: TABLE ar_business_services; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_business_services IS 'Бизнес-сервисы / продукты компании (TOGAF)';


--
-- TOC entry 249 (class 1259 OID 17278)
-- Name: ar_business_services_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_business_services_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_business_services_id_seq OWNER TO postgres;

--
-- TOC entry 4069 (class 0 OID 0)
-- Dependencies: 249
-- Name: ar_business_services_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_business_services_id_seq OWNED BY archrep.ar_business_services.id;


--
-- TOC entry 250 (class 1259 OID 17279)
-- Name: ar_classificators; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_classificators (
    id bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE archrep.ar_classificators OWNER TO postgres;

--
-- TOC entry 4070 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE ar_classificators; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_classificators IS 'Содержит перечень классификаторов (используется на универсальной форме редактирования справочников)';


--
-- TOC entry 4071 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN ar_classificators.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_classificators.name IS 'Наименование классификатора';


--
-- TOC entry 251 (class 1259 OID 17284)
-- Name: ar_classificators_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_classificators_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_classificators_id_seq OWNER TO postgres;

--
-- TOC entry 4072 (class 0 OID 0)
-- Dependencies: 251
-- Name: ar_classificators_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_classificators_id_seq OWNED BY archrep.ar_classificators.id;


--
-- TOC entry 252 (class 1259 OID 17285)
-- Name: ar_gap_states; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_gap_states (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description text
);


ALTER TABLE archrep.ar_gap_states OWNER TO postgres;

--
-- TOC entry 4073 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE ar_gap_states; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_gap_states IS 'Состояние разрыва / архитектурного долга';


--
-- TOC entry 253 (class 1259 OID 17290)
-- Name: ar_gap_states_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_gap_states_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_gap_states_id_seq OWNER TO postgres;

--
-- TOC entry 4074 (class 0 OID 0)
-- Dependencies: 253
-- Name: ar_gap_states_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_gap_states_id_seq OWNED BY archrep.ar_gap_states.id;


--
-- TOC entry 254 (class 1259 OID 17291)
-- Name: ar_gap_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_gap_types (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description text
);


ALTER TABLE archrep.ar_gap_types OWNER TO postgres;

--
-- TOC entry 4075 (class 0 OID 0)
-- Dependencies: 254
-- Name: TABLE ar_gap_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_gap_types IS 'Тип архитектурного долга (отклонение, исключение)';


--
-- TOC entry 255 (class 1259 OID 17296)
-- Name: ar_gap_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_gap_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_gap_types_id_seq OWNER TO postgres;

--
-- TOC entry 4076 (class 0 OID 0)
-- Dependencies: 255
-- Name: ar_gap_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_gap_types_id_seq OWNED BY archrep.ar_gap_types.id;


--
-- TOC entry 256 (class 1259 OID 17297)
-- Name: ar_gaps; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_gaps (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    consequences text,
    ar_impact_level_types_id bigint,
    remediation_effort character varying,
    target_date date,
    ar_gap_states_id bigint,
    resolved_date date,
    ar_adr_statuses_id bigint,
    ar_gap_types_id bigint,
    source character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    responsible_person character varying
);


ALTER TABLE archrep.ar_gaps OWNER TO postgres;

--
-- TOC entry 4077 (class 0 OID 0)
-- Dependencies: 256
-- Name: TABLE ar_gaps; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_gaps IS 'Реестр архитектурного долга (разрывы, отклонения)';


--
-- TOC entry 4078 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN ar_gaps.responsible_person; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_gaps.responsible_person IS 'Ответственное лицо (ФИО), опционально';


--
-- TOC entry 257 (class 1259 OID 17304)
-- Name: ar_gaps_code_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_gaps_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_gaps_code_seq OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 17305)
-- Name: ar_gaps_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_gaps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_gaps_id_seq OWNER TO postgres;

--
-- TOC entry 4079 (class 0 OID 0)
-- Dependencies: 258
-- Name: ar_gaps_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_gaps_id_seq OWNED BY archrep.ar_gaps.id;


--
-- TOC entry 259 (class 1259 OID 17306)
-- Name: ar_impact_level_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_impact_level_types (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description text
);


ALTER TABLE archrep.ar_impact_level_types OWNER TO postgres;

--
-- TOC entry 4080 (class 0 OID 0)
-- Dependencies: 259
-- Name: TABLE ar_impact_level_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_impact_level_types IS 'Степень влияния архитектурного долга';


--
-- TOC entry 260 (class 1259 OID 17311)
-- Name: ar_impact_level_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_impact_level_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_impact_level_types_id_seq OWNER TO postgres;

--
-- TOC entry 4081 (class 0 OID 0)
-- Dependencies: 260
-- Name: ar_impact_level_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_impact_level_types_id_seq OWNED BY archrep.ar_impact_level_types.id;


--
-- TOC entry 261 (class 1259 OID 17312)
-- Name: ar_integration_flow_event_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_integration_flow_event_types (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying
);


ALTER TABLE archrep.ar_integration_flow_event_types OWNER TO postgres;

--
-- TOC entry 4082 (class 0 OID 0)
-- Dependencies: 261
-- Name: TABLE ar_integration_flow_event_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_integration_flow_event_types IS 'Тип инициирующего события интеграции: по событию или по расписанию';


--
-- TOC entry 262 (class 1259 OID 17317)
-- Name: ar_integration_flow_event_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_integration_flow_event_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_integration_flow_event_types_id_seq OWNER TO postgres;

--
-- TOC entry 4083 (class 0 OID 0)
-- Dependencies: 262
-- Name: ar_integration_flow_event_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_integration_flow_event_types_id_seq OWNED BY archrep.ar_integration_flow_event_types.id;


--
-- TOC entry 263 (class 1259 OID 17318)
-- Name: ar_integration_flow_statuses; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_integration_flow_statuses (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying,
    code character varying(64) NOT NULL
);


ALTER TABLE archrep.ar_integration_flow_statuses OWNER TO postgres;

--
-- TOC entry 4084 (class 0 OID 0)
-- Dependencies: 263
-- Name: TABLE ar_integration_flow_statuses; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_integration_flow_statuses IS 'Статусы интеграционных потоков';


--
-- TOC entry 4085 (class 0 OID 0)
-- Dependencies: 263
-- Name: COLUMN ar_integration_flow_statuses.code; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flow_statuses.code IS 'Стабильный код статуса потока (значения в ADR_FLOW_STATUS_MAP)';


--
-- TOC entry 264 (class 1259 OID 17323)
-- Name: ar_integration_flow_statuses_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_integration_flow_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_integration_flow_statuses_id_seq OWNER TO postgres;

--
-- TOC entry 4086 (class 0 OID 0)
-- Dependencies: 264
-- Name: ar_integration_flow_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_integration_flow_statuses_id_seq OWNED BY archrep.ar_integration_flow_statuses.id;


--
-- TOC entry 265 (class 1259 OID 17324)
-- Name: ar_integration_flows; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_integration_flows (
    id bigint NOT NULL,
    source_ar_systems_id bigint NOT NULL,
    target_ar_systems_id bigint NOT NULL,
    ar_integration_flow_event_types_id bigint,
    transferred_data text,
    transfer_method text,
    ar_integration_flow_statuses_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ar_adrs_applied_id bigint,
    ar_adr_increment_relation_id bigint,
    periodicity text
);


ALTER TABLE archrep.ar_integration_flows OWNER TO postgres;

--
-- TOC entry 4087 (class 0 OID 0)
-- Dependencies: 265
-- Name: TABLE ar_integration_flows; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_integration_flows IS 'Реестр интеграционных потоков между системами';


--
-- TOC entry 4088 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.source_ar_systems_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.source_ar_systems_id IS 'Система-источник (FK)';


--
-- TOC entry 4089 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.target_ar_systems_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.target_ar_systems_id IS 'Система-получатель (FK)';


--
-- TOC entry 4090 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.ar_integration_flow_event_types_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.ar_integration_flow_event_types_id IS 'Тип инициирующего события (FK)';


--
-- TOC entry 4091 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.transferred_data; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.transferred_data IS 'Передаваемые данные';


--
-- TOC entry 4092 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.transfer_method; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.transfer_method IS 'Способ передачи';


--
-- TOC entry 4093 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.ar_integration_flow_statuses_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.ar_integration_flow_statuses_id IS 'Статус интеграционного потока (FK)';


--
-- TOC entry 4094 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.ar_adrs_applied_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.ar_adrs_applied_id IS 'Архитектурное заключение, при утверждении которого создана запись (FK ar_adrs_applied)';


--
-- TOC entry 4095 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.ar_adr_increment_relation_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.ar_adr_increment_relation_id IS 'Связь инкремента (ar_adr_increment_relations), по которой создана запись; одна связь — не более одной записи в реестре';


--
-- TOC entry 4096 (class 0 OID 0)
-- Dependencies: 265
-- Name: COLUMN ar_integration_flows.periodicity; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_integration_flows.periodicity IS 'Периодичность передачи информации';


--
-- TOC entry 266 (class 1259 OID 17331)
-- Name: ar_integration_flows_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_integration_flows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_integration_flows_id_seq OWNER TO postgres;

--
-- TOC entry 4097 (class 0 OID 0)
-- Dependencies: 266
-- Name: ar_integration_flows_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_integration_flows_id_seq OWNED BY archrep.ar_integration_flows.id;


--
-- TOC entry 267 (class 1259 OID 17332)
-- Name: ar_metamodel_entity_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_metamodel_entity_types (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    table_name character varying,
    description text
);


ALTER TABLE archrep.ar_metamodel_entity_types OWNER TO postgres;

--
-- TOC entry 4098 (class 0 OID 0)
-- Dependencies: 267
-- Name: TABLE ar_metamodel_entity_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_metamodel_entity_types IS 'Типы сущностей метамодели TOGAF';


--
-- TOC entry 268 (class 1259 OID 17337)
-- Name: ar_metamodel_entity_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_metamodel_entity_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_metamodel_entity_types_id_seq OWNER TO postgres;

--
-- TOC entry 4099 (class 0 OID 0)
-- Dependencies: 268
-- Name: ar_metamodel_entity_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_metamodel_entity_types_id_seq OWNED BY archrep.ar_metamodel_entity_types.id;


--
-- TOC entry 269 (class 1259 OID 17338)
-- Name: ar_metamodel_relation_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_metamodel_relation_types (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    from_entity_type_id bigint NOT NULL,
    to_entity_type_id bigint NOT NULL
);


ALTER TABLE archrep.ar_metamodel_relation_types OWNER TO postgres;

--
-- TOC entry 4100 (class 0 OID 0)
-- Dependencies: 269
-- Name: TABLE ar_metamodel_relation_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_metamodel_relation_types IS 'Типы связей метамодели TOGAF';


--
-- TOC entry 4101 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN ar_metamodel_relation_types.from_entity_type_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_metamodel_relation_types.from_entity_type_id IS 'Тип сущности «от» (FK в ar_metamodel_entity_types)';


--
-- TOC entry 4102 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN ar_metamodel_relation_types.to_entity_type_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_metamodel_relation_types.to_entity_type_id IS 'Тип сущности «к» (FK в ar_metamodel_entity_types)';


--
-- TOC entry 270 (class 1259 OID 17343)
-- Name: ar_metamodel_relation_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_metamodel_relation_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_metamodel_relation_types_id_seq OWNER TO postgres;

--
-- TOC entry 4103 (class 0 OID 0)
-- Dependencies: 270
-- Name: ar_metamodel_relation_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_metamodel_relation_types_id_seq OWNED BY archrep.ar_metamodel_relation_types.id;


--
-- TOC entry 271 (class 1259 OID 17344)
-- Name: ar_metamodel_relations; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_metamodel_relations (
    id bigint NOT NULL,
    from_entity_type character varying NOT NULL,
    from_entity_id bigint NOT NULL,
    to_entity_type character varying NOT NULL,
    to_entity_id bigint NOT NULL,
    relation_type character varying NOT NULL,
    name character varying,
    description text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reference_to_baserow bigint,
    displayed_name character varying
);


ALTER TABLE archrep.ar_metamodel_relations OWNER TO postgres;

--
-- TOC entry 4104 (class 0 OID 0)
-- Dependencies: 271
-- Name: TABLE ar_metamodel_relations; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_metamodel_relations IS 'Связи между объектами метамодели TOGAF';


--
-- TOC entry 4105 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN ar_metamodel_relations.reference_to_baserow; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_metamodel_relations.reference_to_baserow IS 'Ссылка на строку источника проекции (для потоков: ar_integration_flows.id), без FK';


--
-- TOC entry 4106 (class 0 OID 0)
-- Dependencies: 271
-- Name: COLUMN ar_metamodel_relations.displayed_name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_metamodel_relations.displayed_name IS 'Вычисляемая подпись (параметр DISP_INTEGRATION_FLOW_NAME); в UI: displayed_name, иначе name';


--
-- TOC entry 272 (class 1259 OID 17351)
-- Name: ar_metamodel_relations_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_metamodel_relations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_metamodel_relations_id_seq OWNER TO postgres;

--
-- TOC entry 4107 (class 0 OID 0)
-- Dependencies: 272
-- Name: ar_metamodel_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_metamodel_relations_id_seq OWNED BY archrep.ar_metamodel_relations.id;


--
-- TOC entry 273 (class 1259 OID 17352)
-- Name: ar_organization_unit_categories; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_organization_unit_categories (
    id bigint NOT NULL,
    code character varying,
    name character varying NOT NULL,
    description text
);


ALTER TABLE archrep.ar_organization_unit_categories OWNER TO postgres;

--
-- TOC entry 4108 (class 0 OID 0)
-- Dependencies: 273
-- Name: TABLE ar_organization_unit_categories; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_organization_unit_categories IS 'Категории организационных единиц (департамент, дирекция и т.д.)';


--
-- TOC entry 274 (class 1259 OID 17357)
-- Name: ar_organization_unit_categories_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_organization_unit_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_organization_unit_categories_id_seq OWNER TO postgres;

--
-- TOC entry 4109 (class 0 OID 0)
-- Dependencies: 274
-- Name: ar_organization_unit_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_organization_unit_categories_id_seq OWNED BY archrep.ar_organization_unit_categories.id;


--
-- TOC entry 275 (class 1259 OID 17358)
-- Name: ar_organization_units; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_organization_units (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    fullname character varying,
    parent_id bigint,
    description text,
    leader character varying,
    organization_unit_categories_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE archrep.ar_organization_units OWNER TO postgres;

--
-- TOC entry 4110 (class 0 OID 0)
-- Dependencies: 275
-- Name: TABLE ar_organization_units; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_organization_units IS 'Организационные единицы (TOGAF)';


--
-- TOC entry 276 (class 1259 OID 17365)
-- Name: ar_organization_units_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_organization_units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_organization_units_id_seq OWNER TO postgres;

--
-- TOC entry 4111 (class 0 OID 0)
-- Dependencies: 276
-- Name: ar_organization_units_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_organization_units_id_seq OWNED BY archrep.ar_organization_units.id;


--
-- TOC entry 277 (class 1259 OID 17366)
-- Name: ar_partners; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_partners (
    id bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE archrep.ar_partners OWNER TO postgres;

--
-- TOC entry 4112 (class 0 OID 0)
-- Dependencies: 277
-- Name: TABLE ar_partners; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_partners IS 'Партнеры по внедрению, поддержке, вендоры/разработчики.';


--
-- TOC entry 4113 (class 0 OID 0)
-- Dependencies: 277
-- Name: COLUMN ar_partners.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_partners.name IS 'Наименование компании партнера (вендор, разработчик, интегратор, партнер по поддержке)';


--
-- TOC entry 278 (class 1259 OID 17371)
-- Name: ar_partners_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_partners_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_partners_id_seq OWNER TO postgres;

--
-- TOC entry 4114 (class 0 OID 0)
-- Dependencies: 278
-- Name: ar_partners_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_partners_id_seq OWNED BY archrep.ar_partners.id;


--
-- TOC entry 279 (class 1259 OID 17372)
-- Name: ar_principles; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_principles (
    id bigint NOT NULL,
    name character varying NOT NULL,
    statement character varying,
    rationale character varying,
    implications character varying,
    is_approved boolean DEFAULT false,
    approve_document character varying
);


ALTER TABLE archrep.ar_principles OWNER TO postgres;

--
-- TOC entry 4115 (class 0 OID 0)
-- Dependencies: 279
-- Name: TABLE ar_principles; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_principles IS 'Архитектурные принципы';


--
-- TOC entry 4116 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN ar_principles.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_principles.name IS 'Наименование архитектурного принципа';


--
-- TOC entry 4117 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN ar_principles.statement; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_principles.statement IS 'Утверждение - основной тезис принципа';


--
-- TOC entry 4118 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN ar_principles.rationale; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_principles.rationale IS 'Обоснование того, почему этот принцип важен';


--
-- TOC entry 4119 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN ar_principles.implications; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_principles.implications IS 'Применение - описывает порядок применения принципа';


--
-- TOC entry 4120 (class 0 OID 0)
-- Dependencies: 279
-- Name: COLUMN ar_principles.approve_document; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_principles.approve_document IS 'Документ, которым утвержден данный принцип';


--
-- TOC entry 280 (class 1259 OID 17378)
-- Name: ar_principles_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_principles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_principles_id_seq OWNER TO postgres;

--
-- TOC entry 4121 (class 0 OID 0)
-- Dependencies: 280
-- Name: ar_principles_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_principles_id_seq OWNED BY archrep.ar_principles.id;


--
-- TOC entry 281 (class 1259 OID 17379)
-- Name: ar_settings_parameters; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_settings_parameters (
    id bigint NOT NULL,
    code character varying(255) NOT NULL,
    description text,
    value text,
    value_type character varying(50) DEFAULT 'string'::character varying NOT NULL,
    "group" character varying(255),
    is_secret boolean DEFAULT false NOT NULL,
    read_only boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE archrep.ar_settings_parameters OWNER TO postgres;

--
-- TOC entry 4122 (class 0 OID 0)
-- Dependencies: 281
-- Name: TABLE ar_settings_parameters; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_settings_parameters IS 'Настроечные параметры системы (Keycloak, лимиты, флаги и т.д.)';


--
-- TOC entry 4123 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN ar_settings_parameters.code; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_settings_parameters.code IS 'Уникальный код параметра (AR_Keycloak_Enabled, AR_Session_Timeout_Min и т.п.)';


--
-- TOC entry 4124 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN ar_settings_parameters.value_type; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_settings_parameters.value_type IS 'Тип значения: string, number, boolean, json, string_list';


--
-- TOC entry 4125 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN ar_settings_parameters."group"; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_settings_parameters."group" IS 'Группа для отображения в UI (Аутентификация, Интеграции и т.д.)';


--
-- TOC entry 4126 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN ar_settings_parameters.is_secret; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_settings_parameters.is_secret IS 'Секретный параметр: в UI маскировать, в логах не выводить';


--
-- TOC entry 4127 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN ar_settings_parameters.read_only; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_settings_parameters.read_only IS 'Только из окружения/конфига, в UI не редактировать';


--
-- TOC entry 282 (class 1259 OID 17389)
-- Name: ar_settings_parameters_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_settings_parameters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_settings_parameters_id_seq OWNER TO postgres;

--
-- TOC entry 4128 (class 0 OID 0)
-- Dependencies: 282
-- Name: ar_settings_parameters_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_settings_parameters_id_seq OWNED BY archrep.ar_settings_parameters.id;


--
-- TOC entry 283 (class 1259 OID 17390)
-- Name: ar_system_assignments; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_system_assignments (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying
);


ALTER TABLE archrep.ar_system_assignments OWNER TO postgres;

--
-- TOC entry 4129 (class 0 OID 0)
-- Dependencies: 283
-- Name: TABLE ar_system_assignments; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_system_assignments IS 'Классификатор назначения систем';


--
-- TOC entry 4130 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN ar_system_assignments.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_system_assignments.name IS 'Наименование';


--
-- TOC entry 4131 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN ar_system_assignments.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_system_assignments.description IS 'Принцип классификации';


--
-- TOC entry 284 (class 1259 OID 17395)
-- Name: ar_system_assignments_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_system_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_system_assignments_id_seq OWNER TO postgres;

--
-- TOC entry 4132 (class 0 OID 0)
-- Dependencies: 284
-- Name: ar_system_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_system_assignments_id_seq OWNED BY archrep.ar_system_assignments.id;


--
-- TOC entry 285 (class 1259 OID 17396)
-- Name: ar_system_functions; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_system_functions (
    id bigint NOT NULL,
    ar_systems_id bigint NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE archrep.ar_system_functions OWNER TO postgres;

--
-- TOC entry 286 (class 1259 OID 17403)
-- Name: ar_system_functions_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_system_functions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_system_functions_id_seq OWNER TO postgres;

--
-- TOC entry 4133 (class 0 OID 0)
-- Dependencies: 286
-- Name: ar_system_functions_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_system_functions_id_seq OWNED BY archrep.ar_system_functions.id;


--
-- TOC entry 287 (class 1259 OID 17404)
-- Name: ar_system_hosting_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_system_hosting_types (
    name character varying NOT NULL,
    id bigint NOT NULL
);


ALTER TABLE archrep.ar_system_hosting_types OWNER TO postgres;

--
-- TOC entry 4134 (class 0 OID 0)
-- Dependencies: 287
-- Name: TABLE ar_system_hosting_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_system_hosting_types IS 'Тип размещения систем (облако, онпрем, и т.д.)';


--
-- TOC entry 4135 (class 0 OID 0)
-- Dependencies: 287
-- Name: COLUMN ar_system_hosting_types.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_system_hosting_types.name IS 'Наименование';


--
-- TOC entry 288 (class 1259 OID 17409)
-- Name: ar_system_hosting_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_system_hosting_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_system_hosting_types_id_seq OWNER TO postgres;

--
-- TOC entry 4136 (class 0 OID 0)
-- Dependencies: 288
-- Name: ar_system_hosting_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_system_hosting_types_id_seq OWNED BY archrep.ar_system_hosting_types.id;


--
-- TOC entry 289 (class 1259 OID 17410)
-- Name: ar_system_owners; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_system_owners (
    id bigint NOT NULL,
    name character varying NOT NULL,
    leader character varying
);


ALTER TABLE archrep.ar_system_owners OWNER TO postgres;

--
-- TOC entry 4137 (class 0 OID 0)
-- Dependencies: 289
-- Name: TABLE ar_system_owners; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_system_owners IS 'Классификатор направлений бизнеса для классификации систем (по владельцам систем)';


--
-- TOC entry 4138 (class 0 OID 0)
-- Dependencies: 289
-- Name: COLUMN ar_system_owners.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_system_owners.name IS 'Наименование направления';


--
-- TOC entry 4139 (class 0 OID 0)
-- Dependencies: 289
-- Name: COLUMN ar_system_owners.leader; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_system_owners.leader IS 'Руководитель направления';


--
-- TOC entry 290 (class 1259 OID 17415)
-- Name: ar_system_owners_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_system_owners_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_system_owners_id_seq OWNER TO postgres;

--
-- TOC entry 4140 (class 0 OID 0)
-- Dependencies: 290
-- Name: ar_system_owners_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_system_owners_id_seq OWNED BY archrep.ar_system_owners.id;


--
-- TOC entry 291 (class 1259 OID 17416)
-- Name: ar_system_statuses; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_system_statuses (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying
);


ALTER TABLE archrep.ar_system_statuses OWNER TO postgres;

--
-- TOC entry 4141 (class 0 OID 0)
-- Dependencies: 291
-- Name: TABLE ar_system_statuses; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_system_statuses IS 'Классификатор статусов систем';


--
-- TOC entry 4142 (class 0 OID 0)
-- Dependencies: 291
-- Name: COLUMN ar_system_statuses.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_system_statuses.name IS 'Наименование статуса системы';


--
-- TOC entry 4143 (class 0 OID 0)
-- Dependencies: 291
-- Name: COLUMN ar_system_statuses.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_system_statuses.description IS 'Принцип отнесения системы к данному статусу';


--
-- TOC entry 292 (class 1259 OID 17421)
-- Name: ar_system_statuses_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_system_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_system_statuses_id_seq OWNER TO postgres;

--
-- TOC entry 4144 (class 0 OID 0)
-- Dependencies: 292
-- Name: ar_system_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_system_statuses_id_seq OWNED BY archrep.ar_system_statuses.id;


--
-- TOC entry 293 (class 1259 OID 17422)
-- Name: ar_systems; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_systems (
    id bigint NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    fullname character varying,
    parent_ar_systems_id bigint,
    parent_name character varying,
    ar_system_statuses_id bigint,
    vendor_ar_partners_id bigint,
    supplier_ar_partners_id bigint,
    supporter_ar_partners_id bigint,
    description character varying,
    it_lead character varying,
    business_lead character varying,
    ar_system_owners_id bigint,
    ar_system_hosting_types_id bigint,
    comment character varying,
    technologies character varying(512),
    technologies_noref character varying,
    external_system boolean DEFAULT false NOT NULL
);


ALTER TABLE archrep.ar_systems OWNER TO postgres;

--
-- TOC entry 4145 (class 0 OID 0)
-- Dependencies: 293
-- Name: TABLE ar_systems; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_systems IS 'Каталог систем и модулей';


--
-- TOC entry 4146 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.code; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.code IS 'Уникальный код системы (используется в заявках и при именовании серверов)';


--
-- TOC entry 4147 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.name IS 'Краткое наименование системы';


--
-- TOC entry 4148 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.fullname; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.fullname IS 'Полное наименование системы или модуля';


--
-- TOC entry 4149 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.parent_ar_systems_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.parent_ar_systems_id IS 'Ссылка на родительскую систему (для модулей)';


--
-- TOC entry 4150 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.parent_name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.parent_name IS 'Наименование родительской системы. Денормализовал для удобства отображения в компоненте "таблица" до момента простановки parent_id';


--
-- TOC entry 4151 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.ar_system_statuses_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.ar_system_statuses_id IS 'Статус системы (FK)';


--
-- TOC entry 4152 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.vendor_ar_partners_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.vendor_ar_partners_id IS 'Вендор/разработчик решения(FK)';


--
-- TOC entry 4153 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.supplier_ar_partners_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.supplier_ar_partners_id IS 'Поставщик решения, интегратор (FK)';


--
-- TOC entry 4154 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.supporter_ar_partners_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.supporter_ar_partners_id IS 'Партнер по поддержке(FK)';


--
-- TOC entry 4155 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.description IS 'Описание системы/модуля';


--
-- TOC entry 4156 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.it_lead; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.it_lead IS 'Ответственный от ИТ';


--
-- TOC entry 4157 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.business_lead; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.business_lead IS 'Ответственный от бизнеса';


--
-- TOC entry 4158 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.ar_system_owners_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.ar_system_owners_id IS 'Относится к направлению бизнеса (FK)';


--
-- TOC entry 4159 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.ar_system_hosting_types_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.ar_system_hosting_types_id IS 'Тип хостинга(FK)';


--
-- TOC entry 4160 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.comment; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.comment IS 'Примечание';


--
-- TOC entry 4161 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.technologies_noref; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.technologies_noref IS 'временный столбец для формализации технологий';


--
-- TOC entry 4162 (class 0 OID 0)
-- Dependencies: 293
-- Name: COLUMN ar_systems.external_system; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems.external_system IS 'Признак внешней системы или сервиса';


--
-- TOC entry 294 (class 1259 OID 17428)
-- Name: ar_systems_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_systems_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_systems_id_seq OWNER TO postgres;

--
-- TOC entry 4163 (class 0 OID 0)
-- Dependencies: 294
-- Name: ar_systems_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_systems_id_seq OWNED BY archrep.ar_systems.id;


--
-- TOC entry 295 (class 1259 OID 17429)
-- Name: ar_systems_technologies; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_systems_technologies (
    id bigint NOT NULL,
    systems_id bigint NOT NULL,
    technologies_id bigint NOT NULL
);


ALTER TABLE archrep.ar_systems_technologies OWNER TO postgres;

--
-- TOC entry 4164 (class 0 OID 0)
-- Dependencies: 295
-- Name: TABLE ar_systems_technologies; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_systems_technologies IS 'Связь таблиц и технологий';


--
-- TOC entry 4165 (class 0 OID 0)
-- Dependencies: 295
-- Name: COLUMN ar_systems_technologies.systems_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems_technologies.systems_id IS 'Ссылка на систему';


--
-- TOC entry 4166 (class 0 OID 0)
-- Dependencies: 295
-- Name: COLUMN ar_systems_technologies.technologies_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_systems_technologies.technologies_id IS 'Ссылка на технологию';


--
-- TOC entry 296 (class 1259 OID 17432)
-- Name: ar_systems_technologies_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_systems_technologies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_systems_technologies_id_seq OWNER TO postgres;

--
-- TOC entry 4167 (class 0 OID 0)
-- Dependencies: 296
-- Name: ar_systems_technologies_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_systems_technologies_id_seq OWNED BY archrep.ar_systems_technologies.id;


--
-- TOC entry 297 (class 1259 OID 17433)
-- Name: ar_technologies; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_technologies (
    id bigint NOT NULL,
    name character varying NOT NULL,
    vendor_ar_partners_id bigint,
    technology_classes_id bigint,
    approve_document character varying,
    technology_types_id bigint,
    technology_statuses_id bigint,
    radar_include_flag boolean,
    description character varying,
    domestic_flag boolean
);


ALTER TABLE archrep.ar_technologies OWNER TO postgres;

--
-- TOC entry 4168 (class 0 OID 0)
-- Dependencies: 297
-- Name: TABLE ar_technologies; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_technologies IS 'Перечень технологий';


--
-- TOC entry 4169 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.name IS 'Название технологии';


--
-- TOC entry 4170 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.vendor_ar_partners_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.vendor_ar_partners_id IS 'Разработчик/вендор';


--
-- TOC entry 4171 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.technology_classes_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.technology_classes_id IS 'Отнесение к классу ПО';


--
-- TOC entry 4172 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.approve_document; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.approve_document IS 'Основание для включения в каталог технологий';


--
-- TOC entry 4173 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.technology_types_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.technology_types_id IS 'Тип технологии по классификации техрадара';


--
-- TOC entry 4174 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.technology_statuses_id; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.technology_statuses_id IS 'Статус в техрадаре (ADOPT, HOLD, ACCESS, TRIAL)';


--
-- TOC entry 4175 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.radar_include_flag; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.radar_include_flag IS 'Признак включения в техрадар';


--
-- TOC entry 4176 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.description IS 'Краткое описание технологии (в т.ч. ссылка)';


--
-- TOC entry 4177 (class 0 OID 0)
-- Dependencies: 297
-- Name: COLUMN ar_technologies.domestic_flag; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technologies.domestic_flag IS 'Флаг отечественного ПО';


--
-- TOC entry 298 (class 1259 OID 17438)
-- Name: ar_technologies_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_technologies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_technologies_id_seq OWNER TO postgres;

--
-- TOC entry 4178 (class 0 OID 0)
-- Dependencies: 298
-- Name: ar_technologies_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_technologies_id_seq OWNED BY archrep.ar_technologies.id;


--
-- TOC entry 299 (class 1259 OID 17439)
-- Name: ar_technologies_temp; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_technologies_temp (
    name character varying(150),
    vendor_ar_partners_id character varying(150),
    technology_types_id character varying(150),
    tehnology_statuses_id character varying(150),
    radar_include_flag character varying(150),
    technology_classes_id character varying(164),
    description character varying(4096),
    technology_statuses_id character varying(150),
    approove_document character varying(228),
    domestic_flag character varying(150)
);


ALTER TABLE archrep.ar_technologies_temp OWNER TO postgres;

--
-- TOC entry 300 (class 1259 OID 17444)
-- Name: ar_technology_classes; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_technology_classes (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying
);


ALTER TABLE archrep.ar_technology_classes OWNER TO postgres;

--
-- TOC entry 4179 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE ar_technology_classes; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_technology_classes IS 'Классы технологий';


--
-- TOC entry 4180 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN ar_technology_classes.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technology_classes.name IS 'Наименование класса технологии';


--
-- TOC entry 4181 (class 0 OID 0)
-- Dependencies: 300
-- Name: COLUMN ar_technology_classes.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technology_classes.description IS 'Описание класса технологий, правил отнесения к данному классу';


--
-- TOC entry 301 (class 1259 OID 17449)
-- Name: ar_technology_classes_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_technology_classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_technology_classes_id_seq OWNER TO postgres;

--
-- TOC entry 4182 (class 0 OID 0)
-- Dependencies: 301
-- Name: ar_technology_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_technology_classes_id_seq OWNED BY archrep.ar_technology_classes.id;


--
-- TOC entry 302 (class 1259 OID 17450)
-- Name: ar_technology_statuses; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_technology_statuses (
    id bigint NOT NULL,
    name character varying NOT NULL,
    fullname character varying NOT NULL,
    description character varying
);


ALTER TABLE archrep.ar_technology_statuses OWNER TO postgres;

--
-- TOC entry 4183 (class 0 OID 0)
-- Dependencies: 302
-- Name: TABLE ar_technology_statuses; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_technology_statuses IS 'Справочник статусов технологий (по отношению к компании)';


--
-- TOC entry 4184 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN ar_technology_statuses.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technology_statuses.name IS 'Наименование статуса (для техрадара)';


--
-- TOC entry 4185 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN ar_technology_statuses.fullname; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technology_statuses.fullname IS 'Русскоязычное наименование';


--
-- TOC entry 4186 (class 0 OID 0)
-- Dependencies: 302
-- Name: COLUMN ar_technology_statuses.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technology_statuses.description IS 'Описание принципов классификации';


--
-- TOC entry 303 (class 1259 OID 17455)
-- Name: ar_technology_statuses_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_technology_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_technology_statuses_id_seq OWNER TO postgres;

--
-- TOC entry 4187 (class 0 OID 0)
-- Dependencies: 303
-- Name: ar_technology_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_technology_statuses_id_seq OWNED BY archrep.ar_technology_statuses.id;


--
-- TOC entry 304 (class 1259 OID 17456)
-- Name: ar_technology_types; Type: TABLE; Schema: archrep; Owner: postgres
--

CREATE TABLE archrep.ar_technology_types (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying
);


ALTER TABLE archrep.ar_technology_types OWNER TO postgres;

--
-- TOC entry 4188 (class 0 OID 0)
-- Dependencies: 304
-- Name: TABLE ar_technology_types; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON TABLE archrep.ar_technology_types IS 'Справочник типов технологий в классификации техрадара';


--
-- TOC entry 4189 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN ar_technology_types.name; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technology_types.name IS 'Наименование типа технологии (для техрадара)';


--
-- TOC entry 4190 (class 0 OID 0)
-- Dependencies: 304
-- Name: COLUMN ar_technology_types.description; Type: COMMENT; Schema: archrep; Owner: postgres
--

COMMENT ON COLUMN archrep.ar_technology_types.description IS 'Описание правил классификации';


--
-- TOC entry 305 (class 1259 OID 17461)
-- Name: ar_technology_types_id_seq; Type: SEQUENCE; Schema: archrep; Owner: postgres
--

CREATE SEQUENCE archrep.ar_technology_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE archrep.ar_technology_types_id_seq OWNER TO postgres;

--
-- TOC entry 4191 (class 0 OID 0)
-- Dependencies: 305
-- Name: ar_technology_types_id_seq; Type: SEQUENCE OWNED BY; Schema: archrep; Owner: postgres
--

ALTER SEQUENCE archrep.ar_technology_types_id_seq OWNED BY archrep.ar_technology_types.id;


--
-- TOC entry 3501 (class 2604 OID 17483)
-- Name: ar_actor_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_actor_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_actor_types_id_seq'::regclass);


--
-- TOC entry 3502 (class 2604 OID 17484)
-- Name: ar_actors id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_actors ALTER COLUMN id SET DEFAULT nextval('archrep.ar_actors_id_seq'::regclass);


--
-- TOC entry 3505 (class 2604 OID 17485)
-- Name: ar_adr_increment_diagrams id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_diagrams ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_increment_diagrams_id_seq'::regclass);


--
-- TOC entry 3508 (class 2604 OID 17486)
-- Name: ar_adr_increment_relation_statuses id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_relation_statuses ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_relation_statuses_id_seq'::regclass);


--
-- TOC entry 3509 (class 2604 OID 17487)
-- Name: ar_adr_increment_relations id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_relations ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_increment_relations_id_seq'::regclass);


--
-- TOC entry 3510 (class 2604 OID 17488)
-- Name: ar_adr_increment_system_functions id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_system_functions ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_increment_system_functions_id_seq'::regclass);


--
-- TOC entry 3512 (class 2604 OID 17489)
-- Name: ar_adr_increment_system_statuses id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_system_statuses ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_system_statuses_id_seq'::regclass);


--
-- TOC entry 3513 (class 2604 OID 17490)
-- Name: ar_adr_increment_systems id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_systems ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_increment_systems_id_seq'::regclass);


--
-- TOC entry 3514 (class 2604 OID 17491)
-- Name: ar_adr_increment_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_increment_types_id_seq'::regclass);


--
-- TOC entry 3515 (class 2604 OID 17492)
-- Name: ar_adr_increments id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increments ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_increments_id_seq'::regclass);


--
-- TOC entry 3517 (class 2604 OID 17493)
-- Name: ar_adr_statuses id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_statuses ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adr_statuses_id_seq'::regclass);


--
-- TOC entry 3518 (class 2604 OID 17494)
-- Name: ar_adrs_applied id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adrs_applied ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adrs_applied_id_seq'::regclass);


--
-- TOC entry 3521 (class 2604 OID 17495)
-- Name: ar_adrs_principle id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adrs_principle ALTER COLUMN id SET DEFAULT nextval('archrep.ar_adrs_principle_id_seq'::regclass);


--
-- TOC entry 3524 (class 2604 OID 17496)
-- Name: ar_business_functions id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_functions ALTER COLUMN id SET DEFAULT nextval('archrep.ar_business_functions_id_seq'::regclass);


--
-- TOC entry 3527 (class 2604 OID 17497)
-- Name: ar_business_service_statuses id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_service_statuses ALTER COLUMN id SET DEFAULT nextval('archrep.ar_business_service_statuses_id_seq'::regclass);


--
-- TOC entry 3528 (class 2604 OID 17498)
-- Name: ar_business_services id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_services ALTER COLUMN id SET DEFAULT nextval('archrep.ar_business_services_id_seq'::regclass);


--
-- TOC entry 3531 (class 2604 OID 17499)
-- Name: ar_classificators id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_classificators ALTER COLUMN id SET DEFAULT nextval('archrep.ar_classificators_id_seq'::regclass);


--
-- TOC entry 3532 (class 2604 OID 17500)
-- Name: ar_gap_states id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gap_states ALTER COLUMN id SET DEFAULT nextval('archrep.ar_gap_states_id_seq'::regclass);


--
-- TOC entry 3533 (class 2604 OID 17501)
-- Name: ar_gap_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gap_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_gap_types_id_seq'::regclass);


--
-- TOC entry 3534 (class 2604 OID 17502)
-- Name: ar_gaps id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gaps ALTER COLUMN id SET DEFAULT nextval('archrep.ar_gaps_id_seq'::regclass);


--
-- TOC entry 3537 (class 2604 OID 17503)
-- Name: ar_impact_level_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_impact_level_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_impact_level_types_id_seq'::regclass);


--
-- TOC entry 3538 (class 2604 OID 17504)
-- Name: ar_integration_flow_event_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flow_event_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_integration_flow_event_types_id_seq'::regclass);


--
-- TOC entry 3539 (class 2604 OID 17505)
-- Name: ar_integration_flow_statuses id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flow_statuses ALTER COLUMN id SET DEFAULT nextval('archrep.ar_integration_flow_statuses_id_seq'::regclass);


--
-- TOC entry 3540 (class 2604 OID 17506)
-- Name: ar_integration_flows id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flows ALTER COLUMN id SET DEFAULT nextval('archrep.ar_integration_flows_id_seq'::regclass);


--
-- TOC entry 3543 (class 2604 OID 17507)
-- Name: ar_metamodel_entity_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_entity_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_metamodel_entity_types_id_seq'::regclass);


--
-- TOC entry 3544 (class 2604 OID 17508)
-- Name: ar_metamodel_relation_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_relation_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_metamodel_relation_types_id_seq'::regclass);


--
-- TOC entry 3545 (class 2604 OID 17509)
-- Name: ar_metamodel_relations id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_relations ALTER COLUMN id SET DEFAULT nextval('archrep.ar_metamodel_relations_id_seq'::regclass);


--
-- TOC entry 3548 (class 2604 OID 17510)
-- Name: ar_organization_unit_categories id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_organization_unit_categories ALTER COLUMN id SET DEFAULT nextval('archrep.ar_organization_unit_categories_id_seq'::regclass);


--
-- TOC entry 3549 (class 2604 OID 17511)
-- Name: ar_organization_units id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_organization_units ALTER COLUMN id SET DEFAULT nextval('archrep.ar_organization_units_id_seq'::regclass);


--
-- TOC entry 3552 (class 2604 OID 17512)
-- Name: ar_partners id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_partners ALTER COLUMN id SET DEFAULT nextval('archrep.ar_partners_id_seq'::regclass);


--
-- TOC entry 3553 (class 2604 OID 17513)
-- Name: ar_principles id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_principles ALTER COLUMN id SET DEFAULT nextval('archrep.ar_principles_id_seq'::regclass);


--
-- TOC entry 3555 (class 2604 OID 17514)
-- Name: ar_settings_parameters id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_settings_parameters ALTER COLUMN id SET DEFAULT nextval('archrep.ar_settings_parameters_id_seq'::regclass);


--
-- TOC entry 3561 (class 2604 OID 17515)
-- Name: ar_system_assignments id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_assignments ALTER COLUMN id SET DEFAULT nextval('archrep.ar_system_assignments_id_seq'::regclass);


--
-- TOC entry 3562 (class 2604 OID 17516)
-- Name: ar_system_functions id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_functions ALTER COLUMN id SET DEFAULT nextval('archrep.ar_system_functions_id_seq'::regclass);


--
-- TOC entry 3565 (class 2604 OID 17517)
-- Name: ar_system_hosting_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_hosting_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_system_hosting_types_id_seq'::regclass);


--
-- TOC entry 3566 (class 2604 OID 17518)
-- Name: ar_system_owners id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_owners ALTER COLUMN id SET DEFAULT nextval('archrep.ar_system_owners_id_seq'::regclass);


--
-- TOC entry 3567 (class 2604 OID 17519)
-- Name: ar_system_statuses id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_statuses ALTER COLUMN id SET DEFAULT nextval('archrep.ar_system_statuses_id_seq'::regclass);


--
-- TOC entry 3568 (class 2604 OID 17520)
-- Name: ar_systems id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems ALTER COLUMN id SET DEFAULT nextval('archrep.ar_systems_id_seq'::regclass);


--
-- TOC entry 3570 (class 2604 OID 17521)
-- Name: ar_systems_technologies id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems_technologies ALTER COLUMN id SET DEFAULT nextval('archrep.ar_systems_technologies_id_seq'::regclass);


--
-- TOC entry 3571 (class 2604 OID 17522)
-- Name: ar_technologies id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technologies ALTER COLUMN id SET DEFAULT nextval('archrep.ar_technologies_id_seq'::regclass);


--
-- TOC entry 3572 (class 2604 OID 17523)
-- Name: ar_technology_classes id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technology_classes ALTER COLUMN id SET DEFAULT nextval('archrep.ar_technology_classes_id_seq'::regclass);


--
-- TOC entry 3573 (class 2604 OID 17524)
-- Name: ar_technology_statuses id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technology_statuses ALTER COLUMN id SET DEFAULT nextval('archrep.ar_technology_statuses_id_seq'::regclass);


--
-- TOC entry 3574 (class 2604 OID 17525)
-- Name: ar_technology_types id; Type: DEFAULT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technology_types ALTER COLUMN id SET DEFAULT nextval('archrep.ar_technology_types_id_seq'::regclass);


--
-- TOC entry 3928 (class 0 OID 17171)
-- Dependencies: 218
-- Data for Name: ar_actor_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_actor_types VALUES (1, 'internal', 'Внутренний', 'Сотрудник, подразделение');
INSERT INTO archrep.ar_actor_types VALUES (2, 'external', 'Внешний', 'Партнёр, клиент');
INSERT INTO archrep.ar_actor_types VALUES (3, 'system', 'Система', 'Внешняя или внутренняя система');


--
-- TOC entry 3930 (class 0 OID 17177)
-- Dependencies: 220
-- Data for Name: ar_actors; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3932 (class 0 OID 17185)
-- Dependencies: 222
-- Data for Name: ar_adr_increment_diagrams; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3934 (class 0 OID 17193)
-- Dependencies: 224
-- Data for Name: ar_adr_increment_relation_statuses; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_adr_increment_relation_statuses VALUES (1, 'Создается', 'Интеграционный поток запланирован к реализации', 'ADR_INCR_REL_CREATING');
INSERT INTO archrep.ar_adr_increment_relation_statuses VALUES (2, 'Модифицируется', 'Дорабатывается существующий интеграционный поток', 'ADR_INCR_REL_MODIFYING');
INSERT INTO archrep.ar_adr_increment_relation_statuses VALUES (3, 'Используется', 'В рамках решения используется существующий интеграционный поток', 'ADR_INCR_REL_IN_USE');
INSERT INTO archrep.ar_adr_increment_relation_statuses VALUES (4, 'Удаляется', 'Интеграционный поток удаляется', 'ADR_INCR_REL_REMOVING');


--
-- TOC entry 3935 (class 0 OID 17198)
-- Dependencies: 225
-- Data for Name: ar_adr_increment_relations; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3937 (class 0 OID 17204)
-- Dependencies: 227
-- Data for Name: ar_adr_increment_system_functions; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3939 (class 0 OID 17209)
-- Dependencies: 229
-- Data for Name: ar_adr_increment_system_statuses; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_adr_increment_system_statuses VALUES (1, 'Создается', 'Система создается в рамках решения', 'ADR_INCR_SYS_CREATING');
INSERT INTO archrep.ar_adr_increment_system_statuses VALUES (2, 'Используется', 'Система участвует в реализации решения (без изменений)', 'ADR_INCR_SYS_IN_USE');
INSERT INTO archrep.ar_adr_increment_system_statuses VALUES (3, 'Модифицируется', 'Система дорабатывается в рамках решения', 'ADR_INCR_SYS_MODIFYING');
INSERT INTO archrep.ar_adr_increment_system_statuses VALUES (4, 'Выводится из эксплуатации', 'Система выводится из эксплуатации', 'ADR_INCR_SYS_DECOMMISSIONING');
INSERT INTO archrep.ar_adr_increment_system_statuses VALUES (5, 'Создается в другом решении', 'Система реализуется в рамках другого проекта/бизнес-инициативы', 'ADR_INCR_SYS_OTHER_SOLUTION');


--
-- TOC entry 3940 (class 0 OID 17214)
-- Dependencies: 230
-- Data for Name: ar_adr_increment_systems; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3942 (class 0 OID 17220)
-- Dependencies: 232
-- Data for Name: ar_adr_increment_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_adr_increment_types VALUES (1, 'Временное решение', 'Временное (инкрементальное) решение');
INSERT INTO archrep.ar_adr_increment_types VALUES (2, 'Целевое решение', 'Целевое решение');


--
-- TOC entry 3944 (class 0 OID 17226)
-- Dependencies: 234
-- Data for Name: ar_adr_increments; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3947 (class 0 OID 17234)
-- Dependencies: 237
-- Data for Name: ar_adr_statuses; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_adr_statuses VALUES (1, 'Черновик', 'Черновик решения', 'ADR_STATUS_DRAFT');
INSERT INTO archrep.ar_adr_statuses VALUES (2, 'Утверждено архитектором', 'Утверждено архитектором', 'ADR_STATUS_APPROVED_ARCH');
INSERT INTO archrep.ar_adr_statuses VALUES (3, 'Утверждено арх.советом', 'Утверждено архитектурным советом', 'ADR_STATUS_APPROVED_COUNCIL');


--
-- TOC entry 3950 (class 0 OID 17241)
-- Dependencies: 240
-- Data for Name: ar_adrs_applied; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3952 (class 0 OID 17249)
-- Dependencies: 242
-- Data for Name: ar_adrs_principle; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3954 (class 0 OID 17257)
-- Dependencies: 244
-- Data for Name: ar_business_functions; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3956 (class 0 OID 17265)
-- Dependencies: 246
-- Data for Name: ar_business_service_statuses; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_business_service_statuses VALUES (1, 'Разработка', NULL);
INSERT INTO archrep.ar_business_service_statuses VALUES (2, 'В эксплуатации', NULL);
INSERT INTO archrep.ar_business_service_statuses VALUES (3, 'Выведен', NULL);


--
-- TOC entry 3958 (class 0 OID 17271)
-- Dependencies: 248
-- Data for Name: ar_business_services; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3960 (class 0 OID 17279)
-- Dependencies: 250
-- Data for Name: ar_classificators; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_classificators VALUES (1, 'Вендоры/Партнеры/Интеграторы');
INSERT INTO archrep.ar_classificators VALUES (2, 'Назначения систем (Бизнес/Инфраструктура)');
INSERT INTO archrep.ar_classificators VALUES (3, 'Тип хостинга');
INSERT INTO archrep.ar_classificators VALUES (4, 'Бизнес-направления');
INSERT INTO archrep.ar_classificators VALUES (5, 'Статусы систем');
INSERT INTO archrep.ar_classificators VALUES (6, 'Классы технологий');
INSERT INTO archrep.ar_classificators VALUES (7, 'Статусы технологий (техрадар)');
INSERT INTO archrep.ar_classificators VALUES (8, 'Типы технологий (техрадар)');
INSERT INTO archrep.ar_classificators VALUES (9, 'Перечень справочников');


--
-- TOC entry 3962 (class 0 OID 17285)
-- Dependencies: 252
-- Data for Name: ar_gap_states; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_gap_states VALUES (1, 'Выявлен', 'Долг выявлен');
INSERT INTO archrep.ar_gap_states VALUES (2, 'Запланирован', 'Запланировано устранение');
INSERT INTO archrep.ar_gap_states VALUES (3, 'В работе', 'В процессе устранения');
INSERT INTO archrep.ar_gap_states VALUES (4, 'Закрыт', 'Устранён');


--
-- TOC entry 3964 (class 0 OID 17291)
-- Dependencies: 254
-- Data for Name: ar_gap_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_gap_types VALUES (1, 'Архитектурное отклонение', 'Отклонение от целевой архитектуры');
INSERT INTO archrep.ar_gap_types VALUES (2, 'Архитектурное исключение', 'Временное исключение из правил');


--
-- TOC entry 3966 (class 0 OID 17297)
-- Dependencies: 256
-- Data for Name: ar_gaps; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3969 (class 0 OID 17306)
-- Dependencies: 259
-- Data for Name: ar_impact_level_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_impact_level_types VALUES (1, 'Критический', 'Критическое влияние');
INSERT INTO archrep.ar_impact_level_types VALUES (2, 'Высокий', 'Высокая степень влияния');
INSERT INTO archrep.ar_impact_level_types VALUES (3, 'Средний', 'Средняя степень влияния');
INSERT INTO archrep.ar_impact_level_types VALUES (4, 'Низкий', 'Низкая степень влияния');


--
-- TOC entry 3971 (class 0 OID 17312)
-- Dependencies: 261
-- Data for Name: ar_integration_flow_event_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_integration_flow_event_types VALUES (1, 'По событию', 'Инициируется по наступлению события');
INSERT INTO archrep.ar_integration_flow_event_types VALUES (2, 'По расписанию', 'Инициируется по расписанию');


--
-- TOC entry 3973 (class 0 OID 17318)
-- Dependencies: 263
-- Data for Name: ar_integration_flow_statuses; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_integration_flow_statuses VALUES (1, 'Планируется к реализации', 'Интеграционный поток предложен к реализации, но не прошел утверждение архитектором или архитектурным советом', 'FLOW_STATUS_1');
INSERT INTO archrep.ar_integration_flow_statuses VALUES (2, 'В процессе реализации', 'Реализация интеграционного потока утверждена', 'FLOW_STATUS_2');
INSERT INTO archrep.ar_integration_flow_statuses VALUES (3, 'В промышленной эксплуатации', 'Интеграционный поток реализован и эксплуатируется', 'FLOW_STATUS_3');
INSERT INTO archrep.ar_integration_flow_statuses VALUES (4, 'Исключена', 'Ранее реализованный интеграционный поток, выеден из эксплуатации', 'FLOW_STATUS_4');
INSERT INTO archrep.ar_integration_flow_statuses VALUES (5, 'Реализация отменена', 'Предложенный к реализации интеграционный поток не утвержден', 'FLOW_STATUS_5');


--
-- TOC entry 3975 (class 0 OID 17324)
-- Dependencies: 265
-- Data for Name: ar_integration_flows; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3977 (class 0 OID 17332)
-- Dependencies: 267
-- Data for Name: ar_metamodel_entity_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_metamodel_entity_types VALUES (3, 'organization_unit', 'Организационная единица', 'ar_organization_units', NULL);
INSERT INTO archrep.ar_metamodel_entity_types VALUES (5, 'business_service', 'Бизнес-сервис (продукт)', 'ar_business_services', NULL);
INSERT INTO archrep.ar_metamodel_entity_types VALUES (7, 'principle', 'Принцип', 'ar_principles', NULL);
INSERT INTO archrep.ar_metamodel_entity_types VALUES (4, 'actor', 'Заинтересованное лицо', 'ar_actors', NULL);
INSERT INTO archrep.ar_metamodel_entity_types VALUES (6, 'business_function', 'Бизнес-способность', 'ar_business_functions', NULL);
INSERT INTO archrep.ar_metamodel_entity_types VALUES (9, 'gap', 'Архитектурный долг', 'ar_gaps', 'Запись реестра архитектурного долга');
INSERT INTO archrep.ar_metamodel_entity_types VALUES (10, 'applied', 'Архитектурное заключение', 'ar_adrs_applied', 'Запись реестра архитектурных заключений');
INSERT INTO archrep.ar_metamodel_entity_types VALUES (11, 'subsystem', 'Модуль системы', 'ar_systems', 'Модуль системы');
INSERT INTO archrep.ar_metamodel_entity_types VALUES (1, 'system', 'Информационная система', 'ar_systems', 'Система');
INSERT INTO archrep.ar_metamodel_entity_types VALUES (2, 'technology', 'Технология', 'ar_technologies', 'Технологический компонент');


--
-- TOC entry 3979 (class 0 OID 17338)
-- Dependencies: 269
-- Data for Name: ar_metamodel_relation_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_metamodel_relation_types VALUES (11, 'gap-system', 'Относится к', 'Арх. долг относится к системе', 9, 1);
INSERT INTO archrep.ar_metamodel_relation_types VALUES (12, 'system_module', 'Модуль системы', 'Связь формируется автоматически из ar_systems.parent_ar_systems_id', 11, 1);
INSERT INTO archrep.ar_metamodel_relation_types VALUES (13, 'applied_gap', 'Фиксирует арх.долг', 'Архитектурное заключение фиксирует арх.долг', 10, 9);
INSERT INTO archrep.ar_metamodel_relation_types VALUES (14, 'integration_flow', 'Интеграционный поток', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой', 1, 1);
INSERT INTO archrep.ar_metamodel_relation_types VALUES (20, 'module_technology', 'Использует', 'Модуль использует технологию', 11, 2);
INSERT INTO archrep.ar_metamodel_relation_types VALUES (19, 'system_technology', 'Использует', 'Связь информационной системы с элементом технологического стека', 1, 2);
INSERT INTO archrep.ar_metamodel_relation_types VALUES (21, 'integration_flow_system_module', 'Интеграционный поток (Система → Модуль)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой', 1, 11);
INSERT INTO archrep.ar_metamodel_relation_types VALUES (22, 'integration_flow_module_system', 'Интеграционный поток (Модуль → Система)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой', 11, 1);
INSERT INTO archrep.ar_metamodel_relation_types VALUES (23, 'integration_flow_module_module', 'Интеграционный поток (Модуль → Модуль)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой', 11, 11);


--
-- TOC entry 3981 (class 0 OID 17344)
-- Dependencies: 271
-- Data for Name: ar_metamodel_relations; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3983 (class 0 OID 17352)
-- Dependencies: 273
-- Data for Name: ar_organization_unit_categories; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_organization_unit_categories VALUES (1, 'dept', 'Департамент', NULL);
INSERT INTO archrep.ar_organization_unit_categories VALUES (2, 'dir', 'Дирекция', NULL);
INSERT INTO archrep.ar_organization_unit_categories VALUES (3, 'otdel', 'Отдел', NULL);
INSERT INTO archrep.ar_organization_unit_categories VALUES (4, 'other', 'Иное', NULL);


--
-- TOC entry 3985 (class 0 OID 17358)
-- Dependencies: 275
-- Data for Name: ar_organization_units; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3987 (class 0 OID 17366)
-- Dependencies: 277
-- Data for Name: ar_partners; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3989 (class 0 OID 17372)
-- Dependencies: 279
-- Data for Name: ar_principles; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3991 (class 0 OID 17379)
-- Dependencies: 281
-- Data for Name: ar_settings_parameters; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_settings_parameters VALUES (1, 'ARR_SERVER_PORT', 'Порт, на котором слушает BFF/API. При пустом — из env SERVER_PORT или 3000.', '3000', 'number', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (2, 'GAP_CODE_PREFIX', 'Префикс кода при автогенерации записи реестра архитектурного долга (например GAP-1, GAP-2).', 'GAP-', 'string', 'Арх.долг', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (3, 'ADR_ADRP_PREFIX', 'Префикс кода при создании архитектурного решения по принципу (ADRP-1, …).', 'ADRP-', 'string', 'ADR', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (4, 'ADR_ADRA_PREFIX', 'Префикс кода при создании архитектурного заключения (ADRA-1, …).', 'ADRA-', 'string', 'ADR', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (5, 'GRAPH_LAYOUT_DEF', 'Раскладка графа зависимостей по умолчанию при построении: star, grid, ring (и др., если поддерживаются).', 'star', 'string', 'Граф', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (6, 'GRAPH_MAX_NODES', 'Максимальное число узлов на графе; при превышении — предупреждение или ограничение построения.', '200', 'number', 'Граф', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (7, 'GRAPH_EDGE_FONTSZ', 'Размер шрифта подписей рёбер на графе (px).', '10', 'number', 'Граф', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (8, 'GRAPH_VIEWBOX_MIN', 'Минимальная сторона viewBox графа (px); при меньшем размере граф масштабируется.', '500', 'number', 'Граф', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (9, 'ADR_CODE_MAXLEN', 'Максимальная длина кода инкремента/заключения в форме арх.заключений.', '15', 'number', 'ADR', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (11, 'ADR_APPROVED_NAMES', 'Список названий статусов утверждения; при смене на один из них из инкрементов создаются записи в реестре потоков.', '["Утверждено архитектором","Утверждено арх.советом"]', 'json', 'ADR', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (12, 'ADR_DRAFT_STATUS', 'Название статуса «черновик» (редактирование разрешено только в нём).', 'Черновик', 'string', 'ADR', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (15, 'ARR_MENU_COOKIE', 'Имя cookie, в котором хранится состояние свёрнутости пунктов меню.', 'ar-v3-menu-expanded', 'string', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (16, 'ARR_COLS_COOKIE', 'Префикс имени cookie для сохранения видимых колонок таблиц.', 'ar_cols_', 'string', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (17, 'ARR_SORT_COOKIE', 'Префикс имени cookie для сохранения сортировки таблиц.', 'ar_sort_', 'string', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (18, 'ARR_COOKIE_MAX_DAYS', 'Срок жизни cookie колонок/сортировки в днях.', '365', 'number', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (19, 'SYS_CODE_MAXLEN', 'Максимальная длина кода ИС в форме каталога систем.', '32', 'number', 'Системы', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (20, 'ARR_EXCEL_SHEET', 'Имя листа в выгружаемых Excel-файлах, когда не задано явно (fallback).', 'Sheet1', 'string', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (21, 'ARR_SEARCH_PLACEHOLDER', 'Текст по умолчанию в поле поиска таблиц (если не переопределён на экране).', 'Поиск по всем полям таблицы', 'string', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (24, 'ARR_FRONTEND_V3_PATH', 'Каталог статики фронта v3 (относительно cwd сервера).', 'frontend-v3-dist', 'string', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (13, 'GRAPH_ENTITY_ORDER', 'Список кодов типов сущностей в порядке отображения в выборе графа.', '["system", "subsystem", "technology", "organization_unit", "actor", "business_service", "business_function", "principle"]', 'string_list', 'Граф', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 21:07:02.027694+00');
INSERT INTO archrep.ar_settings_parameters VALUES (27, 'ADR_DRAFT_STATUS_CODE', 'Код статуса черновика (ar_adr_statuses.code).', 'ADR_STATUS_DRAFT', 'string', 'ADR', false, false, '2026-03-19 16:24:27.508263+00', '2026-03-19 16:24:27.508263+00');
INSERT INTO archrep.ar_settings_parameters VALUES (26, 'ADR_APPROVED_STATUS_CODES', 'Коды статусов архитектурного заключения (ar_adr_statuses.code) при которых происходит создание потоков в реестре интеграций.', '["ADR_STATUS_APPROVED_ARCH","ADR_STATUS_APPROVED_COUNCIL"]', 'json', 'ADR', false, false, '2026-03-19 16:24:27.508263+00', '2026-03-19 16:26:35.46235+00');
INSERT INTO archrep.ar_settings_parameters VALUES (14, 'ARR_APP_BASE', 'Базовый URL-путь фронта (для роутера и сборки).', '/', 'string', 'Система', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 15:33:09.043616+00');
INSERT INTO archrep.ar_settings_parameters VALUES (10, 'ADR_FLOW_STATUS_MAP', 'JSON: код статуса связи инкремента → код статуса потока. Используется для создания потоков в реестре интеграций из архитектурного заключения ', '{"ADR_INCR_REL_CREATING":"FLOW_STATUS_PLANNED","ADR_INCR_REL_MODIFYING":"FLOW_STATUS_PRODUCTION","ADR_INCR_REL_IN_USE":"FLOW_STATUS_PRODUCTION","ADR_INCR_REL_REMOVING":"FLOW_STATUS_EXCLUDED","ADR_INCR_REL_PLANNED":"FLOW_STATUS_PLANNED","ADR_INCR_REL_IMPLEMENTING":"FLOW_STATUS_IN_PROGRESS","ADR_INCR_REL_DONE":"FLOW_STATUS_PRODUCTION"}', 'json', 'ADR', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 16:28:10.15309+00');
INSERT INTO archrep.ar_settings_parameters VALUES (28, 'DISP_META_ENTITY_TYPE_TEMPLATE', 'Шаблон именования в списках выбора типов сущностей метамодели для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (29, 'DISP_BUSINESS_SERVICE_STATUS_TEMPLATE', 'Шаблон именования в списках выбора статусов бизнес-сервисов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (30, 'DISP_TECH_TYPE_TEMPLATE', 'Шаблон именования в списках выбора типов технологий для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (31, 'DISP_IMPACT_LEVEL_TEMPLATE', 'Шаблон именования в списках выбора уровней влияния для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (32, 'DISP_ORG_UNIT_CATEGORY_TEMPLATE', 'Шаблон именования в списках выбора категорий орг. единиц для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (33, 'DISP_ACTOR_TEMPLATE', 'Шаблон именования в списках выбора акторов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (34, 'DISP_FLOW_STATUS_TEMPLATE', 'Шаблон именования в списках выбора статусов интеграционных потоков для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (35, 'DISP_ADR_SYSTEM_STATUS_TEMPLATE', 'Шаблон именования в списках выбора статусов систем в инкрементах ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (36, 'DISP_PARTNER_TEMPLATE', 'Шаблон именования в списках выбора партнеров для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (37, 'DISP_TECH_CLASS_TEMPLATE', 'Шаблон именования в списках выбора классов технологий для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (38, 'DISP_ADR_STATUS_TEMPLATE', 'Шаблон именования в списках выбора статусов ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (39, 'DISP_BUSINESS_FUNCTION_TEMPLATE', 'Шаблон именования в списках выбора бизнес-функций для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (40, 'DISP_ADR_INCREMENT_TYPE_TEMPLATE', 'Шаблон именования в списках выбора типов инкрементов ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (41, 'DISP_GAP_TEMPLATE', 'Шаблон именования в списках выбора архитектурных долгов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (42, 'DISP_GAP_TYPE_TEMPLATE', 'Шаблон именования в списках выбора типов архитектурного долга для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (43, 'DISP_FLOW_EVENT_TYPE_TEMPLATE', 'Шаблон именования в списках выбора типов событий интеграций для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (44, 'DISP_GAP_STATE_TEMPLATE', 'Шаблон именования в списках выбора состояний долга для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (45, 'DISP_HOSTING_TYPE_TEMPLATE', 'Шаблон именования в списках выбора типов хостинга для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (46, 'DISP_ORG_UNIT_TEMPLATE', 'Шаблон именования в списках выбора орг. единиц для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (47, 'DISP_OWNER_TEMPLATE', 'Шаблон именования в списках выбора владельцев систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (48, 'DISP_TECHNOLOGY_TEMPLATE', 'Шаблон именования в списках выбора технологий для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (49, 'DISP_META_REL_TYPE_TEMPLATE', 'Шаблон именования в списках выбора типов связей метамодели для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (50, 'DISP_BUSINESS_SERVICE_TEMPLATE', 'Шаблон именования в списках выбора бизнес-сервисов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (51, 'DISP_SYSTEM_TEMPLATE', 'Шаблон именования в списках выбора систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (52, 'DISP_ADR_REL_STATUS_TEMPLATE', 'Шаблон именования в списках выбора статусов связей инкрементов ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (53, 'DISP_ADRA_TEMPLATE', 'Шаблон именования в списках выбора архитектурных заключений для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{task_name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (54, 'DISP_TECH_STATUS_TEMPLATE', 'Шаблон именования в списках выбора статусов технологий для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (55, 'DISP_ACTOR_TYPE_TEMPLATE', 'Шаблон именования в списках выбора типов акторов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (56, 'DISP_ADRP_TEMPLATE', 'Шаблон именования в списках выбора принципиальных ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (57, 'DISP_SYSTEM_STATUS_TEMPLATE', 'Шаблон именования в списках выбора статусов систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 18:38:35.318225+00', '2026-03-19 18:38:35.318225+00');
INSERT INTO archrep.ar_settings_parameters VALUES (25, 'GRAPH_ENTITY_ICONS', 'JSON: для каждого кода типа сущности — объект с полями icon (имя иконки Lucide: Monitor, Cpu, …), label, listLabel. Влияет на отображение узлов в Анализаторе зависимостей.', '{"actor": {"icon": "User", "label": "Актор", "listLabel": "Акторы"}, "system": {"icon": "Monitor", "label": "Информационная система", "listLabel": "ИС"}, "principle": {"icon": "Scale", "label": "Принцип", "listLabel": "Принципы"}, "subsystem": {"icon": "Puzzle", "label": "Модуль системы", "listLabel": "Модули систем"}, "technology": {"icon": "Cpu", "label": "Технология", "listLabel": "Технологии"}, "system_child": {"icon": "Server", "label": "Дочерняя система (в составе родителя)", "listLabel": "ИС (дочерняя)"}, "business_service": {"icon": "Package", "label": "Бизнес-сервис (продукт)", "listLabel": "Продукты"}, "business_function": {"icon": "GitBranch", "label": "Бизнес-функция", "listLabel": "Бизнес-способности"}, "organization_unit": {"icon": "Building2", "label": "Организационная единица", "listLabel": "Орг. единицы"}}', 'json', 'Граф', false, false, '2026-03-19 15:33:09.043616+00', '2026-03-19 21:07:02.027694+00');
INSERT INTO archrep.ar_settings_parameters VALUES (58, 'DISP_SUBSYSTEM_TEMPLATE', 'Шаблон именования в списках выбора модулей систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )', '{name}', 'string', 'Display', false, false, '2026-03-19 21:07:48.792785+00', '2026-03-19 21:07:48.792785+00');
INSERT INTO archrep.ar_settings_parameters VALUES (59, 'DISP_INTEGRATION_FLOW_NAME', 'Шаблон подписи ребра метамодели для проекции интеграционного потока (ar_metamodel_relations.displayed_name). Плейсхолдеры: {source_name},{target_name},{source_code},{target_code},{status_name},{event_type_name},{transferred_data},{transfer_method},{periodicity},{id}. Условные блоки [[...]] как у других DISP. См. docs/metamodel-projection-ar-integration-flows.md', '{transferred_data}', 'string', 'Display', false, false, '2026-03-21 13:25:32.039373+00', '2026-03-21 13:53:35.101397+00');
INSERT INTO archrep.ar_settings_parameters VALUES (60, 'SYS_TECH_STACK_RELATION_CODE', 'Код типа связи метамодели для стека технологий ИС (вкладка редактирования системы)', 'system_technology', 'string', 'Метамодель', false, false, '2026-03-21 18:39:16.719561+00', '2026-03-21 18:39:16.719561+00');
INSERT INTO archrep.ar_settings_parameters VALUES (61, 'MODULE_TECH_STACK_RELATION_CODE', 'Код типа связи метамодели для стека технологий модуля ИС (parent_ar_systems_id IS NOT NULL)', 'module_technology', 'string', 'Метамодель', false, false, '2026-03-21 19:49:25.362272+00', '2026-03-21 19:49:25.362272+00');
INSERT INTO archrep.ar_settings_parameters VALUES (62, 'GRAPH_COLLAPSED_SYSTEM_ICON', 'Имя компонента Lucide для узла ИС на графе анализатора при свёртке модулей в систему (issue #48). Пример: MonitorDot.', 'MonitorDot', 'string', 'Граф', false, false, '2026-03-21 21:27:32.422851+00', '2026-03-21 21:27:32.422851+00');
INSERT INTO archrep.ar_settings_parameters VALUES (63, 'DRAWIO_EMBED_BASE', 'Ссылка на drawio для отображения схем', 'https://app.example.com/drawio', 'string', NULL, false, false, '2026-04-11 19:27:57.568687+00', '2026-04-12 12:55:39.872858+00');
INSERT INTO archrep.ar_settings_parameters VALUES (64, 'DRAWIO_NODE_STYLE', 'JSON: стили узлов (систем) на схеме инкремента в draw.io — цвета по статусу, типографика, отступы, сетка (issue #53).', '{"nodeStatusColor":{"ADR_INCR_SYS_IN_USE":"#C8E6C9","ADR_INCR_SYS_CREATING":"#FFF9C4","ADR_INCR_SYS_MODIFYING":"#FFCCBC","ADR_INCR_SYS_DECOMMISSIONING":"#ECEFF1","ADR_INCR_SYS_OTHER_SOLUTION":"#BBDEFB"},"nodeStatusStroke":{},"titleFontSize":14,"titleBold":true,"bodyFontSize":11,"bodyLineHeight":1.25,"paddingH":12,"paddingV":10,"minWidth":140,"minHeight":72,"maxTextWidth":280,"cornerRadius":8,"gridStep":8}', 'json', 'Draw.io', false, false, '2026-04-13 05:12:21.598228+00', '2026-04-13 05:12:21.598228+00');
INSERT INTO archrep.ar_settings_parameters VALUES (66, 'DRAWIO_LAYOUT_STYLE', 'JSON: раскладка схемы инкремента — поля, зазоры, резерв под подписи, разводка параллельных рёбер (issue #53).', '{"algorithm":"layered_orthogonal","direction":"LR","margin":40,"rankSep":80,"nodeSep":40,"edgeLabelReserveH":24,"edgeLabelReserveV":20,"parallelEdgeGap":12}', 'json', 'Draw.io', false, false, '2026-04-13 05:12:21.598228+00', '2026-04-13 05:12:21.598228+00');
INSERT INTO archrep.ar_settings_parameters VALUES (65, 'DRAWIO_EDGE_STYLE', 'JSON: стили рёбер (интеграций) на схеме инкремента — цвет по статусу связи, подпись, online/offline (issue #53).', '{"edgeStatusColor":{"ADR_INCR_REL_CREATING":"#D6B656","ADR_INCR_REL_MODIFYING":"#F57C00","ADR_INCR_REL_IN_USE":"#212121","ADR_INCR_REL_REMOVING":"#C62828"},"labelFontSize":10,"labelOffsetAbove":8,"labelOffsetLeft":8,"onlineLineStyle":{"dashed":false,"strokeWidth":2},"offlineLineStyle":{"dashed":true,"dashPattern":"8 4","strokeWidth":2}}', 'json', 'Draw.io', false, false, '2026-04-13 05:12:21.598228+00', '2026-04-13 09:57:47.521361+00');


--
-- TOC entry 3993 (class 0 OID 17390)
-- Dependencies: 283
-- Data for Name: ar_system_assignments; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_system_assignments VALUES (1, 'Бизнес', 'Системы, которые автоматизируют профильную деятельность в рамках бизнес-процессов компании');
INSERT INTO archrep.ar_system_assignments VALUES (2, 'Инфраструктура', 'Системы, обеспечивающие работоспособность других систем ');


--
-- TOC entry 3995 (class 0 OID 17396)
-- Dependencies: 285
-- Data for Name: ar_system_functions; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 3997 (class 0 OID 17404)
-- Dependencies: 287
-- Data for Name: ar_system_hosting_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_system_hosting_types VALUES ('On-premise', 1);
INSERT INTO archrep.ar_system_hosting_types VALUES ('Облако', 2);
INSERT INTO archrep.ar_system_hosting_types VALUES ('Гибрид (Облако + On-premise)', 3);


--
-- TOC entry 3999 (class 0 OID 17410)
-- Dependencies: 289
-- Data for Name: ar_system_owners; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 4001 (class 0 OID 17416)
-- Dependencies: 291
-- Data for Name: ar_system_statuses; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_system_statuses VALUES (2, 'Планируется к внедрению', 'Системы которые находятся на стадии обсуждения целесообразности внедрения');
INSERT INTO archrep.ar_system_statuses VALUES (3, 'В процессе внедрения', 'Системы для которых уже запущен процесс анализа/разработки, но не перешедшие к стадии опытной эксплуатации');
INSERT INTO archrep.ar_system_statuses VALUES (4, 'В опытной эксплуатации', 'Системы, разработка которых завершена и осуществляется эксплуатация, но процесс ввода в промышленную эксплуатацию не завершен  ');
INSERT INTO archrep.ar_system_statuses VALUES (5, 'В промышленной эксплуатации', 'Системы, которые введены в промышленную эксплуатацию в порядке, установленном на момент внедрения');
INSERT INTO archrep.ar_system_statuses VALUES (6, 'Планируется к выводу из эксплуатации', 'Системы, которые планируются к выводу из промышленной эксплуатации');
INSERT INTO archrep.ar_system_statuses VALUES (7, 'Выведена из эксплуатации', 'Система, эксплуатация которой прекращена');
INSERT INTO archrep.ar_system_statuses VALUES (8, 'В архивном режиме', 'Система, эксплуатируемая только в режиме доступа к архивным данным');


--
-- TOC entry 4003 (class 0 OID 17422)
-- Dependencies: 293
-- Data for Name: ar_systems; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 4005 (class 0 OID 17429)
-- Dependencies: 295
-- Data for Name: ar_systems_technologies; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
-- TOC entry 4007 (class 0 OID 17433)
-- Dependencies: 297
-- Data for Name: ar_technologies; Type: TABLE DATA; Schema: archrep; Owner: postgres
--



--
--
-- TOC entry 4010 (class 0 OID 17444)
-- Dependencies: 300
-- Data for Name: ar_technology_classes; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_technology_classes VALUES (2, 'Прикладные платформы', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (3, 'Офисное ПО', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (6, 'Интеграционное решение', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (8, 'СУБД', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (9, 'Безопасность', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (10, 'Средства анализа данных (BI)', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (12, 'Прикладные решения', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (13, 'Серверы приложений, веб-серверы', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (14, 'Нейросети, машинное обучение', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (4, 'Языки, фреймворки, средства разработки', NULL);
INSERT INTO archrep.ar_technology_classes VALUES (7, 'Инфраструктурные решение', '');
INSERT INTO archrep.ar_technology_classes VALUES (11, 'Операционные системы', '');


--
-- TOC entry 4012 (class 0 OID 17450)
-- Dependencies: 302
-- Data for Name: ar_technology_statuses; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_technology_statuses VALUES (4, 'HOLD', 'HOLD', NULL);
INSERT INTO archrep.ar_technology_statuses VALUES (6, 'ASSESS', 'ASSESS', NULL);
INSERT INTO archrep.ar_technology_statuses VALUES (7, 'TRIAL', 'TRIAL', NULL);
INSERT INTO archrep.ar_technology_statuses VALUES (5, 'ADOPT ', 'ADOPT', '');


--
-- TOC entry 4014 (class 0 OID 17456)
-- Dependencies: 304
-- Data for Name: ar_technology_types; Type: TABLE DATA; Schema: archrep; Owner: postgres
--

INSERT INTO archrep.ar_technology_types VALUES (2, 'Инфраструктура и платформы', NULL);
INSERT INTO archrep.ar_technology_types VALUES (4, 'Инструменты и техники', NULL);
INSERT INTO archrep.ar_technology_types VALUES (5, 'ЯП и фрэймворки', NULL);
INSERT INTO archrep.ar_technology_types VALUES (6, 'Управление данными', NULL);


--
-- TOC entry 4192 (class 0 OID 0)
-- Dependencies: 216
-- Name: adra_code_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.adra_code_seq', 5, true);


--
-- TOC entry 4193 (class 0 OID 0)
-- Dependencies: 217
-- Name: adrp_code_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.adrp_code_seq', 3, true);


--
-- TOC entry 4194 (class 0 OID 0)
-- Dependencies: 219
-- Name: ar_actor_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_actor_types_id_seq', 3, true);


--
-- TOC entry 4195 (class 0 OID 0)
-- Dependencies: 221
-- Name: ar_actors_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_actors_id_seq', 1, false);


--
-- TOC entry 4196 (class 0 OID 0)
-- Dependencies: 223
-- Name: ar_adr_increment_diagrams_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_increment_diagrams_id_seq', 24, true);


--
-- TOC entry 4197 (class 0 OID 0)
-- Dependencies: 226
-- Name: ar_adr_increment_relations_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_increment_relations_id_seq', 17, true);


--
-- TOC entry 4198 (class 0 OID 0)
-- Dependencies: 228
-- Name: ar_adr_increment_system_functions_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_increment_system_functions_id_seq', 26, true);


--
-- TOC entry 4199 (class 0 OID 0)
-- Dependencies: 231
-- Name: ar_adr_increment_systems_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_increment_systems_id_seq', 42, true);


--
-- TOC entry 4200 (class 0 OID 0)
-- Dependencies: 233
-- Name: ar_adr_increment_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_increment_types_id_seq', 2, true);


--
-- TOC entry 4201 (class 0 OID 0)
-- Dependencies: 235
-- Name: ar_adr_increments_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_increments_id_seq', 22, true);


--
-- TOC entry 4202 (class 0 OID 0)
-- Dependencies: 236
-- Name: ar_adr_relation_statuses_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_relation_statuses_id_seq', 4, true);


--
-- TOC entry 4203 (class 0 OID 0)
-- Dependencies: 238
-- Name: ar_adr_statuses_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_statuses_id_seq', 3, true);


--
-- TOC entry 4204 (class 0 OID 0)
-- Dependencies: 239
-- Name: ar_adr_system_statuses_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adr_system_statuses_id_seq', 5, true);


--
-- TOC entry 4205 (class 0 OID 0)
-- Dependencies: 241
-- Name: ar_adrs_applied_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adrs_applied_id_seq', 5, true);


--
-- TOC entry 4206 (class 0 OID 0)
-- Dependencies: 243
-- Name: ar_adrs_principle_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_adrs_principle_id_seq', 3, true);


--
-- TOC entry 4207 (class 0 OID 0)
-- Dependencies: 245
-- Name: ar_business_functions_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_business_functions_id_seq', 77, true);


--
-- TOC entry 4208 (class 0 OID 0)
-- Dependencies: 247
-- Name: ar_business_service_statuses_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_business_service_statuses_id_seq', 3, true);


--
-- TOC entry 4209 (class 0 OID 0)
-- Dependencies: 249
-- Name: ar_business_services_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_business_services_id_seq', 8, true);


--
-- TOC entry 4210 (class 0 OID 0)
-- Dependencies: 251
-- Name: ar_classificators_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_classificators_id_seq', 10, true);


--
-- TOC entry 4211 (class 0 OID 0)
-- Dependencies: 253
-- Name: ar_gap_states_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_gap_states_id_seq', 4, true);


--
-- TOC entry 4212 (class 0 OID 0)
-- Dependencies: 255
-- Name: ar_gap_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_gap_types_id_seq', 2, true);


--
-- TOC entry 4213 (class 0 OID 0)
-- Dependencies: 257
-- Name: ar_gaps_code_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_gaps_code_seq', 12, true);


--
-- TOC entry 4214 (class 0 OID 0)
-- Dependencies: 258
-- Name: ar_gaps_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_gaps_id_seq', 12, true);


--
-- TOC entry 4215 (class 0 OID 0)
-- Dependencies: 260
-- Name: ar_impact_level_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_impact_level_types_id_seq', 4, true);


--
-- TOC entry 4216 (class 0 OID 0)
-- Dependencies: 262
-- Name: ar_integration_flow_event_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_integration_flow_event_types_id_seq', 2, true);


--
-- TOC entry 4217 (class 0 OID 0)
-- Dependencies: 264
-- Name: ar_integration_flow_statuses_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_integration_flow_statuses_id_seq', 5, true);


--
-- TOC entry 4218 (class 0 OID 0)
-- Dependencies: 266
-- Name: ar_integration_flows_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_integration_flows_id_seq', 162, true);


--
-- TOC entry 4219 (class 0 OID 0)
-- Dependencies: 268
-- Name: ar_metamodel_entity_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_metamodel_entity_types_id_seq', 11, true);


--
-- TOC entry 4220 (class 0 OID 0)
-- Dependencies: 270
-- Name: ar_metamodel_relation_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_metamodel_relation_types_id_seq', 23, true);


--
-- TOC entry 4221 (class 0 OID 0)
-- Dependencies: 272
-- Name: ar_metamodel_relations_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_metamodel_relations_id_seq', 1065, true);


--
-- TOC entry 4222 (class 0 OID 0)
-- Dependencies: 274
-- Name: ar_organization_unit_categories_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_organization_unit_categories_id_seq', 4, true);


--
-- TOC entry 4223 (class 0 OID 0)
-- Dependencies: 276
-- Name: ar_organization_units_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_organization_units_id_seq', 1, false);


--
-- TOC entry 4224 (class 0 OID 0)
-- Dependencies: 278
-- Name: ar_partners_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_partners_id_seq', 476, true);


--
-- TOC entry 4225 (class 0 OID 0)
-- Dependencies: 280
-- Name: ar_principles_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_principles_id_seq', 42, true);


--
-- TOC entry 4226 (class 0 OID 0)
-- Dependencies: 282
-- Name: ar_settings_parameters_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_settings_parameters_id_seq', 66, true);


--
-- TOC entry 4227 (class 0 OID 0)
-- Dependencies: 284
-- Name: ar_system_assignments_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_system_assignments_id_seq', 2, true);


--
-- TOC entry 4228 (class 0 OID 0)
-- Dependencies: 286
-- Name: ar_system_functions_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_system_functions_id_seq', 12, true);


--
-- TOC entry 4229 (class 0 OID 0)
-- Dependencies: 288
-- Name: ar_system_hosting_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_system_hosting_types_id_seq', 3, true);


--
-- TOC entry 4230 (class 0 OID 0)
-- Dependencies: 290
-- Name: ar_system_owners_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_system_owners_id_seq', 388, true);


--
-- TOC entry 4231 (class 0 OID 0)
-- Dependencies: 292
-- Name: ar_system_statuses_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_system_statuses_id_seq', 8, true);


--
-- TOC entry 4232 (class 0 OID 0)
-- Dependencies: 294
-- Name: ar_systems_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_systems_id_seq', 191, true);


--
-- TOC entry 4233 (class 0 OID 0)
-- Dependencies: 296
-- Name: ar_systems_technologies_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_systems_technologies_id_seq', 266, true);


--
-- TOC entry 4234 (class 0 OID 0)
-- Dependencies: 298
-- Name: ar_technologies_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_technologies_id_seq', 999, true);


--
-- TOC entry 4235 (class 0 OID 0)
-- Dependencies: 301
-- Name: ar_technology_classes_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_technology_classes_id_seq', 14, true);


--
-- TOC entry 4236 (class 0 OID 0)
-- Dependencies: 303
-- Name: ar_technology_statuses_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_technology_statuses_id_seq', 7, true);


--
-- TOC entry 4237 (class 0 OID 0)
-- Dependencies: 305
-- Name: ar_technology_types_id_seq; Type: SEQUENCE SET; Schema: archrep; Owner: postgres
--

SELECT pg_catalog.setval('archrep.ar_technology_types_id_seq', 6, true);


--
-- TOC entry 3576 (class 2606 OID 17530)
-- Name: ar_actor_types ar_actor_types_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_actor_types
    ADD CONSTRAINT ar_actor_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3578 (class 2606 OID 17532)
-- Name: ar_actors ar_actors_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_actors
    ADD CONSTRAINT ar_actors_code_key UNIQUE (code);


--
-- TOC entry 3581 (class 2606 OID 17534)
-- Name: ar_actors ar_actors_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_actors
    ADD CONSTRAINT ar_actors_pkey PRIMARY KEY (id);


--
-- TOC entry 3584 (class 2606 OID 17536)
-- Name: ar_adr_increment_diagrams ar_adr_increment_diagrams_ar_adr_increment_id_version_no_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_diagrams
    ADD CONSTRAINT ar_adr_increment_diagrams_ar_adr_increment_id_version_no_key UNIQUE (ar_adr_increment_id, version_no);


--
-- TOC entry 3586 (class 2606 OID 17538)
-- Name: ar_adr_increment_diagrams ar_adr_increment_diagrams_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_diagrams
    ADD CONSTRAINT ar_adr_increment_diagrams_pkey PRIMARY KEY (id);


--
-- TOC entry 3593 (class 2606 OID 17540)
-- Name: ar_adr_increment_relations ar_adr_increment_relations_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_relations
    ADD CONSTRAINT ar_adr_increment_relations_pkey PRIMARY KEY (id);


--
-- TOC entry 3595 (class 2606 OID 17542)
-- Name: ar_adr_increment_system_functions ar_adr_increment_system_funct_ar_adr_increment_system_id_ar_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_system_functions
    ADD CONSTRAINT ar_adr_increment_system_funct_ar_adr_increment_system_id_ar_key UNIQUE (ar_adr_increment_system_id, ar_system_functions_id);


--
-- TOC entry 3597 (class 2606 OID 17544)
-- Name: ar_adr_increment_system_functions ar_adr_increment_system_functions_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_system_functions
    ADD CONSTRAINT ar_adr_increment_system_functions_pkey PRIMARY KEY (id);


--
-- TOC entry 3604 (class 2606 OID 17546)
-- Name: ar_adr_increment_systems ar_adr_increment_systems_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_systems
    ADD CONSTRAINT ar_adr_increment_systems_pkey PRIMARY KEY (id);


--
-- TOC entry 3606 (class 2606 OID 17548)
-- Name: ar_adr_increment_systems ar_adr_increment_systems_uniq; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_systems
    ADD CONSTRAINT ar_adr_increment_systems_uniq UNIQUE (ar_adr_increment_id, ar_systems_id);


--
-- TOC entry 3608 (class 2606 OID 17550)
-- Name: ar_adr_increment_types ar_adr_increment_types_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_types
    ADD CONSTRAINT ar_adr_increment_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3611 (class 2606 OID 17552)
-- Name: ar_adr_increments ar_adr_increments_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increments
    ADD CONSTRAINT ar_adr_increments_pkey PRIMARY KEY (id);


--
-- TOC entry 3590 (class 2606 OID 17554)
-- Name: ar_adr_increment_relation_statuses ar_adr_relation_statuses_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_relation_statuses
    ADD CONSTRAINT ar_adr_relation_statuses_pkey PRIMARY KEY (id);


--
-- TOC entry 3614 (class 2606 OID 17556)
-- Name: ar_adr_statuses ar_adr_statuses_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_statuses
    ADD CONSTRAINT ar_adr_statuses_pkey PRIMARY KEY (id);


--
-- TOC entry 3601 (class 2606 OID 17558)
-- Name: ar_adr_increment_system_statuses ar_adr_system_statuses_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_system_statuses
    ADD CONSTRAINT ar_adr_system_statuses_pkey PRIMARY KEY (id);


--
-- TOC entry 3617 (class 2606 OID 17560)
-- Name: ar_adrs_applied ar_adrs_applied_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adrs_applied
    ADD CONSTRAINT ar_adrs_applied_code_key UNIQUE (code);


--
-- TOC entry 3619 (class 2606 OID 17562)
-- Name: ar_adrs_applied ar_adrs_applied_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adrs_applied
    ADD CONSTRAINT ar_adrs_applied_pkey PRIMARY KEY (id);


--
-- TOC entry 3623 (class 2606 OID 17564)
-- Name: ar_adrs_principle ar_adrs_principle_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adrs_principle
    ADD CONSTRAINT ar_adrs_principle_code_key UNIQUE (code);


--
-- TOC entry 3625 (class 2606 OID 17566)
-- Name: ar_adrs_principle ar_adrs_principle_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adrs_principle
    ADD CONSTRAINT ar_adrs_principle_pkey PRIMARY KEY (id);


--
-- TOC entry 3628 (class 2606 OID 17568)
-- Name: ar_business_functions ar_business_functions_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_functions
    ADD CONSTRAINT ar_business_functions_code_key UNIQUE (code);


--
-- TOC entry 3632 (class 2606 OID 17570)
-- Name: ar_business_functions ar_business_functions_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_functions
    ADD CONSTRAINT ar_business_functions_pkey PRIMARY KEY (id);


--
-- TOC entry 3634 (class 2606 OID 17572)
-- Name: ar_business_service_statuses ar_business_service_statuses_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_service_statuses
    ADD CONSTRAINT ar_business_service_statuses_pkey PRIMARY KEY (id);


--
-- TOC entry 3636 (class 2606 OID 17574)
-- Name: ar_business_services ar_business_services_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_services
    ADD CONSTRAINT ar_business_services_code_key UNIQUE (code);


--
-- TOC entry 3639 (class 2606 OID 17576)
-- Name: ar_business_services ar_business_services_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_services
    ADD CONSTRAINT ar_business_services_pkey PRIMARY KEY (id);


--
-- TOC entry 3642 (class 2606 OID 17578)
-- Name: ar_classificators ar_classificators_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_classificators
    ADD CONSTRAINT ar_classificators_pk PRIMARY KEY (id);


--
-- TOC entry 3644 (class 2606 OID 17580)
-- Name: ar_gap_states ar_gap_states_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gap_states
    ADD CONSTRAINT ar_gap_states_pkey PRIMARY KEY (id);


--
-- TOC entry 3646 (class 2606 OID 17582)
-- Name: ar_gap_types ar_gap_types_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gap_types
    ADD CONSTRAINT ar_gap_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3649 (class 2606 OID 17584)
-- Name: ar_gaps ar_gaps_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gaps
    ADD CONSTRAINT ar_gaps_code_key UNIQUE (code);


--
-- TOC entry 3652 (class 2606 OID 17586)
-- Name: ar_gaps ar_gaps_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gaps
    ADD CONSTRAINT ar_gaps_pkey PRIMARY KEY (id);


--
-- TOC entry 3657 (class 2606 OID 17588)
-- Name: ar_impact_level_types ar_impact_level_types_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_impact_level_types
    ADD CONSTRAINT ar_impact_level_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3659 (class 2606 OID 17590)
-- Name: ar_integration_flow_event_types ar_integration_flow_event_types_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flow_event_types
    ADD CONSTRAINT ar_integration_flow_event_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3662 (class 2606 OID 17592)
-- Name: ar_integration_flow_statuses ar_integration_flow_statuses_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flow_statuses
    ADD CONSTRAINT ar_integration_flow_statuses_pkey PRIMARY KEY (id);


--
-- TOC entry 3665 (class 2606 OID 17594)
-- Name: ar_integration_flows ar_integration_flows_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flows
    ADD CONSTRAINT ar_integration_flows_pkey PRIMARY KEY (id);


--
-- TOC entry 3671 (class 2606 OID 17596)
-- Name: ar_metamodel_entity_types ar_metamodel_entity_types_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_entity_types
    ADD CONSTRAINT ar_metamodel_entity_types_code_key UNIQUE (code);


--
-- TOC entry 3673 (class 2606 OID 17598)
-- Name: ar_metamodel_entity_types ar_metamodel_entity_types_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_entity_types
    ADD CONSTRAINT ar_metamodel_entity_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3675 (class 2606 OID 17600)
-- Name: ar_metamodel_relation_types ar_metamodel_relation_types_code_from_to_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_relation_types
    ADD CONSTRAINT ar_metamodel_relation_types_code_from_to_key UNIQUE (code, from_entity_type_id, to_entity_type_id);


--
-- TOC entry 3678 (class 2606 OID 17602)
-- Name: ar_metamodel_relation_types ar_metamodel_relation_types_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_relation_types
    ADD CONSTRAINT ar_metamodel_relation_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3684 (class 2606 OID 17604)
-- Name: ar_metamodel_relations ar_metamodel_relations_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_relations
    ADD CONSTRAINT ar_metamodel_relations_pkey PRIMARY KEY (id);


--
-- TOC entry 3689 (class 2606 OID 17606)
-- Name: ar_organization_unit_categories ar_organization_unit_categories_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_organization_unit_categories
    ADD CONSTRAINT ar_organization_unit_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3692 (class 2606 OID 17608)
-- Name: ar_organization_units ar_organization_units_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_organization_units
    ADD CONSTRAINT ar_organization_units_code_key UNIQUE (code);


--
-- TOC entry 3695 (class 2606 OID 17610)
-- Name: ar_organization_units ar_organization_units_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_organization_units
    ADD CONSTRAINT ar_organization_units_pkey PRIMARY KEY (id);


--
-- TOC entry 3697 (class 2606 OID 17612)
-- Name: ar_partners ar_partners_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_partners
    ADD CONSTRAINT ar_partners_pk PRIMARY KEY (id);


--
-- TOC entry 3699 (class 2606 OID 17614)
-- Name: ar_principles ar_principles_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_principles
    ADD CONSTRAINT ar_principles_pk PRIMARY KEY (id);


--
-- TOC entry 3702 (class 2606 OID 17616)
-- Name: ar_settings_parameters ar_settings_parameters_code_key; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_settings_parameters
    ADD CONSTRAINT ar_settings_parameters_code_key UNIQUE (code);


--
-- TOC entry 3705 (class 2606 OID 17618)
-- Name: ar_settings_parameters ar_settings_parameters_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_settings_parameters
    ADD CONSTRAINT ar_settings_parameters_pkey PRIMARY KEY (id);


--
-- TOC entry 3707 (class 2606 OID 17620)
-- Name: ar_system_assignments ar_system_assignments_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_assignments
    ADD CONSTRAINT ar_system_assignments_pk PRIMARY KEY (id);


--
-- TOC entry 3709 (class 2606 OID 17622)
-- Name: ar_system_functions ar_system_functions_pkey; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_functions
    ADD CONSTRAINT ar_system_functions_pkey PRIMARY KEY (id);


--
-- TOC entry 3712 (class 2606 OID 17624)
-- Name: ar_system_hosting_types ar_system_hosting_types_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_hosting_types
    ADD CONSTRAINT ar_system_hosting_types_pk PRIMARY KEY (id);


--
-- TOC entry 3716 (class 2606 OID 17626)
-- Name: ar_system_statuses ar_system_stasuses_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_statuses
    ADD CONSTRAINT ar_system_stasuses_pk PRIMARY KEY (id);


--
-- TOC entry 3714 (class 2606 OID 17628)
-- Name: ar_system_owners ar_systems_business_areas_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_owners
    ADD CONSTRAINT ar_systems_business_areas_pk PRIMARY KEY (id);


--
-- TOC entry 3718 (class 2606 OID 17630)
-- Name: ar_systems ar_systems_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems
    ADD CONSTRAINT ar_systems_pk PRIMARY KEY (id);


--
-- TOC entry 3722 (class 2606 OID 17632)
-- Name: ar_systems_technologies ar_systems_technologies_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems_technologies
    ADD CONSTRAINT ar_systems_technologies_pk PRIMARY KEY (id);


--
-- TOC entry 3720 (class 2606 OID 17634)
-- Name: ar_systems ar_systems_unique; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems
    ADD CONSTRAINT ar_systems_unique UNIQUE (code);


--
-- TOC entry 3724 (class 2606 OID 17636)
-- Name: ar_technologies ar_technologies_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technologies
    ADD CONSTRAINT ar_technologies_pk PRIMARY KEY (id);


--
-- TOC entry 3726 (class 2606 OID 17638)
-- Name: ar_technology_classes ar_technology_classes_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technology_classes
    ADD CONSTRAINT ar_technology_classes_pk PRIMARY KEY (id);


--
-- TOC entry 3728 (class 2606 OID 17640)
-- Name: ar_technology_statuses ar_technology_statuses_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technology_statuses
    ADD CONSTRAINT ar_technology_statuses_pk PRIMARY KEY (id);


--
-- TOC entry 3730 (class 2606 OID 17642)
-- Name: ar_technology_types ar_technology_types_pk; Type: CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technology_types
    ADD CONSTRAINT ar_technology_types_pk PRIMARY KEY (id);


--
-- TOC entry 3579 (class 1259 OID 17645)
-- Name: ar_actors_org_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_actors_org_idx ON archrep.ar_actors USING btree (organization_unit_id);


--
-- TOC entry 3582 (class 1259 OID 17646)
-- Name: ar_actors_type_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_actors_type_idx ON archrep.ar_actors USING btree (actor_type_id);


--
-- TOC entry 3588 (class 1259 OID 17647)
-- Name: ar_adr_incr_rel_st_code_uidx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE UNIQUE INDEX ar_adr_incr_rel_st_code_uidx ON archrep.ar_adr_increment_relation_statuses USING btree (code);


--
-- TOC entry 3591 (class 1259 OID 17648)
-- Name: ar_adr_increment_relations_increment_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_adr_increment_relations_increment_idx ON archrep.ar_adr_increment_relations USING btree (ar_adr_increment_id);


--
-- TOC entry 3599 (class 1259 OID 17649)
-- Name: ar_adr_increment_system_statuses_code_uidx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE UNIQUE INDEX ar_adr_increment_system_statuses_code_uidx ON archrep.ar_adr_increment_system_statuses USING btree (code);


--
-- TOC entry 3602 (class 1259 OID 17650)
-- Name: ar_adr_increment_systems_increment_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_adr_increment_systems_increment_idx ON archrep.ar_adr_increment_systems USING btree (ar_adr_increment_id);


--
-- TOC entry 3609 (class 1259 OID 17651)
-- Name: ar_adr_increments_applied_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_adr_increments_applied_idx ON archrep.ar_adr_increments USING btree (ar_adrs_applied_id);


--
-- TOC entry 3612 (class 1259 OID 17652)
-- Name: ar_adr_statuses_code_uidx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE UNIQUE INDEX ar_adr_statuses_code_uidx ON archrep.ar_adr_statuses USING btree (code);


--
-- TOC entry 3615 (class 1259 OID 17653)
-- Name: ar_adrs_applied_code_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_adrs_applied_code_idx ON archrep.ar_adrs_applied USING btree (code);


--
-- TOC entry 3620 (class 1259 OID 17654)
-- Name: ar_adrs_applied_status_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_adrs_applied_status_idx ON archrep.ar_adrs_applied USING btree (ar_adr_statuses_id);


--
-- TOC entry 3621 (class 1259 OID 17655)
-- Name: ar_adrs_principle_code_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_adrs_principle_code_idx ON archrep.ar_adrs_principle USING btree (code);


--
-- TOC entry 3626 (class 1259 OID 17656)
-- Name: ar_adrs_principle_status_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_adrs_principle_status_idx ON archrep.ar_adrs_principle USING btree (ar_adr_statuses_id);


--
-- TOC entry 3629 (class 1259 OID 17657)
-- Name: ar_business_functions_owner_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_business_functions_owner_idx ON archrep.ar_business_functions USING btree (ar_organization_units_id);


--
-- TOC entry 3630 (class 1259 OID 17658)
-- Name: ar_business_functions_parent_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_business_functions_parent_idx ON archrep.ar_business_functions USING btree (parent_id);


--
-- TOC entry 3637 (class 1259 OID 17659)
-- Name: ar_business_services_owner_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_business_services_owner_idx ON archrep.ar_business_services USING btree (ar_organization_units_id);


--
-- TOC entry 3640 (class 1259 OID 17660)
-- Name: ar_business_services_status_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_business_services_status_idx ON archrep.ar_business_services USING btree (ar_business_service_statuses_id);


--
-- TOC entry 3647 (class 1259 OID 17661)
-- Name: ar_gaps_code_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_gaps_code_idx ON archrep.ar_gaps USING btree (code);


--
-- TOC entry 3650 (class 1259 OID 17662)
-- Name: ar_gaps_impact_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_gaps_impact_idx ON archrep.ar_gaps USING btree (ar_impact_level_types_id);


--
-- TOC entry 3653 (class 1259 OID 17663)
-- Name: ar_gaps_state_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_gaps_state_idx ON archrep.ar_gaps USING btree (ar_gap_states_id);


--
-- TOC entry 3654 (class 1259 OID 17664)
-- Name: ar_gaps_target_date_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_gaps_target_date_idx ON archrep.ar_gaps USING btree (target_date);


--
-- TOC entry 3655 (class 1259 OID 17665)
-- Name: ar_gaps_type_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_gaps_type_idx ON archrep.ar_gaps USING btree (ar_gap_types_id);


--
-- TOC entry 3660 (class 1259 OID 17666)
-- Name: ar_integration_flow_statuses_code_uidx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE UNIQUE INDEX ar_integration_flow_statuses_code_uidx ON archrep.ar_integration_flow_statuses USING btree (code);


--
-- TOC entry 3663 (class 1259 OID 17667)
-- Name: ar_integration_flows_applied_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_integration_flows_applied_idx ON archrep.ar_integration_flows USING btree (ar_adrs_applied_id);


--
-- TOC entry 3666 (class 1259 OID 17668)
-- Name: ar_integration_flows_relation_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_integration_flows_relation_idx ON archrep.ar_integration_flows USING btree (ar_adr_increment_relation_id);


--
-- TOC entry 3667 (class 1259 OID 17669)
-- Name: ar_integration_flows_source_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_integration_flows_source_idx ON archrep.ar_integration_flows USING btree (source_ar_systems_id);


--
-- TOC entry 3668 (class 1259 OID 17670)
-- Name: ar_integration_flows_status_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_integration_flows_status_idx ON archrep.ar_integration_flows USING btree (ar_integration_flow_statuses_id);


--
-- TOC entry 3669 (class 1259 OID 17671)
-- Name: ar_integration_flows_target_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_integration_flows_target_idx ON archrep.ar_integration_flows USING btree (target_ar_systems_id);


--
-- TOC entry 3680 (class 1259 OID 17672)
-- Name: ar_metamodel_rel_iflow_proj_ref_uq; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE UNIQUE INDEX ar_metamodel_rel_iflow_proj_ref_uq ON archrep.ar_metamodel_relations USING btree (reference_to_baserow) WHERE ((reference_to_baserow IS NOT NULL) AND ((relation_type)::text = ANY (ARRAY[('integration_flow'::character varying)::text, ('integration_flow_system_module'::character varying)::text, ('integration_flow_module_system'::character varying)::text, ('integration_flow_module_module'::character varying)::text])));


--
-- TOC entry 3681 (class 1259 OID 17673)
-- Name: ar_metamodel_rel_system_module_uq; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE UNIQUE INDEX ar_metamodel_rel_system_module_uq ON archrep.ar_metamodel_relations USING btree (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type) WHERE (((relation_type)::text = 'system_module'::text) AND ((from_entity_type)::text = 'subsystem'::text) AND ((to_entity_type)::text = 'system'::text));


--
-- TOC entry 3676 (class 1259 OID 17674)
-- Name: ar_metamodel_relation_types_from_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_metamodel_relation_types_from_idx ON archrep.ar_metamodel_relation_types USING btree (from_entity_type_id);


--
-- TOC entry 3679 (class 1259 OID 17675)
-- Name: ar_metamodel_relation_types_to_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_metamodel_relation_types_to_idx ON archrep.ar_metamodel_relation_types USING btree (to_entity_type_id);


--
-- TOC entry 3682 (class 1259 OID 17676)
-- Name: ar_metamodel_relations_from_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_metamodel_relations_from_idx ON archrep.ar_metamodel_relations USING btree (from_entity_type, from_entity_id);


--
-- TOC entry 3685 (class 1259 OID 17677)
-- Name: ar_metamodel_relations_ref_baserow_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_metamodel_relations_ref_baserow_idx ON archrep.ar_metamodel_relations USING btree (reference_to_baserow) WHERE (reference_to_baserow IS NOT NULL);


--
-- TOC entry 3686 (class 1259 OID 17678)
-- Name: ar_metamodel_relations_to_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_metamodel_relations_to_idx ON archrep.ar_metamodel_relations USING btree (to_entity_type, to_entity_id);


--
-- TOC entry 3687 (class 1259 OID 17679)
-- Name: ar_metamodel_relations_type_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_metamodel_relations_type_idx ON archrep.ar_metamodel_relations USING btree (relation_type);


--
-- TOC entry 3690 (class 1259 OID 17680)
-- Name: ar_organization_units_category_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_organization_units_category_idx ON archrep.ar_organization_units USING btree (organization_unit_categories_id);


--
-- TOC entry 3693 (class 1259 OID 17681)
-- Name: ar_organization_units_parent_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_organization_units_parent_idx ON archrep.ar_organization_units USING btree (parent_id);


--
-- TOC entry 3700 (class 1259 OID 17682)
-- Name: ar_settings_parameters_code_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_settings_parameters_code_idx ON archrep.ar_settings_parameters USING btree (code);


--
-- TOC entry 3703 (class 1259 OID 17683)
-- Name: ar_settings_parameters_group_idx; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX ar_settings_parameters_group_idx ON archrep.ar_settings_parameters USING btree ("group");


--
-- TOC entry 3598 (class 1259 OID 17684)
-- Name: idx_adr_inc_sys_fn_row; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX idx_adr_inc_sys_fn_row ON archrep.ar_adr_increment_system_functions USING btree (ar_adr_increment_system_id);


--
-- TOC entry 3587 (class 1259 OID 17685)
-- Name: idx_ar_adr_increment_diagrams_inc; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE INDEX idx_ar_adr_increment_diagrams_inc ON archrep.ar_adr_increment_diagrams USING btree (ar_adr_increment_id);


--
-- TOC entry 3710 (class 1259 OID 17686)
-- Name: ux_ar_system_functions_system_lower_name; Type: INDEX; Schema: archrep; Owner: postgres
--

CREATE UNIQUE INDEX ux_ar_system_functions_system_lower_name ON archrep.ar_system_functions USING btree (ar_systems_id, lower(TRIM(BOTH FROM name)));


--
-- TOC entry 3778 (class 2620 OID 17687)
-- Name: ar_integration_flows trg_ar_integration_flows_sync_metamodel; Type: TRIGGER; Schema: archrep; Owner: postgres
--

CREATE TRIGGER trg_ar_integration_flows_sync_metamodel AFTER INSERT OR UPDATE ON archrep.ar_integration_flows FOR EACH ROW EXECUTE FUNCTION archrep.trg_ar_integration_flows_sync_metamodel();


--
-- TOC entry 3779 (class 2620 OID 17688)
-- Name: ar_systems trg_sync_system_module_relation_delete; Type: TRIGGER; Schema: archrep; Owner: postgres
--

CREATE TRIGGER trg_sync_system_module_relation_delete AFTER DELETE ON archrep.ar_systems FOR EACH ROW EXECUTE FUNCTION archrep.sync_system_module_relation();


--
-- TOC entry 3780 (class 2620 OID 17689)
-- Name: ar_systems trg_sync_system_module_relation_upsert; Type: TRIGGER; Schema: archrep; Owner: postgres
--

CREATE TRIGGER trg_sync_system_module_relation_upsert AFTER INSERT OR UPDATE OF parent_ar_systems_id ON archrep.ar_systems FOR EACH ROW EXECUTE FUNCTION archrep.sync_system_module_relation();


--
-- TOC entry 3781 (class 2620 OID 17690)
-- Name: ar_systems trg_systems_resync_integration_flow_projections; Type: TRIGGER; Schema: archrep; Owner: postgres
--

CREATE TRIGGER trg_systems_resync_integration_flow_projections AFTER UPDATE OF parent_ar_systems_id ON archrep.ar_systems FOR EACH ROW EXECUTE FUNCTION archrep.trg_ar_systems_resync_integration_flow_projections();


--
-- TOC entry 3782 (class 2620 OID 17691)
-- Name: ar_systems trg_systems_sync_tech_stack_on_parent; Type: TRIGGER; Schema: archrep; Owner: postgres
--

CREATE TRIGGER trg_systems_sync_tech_stack_on_parent AFTER UPDATE OF parent_ar_systems_id ON archrep.ar_systems FOR EACH ROW EXECUTE FUNCTION archrep.sync_tech_stack_relations_on_parent_change();


--
-- TOC entry 3731 (class 2606 OID 17692)
-- Name: ar_actors ar_actors_org_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_actors
    ADD CONSTRAINT ar_actors_org_fkey FOREIGN KEY (organization_unit_id) REFERENCES archrep.ar_organization_units(id) ON DELETE SET NULL;


--
-- TOC entry 3732 (class 2606 OID 17697)
-- Name: ar_actors ar_actors_type_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_actors
    ADD CONSTRAINT ar_actors_type_fkey FOREIGN KEY (actor_type_id) REFERENCES archrep.ar_actor_types(id) ON DELETE SET NULL;


--
-- TOC entry 3733 (class 2606 OID 17702)
-- Name: ar_adr_increment_diagrams ar_adr_increment_diagrams_ar_adr_increment_id_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_diagrams
    ADD CONSTRAINT ar_adr_increment_diagrams_ar_adr_increment_id_fkey FOREIGN KEY (ar_adr_increment_id) REFERENCES archrep.ar_adr_increments(id) ON DELETE CASCADE;


--
-- TOC entry 3734 (class 2606 OID 17707)
-- Name: ar_adr_increment_relations ar_adr_increment_relations_from_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_relations
    ADD CONSTRAINT ar_adr_increment_relations_from_fkey FOREIGN KEY (from_ar_systems_id) REFERENCES archrep.ar_systems(id) ON DELETE SET NULL;


--
-- TOC entry 3735 (class 2606 OID 17712)
-- Name: ar_adr_increment_relations ar_adr_increment_relations_increment_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_relations
    ADD CONSTRAINT ar_adr_increment_relations_increment_fkey FOREIGN KEY (ar_adr_increment_id) REFERENCES archrep.ar_adr_increments(id) ON DELETE CASCADE;


--
-- TOC entry 3736 (class 2606 OID 17717)
-- Name: ar_adr_increment_relations ar_adr_increment_relations_status_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_relations
    ADD CONSTRAINT ar_adr_increment_relations_status_fkey FOREIGN KEY (ar_adr_increment_relation_statuses_id) REFERENCES archrep.ar_adr_increment_relation_statuses(id);


--
-- TOC entry 3737 (class 2606 OID 17722)
-- Name: ar_adr_increment_relations ar_adr_increment_relations_to_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_relations
    ADD CONSTRAINT ar_adr_increment_relations_to_fkey FOREIGN KEY (to_ar_systems_id) REFERENCES archrep.ar_systems(id) ON DELETE SET NULL;


--
-- TOC entry 3738 (class 2606 OID 17727)
-- Name: ar_adr_increment_system_functions ar_adr_increment_system_functio_ar_adr_increment_system_id_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_system_functions
    ADD CONSTRAINT ar_adr_increment_system_functio_ar_adr_increment_system_id_fkey FOREIGN KEY (ar_adr_increment_system_id) REFERENCES archrep.ar_adr_increment_systems(id) ON DELETE CASCADE;


--
-- TOC entry 3739 (class 2606 OID 17732)
-- Name: ar_adr_increment_system_functions ar_adr_increment_system_functions_ar_system_functions_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_system_functions
    ADD CONSTRAINT ar_adr_increment_system_functions_ar_system_functions_fk FOREIGN KEY (ar_system_functions_id) REFERENCES archrep.ar_system_functions(id) ON DELETE RESTRICT;


--
-- TOC entry 3740 (class 2606 OID 17737)
-- Name: ar_adr_increment_systems ar_adr_increment_systems_increment_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_systems
    ADD CONSTRAINT ar_adr_increment_systems_increment_fkey FOREIGN KEY (ar_adr_increment_id) REFERENCES archrep.ar_adr_increments(id) ON DELETE CASCADE;


--
-- TOC entry 3741 (class 2606 OID 17742)
-- Name: ar_adr_increment_systems ar_adr_increment_systems_status_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_systems
    ADD CONSTRAINT ar_adr_increment_systems_status_fkey FOREIGN KEY (ar_adr_increment_system_statuses_id) REFERENCES archrep.ar_adr_increment_system_statuses(id);


--
-- TOC entry 3742 (class 2606 OID 17747)
-- Name: ar_adr_increment_systems ar_adr_increment_systems_system_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increment_systems
    ADD CONSTRAINT ar_adr_increment_systems_system_fkey FOREIGN KEY (ar_systems_id) REFERENCES archrep.ar_systems(id) ON DELETE CASCADE;


--
-- TOC entry 3743 (class 2606 OID 17752)
-- Name: ar_adr_increments ar_adr_increments_applied_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increments
    ADD CONSTRAINT ar_adr_increments_applied_fkey FOREIGN KEY (ar_adrs_applied_id) REFERENCES archrep.ar_adrs_applied(id) ON DELETE CASCADE;


--
-- TOC entry 3744 (class 2606 OID 17757)
-- Name: ar_adr_increments ar_adr_increments_type_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adr_increments
    ADD CONSTRAINT ar_adr_increments_type_fkey FOREIGN KEY (ar_adr_increment_types_id) REFERENCES archrep.ar_adr_increment_types(id);


--
-- TOC entry 3745 (class 2606 OID 17762)
-- Name: ar_adrs_applied ar_adrs_applied_status_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adrs_applied
    ADD CONSTRAINT ar_adrs_applied_status_fkey FOREIGN KEY (ar_adr_statuses_id) REFERENCES archrep.ar_adr_statuses(id);


--
-- TOC entry 3746 (class 2606 OID 17767)
-- Name: ar_adrs_principle ar_adrs_principle_status_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_adrs_principle
    ADD CONSTRAINT ar_adrs_principle_status_fkey FOREIGN KEY (ar_adr_statuses_id) REFERENCES archrep.ar_adr_statuses(id);


--
-- TOC entry 3747 (class 2606 OID 17772)
-- Name: ar_business_functions ar_business_functions_owner_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_functions
    ADD CONSTRAINT ar_business_functions_owner_fkey FOREIGN KEY (ar_organization_units_id) REFERENCES archrep.ar_organization_units(id) ON DELETE SET NULL;


--
-- TOC entry 3748 (class 2606 OID 17777)
-- Name: ar_business_functions ar_business_functions_parent_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_functions
    ADD CONSTRAINT ar_business_functions_parent_fkey FOREIGN KEY (parent_id) REFERENCES archrep.ar_business_functions(id) ON DELETE SET NULL;


--
-- TOC entry 3749 (class 2606 OID 17782)
-- Name: ar_business_services ar_business_services_owner_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_services
    ADD CONSTRAINT ar_business_services_owner_fkey FOREIGN KEY (ar_organization_units_id) REFERENCES archrep.ar_organization_units(id) ON DELETE SET NULL;


--
-- TOC entry 3750 (class 2606 OID 17787)
-- Name: ar_business_services ar_business_services_status_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_business_services
    ADD CONSTRAINT ar_business_services_status_fkey FOREIGN KEY (ar_business_service_statuses_id) REFERENCES archrep.ar_business_service_statuses(id) ON DELETE SET NULL;


--
-- TOC entry 3751 (class 2606 OID 17792)
-- Name: ar_gaps ar_gaps_adr_status_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gaps
    ADD CONSTRAINT ar_gaps_adr_status_fkey FOREIGN KEY (ar_adr_statuses_id) REFERENCES archrep.ar_adr_statuses(id) ON DELETE SET NULL;


--
-- TOC entry 3752 (class 2606 OID 17797)
-- Name: ar_gaps ar_gaps_impact_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gaps
    ADD CONSTRAINT ar_gaps_impact_fkey FOREIGN KEY (ar_impact_level_types_id) REFERENCES archrep.ar_impact_level_types(id) ON DELETE SET NULL;


--
-- TOC entry 3753 (class 2606 OID 17802)
-- Name: ar_gaps ar_gaps_state_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gaps
    ADD CONSTRAINT ar_gaps_state_fkey FOREIGN KEY (ar_gap_states_id) REFERENCES archrep.ar_gap_states(id) ON DELETE SET NULL;


--
-- TOC entry 3754 (class 2606 OID 17807)
-- Name: ar_gaps ar_gaps_type_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_gaps
    ADD CONSTRAINT ar_gaps_type_fkey FOREIGN KEY (ar_gap_types_id) REFERENCES archrep.ar_gap_types(id) ON DELETE SET NULL;


--
-- TOC entry 3755 (class 2606 OID 17812)
-- Name: ar_integration_flows ar_integration_flows_applied_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flows
    ADD CONSTRAINT ar_integration_flows_applied_fkey FOREIGN KEY (ar_adrs_applied_id) REFERENCES archrep.ar_adrs_applied(id) ON DELETE SET NULL;


--
-- TOC entry 3756 (class 2606 OID 17817)
-- Name: ar_integration_flows ar_integration_flows_event_type_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flows
    ADD CONSTRAINT ar_integration_flows_event_type_fkey FOREIGN KEY (ar_integration_flow_event_types_id) REFERENCES archrep.ar_integration_flow_event_types(id) ON DELETE SET NULL;


--
-- TOC entry 3757 (class 2606 OID 17822)
-- Name: ar_integration_flows ar_integration_flows_relation_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flows
    ADD CONSTRAINT ar_integration_flows_relation_fkey FOREIGN KEY (ar_adr_increment_relation_id) REFERENCES archrep.ar_adr_increment_relations(id) ON DELETE SET NULL;


--
-- TOC entry 3758 (class 2606 OID 17827)
-- Name: ar_integration_flows ar_integration_flows_source_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flows
    ADD CONSTRAINT ar_integration_flows_source_fkey FOREIGN KEY (source_ar_systems_id) REFERENCES archrep.ar_systems(id) ON DELETE CASCADE;


--
-- TOC entry 3759 (class 2606 OID 17832)
-- Name: ar_integration_flows ar_integration_flows_status_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flows
    ADD CONSTRAINT ar_integration_flows_status_fkey FOREIGN KEY (ar_integration_flow_statuses_id) REFERENCES archrep.ar_integration_flow_statuses(id) ON DELETE SET NULL;


--
-- TOC entry 3760 (class 2606 OID 17837)
-- Name: ar_integration_flows ar_integration_flows_target_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_integration_flows
    ADD CONSTRAINT ar_integration_flows_target_fkey FOREIGN KEY (target_ar_systems_id) REFERENCES archrep.ar_systems(id) ON DELETE CASCADE;


--
-- TOC entry 3761 (class 2606 OID 17842)
-- Name: ar_metamodel_relation_types ar_metamodel_relation_types_from_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_relation_types
    ADD CONSTRAINT ar_metamodel_relation_types_from_fkey FOREIGN KEY (from_entity_type_id) REFERENCES archrep.ar_metamodel_entity_types(id) ON DELETE RESTRICT;


--
-- TOC entry 3762 (class 2606 OID 17847)
-- Name: ar_metamodel_relation_types ar_metamodel_relation_types_to_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_metamodel_relation_types
    ADD CONSTRAINT ar_metamodel_relation_types_to_fkey FOREIGN KEY (to_entity_type_id) REFERENCES archrep.ar_metamodel_entity_types(id) ON DELETE RESTRICT;


--
-- TOC entry 3763 (class 2606 OID 17852)
-- Name: ar_organization_units ar_organization_units_category_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_organization_units
    ADD CONSTRAINT ar_organization_units_category_fkey FOREIGN KEY (organization_unit_categories_id) REFERENCES archrep.ar_organization_unit_categories(id) ON DELETE SET NULL;


--
-- TOC entry 3764 (class 2606 OID 17857)
-- Name: ar_organization_units ar_organization_units_parent_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_organization_units
    ADD CONSTRAINT ar_organization_units_parent_fkey FOREIGN KEY (parent_id) REFERENCES archrep.ar_organization_units(id) ON DELETE SET NULL;


--
-- TOC entry 3765 (class 2606 OID 17862)
-- Name: ar_system_functions ar_system_functions_ar_systems_id_fkey; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_system_functions
    ADD CONSTRAINT ar_system_functions_ar_systems_id_fkey FOREIGN KEY (ar_systems_id) REFERENCES archrep.ar_systems(id) ON DELETE CASCADE;


--
-- TOC entry 3766 (class 2606 OID 17867)
-- Name: ar_systems ar_systems_ar_partners_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems
    ADD CONSTRAINT ar_systems_ar_partners_fk FOREIGN KEY (vendor_ar_partners_id) REFERENCES archrep.ar_partners(id);


--
-- TOC entry 3767 (class 2606 OID 17872)
-- Name: ar_systems ar_systems_ar_partners_fk_1; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems
    ADD CONSTRAINT ar_systems_ar_partners_fk_1 FOREIGN KEY (supplier_ar_partners_id) REFERENCES archrep.ar_partners(id);


--
-- TOC entry 3768 (class 2606 OID 17877)
-- Name: ar_systems ar_systems_ar_partners_fk_2; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems
    ADD CONSTRAINT ar_systems_ar_partners_fk_2 FOREIGN KEY (supporter_ar_partners_id) REFERENCES archrep.ar_partners(id);


--
-- TOC entry 3769 (class 2606 OID 17882)
-- Name: ar_systems ar_systems_ar_system_hosting_types_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems
    ADD CONSTRAINT ar_systems_ar_system_hosting_types_fk FOREIGN KEY (ar_system_hosting_types_id) REFERENCES archrep.ar_system_hosting_types(id);


--
-- TOC entry 3770 (class 2606 OID 17887)
-- Name: ar_systems ar_systems_ar_system_owners_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems
    ADD CONSTRAINT ar_systems_ar_system_owners_fk FOREIGN KEY (ar_system_owners_id) REFERENCES archrep.ar_system_owners(id);


--
-- TOC entry 3771 (class 2606 OID 17892)
-- Name: ar_systems ar_systems_ar_system_statuses_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems
    ADD CONSTRAINT ar_systems_ar_system_statuses_fk FOREIGN KEY (ar_system_statuses_id) REFERENCES archrep.ar_system_statuses(id);


--
-- TOC entry 3772 (class 2606 OID 17897)
-- Name: ar_systems_technologies ar_systems_technologies_ar_systems_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems_technologies
    ADD CONSTRAINT ar_systems_technologies_ar_systems_fk FOREIGN KEY (systems_id) REFERENCES archrep.ar_systems(id);


--
-- TOC entry 3773 (class 2606 OID 17902)
-- Name: ar_systems_technologies ar_systems_technologies_ar_technologies_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_systems_technologies
    ADD CONSTRAINT ar_systems_technologies_ar_technologies_fk FOREIGN KEY (technologies_id) REFERENCES archrep.ar_technologies(id);


--
-- TOC entry 3774 (class 2606 OID 17907)
-- Name: ar_technologies ar_technologies_ar_partners_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technologies
    ADD CONSTRAINT ar_technologies_ar_partners_fk FOREIGN KEY (vendor_ar_partners_id) REFERENCES archrep.ar_partners(id);


--
-- TOC entry 3775 (class 2606 OID 17912)
-- Name: ar_technologies ar_technologies_ar_technology_classes_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technologies
    ADD CONSTRAINT ar_technologies_ar_technology_classes_fk FOREIGN KEY (technology_classes_id) REFERENCES archrep.ar_technology_classes(id);


--
-- TOC entry 3776 (class 2606 OID 17917)
-- Name: ar_technologies ar_technologies_ar_technology_statuses_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technologies
    ADD CONSTRAINT ar_technologies_ar_technology_statuses_fk FOREIGN KEY (technology_statuses_id) REFERENCES archrep.ar_technology_statuses(id);


--
-- TOC entry 3777 (class 2606 OID 17922)
-- Name: ar_technologies ar_technologies_ar_technology_types_fk; Type: FK CONSTRAINT; Schema: archrep; Owner: postgres
--

ALTER TABLE ONLY archrep.ar_technologies
    ADD CONSTRAINT ar_technologies_ar_technology_types_fk FOREIGN KEY (technology_types_id) REFERENCES archrep.ar_technology_types(id);


-- Completed on 2026-04-23 10:13:28

--
-- PostgreSQL database dump complete
--

