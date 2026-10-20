-- Параметры Keycloak SSO (фаза B). Секреты client — только env, не в этой таблице.
-- После применения: перезапуск backend (кэш ar_settings_parameters).

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'SEC_KEYCLOAK_ENABLED',
  'Включить вход через Keycloak (OIDC Authorization Code на backend). Client id/secret и redirect — только в env.',
  'false',
  'boolean',
  'Безопасность',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  "group" = EXCLUDED."group";

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'SEC_KEYCLOAK_LOGIN_MODE',
  'Режим UI SSO: button (кнопка на /login), auto (сразу OIDC), silent (prompt=none, иначе форма). Обход auto: /login?local=1',
  'button',
  'string',
  'Безопасность',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  "group" = EXCLUDED."group";

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'SEC_KEYCLOAK_ISSUER',
  'OIDC issuer (realm URL), напр. https://sso.example/realms/common. Discovery: {issuer}/.well-known/openid-configuration. Переопределяется env KEYCLOAK_ISSUER.',
  '',
  'string',
  'Безопасность',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  "group" = EXCLUDED."group";
