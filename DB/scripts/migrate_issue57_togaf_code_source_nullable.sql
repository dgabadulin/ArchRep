-- GitHub #57: API больше не передаёт/не требует code (орг.единицы, акторы, продукты, способности)
-- и source только для акторов — INSERT без этих полей. Колонки остаются, снимаем NOT NULL.
-- Идемпотентно: повторный ALTER … DROP NOT NULL безопасен в PostgreSQL.

ALTER TABLE archrep.ar_organization_units ALTER COLUMN code DROP NOT NULL;
ALTER TABLE archrep.ar_actors ALTER COLUMN code DROP NOT NULL;
ALTER TABLE archrep.ar_actors ALTER COLUMN source DROP NOT NULL;
ALTER TABLE archrep.ar_business_services ALTER COLUMN code DROP NOT NULL;
ALTER TABLE archrep.ar_business_functions ALTER COLUMN code DROP NOT NULL;
