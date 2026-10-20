-- Демо-набор «СеверЛогистик» по docs/demo-dataset-scor-reference-model.md (SCOR).
-- Идемпотентно: повторный psql -f не дублирует коды DEMO_SCOR_*; ручные рёбра метамодели с payload
-- удаляются и вставляются заново; интеграционные потоки с transferred_data = 'SCOR_DEMO_REF' пересоздаются.
-- Предусловия: миграции ar_employees, section32 FK-проекции, demo_full_model_entities_matrix_relation_dictionary.
-- После наката: перезапуск backend.

-- ---------------------------------------------------------------------------
-- 0) Удаление предыдущего наполнения этого скрипта
-- ---------------------------------------------------------------------------
DELETE FROM archrep.ar_metamodel_relations
WHERE payload @> '{"demo_scor_dataset":"v1"}'::jsonb;

DELETE FROM archrep.ar_metamodel_relations r
WHERE r.reference_to_baserow IN (
  SELECT f.id FROM archrep.ar_integration_flows f WHERE f.transferred_data = 'SCOR_DEMO_REF'
)
AND r.relation_type IN (
  'integration_flow','integration_flow_system_module','integration_flow_module_system','integration_flow_module_module'
);

DELETE FROM archrep.ar_integration_flows
WHERE transferred_data = 'SCOR_DEMO_REF';

-- ---------------------------------------------------------------------------
-- 1) Партнёры (§11) — по имени, без дублей
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_partners (name)
SELECT x FROM unnest(ARRAY[
  'ООО «ТрансЛиния»','ООО «УпаковкаПрофи»','ЗАО «СенсорыПром»','ИП «РегионЭкспресс»',
  'ООО «ЛабКонтроль»','ООО «Утилизатор»','АО «БанкСевер»','ООО «ЭДО-Хаб»',
  'SAP SE','Microsoft','ООО «1С-Софт»','PostgreSQL Professional Europe','Red Hat','VMware',
  'АО «ИнтеграторСофт»','ООО «Поддержка24»','ООО «ОблакоДата»','ООО «КиберЩит»'
]) AS t(x)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_partners p WHERE p.name = t.x);

-- ---------------------------------------------------------------------------
-- 2) Оргструктура (§2) — коды DEMO_SCOR_OU_*
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_organization_units (code, name, description, parent_id)
VALUES
  ('DEMO_SCOR_OU_DIR', 'Дирекция по цепочке поставок', 'Корневая OU для SCOR-витрины', NULL),
  ('DEMO_SCOR_OU_SRC', 'Управление закупок и поставщиков', 'Домен Source', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR')),
  ('DEMO_SCOR_OU_MAKE', 'Производственный комплекс «Север-1»', 'Домен Make', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR')),
  ('DEMO_SCOR_OU_RC_MSK', 'Распределительный центр «Москва-Юг»', 'Deliver', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR')),
  ('DEMO_SCOR_OU_RC_KZN', 'Распределительный центр «Казань»', 'Deliver', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR')),
  ('DEMO_SCOR_OU_SOP', 'Служба планирования и S&OP', 'Plan', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR')),
  ('DEMO_SCOR_OU_RET', 'Клиентский сервис и возвраты', 'Return', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR')),
  ('DEMO_SCOR_OU_IT', 'ИТ и цифровая трансформация', 'Enable', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR')),
  ('DEMO_SCOR_OU_FIN', 'Финансовый блок', 'Enable', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR')),
  ('DEMO_SCOR_OU_QA', 'Управление качества и комплаенса', 'Enable / Make', (SELECT id FROM archrep.ar_organization_units WHERE code = 'DEMO_SCOR_OU_DIR'))
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id;

-- ---------------------------------------------------------------------------
-- 3) Сотрудники §10 (35 ФИО)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_employees (full_name, active)
SELECT fn, true FROM unnest(ARRAY[
  'Иванов А.С.','Петрова М.И.','Сидоров К.Ю.','Козлова Е.В.','Морозов Д.П.',
  'Волкова Н.С.','Лебедев И.О.','Новикова Т.Р.','Орлов П.М.','Соколова Л.А.',
  'Жуков В.Г.','Фёдорова А.П.','Григорьян Д.С.','Алиев Р.К.','Беляева О.Н.',
  'Дмитриев С.В.','Егорова И.Л.','Зайцев М.Р.','Климова Ю.Т.','Ларина Е.Д.',
  'Михайлов П.С.','Никитин А.В.','Овчинников Г.И.','Павлова С.Н.','Романов К.Е.',
  'Семёнова Т.О.','Тихонов В.Я.','Уварова Н.П.','Фролов Д.К.','Харитонов Л.М.',
  'Цветкова Е.Р.','Чернов И.С.','Шестакова М.В.','Щербаков А.П.','Яковлев О.Д.'
]) AS t(fn)
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_employees e
  WHERE lower(trim(split_part(e.full_name, ' ', 1))) = lower(trim(split_part(t.fn, ' ', 1)))
);

-- ---------------------------------------------------------------------------
-- 4) Акторы §3
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_actors (code, name, description, organization_unit_id, actor_type_id)
SELECT v.code, v.name, v.descr,
  (SELECT id FROM archrep.ar_organization_units ou WHERE ou.code = v.ou_code),
  1
FROM (VALUES
  ('DEMO_SCOR_ACT_DIR','Директор по цепочке поставок','Enable / Plan','DEMO_SCOR_OU_DIR'),
  ('DEMO_SCOR_ACT_SRC','Руководитель закупок сырья','Source','DEMO_SCOR_OU_SRC'),
  ('DEMO_SCOR_ACT_MFG','Руководитель производства','Make','DEMO_SCOR_OU_MAKE'),
  ('DEMO_SCOR_ACT_LOG','Руководитель логистики дистрибуции','Deliver','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_ACT_SOP','Менеджер по планированию спроса (S&OP)','Plan','DEMO_SCOR_OU_SOP'),
  ('DEMO_SCOR_ACT_RET','Специалист по возвратам и претензиям','Return','DEMO_SCOR_OU_RET'),
  ('DEMO_SCOR_ACT_ARCH','Архитектор данных','Enable','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_ACT_PO_EO','Владелец продукта «Единое окно заказа»','Deliver','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_ACT_PO_WH','Владелец продукта «Склад и остатки»','Deliver','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_ACT_SUPP','Представитель ключевого поставщика упаковки','Source','DEMO_SCOR_OU_SRC'),
  ('DEMO_SCOR_ACT_ITINF','Руководитель ИТ-инфраструктуры','Enable','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_ACT_AUD','Внутренний аудит','Enable','DEMO_SCOR_OU_FIN'),
  ('DEMO_SCOR_ACT_WMS','Руководитель проекта внедрения WMS','Enable','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_ACT_OPS','Операционный директор сети магазинов','Deliver','DEMO_SCOR_OU_DIR'),
  ('DEMO_SCOR_ACT_QA','Руководитель службы качества','Make','DEMO_SCOR_OU_QA')
) AS v(code, name, descr, ou_code)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  organization_unit_id = EXCLUDED.organization_unit_id,
  actor_type_id = EXCLUDED.actor_type_id;

-- ---------------------------------------------------------------------------
-- 5) Статус бизнес-сервиса + продукты §4 (FK OU → триггер OU↔BS)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_business_service_statuses (name, description)
SELECT 'Активен (demo SCOR)', 'Статус для демо-набора SCOR'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_business_service_statuses WHERE name = 'Активен (demo SCOR)');

INSERT INTO archrep.ar_business_services (code, name, fullname, description, ar_organization_units_id, ar_business_service_statuses_id)
SELECT v.code, v.name, v.fullname, v.descr,
  (SELECT id FROM archrep.ar_organization_units ou WHERE ou.code = v.ou_code),
  COALESCE(
    (SELECT id FROM archrep.ar_business_service_statuses WHERE name = 'Активен (demo SCOR)' LIMIT 1),
    (SELECT id FROM archrep.ar_business_service_statuses ORDER BY id LIMIT 1)
  )
FROM (VALUES
  ('DEMO_SCOR_BS_3PL','3PL: договорное хранение и обработка груза на РЦ','3PL РЦ','Платно за паллето-место','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_BS_LTL','Доставка сборных грузов до РЦ и магазинов клиента','Доставка LTL','Тарифная сетка','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_BS_STM','Контрактное производство продукции под СТМ клиента','СТМ','Слот мощности','DEMO_SCOR_OU_MAKE'),
  ('DEMO_SCOR_BS_EXP','Экспресс-доставка «день-в-день»','Экспресс','Премиум','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_BS_REV','Реверс-логистика и обработка возвратов для клиента','RMA','Под ключ','DEMO_SCOR_OU_RET'),
  ('DEMO_SCOR_BS_DIS','Утилизация и сертифицированное уничтожение брака заказчика','Утилизация','Акты','DEMO_SCOR_OU_QA'),
  ('DEMO_SCOR_BS_AUD','Аудит качества партии на площадке заказчика','Аудит качества','Выезд','DEMO_SCOR_OU_QA'),
  ('DEMO_SCOR_BS_ANL','Подписка на аналитику цепочки (портал для клиента)','Аналитика','OTIF','DEMO_SCOR_OU_SOP'),
  ('DEMO_SCOR_BS_SOPC','Консалтинг и настройка S&OP под процессы клиента','S&OP консалтинг','Проект','DEMO_SCOR_OU_SOP'),
  ('DEMO_SCOR_BS_API','Интеграция клиента с «единым окном» статусов заказа','API окно','Платное API','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_BS_TRN','Обучение персонала клиента работе в учебной среде WMS','Тренинг WMS','Сертификат','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_BS_LEASE','Лизинг температурной ёмкости рефрижераторного парка','Лизинг реф','Аренда','DEMO_SCOR_OU_FIN')
) AS v(code, name, fullname, descr, ou_code)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  fullname = EXCLUDED.fullname,
  description = EXCLUDED.description,
  ar_organization_units_id = EXCLUDED.ar_organization_units_id,
  ar_business_service_statuses_id = EXCLUDED.ar_business_service_statuses_id;

-- ---------------------------------------------------------------------------
-- 6) Бизнес-функции §5 (L1 SCOR + L2/L3, владелец OU для §17.1.B)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id, ar_organization_units_id)
SELECT 'DEMO_SCOR_BF_L1_P', 'Планирование цепочки поставок (Plan)', 'SCOR L1', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_business_functions WHERE code = 'DEMO_SCOR_BF_L1_P');
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id, ar_organization_units_id)
SELECT 'DEMO_SCOR_BF_L1_S', 'Закупки и управление поставщиками (Source)', 'SCOR L1', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_business_functions WHERE code = 'DEMO_SCOR_BF_L1_S');
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id, ar_organization_units_id)
SELECT 'DEMO_SCOR_BF_L1_M', 'Производство и выпуск (Make)', 'SCOR L1', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_business_functions WHERE code = 'DEMO_SCOR_BF_L1_M');
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id, ar_organization_units_id)
SELECT 'DEMO_SCOR_BF_L1_D', 'Доставка и складская логистика (Deliver)', 'SCOR L1', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_business_functions WHERE code = 'DEMO_SCOR_BF_L1_D');
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id, ar_organization_units_id)
SELECT 'DEMO_SCOR_BF_L1_R', 'Возвраты и обратный поток (Return)', 'SCOR L1', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_business_functions WHERE code = 'DEMO_SCOR_BF_L1_R');
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id, ar_organization_units_id)
SELECT 'DEMO_SCOR_BF_L1_E', 'Обеспечение цепочки (Enable)', 'SCOR L1', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_business_functions WHERE code = 'DEMO_SCOR_BF_L1_E');

-- L2/L3: вставка с привязкой parent и OU (OU-BF §17.1.B)
INSERT INTO archrep.ar_business_functions (code, name, description, parent_id, ar_organization_units_id)
SELECT v.code, v.name, v.descr,
  (SELECT id FROM archrep.ar_business_functions b WHERE b.code = v.pcode),
  (SELECT id FROM archrep.ar_organization_units ou WHERE ou.code = v.ou_code)
FROM (VALUES
  ('DEMO_SCOR_BF_L2_FORECAST','Прогноз спроса','L2 Plan','DEMO_SCOR_BF_L1_P','DEMO_SCOR_OU_DIR'),
  ('DEMO_SCOR_BF_L2_TENDER','Тендер','L2 Source','DEMO_SCOR_BF_L1_S','DEMO_SCOR_OU_SRC'),
  ('DEMO_SCOR_BF_L2_RELEASE','Выпуск партии','L2 Make','DEMO_SCOR_BF_L1_M','DEMO_SCOR_OU_MAKE'),
  ('DEMO_SCOR_BF_L2_PICKSHIP','Отбор и отгрузка','L2 Deliver','DEMO_SCOR_BF_L1_D','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_BF_L2_INBOUND','Приёмка на РЦ','L2 Deliver','DEMO_SCOR_BF_L1_D','DEMO_SCOR_OU_RC_KZN'),
  ('DEMO_SCOR_BF_L2_BAL','Баланс запасов','L2 Plan','DEMO_SCOR_BF_L1_P','DEMO_SCOR_OU_SOP'),
  ('DEMO_SCOR_BF_L2_RETREG','Регистрация возврата','L2 Return','DEMO_SCOR_BF_L1_R','DEMO_SCOR_OU_RET'),
  ('DEMO_SCOR_BF_L2_ITARCH','Архитектура ИТ','L2 Enable','DEMO_SCOR_BF_L1_E','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_BF_L2_COMP','Комплаенс (E)','L2 Enable','DEMO_SCOR_BF_L1_E','DEMO_SCOR_OU_FIN'),
  ('DEMO_SCOR_BF_L2_QC','Контроль качества выпуска','L2 Make','DEMO_SCOR_BF_L1_M','DEMO_SCOR_OU_QA'),
  ('DEMO_SCOR_BF_L2_CONTRACT','Контракт','L2 Source','DEMO_SCOR_BF_L1_S','DEMO_SCOR_OU_SRC'),
  ('DEMO_SCOR_BF_L2_PLREL','План выпуска','L2 Make','DEMO_SCOR_BF_L1_M','DEMO_SCOR_OU_MAKE'),
  ('DEMO_SCOR_BF_L2_DELPT','Доставка в точку','L2 Deliver','DEMO_SCOR_BF_L1_D','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_BF_L2_CAUSE','Разбор причин','L2 Return','DEMO_SCOR_BF_L1_R','DEMO_SCOR_OU_RET'),
  ('DEMO_SCOR_BF_L2_RESORD','Резервирование остатка под заказ','L2 Deliver','DEMO_SCOR_BF_L1_D','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_BF_L2_XDOCK','Кросс-докинг','L2 Deliver','DEMO_SCOR_BF_L1_D','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_BF_L2_PORT','Портфель заказов поставщикам','L2 Source','DEMO_SCOR_BF_L1_S','DEMO_SCOR_OU_SRC'),
  ('DEMO_SCOR_BF_L2_UTIL','Утилизация','L2 Return','DEMO_SCOR_BF_L1_R','DEMO_SCOR_OU_RET'),
  ('DEMO_SCOR_BF_L2_INQC','Входной контроль поставки','L2 Source','DEMO_SCOR_BF_L1_S','DEMO_SCOR_OU_SRC'),
  ('DEMO_SCOR_BF_L2_TRAIN','Обучение','L2 Enable','DEMO_SCOR_BF_L1_E','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_BF_L3_INTREG','Ведение реестра интеграций ИС','L3 Enable','DEMO_SCOR_BF_L2_ITARCH','DEMO_SCOR_OU_IT'),
  ('DEMO_SCOR_BF_L3_ROUTE','Планирование маршрута доставки','L3 Deliver','DEMO_SCOR_BF_L2_DELPT','DEMO_SCOR_OU_RC_MSK'),
  ('DEMO_SCOR_BF_L3_CLAIM','Оформление претензии поставщику упаковки','L3 Return','DEMO_SCOR_BF_L2_CAUSE','DEMO_SCOR_OU_RET'),
  ('DEMO_SCOR_BF_L3_INBOP','Приёмка на РЦ (операция)','L3 Deliver','DEMO_SCOR_BF_L2_INBOUND','DEMO_SCOR_OU_RC_KZN'),
  ('DEMO_SCOR_BF_L2_INC','Управление инцидентами','L2 Enable','DEMO_SCOR_BF_L1_E','DEMO_SCOR_OU_IT')
) AS v(code, name, descr, pcode, ou_code)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  ar_organization_units_id = EXCLUDED.ar_organization_units_id;

-- Пересборка OU↔BF / OU↔BS проекций после UPDATE OU на BF/BS
UPDATE archrep.ar_business_functions f SET ar_organization_units_id = f.ar_organization_units_id WHERE f.code LIKE 'DEMO_SCOR_BF_%';
UPDATE archrep.ar_business_services s SET ar_organization_units_id = s.ar_organization_units_id WHERE s.code LIKE 'DEMO_SCOR_BS_%';

-- ---------------------------------------------------------------------------
-- 7) Принципы §13, ADRP §14, ADRA §16, долги §15
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_principles (name, statement, is_approved)
SELECT v.n, v.s, true FROM (VALUES
  ('Первичность архитектурных принципов','Решения не противоречат принципам без пересмотра'),
  ('Импортозамещение','Приоритет отечественных решений'),
  ('Соблюдение законодательства','ПДн, прослеживаемость'),
  ('Данные — актив компании','Качество и владение данными'),
  ('Единая технологическая политика','Стек и API согласованы'),
  ('Кибербезопасность по умолчанию','Защищённость с проектирования'),
  ('Устойчивое развитие и экология','ESG в логистике'),
  ('Прозрачность для аудита','Интеграции прослеживаемы'),
  ('Управляемость изменений','Изменения через процесс')
) AS v(n, s)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_principles p WHERE p.name = v.n);

INSERT INTO archrep.ar_adrs_principle (code, name, context, ar_adr_statuses_id)
SELECT v.code, v.name, v.ctx, 1 FROM (VALUES
  ('DEMO_SCOR_ADRP_01','Единый источник правды по SKU — MDM','ADRP-01'),
  ('DEMO_SCOR_ADRP_02','Событийная шина для статусов отгрузки','ADRP-02'),
  ('DEMO_SCOR_ADRP_03','Запрет прямой записи в склад из внешних Excel','ADRP-03'),
  ('DEMO_SCOR_ADRP_04','Стандарт контрактов API между OMS и WMS','ADRP-04'),
  ('DEMO_SCOR_ADRP_05','Классификация интеграций: синхрон / асинхрон','ADRP-05'),
  ('DEMO_SCOR_ADRP_06','Политика хранения ПДн в логах TMS','ADRP-06'),
  ('DEMO_SCOR_ADRP_07','Связка возврата с причиной в MDM','ADRP-07'),
  ('DEMO_SCOR_ADRP_08','Версионирование схем сообщений на шине','ADRP-08')
) AS v(code, name, ctx)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, context = EXCLUDED.context;

INSERT INTO archrep.ar_adrs_applied (code, task_name, conclusion, ar_adr_statuses_id)
SELECT v.code, v.task, v.ctx, 1 FROM (VALUES
  ('DEMO_SCOR_ADRA_01','Внедрить сквозной статус доставки в OMS','Deliver'),
  ('DEMO_SCOR_ADRA_02','Сократить окно ночной выгрузки в Data Lake','Plan / Enable'),
  ('DEMO_SCOR_ADRA_03','Заменить точечную интеграцию OMS–WMS на шину','Enable / Deliver'),
  ('DEMO_SCOR_ADRA_04','Унифицировать учёт партий MES↔ERP','Make / Source'),
  ('DEMO_SCOR_ADRA_05','Пилот ЭЦП накладных с перевозчиком','Deliver / Source'),
  ('DEMO_SCOR_ADRA_06','Резервирование Kafka для РЦ Казань','Enable'),
  ('DEMO_SCOR_ADRA_07','Регламент инцидентов при падении TMS','Deliver'),
  ('DEMO_SCOR_ADRA_08','Модель данных возвратов','Return'),
  ('DEMO_SCOR_ADRA_09','Мобильное приложение кладовщика','Deliver / Make'),
  ('DEMO_SCOR_ADRA_10','Перенос отчётности S&OP в облако','Plan / Enable')
) AS v(code, task, ctx)
ON CONFLICT (code) DO UPDATE SET task_name = EXCLUDED.task_name, conclusion = EXCLUDED.conclusion;

INSERT INTO archrep.ar_gaps (code, name, description, ar_gap_states_id, ar_gap_types_id, ar_impact_level_types_id)
SELECT v.code, v.name, v.descr, 1, 1, 2 FROM (VALUES
  ('DEMO_SCOR_GAP_01','Дублирование справочника магазинов','OMS и файловый обмен'),
  ('DEMO_SCOR_GAP_02','Нет сквозного трейсинга OMS→WMS→TMS','UI'),
  ('DEMO_SCOR_GAP_03','Ручной перенос статусов возврата из Excel','ERP'),
  ('DEMO_SCOR_GAP_04','Расхождение единиц измерения MES↔ERP','Данные'),
  ('DEMO_SCOR_GAP_05','Нет актив-пассив Kafka в РЦ Казань','Инфра'),
  ('DEMO_SCOR_GAP_06','Устаревший TLS на API портала поставщика','ИБ'),
  ('DEMO_SCOR_GAP_07','Нет регламента отключения интеграции при инциденте ИБ','Процесс'),
  ('DEMO_SCOR_GAP_08','Перегрузка ночного ETL','S&OP отчёты'),
  ('DEMO_SCOR_GAP_09','Неполная синхронизация штрихкодов MDM↔WMS','Данные'),
  ('DEMO_SCOR_GAP_10','Долг миграции SOAP→REST для потока ERP','Интеграция'),
  ('DEMO_SCOR_GAP_11','Нет резервной площадки для критичного модуля TMS','Надёжность'),
  ('DEMO_SCOR_GAP_12','Неформализованы роли согласования изменений в MES','Процесс')
) AS v(code, name, descr)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- 8) Технологии §8 (имя; вендор — опционально через подзапрос партнёра)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_technologies (name, vendor_ar_partners_id)
SELECT t.n,
  CASE WHEN t.p IS NULL THEN NULL ELSE (SELECT id FROM archrep.ar_partners p WHERE p.name = t.p LIMIT 1) END
FROM (VALUES
  ('PostgreSQL','PostgreSQL Professional Europe'),
  ('Microsoft SQL Server','Microsoft'),
  ('Kafka','Red Hat'),
  ('Apache Airflow',NULL),
  ('Kubernetes','Red Hat'),
  ('Docker',NULL),
  ('REST API',NULL),
  ('SOAP (legacy)',NULL),
  ('GraphQL (пилот)',NULL),
  ('Redis',NULL),
  ('Elasticsearch',NULL),
  ('Power BI','Microsoft'),
  ('1С:ERP','ООО «1С-Софт»'),
  ('SAP UI5 (фрагмент)','SAP SE'),
  ('RabbitMQ',NULL),
  ('NGINX',NULL),
  ('Keycloak','Red Hat'),
  ('GitLab CI',NULL),
  ('Ansible',NULL),
  ('VMware','VMware'),
  ('SAN/NFS',NULL),
  ('VPN site-to-site',NULL),
  ('SSL/TLS',NULL),
  ('Prometheus',NULL),
  ('Grafana',NULL),
  ('OpenTelemetry',NULL),
  ('Python (ETL)',NULL),
  ('Java (сервисы интеграции)',NULL),
  ('.NET (внутренние API)','Microsoft')
) AS t(n, p)
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_technologies x WHERE lower(trim(x.name)) = lower(trim(t.n)));

-- ---------------------------------------------------------------------------
-- 9) ИС и модули §6–§7 (корни без parent; модули — parent_ar_systems_id)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_systems (code, name, fullname, parent_ar_systems_id, ar_system_statuses_id, external_system)
SELECT v.code, v.name, v.fullname, NULL,
  (SELECT id FROM archrep.ar_system_statuses ORDER BY id LIMIT 1), false
FROM (VALUES
  ('DEMO_SCOR_SYS_SOP','Спрос и S&OP','Спрос и S&OP'),
  ('DEMO_SCOR_SYS_BUD','Бюджетирование закупок','Бюджетирование закупок'),
  ('DEMO_SCOR_SYS_ERP','ERP: закупки и контракты','ERP: закупки и контракты'),
  ('DEMO_SCOR_SYS_SUPP','Портал поставщика','Портал поставщика'),
  ('DEMO_SCOR_SYS_MES','MES учёт выпуска','MES учёт выпуска'),
  ('DEMO_SCOR_SYS_LIMS','LIMS качество сырья','LIMS качество сырья'),
  ('DEMO_SCOR_SYS_WMS_MSK','WMS РЦ Москва','WMS РЦ Москва'),
  ('DEMO_SCOR_SYS_WMS_KZN','WMS РЦ Казань','WMS РЦ Казань'),
  ('DEMO_SCOR_SYS_TMS','TMS маршрутизация','TMS маршрутизация'),
  ('DEMO_SCOR_SYS_OMS','OMS заказы сети','OMS заказы сети'),
  ('DEMO_SCOR_SYS_RET','Модуль возвратов ERP','Модуль возвратов ERP'),
  ('DEMO_SCOR_SYS_CMDB','Корпоративный каталог ИС','Корпоративный каталог ИС'),
  ('DEMO_SCOR_SYS_IAM','IAM','IAM'),
  ('DEMO_SCOR_SYS_MDM','MDM номенклатуры','MDM номенклатуры'),
  ('DEMO_SCOR_SYS_DL','Data Lake аналитики','Data Lake аналитики'),
  ('DEMO_SCOR_SYS_SD','Service Desk','Service Desk'),
  ('DEMO_SCOR_SYS_ESB','Шина интеграции (ESB)','Шина интеграции (ESB)'),
  ('DEMO_SCOR_SYS_KAFKA','Шина событий (Kafka)','Шина событий (Kafka)'),
  ('DEMO_SCOR_SYS_BI','BI-портал цепочки','BI-портал цепочки'),
  ('DEMO_SCOR_SYS_MON','Мониторинг SLA интеграций','Мониторинг SLA интеграций'),
  ('DEMO_SCOR_SYS_BKP','Корпоративное резервное копирование','Корпоративное резервное копирование'),
  ('DEMO_SCOR_SYS_LOGPORT','Портал управленческой отчётности логистики','Портал управленческой отчётности логистики')
) AS v(code, name, fullname)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, fullname = EXCLUDED.fullname;

-- Модули (коды DEMO_SCOR_MOD_*)
INSERT INTO archrep.ar_systems (code, name, fullname, parent_ar_systems_id, parent_name, ar_system_statuses_id, external_system)
SELECT v.code, v.name, v.fn,
  (SELECT id FROM archrep.ar_systems s WHERE s.code = v.pcode),
  (SELECT s.name FROM archrep.ar_systems s WHERE s.code = v.pcode),
  (SELECT id FROM archrep.ar_system_statuses ORDER BY id LIMIT 1), false
FROM (VALUES
  ('DEMO_SCOR_MOD_WMS_MSK_RECV','Приёмка','WMS Москва — Приёмка','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_MOD_WMS_MSK_PLC','Размещение','WMS Москва — Размещение','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_MOD_WMS_MSK_PICK','Отбор','WMS Москва — Отбор','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_MOD_WMS_MSK_SHIP','Отгрузка','WMS Москва — Отгрузка','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_MOD_WMS_MSK_INV','Инвентаризация','WMS Москва — Инвентаризация','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_MOD_WMS_MSK_PACK','Упаковка в гофрокороб','WMS Москва — Упаковка','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_MOD_WMS_KZN_RECV','Приёмка','WMS Казань — Приёмка','DEMO_SCOR_SYS_WMS_KZN'),
  ('DEMO_SCOR_MOD_WMS_KZN_PLC','Размещение','WMS Казань — Размещение','DEMO_SCOR_SYS_WMS_KZN'),
  ('DEMO_SCOR_MOD_WMS_KZN_PICK','Отбор','WMS Казань — Отбор','DEMO_SCOR_SYS_WMS_KZN'),
  ('DEMO_SCOR_MOD_WMS_KZN_SHIP','Отгрузка','WMS Казань — Отгрузка','DEMO_SCOR_SYS_WMS_KZN'),
  ('DEMO_SCOR_MOD_WMS_KZN_INV','Инвентаризация','WMS Казань — Инвентаризация','DEMO_SCOR_SYS_WMS_KZN'),
  ('DEMO_SCOR_MOD_ERP_REQ','Заявки на закупку','ERP — Заявки','DEMO_SCOR_SYS_ERP'),
  ('DEMO_SCOR_MOD_ERP_CTR','Согласование договоров','ERP — Согласование','DEMO_SCOR_SYS_ERP'),
  ('DEMO_SCOR_MOD_ERP_GRN','Приёмка по накладной','ERP — Приёмка','DEMO_SCOR_SYS_ERP'),
  ('DEMO_SCOR_MOD_TMS_RT','Планирование рейсов','TMS — Планирование','DEMO_SCOR_SYS_TMS'),
  ('DEMO_SCOR_MOD_TMS_TRK','Трекинг ТС','TMS — Трекинг','DEMO_SCOR_SYS_TMS'),
  ('DEMO_SCOR_MOD_TMS_TAR','Расчёт тарифов перевозчика','TMS — Тарифы','DEMO_SCOR_SYS_TMS'),
  ('DEMO_SCOR_MOD_OMS_B2B','Корзина B2B','OMS — B2B','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_MOD_OMS_RES','Резервирование','OMS — Резервирование','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_MOD_OMS_IWMS','Интеграция с WMS','OMS — Интеграция WMS','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_MOD_OMS_SPLIT','Разбиение заказа по РЦ','OMS — Разбиение','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_MOD_MES_SHIFT','Сменные задания','MES — Смены','DEMO_SCOR_SYS_MES'),
  ('DEMO_SCOR_MOD_MES_SCRAP','Учёт брака','MES — Брак','DEMO_SCOR_SYS_MES'),
  ('DEMO_SCOR_MOD_MES_SENS','Сенсоры линии','MES — Сенсоры','DEMO_SCOR_SYS_MES'),
  ('DEMO_SCOR_MOD_MES_DEF','Фиксация брака по причине','MES — Фиксация брака','DEMO_SCOR_SYS_MES'),
  ('DEMO_SCOR_MOD_SUPP_CONF','Подтверждение поставки','Портал — Подтверждение','DEMO_SCOR_SYS_SUPP'),
  ('DEMO_SCOR_MOD_SD_INT','Интеграции','Service Desk — Интеграции','DEMO_SCOR_SYS_SD'),
  ('DEMO_SCOR_MOD_MON_SLA','Мониторинг SLA (подмодуль)','Мониторинг — SLA','DEMO_SCOR_SYS_MON'),
  ('DEMO_SCOR_MOD_ESB_ADP','ESB-адаптер (условный)','ESB — Адаптер','DEMO_SCOR_SYS_ESB'),
  ('DEMO_SCOR_MOD_KFK_CONN','Kafka-коннектор (условный)','Kafka — Коннектор','DEMO_SCOR_SYS_KAFKA')
) AS v(code, name, fn, pcode)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, fullname = EXCLUDED.fullname, parent_ar_systems_id = EXCLUDED.parent_ar_systems_id, parent_name = EXCLUDED.parent_name;

-- FK: вендоры / интегратор / поддержка и лиды (§17.1.FK)
UPDATE archrep.ar_systems s SET
  vendor_ar_partners_id = p.id
FROM archrep.ar_partners p
WHERE s.code IN (
  'DEMO_SCOR_SYS_ERP','DEMO_SCOR_SYS_OMS','DEMO_SCOR_SYS_MES','DEMO_SCOR_SYS_LIMS',
  'DEMO_SCOR_SYS_WMS_MSK','DEMO_SCOR_SYS_DL','DEMO_SCOR_SYS_BI','DEMO_SCOR_SYS_IAM',
  'DEMO_SCOR_SYS_CMDB','DEMO_SCOR_SYS_MDM'
) AND (
  (s.code = 'DEMO_SCOR_SYS_ERP' AND p.name = 'SAP SE') OR
  (s.code = 'DEMO_SCOR_SYS_OMS' AND p.name = 'Microsoft') OR
  (s.code = 'DEMO_SCOR_SYS_MES' AND p.name = 'ЗАО «СенсорыПром»') OR
  (s.code = 'DEMO_SCOR_SYS_LIMS' AND p.name = 'ООО «ЛабКонтроль»') OR
  (s.code = 'DEMO_SCOR_SYS_WMS_MSK' AND p.name = 'ООО «1С-Софт»') OR
  (s.code = 'DEMO_SCOR_SYS_DL' AND p.name = 'Red Hat') OR
  (s.code = 'DEMO_SCOR_SYS_BI' AND p.name = 'Microsoft') OR
  (s.code = 'DEMO_SCOR_SYS_IAM' AND p.name = 'Red Hat') OR
  (s.code = 'DEMO_SCOR_SYS_CMDB' AND p.name = 'Red Hat') OR
  (s.code = 'DEMO_SCOR_SYS_MDM' AND p.name = 'Microsoft')
) AND s.vendor_ar_partners_id IS DISTINCT FROM p.id;

UPDATE archrep.ar_systems s SET supplier_ar_partners_id = p.id
FROM archrep.ar_partners p
WHERE p.name = 'АО «ИнтеграторСофт»'
  AND s.code IN ('DEMO_SCOR_SYS_WMS_MSK','DEMO_SCOR_SYS_WMS_KZN','DEMO_SCOR_SYS_TMS','DEMO_SCOR_SYS_OMS','DEMO_SCOR_SYS_MES','DEMO_SCOR_SYS_DL','DEMO_SCOR_SYS_ESB','DEMO_SCOR_SYS_KAFKA','DEMO_SCOR_SYS_BI','DEMO_SCOR_SYS_MON');

UPDATE archrep.ar_systems s SET supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1)
WHERE s.code IN ('DEMO_SCOR_SYS_WMS_MSK','DEMO_SCOR_SYS_TMS','DEMO_SCOR_SYS_OMS','DEMO_SCOR_SYS_MES','DEMO_SCOR_SYS_DL','DEMO_SCOR_SYS_ESB','DEMO_SCOR_SYS_BI','DEMO_SCOR_SYS_MON');

UPDATE archrep.ar_systems s SET supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «ОблакоДата»' LIMIT 1)
WHERE s.code IN ('DEMO_SCOR_SYS_WMS_KZN','DEMO_SCOR_SYS_KAFKA');

UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ЗАО «СенсорыПром»' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_MES_SENS';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'VMware' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_TMS_TRK';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'Red Hat' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_WMS_MSK_PICK';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'PostgreSQL Professional Europe' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_OMS_RES';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'SAP SE' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_ERP_REQ';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'Microsoft' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_ERP_CTR';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «1С-Софт»' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_WMS_KZN_RECV';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ЗАО «СенсорыПром»' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_MES_SHIFT';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'Microsoft' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_OMS_IWMS';
UPDATE archrep.ar_systems m SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «КиберЩит»' LIMIT 1), supplier_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'АО «ИнтеграторСофт»' LIMIT 1), supporter_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «Поддержка24»' LIMIT 1) WHERE m.code = 'DEMO_SCOR_MOD_SD_INT';

UPDATE archrep.ar_technologies t SET vendor_ar_partners_id = p.id
FROM archrep.ar_partners p
WHERE lower(trim(t.name)) = lower(trim('PostgreSQL')) AND p.name = 'PostgreSQL Professional Europe';

UPDATE archrep.ar_technologies t SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'Red Hat' LIMIT 1)
WHERE lower(trim(t.name)) IN ('kafka','kubernetes','keycloak');

UPDATE archrep.ar_technologies t SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'VMware' LIMIT 1)
WHERE lower(trim(t.name)) = 'vmware';

UPDATE archrep.ar_technologies t SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'ООО «1С-Софт»' LIMIT 1)
WHERE lower(trim(t.name)) LIKE '%1с%';

UPDATE archrep.ar_technologies t SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'Microsoft' LIMIT 1)
WHERE lower(trim(t.name)) IN ('microsoft sql server','power bi','.net (внутренние api)');

-- ИТ/бизнес лиды на корнях и модулях (первые сотрудники §10)
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id
FROM archrep.ar_employees e
WHERE s.code = 'DEMO_SCOR_SYS_SOP' AND e.full_name = 'Иванов А.С.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_BUD' AND e.full_name = 'Петрова М.И.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_ERP' AND e.full_name = 'Сидоров К.Ю.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_SUPP' AND e.full_name = 'Козлова Е.В.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_MES' AND e.full_name = 'Морозов Д.П.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_LIMS' AND e.full_name = 'Волкова Н.С.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_WMS_MSK' AND e.full_name = 'Лебедев И.О.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_WMS_KZN' AND e.full_name = 'Новикова Т.Р.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_TMS' AND e.full_name = 'Орлов П.М.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_OMS' AND e.full_name = 'Соколова Л.А.';

UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_RET' AND e.full_name = 'Жуков В.Г.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_CMDB' AND e.full_name = 'Фёдорова А.П.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_IAM' AND e.full_name = 'Григорьян Д.С.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_MDM' AND e.full_name = 'Алиев Р.К.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_DL' AND e.full_name = 'Беляева О.Н.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_SD' AND e.full_name = 'Дмитриев С.В.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_ESB' AND e.full_name = 'Егорова И.Л.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_KAFKA' AND e.full_name = 'Зайцев М.Р.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_BI' AND e.full_name = 'Климова Ю.Т.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_MON' AND e.full_name = 'Ларина Е.Д.';

UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_WMS_MSK_PICK' AND e.full_name = 'Михайлов П.С.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_OMS_RES' AND e.full_name = 'Никитин А.В.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_MES_SHIFT' AND e.full_name = 'Овчинников Г.И.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_ERP_GRN' AND e.full_name = 'Павлова С.Н.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_TMS_TRK' AND e.full_name = 'Романов К.Е.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_OMS_B2B' AND e.full_name = 'Семёнова Т.О.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_MES_SCRAP' AND e.full_name = 'Тихонов В.Я.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_WMS_MSK_RECV' AND e.full_name = 'Уварова Н.П.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_OMS_IWMS' AND e.full_name = 'Фролов Д.К.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_MOD_ERP_REQ' AND e.full_name = 'Харитонов Л.М.';

-- Триггеры FK: форсируем пересборку партнёров/лидов
UPDATE archrep.ar_systems s SET vendor_ar_partners_id = s.vendor_ar_partners_id WHERE s.code LIKE 'DEMO_SCOR_%';
UPDATE archrep.ar_systems s SET it_lead_employee_id = s.it_lead_employee_id WHERE s.code LIKE 'DEMO_SCOR_%';
UPDATE archrep.ar_technologies t SET vendor_ar_partners_id = t.vendor_ar_partners_id
WHERE lower(trim(t.name)) IN (
  SELECT lower(trim(x.n)) FROM (VALUES
    ('PostgreSQL'),('Kafka'),('Kubernetes'),('Keycloak'),('VMware'),('1С:ERP'),
    ('Microsoft SQL Server'),('Power BI'),('.NET (внутренние API)'),('SAP UI5 (фрагмент)')
  ) AS x(n)
);

UPDATE archrep.ar_technologies t SET vendor_ar_partners_id = (SELECT id FROM archrep.ar_partners WHERE name = 'SAP SE' LIMIT 1)
WHERE lower(trim(t.name)) LIKE '%sap ui5%';

UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_BKP' AND e.full_name = 'Цветкова Е.Р.';
UPDATE archrep.ar_systems s SET it_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_LOGPORT' AND e.full_name = 'Чернов И.С.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_SOP' AND e.full_name = 'Шестакова М.В.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_BUD' AND e.full_name = 'Щербаков А.П.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_SUPP' AND e.full_name = 'Яковлев О.Д.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_LIMS' AND e.full_name = 'Павлова С.Н.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_WMS_MSK' AND e.full_name = 'Романов К.Е.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_WMS_KZN' AND e.full_name = 'Семёнова Т.О.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_TMS' AND e.full_name = 'Тихонов В.Я.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_OMS' AND e.full_name = 'Уварова Н.П.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_ERP' AND e.full_name = 'Фролов Д.К.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_MES' AND e.full_name = 'Харитонов Л.М.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_BKP' AND e.full_name = 'Цветкова Е.Р.';
UPDATE archrep.ar_systems s SET business_lead_employee_id = e.id FROM archrep.ar_employees e WHERE s.code = 'DEMO_SCOR_SYS_LOGPORT' AND e.full_name = 'Чернов И.С.';

UPDATE archrep.ar_systems s SET it_lead_employee_id = s.it_lead_employee_id, business_lead_employee_id = s.business_lead_employee_id WHERE s.code LIKE 'DEMO_SCOR_%';

-- ---------------------------------------------------------------------------
-- 10) Функции ИС §12 (триггер → system_system_function)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_system_functions (ar_systems_id, name)
SELECT s.id, v.fn FROM archrep.ar_systems s
JOIN (VALUES
  ('DEMO_SCOR_SYS_WMS_MSK','Приёмка по SSCC'),
  ('DEMO_SCOR_SYS_WMS_MSK','Отбор волной'),
  ('DEMO_SCOR_SYS_WMS_MSK','Упаковка в гофрокороб'),
  ('DEMO_SCOR_SYS_WMS_MSK','Инвентаризация'),
  ('DEMO_SCOR_SYS_WMS_KZN','Приёмка'),
  ('DEMO_SCOR_SYS_WMS_KZN','Размещение'),
  ('DEMO_SCOR_SYS_WMS_KZN','Отбор'),
  ('DEMO_SCOR_SYS_TMS','Расчёт ETA'),
  ('DEMO_SCOR_SYS_TMS','Передача статуса в OMS'),
  ('DEMO_SCOR_SYS_TMS','Планирование рейсов'),
  ('DEMO_SCOR_SYS_ERP','Создание заказа поставщику'),
  ('DEMO_SCOR_SYS_ERP','Трёхстороннее сопоставление'),
  ('DEMO_SCOR_SYS_ERP','Приёмка по накладной'),
  ('DEMO_SCOR_SYS_OMS','Проверка кредитного лимита сети'),
  ('DEMO_SCOR_SYS_OMS','Разбиение заказа по РЦ'),
  ('DEMO_SCOR_SYS_OMS','Корзина B2B'),
  ('DEMO_SCOR_SYS_OMS','Интеграция с WMS'),
  ('DEMO_SCOR_SYS_MES','Сканирование партии сырья'),
  ('DEMO_SCOR_SYS_MES','Фиксация брака по причине'),
  ('DEMO_SCOR_SYS_MES','Сменные задания'),
  ('DEMO_SCOR_SYS_MES','Учёт брака')
) AS v(scode, fn) ON v.scode = s.code
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_system_functions f
  WHERE f.ar_systems_id = s.id AND lower(trim(f.name)) = lower(trim(v.fn))
);

UPDATE archrep.ar_system_functions f SET ar_systems_id = f.ar_systems_id WHERE EXISTS (SELECT 1 FROM archrep.ar_systems s WHERE s.id = f.ar_systems_id AND s.code LIKE 'DEMO_SCOR_%');

-- ---------------------------------------------------------------------------
-- 11) Ручные связи метамодели §17.1.C,D,E,F,G,H,I,J + §17.2 + §17.3 (payload)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_relations (
  from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, description, payload
)
SELECT 'actor', a.id, 'business_function', b.id, 'actor_business_function', '', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM archrep.ar_actors a
JOIN archrep.ar_business_functions b ON b.code IN (
  'DEMO_SCOR_BF_L2_BAL','DEMO_SCOR_BF_L2_CONTRACT','DEMO_SCOR_BF_L2_PLREL','DEMO_SCOR_BF_L2_DELPT',
  'DEMO_SCOR_BF_L2_FORECAST','DEMO_SCOR_BF_L2_CAUSE','DEMO_SCOR_BF_L3_INTREG','DEMO_SCOR_BF_L2_RESORD',
  'DEMO_SCOR_BF_L2_XDOCK','DEMO_SCOR_BF_L3_CLAIM'
)
JOIN (VALUES
  ('DEMO_SCOR_ACT_DIR','DEMO_SCOR_BF_L2_BAL'),
  ('DEMO_SCOR_ACT_SRC','DEMO_SCOR_BF_L2_CONTRACT'),
  ('DEMO_SCOR_ACT_MFG','DEMO_SCOR_BF_L2_PLREL'),
  ('DEMO_SCOR_ACT_LOG','DEMO_SCOR_BF_L2_DELPT'),
  ('DEMO_SCOR_ACT_SOP','DEMO_SCOR_BF_L2_FORECAST'),
  ('DEMO_SCOR_ACT_RET','DEMO_SCOR_BF_L2_CAUSE'),
  ('DEMO_SCOR_ACT_ARCH','DEMO_SCOR_BF_L3_INTREG'),
  ('DEMO_SCOR_ACT_PO_EO','DEMO_SCOR_BF_L2_RESORD'),
  ('DEMO_SCOR_ACT_PO_WH','DEMO_SCOR_BF_L2_XDOCK'),
  ('DEMO_SCOR_ACT_SUPP','DEMO_SCOR_BF_L3_CLAIM')
) AS m(acode, bcode) ON a.code = m.acode AND b.code = m.bcode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'actor' AND r.from_entity_id = a.id AND r.to_entity_type = 'business_function'
    AND r.to_entity_id = b.id AND r.relation_type = 'actor_business_function'
);

INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'business_function', bf.id, 'business_service', bs.id, 'business_function_business_service', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_BF_L2_PICKSHIP','DEMO_SCOR_BS_3PL'),
  ('DEMO_SCOR_BF_L2_DELPT','DEMO_SCOR_BS_LTL'),
  ('DEMO_SCOR_BF_L2_RELEASE','DEMO_SCOR_BS_STM'),
  ('DEMO_SCOR_BF_L2_FORECAST','DEMO_SCOR_BS_ANL'),
  ('DEMO_SCOR_BF_L2_TENDER','DEMO_SCOR_BS_SOPC'),
  ('DEMO_SCOR_BF_L2_RETREG','DEMO_SCOR_BS_REV'),
  ('DEMO_SCOR_BF_L2_UTIL','DEMO_SCOR_BS_DIS'),
  ('DEMO_SCOR_BF_L2_INQC','DEMO_SCOR_BS_AUD'),
  ('DEMO_SCOR_BF_L2_TRAIN','DEMO_SCOR_BS_TRN'),
  ('DEMO_SCOR_BF_L2_ITARCH','DEMO_SCOR_BS_API')
) AS v(bfcode, bscode)
JOIN archrep.ar_business_functions bf ON bf.code = v.bfcode
JOIN archrep.ar_business_services bs ON bs.code = v.bscode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'business_function' AND r.from_entity_id = bf.id AND r.to_entity_type = 'business_service'
    AND r.to_entity_id = bs.id AND r.relation_type = 'business_function_business_service'
);

-- system_function → business_function (§17.1.E)
INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'system_function', f.id, 'business_function', bf.id, 'system_function_business_function', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_SYS_WMS_MSK','Приёмка по SSCC','DEMO_SCOR_BF_L3_INBOP'),
  ('DEMO_SCOR_SYS_WMS_MSK','Отбор волной','DEMO_SCOR_BF_L2_PICKSHIP'),
  ('DEMO_SCOR_SYS_TMS','Расчёт ETA','DEMO_SCOR_BF_L3_ROUTE'),
  ('DEMO_SCOR_SYS_TMS','Передача статуса в OMS','DEMO_SCOR_BF_L2_DELPT'),
  ('DEMO_SCOR_SYS_ERP','Создание заказа поставщику','DEMO_SCOR_BF_L2_PORT'),
  ('DEMO_SCOR_SYS_ERP','Трёхстороннее сопоставление','DEMO_SCOR_BF_L2_CONTRACT'),
  ('DEMO_SCOR_SYS_OMS','Проверка кредитного лимита сети','DEMO_SCOR_BF_L2_RESORD'),
  ('DEMO_SCOR_SYS_OMS','Разбиение заказа по РЦ','DEMO_SCOR_BF_L2_PORT'),
  ('DEMO_SCOR_SYS_MES','Сканирование партии сырья','DEMO_SCOR_BF_L2_INQC'),
  ('DEMO_SCOR_SYS_MES','Фиксация брака по причине','DEMO_SCOR_BF_L2_QC')
) AS v(scode, fname, bfcode)
JOIN archrep.ar_systems s ON s.code = v.scode
JOIN archrep.ar_system_functions f ON f.ar_systems_id = s.id AND lower(trim(f.name)) = lower(trim(v.fname))
JOIN archrep.ar_business_functions bf ON bf.code = v.bfcode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'system_function' AND r.from_entity_id = f.id AND r.to_entity_type = 'business_function'
    AND r.to_entity_id = bf.id AND r.relation_type = 'system_function_business_function'
);

INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'system_function', f.id, 'business_service', bs.id, 'system_function_business_service', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_SYS_TMS','Расчёт ETA','DEMO_SCOR_BS_EXP'),
  ('DEMO_SCOR_SYS_WMS_MSK','Приёмка по SSCC','DEMO_SCOR_BS_3PL'),
  ('DEMO_SCOR_SYS_WMS_MSK','Отбор волной','DEMO_SCOR_BS_3PL'),
  ('DEMO_SCOR_SYS_WMS_MSK','Упаковка в гофрокороб','DEMO_SCOR_BS_LTL'),
  ('DEMO_SCOR_SYS_ERP','Создание заказа поставщику','DEMO_SCOR_BS_API'),
  ('DEMO_SCOR_SYS_ERP','Трёхстороннее сопоставление','DEMO_SCOR_BS_SOPC'),
  ('DEMO_SCOR_SYS_OMS','Разбиение заказа по РЦ','DEMO_SCOR_BS_EXP'),
  ('DEMO_SCOR_SYS_MES','Сканирование партии сырья','DEMO_SCOR_BS_STM'),
  ('DEMO_SCOR_SYS_MES','Фиксация брака по причине','DEMO_SCOR_BS_DIS'),
  ('DEMO_SCOR_SYS_TMS','Передача статуса в OMS','DEMO_SCOR_BS_ANL')
) AS v(scode, fname, bscode)
JOIN archrep.ar_systems s ON s.code = v.scode
JOIN archrep.ar_system_functions f ON f.ar_systems_id = s.id AND lower(trim(f.name)) = lower(trim(v.fname))
JOIN archrep.ar_business_services bs ON bs.code = v.bscode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'system_function' AND r.from_entity_id = f.id AND r.to_entity_type = 'business_service'
    AND r.to_entity_id = bs.id AND r.relation_type = 'system_function_business_service'
);

INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'actor', a.id, 'system_function', f.id, 'actor_system_function', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_ACT_PO_EO','DEMO_SCOR_SYS_OMS','Разбиение заказа по РЦ'),
  ('DEMO_SCOR_ACT_PO_WH','DEMO_SCOR_SYS_WMS_MSK','Отбор волной'),
  ('DEMO_SCOR_ACT_LOG','DEMO_SCOR_SYS_TMS','Расчёт ETA'),
  ('DEMO_SCOR_ACT_SOP','DEMO_SCOR_SYS_OMS','Проверка кредитного лимита сети'),
  ('DEMO_SCOR_ACT_SRC','DEMO_SCOR_SYS_ERP','Создание заказа поставщику'),
  ('DEMO_SCOR_ACT_MFG','DEMO_SCOR_SYS_MES','Сканирование партии сырья'),
  ('DEMO_SCOR_ACT_ARCH','DEMO_SCOR_SYS_TMS','Передача статуса в OMS'),
  ('DEMO_SCOR_ACT_ITINF','DEMO_SCOR_SYS_WMS_MSK','Приёмка по SSCC'),
  ('DEMO_SCOR_ACT_WMS','DEMO_SCOR_SYS_WMS_MSK','Упаковка в гофрокороб'),
  ('DEMO_SCOR_ACT_OPS','DEMO_SCOR_SYS_ERP','Трёхстороннее сопоставление')
) AS v(acode, scode, fnm)
JOIN archrep.ar_actors a ON a.code = v.acode
JOIN archrep.ar_systems s ON s.code = v.scode
JOIN archrep.ar_system_functions f ON f.ar_systems_id = s.id AND lower(trim(f.name)) = lower(trim(v.fnm))
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'actor' AND r.from_entity_id = a.id AND r.to_entity_type = 'system_function'
    AND r.to_entity_id = f.id AND r.relation_type = 'actor_system_function'
);

INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'applied', aa.id, 'adr_principle', ap.id, 'adr_applied_adr_principle', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_ADRA_01','DEMO_SCOR_ADRP_04'),
  ('DEMO_SCOR_ADRA_02','DEMO_SCOR_ADRP_05'),
  ('DEMO_SCOR_ADRA_03','DEMO_SCOR_ADRP_02'),
  ('DEMO_SCOR_ADRA_04','DEMO_SCOR_ADRP_01'),
  ('DEMO_SCOR_ADRA_05','DEMO_SCOR_ADRP_04'),
  ('DEMO_SCOR_ADRA_06','DEMO_SCOR_ADRP_02'),
  ('DEMO_SCOR_ADRA_07','DEMO_SCOR_ADRP_05'),
  ('DEMO_SCOR_ADRA_08','DEMO_SCOR_ADRP_07'),
  ('DEMO_SCOR_ADRA_09','DEMO_SCOR_ADRP_03'),
  ('DEMO_SCOR_ADRA_10','DEMO_SCOR_ADRP_08')
) AS v(acode, pcode)
JOIN archrep.ar_adrs_applied aa ON aa.code = v.acode
JOIN archrep.ar_adrs_principle ap ON ap.code = v.pcode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'applied' AND r.from_entity_id = aa.id AND r.to_entity_type = 'adr_principle'
    AND r.to_entity_id = ap.id AND r.relation_type = 'adr_applied_adr_principle'
);

INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'applied', aa.id, 'gap', g.id, 'applied_gap', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_ADRA_01','DEMO_SCOR_GAP_02'),
  ('DEMO_SCOR_ADRA_02','DEMO_SCOR_GAP_08'),
  ('DEMO_SCOR_ADRA_03','DEMO_SCOR_GAP_10'),
  ('DEMO_SCOR_ADRA_04','DEMO_SCOR_GAP_04'),
  ('DEMO_SCOR_ADRA_05','DEMO_SCOR_GAP_06'),
  ('DEMO_SCOR_ADRA_06','DEMO_SCOR_GAP_05'),
  ('DEMO_SCOR_ADRA_07','DEMO_SCOR_GAP_07'),
  ('DEMO_SCOR_ADRA_08','DEMO_SCOR_GAP_03'),
  ('DEMO_SCOR_ADRA_09','DEMO_SCOR_GAP_11'),
  ('DEMO_SCOR_ADRA_10','DEMO_SCOR_GAP_12')
) AS v(acode, gcode)
JOIN archrep.ar_adrs_applied aa ON aa.code = v.acode
JOIN archrep.ar_gaps g ON g.code = v.gcode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'applied' AND r.from_entity_id = aa.id AND r.to_entity_type = 'gap'
    AND r.to_entity_id = g.id AND r.relation_type = 'applied_gap'
);

INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'gap', g.id, 'system', s.id, 'gap-system', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_GAP_01','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_GAP_02','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_GAP_03','DEMO_SCOR_SYS_RET'),
  ('DEMO_SCOR_GAP_04','DEMO_SCOR_SYS_MES'),
  ('DEMO_SCOR_GAP_05','DEMO_SCOR_SYS_KAFKA'),
  ('DEMO_SCOR_GAP_06','DEMO_SCOR_SYS_SUPP'),
  ('DEMO_SCOR_GAP_07','DEMO_SCOR_SYS_ESB'),
  ('DEMO_SCOR_GAP_08','DEMO_SCOR_SYS_DL'),
  ('DEMO_SCOR_GAP_09','DEMO_SCOR_SYS_MDM'),
  ('DEMO_SCOR_GAP_10','DEMO_SCOR_SYS_ERP')
) AS v(gcode, scode)
JOIN archrep.ar_gaps g ON g.code = v.gcode
JOIN archrep.ar_systems s ON s.code = v.scode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'gap' AND r.from_entity_id = g.id AND r.to_entity_type = 'system'
    AND r.to_entity_id = s.id AND r.relation_type = 'gap-system'
);

-- §17.2 / §17.3 system ↔ BS / BF
INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'system', s.id, 'business_service', bs.id, 'system_business_service', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_SYS_SOP','DEMO_SCOR_BS_ANL'),
  ('DEMO_SCOR_SYS_BUD','DEMO_SCOR_BS_SOPC'),
  ('DEMO_SCOR_SYS_ERP','DEMO_SCOR_BS_API'),
  ('DEMO_SCOR_SYS_SUPP','DEMO_SCOR_BS_SOPC'),
  ('DEMO_SCOR_SYS_MES','DEMO_SCOR_BS_STM'),
  ('DEMO_SCOR_SYS_LIMS','DEMO_SCOR_BS_AUD'),
  ('DEMO_SCOR_SYS_WMS_MSK','DEMO_SCOR_BS_3PL'),
  ('DEMO_SCOR_SYS_WMS_KZN','DEMO_SCOR_BS_3PL'),
  ('DEMO_SCOR_SYS_TMS','DEMO_SCOR_BS_LTL'),
  ('DEMO_SCOR_SYS_OMS','DEMO_SCOR_BS_EXP'),
  ('DEMO_SCOR_SYS_RET','DEMO_SCOR_BS_REV'),
  ('DEMO_SCOR_SYS_CMDB','DEMO_SCOR_BS_TRN'),
  ('DEMO_SCOR_SYS_IAM','DEMO_SCOR_BS_API'),
  ('DEMO_SCOR_SYS_MDM','DEMO_SCOR_BS_ANL'),
  ('DEMO_SCOR_SYS_DL','DEMO_SCOR_BS_ANL'),
  ('DEMO_SCOR_SYS_SD','DEMO_SCOR_BS_TRN'),
  ('DEMO_SCOR_SYS_ESB','DEMO_SCOR_BS_API'),
  ('DEMO_SCOR_SYS_KAFKA','DEMO_SCOR_BS_ANL'),
  ('DEMO_SCOR_SYS_BI','DEMO_SCOR_BS_ANL'),
  ('DEMO_SCOR_SYS_MON','DEMO_SCOR_BS_ANL'),
  ('DEMO_SCOR_SYS_BKP','DEMO_SCOR_BS_LEASE'),
  ('DEMO_SCOR_SYS_LOGPORT','DEMO_SCOR_BS_ANL')
) AS v(scode, bscode)
JOIN archrep.ar_systems s ON s.code = v.scode
JOIN archrep.ar_business_services bs ON bs.code = v.bscode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'system' AND r.from_entity_id = s.id AND r.to_entity_type = 'business_service'
    AND r.to_entity_id = bs.id AND r.relation_type = 'system_business_service'
);

INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'system', s.id, 'business_function', bf.id, 'system_business_function', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_SYS_SOP','DEMO_SCOR_BF_L2_FORECAST'),
  ('DEMO_SCOR_SYS_BUD','DEMO_SCOR_BF_L2_BAL'),
  ('DEMO_SCOR_SYS_ERP','DEMO_SCOR_BF_L2_PORT'),
  ('DEMO_SCOR_SYS_SUPP','DEMO_SCOR_BF_L2_CONTRACT'),
  ('DEMO_SCOR_SYS_MES','DEMO_SCOR_BF_L2_RELEASE'),
  ('DEMO_SCOR_SYS_LIMS','DEMO_SCOR_BF_L2_QC'),
  ('DEMO_SCOR_SYS_WMS_MSK','DEMO_SCOR_BF_L2_PICKSHIP'),
  ('DEMO_SCOR_SYS_WMS_KZN','DEMO_SCOR_BF_L2_INBOUND'),
  ('DEMO_SCOR_SYS_TMS','DEMO_SCOR_BF_L3_ROUTE'),
  ('DEMO_SCOR_SYS_OMS','DEMO_SCOR_BF_L2_RESORD'),
  ('DEMO_SCOR_SYS_RET','DEMO_SCOR_BF_L2_RETREG'),
  ('DEMO_SCOR_SYS_CMDB','DEMO_SCOR_BF_L3_INTREG'),
  ('DEMO_SCOR_SYS_IAM','DEMO_SCOR_BF_L2_ITARCH'),
  ('DEMO_SCOR_SYS_MDM','DEMO_SCOR_BF_L3_CLAIM'),
  ('DEMO_SCOR_SYS_DL','DEMO_SCOR_BF_L2_FORECAST'),
  ('DEMO_SCOR_SYS_SD','DEMO_SCOR_BF_L2_INC'),
  ('DEMO_SCOR_SYS_ESB','DEMO_SCOR_BF_L3_INTREG'),
  ('DEMO_SCOR_SYS_KAFKA','DEMO_SCOR_BF_L2_ITARCH'),
  ('DEMO_SCOR_SYS_BI','DEMO_SCOR_BF_L2_FORECAST'),
  ('DEMO_SCOR_SYS_MON','DEMO_SCOR_BF_L2_INC'),
  ('DEMO_SCOR_SYS_BKP','DEMO_SCOR_BF_L2_ITARCH'),
  ('DEMO_SCOR_SYS_LOGPORT','DEMO_SCOR_BF_L2_DELPT')
) AS v(scode, bfcode)
JOIN archrep.ar_systems s ON s.code = v.scode
JOIN archrep.ar_business_functions bf ON bf.code = v.bfcode
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'system' AND r.from_entity_id = s.id AND r.to_entity_type = 'business_function'
    AND r.to_entity_id = bf.id AND r.relation_type = 'system_business_function'
);

-- system_technology / module_technology (явные рёбра для демо)
INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'system', s.id, 'technology', t.id, 'system_technology', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_SYS_WMS_MSK','PostgreSQL'),
  ('DEMO_SCOR_SYS_OMS','Redis'),
  ('DEMO_SCOR_SYS_ERP','1С:ERP'),
  ('DEMO_SCOR_SYS_MES','Python (ETL)'),
  ('DEMO_SCOR_SYS_DL','Kafka'),
  ('DEMO_SCOR_SYS_ESB','RabbitMQ'),
  ('DEMO_SCOR_SYS_TMS','OpenTelemetry'),
  ('DEMO_SCOR_SYS_BI','Power BI'),
  ('DEMO_SCOR_SYS_IAM','Keycloak'),
  ('DEMO_SCOR_SYS_CMDB','Elasticsearch')
) AS v(scode, tname)
JOIN archrep.ar_systems s ON s.code = v.scode
JOIN archrep.ar_technologies t ON lower(trim(t.name)) = lower(trim(v.tname))
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'system' AND r.from_entity_id = s.id AND r.to_entity_type = 'technology'
    AND r.to_entity_id = t.id AND r.relation_type = 'system_technology' AND r.payload @> '{"demo_scor_dataset":"v1"}'::jsonb
);

INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, payload)
SELECT 'subsystem', m.id, 'technology', t.id, 'module_technology', '', '{"demo_scor_dataset":"v1"}'::jsonb
FROM (VALUES
  ('DEMO_SCOR_MOD_TMS_TRK','Kafka'),
  ('DEMO_SCOR_MOD_WMS_MSK_PICK','Redis'),
  ('DEMO_SCOR_MOD_OMS_RES','PostgreSQL'),
  ('DEMO_SCOR_MOD_MES_SENS','Prometheus'),
  ('DEMO_SCOR_MOD_ERP_REQ','SOAP (legacy)'),
  ('DEMO_SCOR_MOD_WMS_MSK_RECV','PostgreSQL'),
  ('DEMO_SCOR_MOD_OMS_IWMS','REST API'),
  ('DEMO_SCOR_MOD_MES_SHIFT','Kafka'),
  ('DEMO_SCOR_MOD_ERP_GRN','1С:ERP'),
  ('DEMO_SCOR_MOD_KFK_CONN','Kafka')
) AS v(mcode, tname)
JOIN archrep.ar_systems m ON m.code = v.mcode
JOIN archrep.ar_technologies t ON lower(trim(t.name)) = lower(trim(v.tname))
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relations r
  WHERE r.from_entity_type = 'subsystem' AND r.from_entity_id = m.id AND r.to_entity_type = 'technology'
    AND r.to_entity_id = t.id AND r.relation_type = 'module_technology' AND r.payload @> '{"demo_scor_dataset":"v1"}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 12) Интеграционные потоки §17.4–17.7 + §9 (доп. 35 корень→корень)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_integration_flows (
  source_ar_systems_id, target_ar_systems_id, transferred_data,
  ar_integration_flow_event_types_id, ar_integration_flow_statuses_id, transfer_method
)
SELECT src.id, tgt.id, 'SCOR_DEMO_REF', 1, 3, 'demo-scor'
FROM (VALUES
  ('DEMO_SCOR_SYS_OMS','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_SYS_WMS_MSK','DEMO_SCOR_SYS_TMS'),
  ('DEMO_SCOR_SYS_TMS','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_SYS_MES','DEMO_SCOR_SYS_ERP'),
  ('DEMO_SCOR_SYS_MDM','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_SYS_MDM','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_SYS_SUPP','DEMO_SCOR_SYS_ERP'),
  ('DEMO_SCOR_SYS_WMS_MSK','DEMO_SCOR_SYS_WMS_KZN'),
  ('DEMO_SCOR_SYS_ERP','DEMO_SCOR_SYS_DL'),
  ('DEMO_SCOR_SYS_WMS_KZN','DEMO_SCOR_SYS_DL'),
  ('DEMO_SCOR_SYS_SOP','DEMO_SCOR_SYS_BI'),
  ('DEMO_SCOR_SYS_BUD','DEMO_SCOR_SYS_ERP'),
  ('DEMO_SCOR_SYS_ESB','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_SYS_KAFKA','DEMO_SCOR_SYS_DL'),
  ('DEMO_SCOR_SYS_SD','DEMO_SCOR_SYS_MON'),
  ('DEMO_SCOR_SYS_LIMS','DEMO_SCOR_SYS_MES'),
  ('DEMO_SCOR_SYS_RET','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_SYS_IAM','DEMO_SCOR_SYS_SUPP'),
  ('DEMO_SCOR_SYS_BKP','DEMO_SCOR_SYS_DL'),
  ('DEMO_SCOR_SYS_LOGPORT','DEMO_SCOR_SYS_BI')
) AS p(scode, tcode)
JOIN archrep.ar_systems src ON src.code = p.scode
JOIN archrep.ar_systems tgt ON tgt.code = p.tcode;

INSERT INTO archrep.ar_integration_flows (source_ar_systems_id, target_ar_systems_id, transferred_data, ar_integration_flow_event_types_id, ar_integration_flow_statuses_id, transfer_method)
SELECT src.id, tgt.id, 'SCOR_DEMO_REF', 1, 3, 'demo-scor-ifsm'
FROM (VALUES
  ('DEMO_SCOR_SYS_OMS','DEMO_SCOR_MOD_WMS_MSK_PICK'),
  ('DEMO_SCOR_SYS_TMS','DEMO_SCOR_MOD_WMS_MSK_SHIP'),
  ('DEMO_SCOR_SYS_ERP','DEMO_SCOR_MOD_MES_SHIFT'),
  ('DEMO_SCOR_SYS_SOP','DEMO_SCOR_MOD_OMS_RES'),
  ('DEMO_SCOR_SYS_ESB','DEMO_SCOR_MOD_TMS_TRK'),
  ('DEMO_SCOR_SYS_MDM','DEMO_SCOR_MOD_WMS_KZN_RECV'),
  ('DEMO_SCOR_SYS_SUPP','DEMO_SCOR_MOD_ERP_GRN'),
  ('DEMO_SCOR_SYS_BI','DEMO_SCOR_MOD_WMS_MSK_INV'),
  ('DEMO_SCOR_SYS_SD','DEMO_SCOR_MOD_OMS_IWMS'),
  ('DEMO_SCOR_SYS_LIMS','DEMO_SCOR_MOD_MES_SCRAP'),
  ('DEMO_SCOR_SYS_BUD','DEMO_SCOR_MOD_ERP_REQ'),
  ('DEMO_SCOR_SYS_DL','DEMO_SCOR_MOD_WMS_MSK_PLC'),
  ('DEMO_SCOR_SYS_MON','DEMO_SCOR_MOD_ESB_ADP'),
  ('DEMO_SCOR_SYS_KAFKA','DEMO_SCOR_MOD_OMS_B2B'),
  ('DEMO_SCOR_SYS_RET','DEMO_SCOR_MOD_OMS_SPLIT'),
  ('DEMO_SCOR_SYS_IAM','DEMO_SCOR_MOD_SUPP_CONF'),
  ('DEMO_SCOR_SYS_BKP','DEMO_SCOR_MOD_WMS_MSK_RECV'),
  ('DEMO_SCOR_SYS_LOGPORT','DEMO_SCOR_MOD_TMS_RT'),
  ('DEMO_SCOR_SYS_WMS_KZN','DEMO_SCOR_MOD_MES_SENS'),
  ('DEMO_SCOR_SYS_MES','DEMO_SCOR_MOD_WMS_KZN_PICK')
) AS p(scode, tcode)
JOIN archrep.ar_systems src ON src.code = p.scode
JOIN archrep.ar_systems tgt ON tgt.code = p.tcode;

INSERT INTO archrep.ar_integration_flows (source_ar_systems_id, target_ar_systems_id, transferred_data, ar_integration_flow_event_types_id, ar_integration_flow_statuses_id, transfer_method)
SELECT src.id, tgt.id, 'SCOR_DEMO_REF', 1, 3, 'demo-scor-ifms'
FROM (VALUES
  ('DEMO_SCOR_MOD_WMS_MSK_PICK','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_MOD_WMS_MSK_SHIP','DEMO_SCOR_SYS_TMS'),
  ('DEMO_SCOR_MOD_MES_SHIFT','DEMO_SCOR_SYS_ERP'),
  ('DEMO_SCOR_MOD_TMS_RT','DEMO_SCOR_SYS_OMS'),
  ('DEMO_SCOR_MOD_OMS_RES','DEMO_SCOR_SYS_WMS_MSK'),
  ('DEMO_SCOR_MOD_WMS_KZN_RECV','DEMO_SCOR_SYS_MDM'),
  ('DEMO_SCOR_MOD_ERP_GRN','DEMO_SCOR_SYS_SUPP'),
  ('DEMO_SCOR_MOD_KFK_CONN','DEMO_SCOR_SYS_DL'),
  ('DEMO_SCOR_MOD_WMS_MSK_INV','DEMO_SCOR_SYS_BI'),
  ('DEMO_SCOR_MOD_MES_SENS','DEMO_SCOR_SYS_LIMS'),
  ('DEMO_SCOR_MOD_WMS_MSK_PLC','DEMO_SCOR_SYS_SOP'),
  ('DEMO_SCOR_MOD_OMS_B2B','DEMO_SCOR_SYS_BUD'),
  ('DEMO_SCOR_MOD_MES_SCRAP','DEMO_SCOR_SYS_RET'),
  ('DEMO_SCOR_MOD_ERP_CTR','DEMO_SCOR_SYS_SD'),
  ('DEMO_SCOR_MOD_WMS_KZN_PICK','DEMO_SCOR_SYS_ESB'),
  ('DEMO_SCOR_MOD_TMS_TRK','DEMO_SCOR_SYS_MON'),
  ('DEMO_SCOR_MOD_OMS_IWMS','DEMO_SCOR_SYS_IAM'),
  ('DEMO_SCOR_MOD_WMS_MSK_RECV','DEMO_SCOR_SYS_BKP'),
  ('DEMO_SCOR_MOD_MES_DEF','DEMO_SCOR_SYS_LIMS'),
  ('DEMO_SCOR_MOD_SUPP_CONF','DEMO_SCOR_SYS_ERP')
) AS p(scode, tcode)
JOIN archrep.ar_systems src ON src.code = p.scode
JOIN archrep.ar_systems tgt ON tgt.code = p.tcode;

INSERT INTO archrep.ar_integration_flows (source_ar_systems_id, target_ar_systems_id, transferred_data, ar_integration_flow_event_types_id, ar_integration_flow_statuses_id, transfer_method)
SELECT src.id, tgt.id, 'SCOR_DEMO_REF', 1, 3, 'demo-scor-ifmm'
FROM (VALUES
  ('DEMO_SCOR_MOD_OMS_IWMS','DEMO_SCOR_MOD_WMS_MSK_PICK'),
  ('DEMO_SCOR_MOD_WMS_MSK_PICK','DEMO_SCOR_MOD_WMS_MSK_PACK'),
  ('DEMO_SCOR_MOD_WMS_MSK_SHIP','DEMO_SCOR_MOD_TMS_TRK'),
  ('DEMO_SCOR_MOD_MES_SHIFT','DEMO_SCOR_MOD_MES_SCRAP'),
  ('DEMO_SCOR_MOD_TMS_TAR','DEMO_SCOR_MOD_OMS_B2B'),
  ('DEMO_SCOR_MOD_WMS_KZN_RECV','DEMO_SCOR_MOD_WMS_KZN_PLC'),
  ('DEMO_SCOR_MOD_ERP_REQ','DEMO_SCOR_MOD_SUPP_CONF'),
  ('DEMO_SCOR_MOD_MES_SENS','DEMO_SCOR_MOD_MES_DEF'),
  ('DEMO_SCOR_MOD_WMS_KZN_PICK','DEMO_SCOR_MOD_WMS_KZN_SHIP'),
  ('DEMO_SCOR_MOD_SD_INT','DEMO_SCOR_MOD_MON_SLA'),
  ('DEMO_SCOR_MOD_OMS_RES','DEMO_SCOR_MOD_OMS_B2B'),
  ('DEMO_SCOR_MOD_TMS_RT','DEMO_SCOR_MOD_TMS_TAR'),
  ('DEMO_SCOR_MOD_TMS_TAR','DEMO_SCOR_MOD_TMS_TRK'),
  ('DEMO_SCOR_MOD_ERP_REQ','DEMO_SCOR_MOD_ERP_CTR'),
  ('DEMO_SCOR_MOD_ERP_CTR','DEMO_SCOR_MOD_ERP_GRN'),
  ('DEMO_SCOR_MOD_WMS_MSK_RECV','DEMO_SCOR_MOD_WMS_MSK_PLC'),
  ('DEMO_SCOR_MOD_WMS_MSK_PLC','DEMO_SCOR_MOD_WMS_MSK_PICK'),
  ('DEMO_SCOR_MOD_WMS_KZN_RECV','DEMO_SCOR_MOD_WMS_KZN_PICK'),
  ('DEMO_SCOR_MOD_MES_SHIFT','DEMO_SCOR_MOD_MES_SENS'),
  ('DEMO_SCOR_MOD_MES_SCRAP','DEMO_SCOR_MOD_MES_SHIFT')
) AS p(scode, tcode)
JOIN archrep.ar_systems src ON src.code = p.scode
JOIN archrep.ar_systems tgt ON tgt.code = p.tcode;

INSERT INTO archrep.ar_integration_flows (source_ar_systems_id, target_ar_systems_id, transferred_data, ar_integration_flow_event_types_id, ar_integration_flow_statuses_id, transfer_method)
SELECT o.id, w.id, 'SCOR_DEMO_REF', 1, 3, 'demo-scor-extra'
FROM generate_series(1, 35) g
JOIN archrep.ar_systems o ON o.code = 'DEMO_SCOR_SYS_OMS'
JOIN archrep.ar_systems w ON w.code = 'DEMO_SCOR_SYS_WMS_MSK';

-- Проекции integration_flow* в ar_metamodel_relations создаются триггером INSERT на ar_integration_flows.
