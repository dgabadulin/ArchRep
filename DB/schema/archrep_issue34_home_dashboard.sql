-- Issue #34: функции подсчёта для KPI главной страницы.
-- Выполнять после archrep (системы, технологии, потоки), archrep_issue23 (ar_gaps).
-- psql -f DB/schema/archrep_issue34_home_dashboard.sql

BEGIN;

CREATE OR REPLACE FUNCTION archrep.dashboard_home_systems_total()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$ SELECT COUNT(*)::bigint FROM archrep.ar_systems $$;

CREATE OR REPLACE FUNCTION archrep.dashboard_home_systems_with_parent()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint
  FROM archrep.ar_systems s
  WHERE s.parent_ar_systems_id IS NOT NULL
    AND s.parent_ar_systems_id <> s.id
$$;

CREATE OR REPLACE FUNCTION archrep.dashboard_home_integration_flows()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$ SELECT COUNT(*)::bigint FROM archrep.ar_integration_flows $$;

CREATE OR REPLACE FUNCTION archrep.dashboard_home_technologies_total()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$ SELECT COUNT(*)::bigint FROM archrep.ar_technologies $$;

CREATE OR REPLACE FUNCTION archrep.dashboard_home_technologies_foreign_null_flag()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint
  FROM archrep.ar_technologies t
  WHERE t.domestic_flag IS NULL
$$;

CREATE OR REPLACE FUNCTION archrep.dashboard_home_gaps_total()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$ SELECT COUNT(*)::bigint FROM archrep.ar_gaps $$;

CREATE OR REPLACE FUNCTION archrep.dashboard_home_gaps_closed()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::bigint
  FROM archrep.ar_gaps g
  WHERE g.resolved_date IS NOT NULL
$$;

COMMENT ON FUNCTION archrep.dashboard_home_systems_total() IS 'KPI главной: всего записей в ar_systems';
COMMENT ON FUNCTION archrep.dashboard_home_systems_with_parent() IS 'KPI главной: подсистемы/модули (parent_ar_systems_id задан и не самоссылка)';
COMMENT ON FUNCTION archrep.dashboard_home_integration_flows() IS 'KPI главной: строки ar_integration_flows';
COMMENT ON FUNCTION archrep.dashboard_home_technologies_total() IS 'KPI главной: всего технологий';
COMMENT ON FUNCTION archrep.dashboard_home_technologies_foreign_null_flag() IS 'KPI главной: технологии с domestic_flag IS NULL (иностранные по умолчанию)';
COMMENT ON FUNCTION archrep.dashboard_home_gaps_total() IS 'KPI главной: всего записей арх. долга';
COMMENT ON FUNCTION archrep.dashboard_home_gaps_closed() IS 'KPI главной: долг с заполненной resolved_date';

COMMIT;
