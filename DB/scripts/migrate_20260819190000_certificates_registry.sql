-- Реестр сертификатов (#69): ar_certificates, certificate->domain/employee FK projections,
-- CHK_CERT_* parameters и certificate_expiration_check.
-- Идемпотентно. См. docs/certificate-registry-schema.md

CREATE SEQUENCE IF NOT EXISTS archrep.ar_certificates_code_seq;

CREATE TABLE IF NOT EXISTS archrep.ar_certificates (
  id bigserial PRIMARY KEY,
  code varchar NOT NULL DEFAULT ('CRT-' || nextval('archrep.ar_certificates_code_seq')),
  ar_domains_id int8 NOT NULL,
  ca_ar_partners_id int8 NULL,
  issued_at date NOT NULL,
  expires_at date NOT NULL,
  wildcard_flag boolean NOT NULL DEFAULT false,
  placement_url text NULL,
  responsible_ar_employees_id int8 NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ar_certificates_code_key UNIQUE (code),
  CONSTRAINT ar_certificates_domain_fkey
    FOREIGN KEY (ar_domains_id) REFERENCES archrep.ar_domains(id) ON DELETE RESTRICT,
  CONSTRAINT ar_certificates_ca_partner_fkey
    FOREIGN KEY (ca_ar_partners_id) REFERENCES archrep.ar_partners(id) ON DELETE SET NULL,
  CONSTRAINT ar_certificates_responsible_fkey
    FOREIGN KEY (responsible_ar_employees_id) REFERENCES archrep.ar_employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ar_certificates_domain_id_idx
  ON archrep.ar_certificates (ar_domains_id);
CREATE INDEX IF NOT EXISTS ar_certificates_ca_partner_id_idx
  ON archrep.ar_certificates (ca_ar_partners_id);
CREATE INDEX IF NOT EXISTS ar_certificates_expires_at_idx
  ON archrep.ar_certificates (expires_at);
CREATE INDEX IF NOT EXISTS ar_certificates_responsible_id_idx
  ON archrep.ar_certificates (responsible_ar_employees_id);

COMMENT ON TABLE archrep.ar_certificates IS 'Реестр сертификатов (#69)';

INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'certificate', 'Сертификат', 'ar_certificates', 'SSL/TLS и иные сертификаты, привязанные к доменам'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'certificate');

UPDATE archrep.ar_metamodel_entity_types
SET import_allowed = true
WHERE code = 'certificate';

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'certificate_domain', 'Выпущен для', 'Сертификат выпущен для домена; FK ar_certificates.ar_domains_id', f.id, t.id
FROM archrep.ar_metamodel_entity_types f
CROSS JOIN archrep.ar_metamodel_entity_types t
WHERE f.code = 'certificate' AND t.code = 'domain'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'certificate_domain' AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
  );

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'certificate_employee_responsible', 'Ответственный', 'Сертификат закреплён за сотрудником; FK ar_certificates.responsible_ar_employees_id', f.id, t.id
FROM archrep.ar_metamodel_entity_types f
CROSS JOIN archrep.ar_metamodel_entity_types t
WHERE f.code = 'certificate' AND t.code = 'employee'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'certificate_employee_responsible' AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
  );

CREATE OR REPLACE FUNCTION archrep.sync_ar_certificates_metamodel_relations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM archrep.ar_metamodel_relations r
    WHERE r.from_entity_type = 'certificate'
      AND r.from_entity_id = OLD.id
      AND r.relation_type IN ('certificate_domain', 'certificate_employee_responsible');
    RETURN OLD;
  END IF;

  DELETE FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'certificate'
    AND r.from_entity_id = NEW.id
    AND r.relation_type IN ('certificate_domain', 'certificate_employee_responsible');

  IF NEW.ar_domains_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      'certificate', NEW.id, 'domain', NEW.ar_domains_id,
      'certificate_domain', '', '',
      '{"projection":"fk","source":"ar_certificates.ar_domains_id"}'::jsonb,
      NULL, NULL
    );
  END IF;

  IF NEW.responsible_ar_employees_id IS NOT NULL THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type, from_entity_id, to_entity_type, to_entity_id,
      relation_type, name, description, payload, displayed_name, reference_to_baserow
    ) VALUES (
      'certificate', NEW.id, 'employee', NEW.responsible_ar_employees_id,
      'certificate_employee_responsible', '', '',
      '{"projection":"fk","source":"ar_certificates.responsible_ar_employees_id"}'::jsonb,
      NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_certificates_metamodel ON archrep.ar_certificates;
CREATE TRIGGER trg_ar_certificates_metamodel
  AFTER INSERT OR UPDATE OF ar_domains_id, responsible_ar_employees_id
  ON archrep.ar_certificates
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_certificates_metamodel_relations();

DROP TRIGGER IF EXISTS trg_ar_certificates_metamodel_del ON archrep.ar_certificates;
CREATE TRIGGER trg_ar_certificates_metamodel_del
  AFTER DELETE ON archrep.ar_certificates
  FOR EACH ROW
  EXECUTE PROCEDURE archrep.sync_ar_certificates_metamodel_relations();

INSERT INTO archrep.ar_metamodel_relations (
  from_entity_type, from_entity_id, to_entity_type, to_entity_id,
  relation_type, name, description, payload, displayed_name, reference_to_baserow
)
SELECT
  'certificate', c.id, 'domain', c.ar_domains_id,
  'certificate_domain', '', '',
  '{"projection":"fk","source":"ar_certificates.ar_domains_id"}'::jsonb, NULL, NULL
FROM archrep.ar_certificates c
WHERE c.ar_domains_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relations r
    WHERE r.relation_type = 'certificate_domain'
      AND r.from_entity_type = 'certificate'
      AND r.from_entity_id = c.id
  );

INSERT INTO archrep.ar_metamodel_relations (
  from_entity_type, from_entity_id, to_entity_type, to_entity_id,
  relation_type, name, description, payload, displayed_name, reference_to_baserow
)
SELECT
  'certificate', c.id, 'employee', c.responsible_ar_employees_id,
  'certificate_employee_responsible', '', '',
  '{"projection":"fk","source":"ar_certificates.responsible_ar_employees_id"}'::jsonb, NULL, NULL
FROM archrep.ar_certificates c
WHERE c.responsible_ar_employees_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relations r
    WHERE r.relation_type = 'certificate_employee_responsible'
      AND r.from_entity_type = 'certificate'
      AND r.from_entity_id = c.id
  );

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT 'DISP_CERTIFICATE_TEMPLATE', 'Шаблон отображаемого имени сертификата в списках и на графе.', '{code} [[для {domain_name}]][[ до {expires_at}]]', 'string', 'Отображаемые имена', false, false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DISP_CERTIFICATE_TEMPLATE');

UPDATE archrep.ar_settings_parameters
SET value = CASE
  WHEN value LIKE '%"certificate"%' THEN value
  WHEN value LIKE '%"domain"%' THEN replace(value, '"domain"', '"domain","certificate"')
  ELSE regexp_replace(value, '\]\s*$', ',"certificate"]')
END,
updated_at = current_timestamp
WHERE code = 'GRAPH_ENTITY_ORDER'
  AND value IS NOT NULL
  AND value NOT LIKE '%"certificate"%';

UPDATE archrep.ar_settings_parameters
SET value = CASE
  WHEN value LIKE '%"certificate"%' THEN value
  WHEN trim(value) IN ('', '{}', 'null') THEN '{"certificate":{"label":"Сертификат","icon":"Shield","listLabel":"Сертификаты"}}'
  ELSE regexp_replace(trim(value), '\}\s*$', ',"certificate":{"label":"Сертификат","icon":"Shield","listLabel":"Сертификаты"}}')
END,
updated_at = current_timestamp
WHERE code = 'GRAPH_ENTITY_ICONS'
  AND value IS NOT NULL
  AND value NOT LIKE '%"certificate"%';

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'CHK_CERT_EXPIRATION',
  'Порог в днях: сертификаты с expires_at от сегодня до сегодня+N попадают в уведомление (Job Runner).',
  '30',
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
  'CHK_CERT_EXPIRATION_EMAIL',
  'Получатель email-уведомления об истекающих сертификатах. Несколько адресов через запятую.',
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

INSERT INTO archrep.ar_permissions (code, description, is_active) VALUES
  ('certificate:read', 'Реестр сертификатов: чтение', true),
  ('certificate:write', 'Реестр сертификатов: создание и изменение', true),
  ('certificate:delete', 'Реестр сертификатов: удаление', true),
  ('certificate:export', 'Реестр сертификатов: экспорт Excel', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO archrep.ar_jobs (code, name, description, handler, interval_seconds, enabled)
VALUES (
  'certificate_expiration_check',
  'Проверка сроков сертификатов',
  'Email со списком сертификатов, истекающих в течение CHK_CERT_EXPIRATION дней.',
  'certificate_expiration_check',
  259200,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  handler = EXCLUDED.handler,
  interval_seconds = EXCLUDED.interval_seconds;
