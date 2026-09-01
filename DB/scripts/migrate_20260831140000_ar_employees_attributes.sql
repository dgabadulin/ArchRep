-- ar_employees: табельный номер и email (полное имя — full_name, уже есть).
-- Идемпотентно. После применения: перезапуск backend.

ALTER TABLE archrep.ar_employees
  ADD COLUMN IF NOT EXISTS employee_number VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;

COMMENT ON COLUMN archrep.ar_employees.employee_number IS 'Табельный номер сотрудника';
COMMENT ON COLUMN archrep.ar_employees.email IS 'Email сотрудника';
COMMENT ON COLUMN archrep.ar_employees.full_name IS 'Полное имя (ФИО)';

CREATE UNIQUE INDEX IF NOT EXISTS ar_employees_employee_number_uidx
  ON archrep.ar_employees (lower(trim(employee_number)))
  WHERE employee_number IS NOT NULL AND trim(employee_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ar_employees_email_lower_uidx
  ON archrep.ar_employees (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

UPDATE archrep.ar_settings_parameters
SET description = 'Шаблон видимого имени сотрудника: {full_name}, {employee_number}, {email}, {status} (active/inactive); условные блоки [[ ]].'
WHERE code = 'DISP_EMPLOYEE_TEMPLATE';
