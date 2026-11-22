-- Тип интерфейса ИС (issue #129): справочник + связь «многие-ко-многим».
-- Множественный выбор: у системы может быть несколько типов интерфейса.
-- Тип интерфейса — классификационный атрибут, а не сущность метамодели: версия схемы
-- «Метамодель ИСАР» не меняется (значения живут в «Справочниках»).
-- Идемпотентно.

CREATE TABLE IF NOT EXISTS archrep.ar_system_interface_types (
    id bigserial NOT NULL,
    code varchar(64) NOT NULL,
    name varchar(255) NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ar_system_interface_types_pk PRIMARY KEY (id),
    CONSTRAINT ar_system_interface_types_code_uq UNIQUE (code),
    CONSTRAINT ar_system_interface_types_name_uq UNIQUE (name)
);

COMMENT ON TABLE archrep.ar_system_interface_types IS 'Справочник типов пользовательского интерфейса ИС (Web/Desktop/Mobile/Терминал)';
COMMENT ON COLUMN archrep.ar_system_interface_types.code IS 'Технический код (устойчив к переименованию), уникален';
COMMENT ON COLUMN archrep.ar_system_interface_types.name IS 'Наименование для UI, уникально';
COMMENT ON COLUMN archrep.ar_system_interface_types.description IS 'Пояснение (например, «Консольный интерфейс (TUI)»)';

-- Предзаполнение: Web / Desktop / Mobile / Терминал (консоль). Код — ключ идемпотентности:
-- повторное применение не перезаписывает пользовательские правки наименований.
INSERT INTO archrep.ar_system_interface_types (code, name, description)
VALUES
    ('web', 'Web', 'Веб-интерфейс (браузер)'),
    ('desktop', 'Desktop', 'Десктопное приложение (толстый клиент)'),
    ('mobile', 'Mobile', 'Мобильное приложение'),
    ('terminal', 'Терминал', 'Консольный интерфейс (TUI)')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS archrep.ar_system_interface_type_links (
    id bigserial NOT NULL,
    ar_systems_id bigint NOT NULL,
    ar_system_interface_types_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ar_system_interface_type_links_pk PRIMARY KEY (id),
    CONSTRAINT ar_system_interface_type_links_uq UNIQUE (ar_systems_id, ar_system_interface_types_id),
    CONSTRAINT ar_system_interface_type_links_system_fk FOREIGN KEY (ar_systems_id)
        REFERENCES archrep.ar_systems (id) ON DELETE CASCADE,
    CONSTRAINT ar_system_interface_type_links_type_fk FOREIGN KEY (ar_system_interface_types_id)
        REFERENCES archrep.ar_system_interface_types (id) ON DELETE RESTRICT
);

COMMENT ON TABLE archrep.ar_system_interface_type_links IS 'Связь ИС ↔ тип интерфейса (M:N, issue #129)';
COMMENT ON COLUMN archrep.ar_system_interface_type_links.ar_systems_id IS 'ИС или модуль (parent_ar_systems_id ≠ NULL) — ограничений нет';
COMMENT ON COLUMN archrep.ar_system_interface_type_links.ar_system_interface_types_id IS 'Тип интерфейса; удаление используемого типа запрещено (RESTRICT)';

CREATE INDEX IF NOT EXISTS ar_system_interface_type_links_type_idx
    ON archrep.ar_system_interface_type_links (ar_system_interface_types_id);

-- Версия схемы (issue #129): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261122130000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by
  WHERE archrep.ar_schema_info.version < EXCLUDED.version;
