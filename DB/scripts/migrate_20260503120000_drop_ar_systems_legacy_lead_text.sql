-- Удаление текстовых полей ответственных на ИС (заменены FK it_lead_employee_id / business_lead_employee_id).
-- Накатывать после migrate_20260501120000_ar_employees_system_leads.sql (импорт из текстов уже выполнен).
-- Идемпотентно.

ALTER TABLE archrep.ar_systems DROP COLUMN IF EXISTS it_lead;
ALTER TABLE archrep.ar_systems DROP COLUMN IF EXISTS business_lead;
