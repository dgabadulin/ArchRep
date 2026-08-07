-- RBAC / local auth (#66): таблицы пользователей, ролей и permissions.
-- Сиды ролей/permissions — в этом файле (через include-логику миграции JS + seed SQL).
-- Матрица role→permission и bootstrap demo/aradmin — идемпотентно при старте API
-- (backend/auth/bootstrapAuth.js), чтобы не хранить plaintext паролей в SQL.

CREATE TABLE IF NOT EXISTS archrep.ar_app_users (
  id                   bigserial PRIMARY KEY,
  login                varchar(100) NOT NULL,
  email                varchar(255) NULL,
  display_name         varchar(255) NOT NULL,
  password_hash        text NULL,
  auth_provider        varchar(20) NOT NULL DEFAULT 'local',
  keycloak_sub         varchar(100) NULL,
  employee_id          bigint NULL REFERENCES archrep.ar_employees(id) ON DELETE SET NULL,
  is_active            boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at        timestamptz NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by_user_id   bigint NULL,
  CONSTRAINT ar_app_users_login_uq UNIQUE (login),
  CONSTRAINT ar_app_users_email_uq UNIQUE (email),
  CONSTRAINT ar_app_users_keycloak_sub_uq UNIQUE (keycloak_sub),
  CONSTRAINT ar_app_users_auth_provider_chk CHECK (auth_provider IN ('local', 'keycloak', 'hybrid'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_app_users_created_by_fk'
  ) THEN
    ALTER TABLE archrep.ar_app_users
      ADD CONSTRAINT ar_app_users_created_by_fk
      FOREIGN KEY (created_by_user_id) REFERENCES archrep.ar_app_users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS archrep.ar_roles (
  id          bigserial PRIMARY KEY,
  code        varchar(64) NOT NULL,
  name        varchar(255) NOT NULL,
  description text NULL,
  is_system   boolean NOT NULL DEFAULT true,
  is_active   boolean NOT NULL DEFAULT true,
  CONSTRAINT ar_roles_code_uq UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS archrep.ar_permissions (
  id          bigserial PRIMARY KEY,
  code        varchar(128) NOT NULL,
  description text NULL,
  is_active   boolean NOT NULL DEFAULT true,
  CONSTRAINT ar_permissions_code_uq UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS archrep.ar_role_permissions (
  role_id       bigint NOT NULL REFERENCES archrep.ar_roles(id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES archrep.ar_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS archrep.ar_user_roles (
  user_id             bigint NOT NULL REFERENCES archrep.ar_app_users(id) ON DELETE CASCADE,
  role_id             bigint NOT NULL REFERENCES archrep.ar_roles(id) ON DELETE CASCADE,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  assigned_by_user_id bigint NULL REFERENCES archrep.ar_app_users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS ar_user_roles_role_id_idx ON archrep.ar_user_roles (role_id);
CREATE INDEX IF NOT EXISTS ar_role_permissions_permission_id_idx ON archrep.ar_role_permissions (permission_id);
CREATE INDEX IF NOT EXISTS ar_app_users_is_active_idx ON archrep.ar_app_users (is_active);

-- Seed roles
INSERT INTO archrep.ar_roles (code, name, description, is_system, is_active) VALUES
  ('VIEWER', 'Наблюдатель', 'Чтение каталогов и аналитики', true, true),
  ('ARCHITECT', 'Архитектор', 'CRUD доменных реестров', true, true),
  ('REPOSITORY_ADMIN', 'Администратор репозитория', 'Параметры, справочники, сервисные операции, пользователи', true, true),
  ('SYSTEM_ADMIN', 'Администратор платформы', 'Полный доступ включая restart API', true, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = true,
  is_active = true;

-- Seed permissions (каталог docs/access-control-design.md + backend/auth/permissionsCatalog.js)
INSERT INTO archrep.ar_permissions (code, description, is_active) VALUES
  ('principle:read', NULL, true),
  ('principle:write', NULL, true),
  ('principle:delete', NULL, true),
  ('principle:export', NULL, true),
  ('adr_principle:read', NULL, true),
  ('adr_principle:write', NULL, true),
  ('adr_principle:delete', NULL, true),
  ('adr_principle:export', NULL, true),
  ('adr_applied:read', NULL, true),
  ('adr_applied:write', NULL, true),
  ('adr_applied:delete', NULL, true),
  ('adr_applied:export', NULL, true),
  ('gap:read', NULL, true),
  ('gap:write', NULL, true),
  ('gap:delete', NULL, true),
  ('gap:export', NULL, true),
  ('organization_unit:read', NULL, true),
  ('organization_unit:write', NULL, true),
  ('organization_unit:delete', NULL, true),
  ('organization_unit:export', NULL, true),
  ('actor:read', NULL, true),
  ('actor:write', NULL, true),
  ('actor:delete', NULL, true),
  ('actor:export', NULL, true),
  ('business_service:read', NULL, true),
  ('business_service:write', NULL, true),
  ('business_service:delete', NULL, true),
  ('business_service:export', NULL, true),
  ('business_function:read', NULL, true),
  ('business_function:write', NULL, true),
  ('business_function:delete', NULL, true),
  ('business_function:export', NULL, true),
  ('goals:read', NULL, true),
  ('system:read', NULL, true),
  ('system:write', NULL, true),
  ('system:delete', NULL, true),
  ('system:export', NULL, true),
  ('system_function:read', NULL, true),
  ('system_function:write', NULL, true),
  ('system_function:delete', NULL, true),
  ('integration_flow:read', NULL, true),
  ('integration_flow:write', NULL, true),
  ('integration_flow:delete', NULL, true),
  ('integration_flow:export', NULL, true),
  ('web_resource:read', NULL, true),
  ('web_resource:write', NULL, true),
  ('web_resource:delete', NULL, true),
  ('web_resource:export', NULL, true),
  ('partner:read', NULL, true),
  ('partner:write', NULL, true),
  ('partner:delete', NULL, true),
  ('partner:export', NULL, true),
  ('employee:read', NULL, true),
  ('employee:write', NULL, true),
  ('employee:delete', NULL, true),
  ('employee:export', NULL, true),
  ('technology:read', NULL, true),
  ('technology:write', NULL, true),
  ('technology:delete', NULL, true),
  ('technology:export', NULL, true),
  ('tech_radar:read', NULL, true),
  ('analytics:read', NULL, true),
  ('dashboard:read', NULL, true),
  ('metamodel_relation:read', NULL, true),
  ('metamodel_relation:write', NULL, true),
  ('metamodel_relation:delete', NULL, true),
  ('metamodel_relation:export', NULL, true),
  ('metamodel:rebuild', NULL, true),
  ('references:read', NULL, true),
  ('references:write', NULL, true),
  ('metamodel_catalog:read', NULL, true),
  ('metamodel_catalog:write', NULL, true),
  ('settings_parameters:read', NULL, true),
  ('settings_parameters:write', NULL, true),
  ('service_operations:execute', NULL, true),
  ('import:execute', NULL, true),
  ('users:read', NULL, true),
  ('users:write', NULL, true),
  ('users:delete', NULL, true),
  ('users:export', NULL, true),
  ('roles:read', NULL, true),
  ('roles:assign', NULL, true),
  ('roles:write', NULL, true),
  ('system_admin:restart', NULL, true)
ON CONFLICT (code) DO NOTHING;
