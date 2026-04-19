-- Вставка бизнес-способностей по данным из Снимок4, Снимок5, Снимок6.
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_seed_business_functions_from_snapshots.sql

BEGIN;

-- Родительские способности (верхний уровень)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
VALUES
  ('bf-marketing-promo', 'Маркетинг и продвижение', NULL, NULL),
  ('bf-network-mgmt', 'Управление сетью', NULL, NULL),
  ('bf-supply-chain', 'Управление цепочками поставок', NULL, NULL),
  ('bf-sales-mgmt', 'Управление продажами', NULL, NULL),
  ('bf-after-sales', 'Управление послепродажным обслуживанием', NULL, NULL),
  ('bf-learning-mgmt', 'Управление обучением', NULL, NULL),
  ('bf-feedback-quality', 'Управление обратной связью и качеством продукции', NULL, NULL),
  ('bf-hr-mgmt', 'Управление персоналом', NULL, NULL),
  ('bf-finance', 'Финансы', NULL, NULL),
  ('bf-business-support', 'Поддержка бизнеса', NULL, NULL)
ON CONFLICT (code) DO NOTHING;

-- Дети: Маркетинг и продвижение (Снимок4)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-marketing-promo' LIMIT 1)
FROM (VALUES
  ('bf-marketing-promo-01', 'Изучение рынков, клиентов, возможности компании', NULL),
  ('bf-marketing-promo-02', 'Разработка маркетинговой стратегии', NULL),
  ('bf-marketing-promo-03', 'Вывод новых продуктов', NULL),
  ('bf-marketing-promo-04', 'Управление ценообразованием', NULL),
  ('bf-marketing-promo-05', 'Управление информацией о продукте', NULL),
  ('bf-marketing-promo-06', 'Управление рекламной деятельностью (в т.ч. Мониторинг эффективности)', NULL),
  ('bf-marketing-promo-07', 'Управление маркетинговой информацией', NULL),
  ('bf-marketing-promo-08', 'Управление ФПП и программами лояльности', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Управление сетью (Снимок4)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-network-mgmt' LIMIT 1)
FROM (VALUES
  ('bf-network-mgmt-01', 'Управление коммерческой политикой', NULL),
  ('bf-network-mgmt-02', 'Управление составом сети', NULL),
  ('bf-network-mgmt-03', 'Управление эффективностью сети', NULL),
  ('bf-network-mgmt-04', 'Управление стандартами', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Управление цепочками поставок (Снимок4)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-supply-chain' LIMIT 1)
FROM (VALUES
  ('bf-supply-chain-01', 'Планирование обеспечения ресурсами (управление заказами)', NULL),
  ('bf-supply-chain-02', 'Складская логистика', NULL),
  ('bf-supply-chain-03', 'Транспортная логистика', NULL),
  ('bf-supply-chain-04', 'Управление производственными закупками', NULL),
  ('bf-supply-chain-05', 'Управление доработкой', NULL),
  ('bf-supply-chain-06', 'Управление дебиторской задолженностью и взаиморасчеты с ССС (контроллинг)', NULL),
  ('bf-supply-chain-07', 'Управление реализацией', NULL),
  ('bf-supply-chain-08', 'Управление сборочным производством', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Управление продажами (Снимок5)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-sales-mgmt' LIMIT 1)
FROM (VALUES
  ('bf-sales-mgmt-01', 'Анализ продаж', NULL),
  ('bf-sales-mgmt-02', 'Управление бизнес-планированием', NULL),
  ('bf-sales-mgmt-03', 'Прямые продажи онлайн', NULL),
  ('bf-sales-mgmt-04', 'Прямые продажи оффлайн', NULL),
  ('bf-sales-mgmt-05', 'Продажи через CCC', NULL),
  ('bf-sales-mgmt-06', 'Управление клиентскими данными', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Управление послепродажным обслуживанием (Снимок5)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-after-sales' LIMIT 1)
FROM (VALUES
  ('bf-after-sales-01', 'Гарантийная политика', NULL),
  ('bf-after-sales-02', 'Управление ремонтными работами', NULL),
  ('bf-after-sales-03', 'Обеспечение запасными частями CCC', NULL),
  ('bf-after-sales-04', 'Сопровождение ключевых клиентов на всех этапах ППО', NULL),
  ('bf-after-sales-05', 'Технический консалтинг', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Управление обучением (Снимок5)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-learning-mgmt' LIMIT 1)
FROM (VALUES
  ('bf-learning-mgmt-01', 'Обучение сотрудников', NULL),
  ('bf-learning-mgmt-02', 'Обучение партнеров', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Управление обратной связью и качеством продукции (Снимок5)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-feedback-quality' LIMIT 1)
FROM (VALUES
  ('bf-feedback-quality-01', 'Качество продукции', NULL),
  ('bf-feedback-quality-02', 'Обратная связь', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Управление персоналом (Снимок6)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-hr-mgmt' LIMIT 1)
FROM (VALUES
  ('bf-hr-mgmt-01', 'Подбор персонала', NULL),
  ('bf-hr-mgmt-02', 'Адаптация персонала', NULL),
  ('bf-hr-mgmt-03', 'Мотивация персонала', NULL),
  ('bf-hr-mgmt-04', 'Внутрикорпоративные коммуникации', NULL),
  ('bf-hr-mgmt-05', 'Движение персонала', NULL),
  ('bf-hr-mgmt-06', 'Управление HR-аналитикой', NULL),
  ('bf-hr-mgmt-07', 'Кадровое делопроизводство', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Финансы (Снимок6)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-finance' LIMIT 1)
FROM (VALUES
  ('bf-finance-01', 'Расчет зарплаты', NULL),
  ('bf-finance-02', 'Бухгалтерский и налоговый учет', NULL),
  ('bf-finance-03', 'Бюджетирование и управленческий учет', NULL),
  ('bf-finance-04', 'Закупочное ценообразование TC', NULL),
  ('bf-finance-05', 'Казначейство', NULL),
  ('bf-finance-06', 'Инвестиционный анализ', NULL),
  ('bf-finance-07', 'Подготовка отчетности для акционера', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

-- Дети: Поддержка бизнеса (Снимок6)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id)
SELECT v.code, v.name, v.description, (SELECT id FROM archrep.ar_business_functions WHERE code = 'bf-business-support' LIMIT 1)
FROM (VALUES
  ('bf-business-support-01', 'Защита ресурсов', NULL),
  ('bf-business-support-02', 'Проектное управление', NULL),
  ('bf-business-support-03', 'Юридическое обеспечение', NULL),
  ('bf-business-support-04', 'Документационное обеспечение', NULL),
  ('bf-business-support-05', 'AXO', NULL),
  ('bf-business-support-06', 'Управление непроизводственными закупками', NULL),
  ('bf-business-support-07', 'Охрана труда', NULL),
  ('bf-business-support-08', 'Управление бизнес-процессами', NULL),
  ('bf-business-support-09', 'Данные и аналитика', NULL),
  ('bf-business-support-10', 'ИТ и ИБ', NULL)
) AS v(code, name, description)
ON CONFLICT (code) DO NOTHING;

COMMIT;
