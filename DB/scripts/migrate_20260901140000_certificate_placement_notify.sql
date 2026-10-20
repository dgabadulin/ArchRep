-- Уведомления о размещении сертификатов (#71): placement_notified_*, CHK_CERT_PLACEMENT_*, job certificate_placement_notify.
-- Идемпотентно. См. docs/certificate-registry-schema.md §7

ALTER TABLE archrep.ar_certificates
  ADD COLUMN IF NOT EXISTS placement_notified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS placement_notified_url text NULL;

COMMENT ON COLUMN archrep.ar_certificates.placement_notified_at IS 'Когда отправлено уведомление о размещении (placement_url)';
COMMENT ON COLUMN archrep.ar_certificates.placement_notified_url IS 'placement_url, по которому уже уведомляли';

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'CHK_CERT_PLACEMENT_INTERVAL_SECONDS',
  'Интервал между успешными запусками задания certificate_placement_notify (секунды). Минимум 3600. По умолчанию 86400 (1 сутки).',
  '86400',
  'number',
  'Проверки',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  "group" = EXCLUDED."group";

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'CHK_CERT_PLACEMENT_EMAIL',
  'Fallback-получатель email об размещении сертификата, если у ответственного нет email. Несколько адресов через запятую.',
  '',
  'string',
  'Проверки',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  "group" = EXCLUDED."group";

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'CHK_CERT_PLACEMENT_EMAIL_ADD',
  'Дополнительные получатели (копия) уведомления о размещении сертификата (например, руководители). Несколько адресов через запятую.',
  '',
  'string',
  'Проверки',
  false,
  false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  "group" = EXCLUDED."group";

INSERT INTO archrep.ar_jobs (code, name, description, handler, interval_seconds, enabled)
VALUES (
  'certificate_placement_notify',
  'Уведомления о размещении сертификатов',
  'Email ответственному при новом или изменённом placement_url. Интервал: CHK_CERT_PLACEMENT_INTERVAL_SECONDS.',
  'certificate_placement_notify',
  86400,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  handler = EXCLUDED.handler,
  interval_seconds = EXCLUDED.interval_seconds;
