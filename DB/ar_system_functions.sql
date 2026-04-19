-- Функции ИС и выбор функций в строке «система в решении» — issue #52

CREATE TABLE IF NOT EXISTS archrep.ar_system_functions (
  id BIGSERIAL PRIMARY KEY,
  ar_systems_id BIGINT NOT NULL REFERENCES archrep.ar_systems (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ar_system_functions_system_lower_name
  ON archrep.ar_system_functions (ar_systems_id, lower(trim(name)));

CREATE TABLE IF NOT EXISTS archrep.ar_adr_increment_system_functions (
  id BIGSERIAL PRIMARY KEY,
  ar_adr_increment_system_id BIGINT NOT NULL REFERENCES archrep.ar_adr_increment_systems (id) ON DELETE CASCADE,
  ar_system_functions_id BIGINT NOT NULL REFERENCES archrep.ar_system_functions (id) ON DELETE RESTRICT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (ar_adr_increment_system_id, ar_system_functions_id)
);

CREATE INDEX IF NOT EXISTS idx_adr_inc_sys_fn_row ON archrep.ar_adr_increment_system_functions (ar_adr_increment_system_id);
