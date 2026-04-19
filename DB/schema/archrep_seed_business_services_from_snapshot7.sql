-- Вставка продуктов (бизнес-сервисов) по данным из Снимок7.
-- Таблица: archrep.ar_business_services
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_seed_business_services_from_snapshot7.sql

BEGIN;

INSERT INTO archrep.ar_business_services (code, name, fullname, description, ar_organization_units_id, ar_business_service_statuses_id, source, category)
VALUES
  ('bs-lcv-mcv', 'LCV, MCV (кроме Валдай)', 'LCV, MCV (кроме Валдай)', NULL, NULL, NULL, 'Снимок7', NULL),
  ('bs-valday', 'Валдай', 'Валдай', NULL, NULL, NULL, 'Снимок7', NULL),
  ('bs-bus', 'BUS', 'BUS', NULL, NULL, NULL, 'Снимок7', NULL),
  ('bs-cat', 'CAT', 'CAT', NULL, NULL, NULL, 'Снимок7', NULL),
  ('bs-equip-modification', 'Доработка техники (как услуга)', 'Доработка техники (как услуга) [Приостановлено]', 'Приостановлено', NULL, NULL, 'Снимок7', NULL),
  ('bs-spare-parts', 'Запасные части (в т.ч. мал.прицепы)', 'Запасные части (в т.ч. мал.прицепы)', NULL, NULL, NULL, 'Снимок7', NULL),
  ('bs-service-contract', 'Сервисный контракт, сервисный оператор', 'Сервисный контракт, сервисный оператор', NULL, NULL, NULL, 'Снимок7', NULL),
  ('bs-other', 'Прочие продукты', 'Прочие продукты', NULL, NULL, NULL, 'Снимок7', NULL),
  ('bs-digital-services', 'Цифровые сервисы', 'Цифровые сервисы', NULL, NULL, NULL, 'Снимок7', 'Прочие продукты'),
  ('bs-fleetpro', 'FleetPro', 'FleetPro', NULL, NULL, NULL, 'Снимок7', 'Прочие продукты')
ON CONFLICT (code) DO NOTHING;

COMMIT;
