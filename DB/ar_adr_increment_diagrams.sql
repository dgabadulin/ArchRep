-- Диаграммы Draw.io по решениям (инкрементам) архитектурного заключения — issue #51
-- Выполнить в БД archrep перед использованием API.

CREATE TABLE IF NOT EXISTS archrep.ar_adr_increment_diagrams (
  id BIGSERIAL PRIMARY KEY,
  ar_adr_increment_id BIGINT NOT NULL REFERENCES archrep.ar_adr_increments (id) ON DELETE CASCADE,
  version_no INT NOT NULL,
  mxfile TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_edited_by TEXT NULL,
  UNIQUE (ar_adr_increment_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_ar_adr_increment_diagrams_inc ON archrep.ar_adr_increment_diagrams (ar_adr_increment_id);
