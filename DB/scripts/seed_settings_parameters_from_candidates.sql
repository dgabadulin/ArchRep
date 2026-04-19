-- Вставка параметров из docs/settings-parameters-candidates.md в archrep.ar_settings_parameters.
-- Запуск: psql -h ... -U ... -d ... -f DB/scripts/seed_settings_parameters_from_candidates.sql
-- При существующем code запись не перезаписывается (ON CONFLICT DO NOTHING).

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES
  (
    'ARR_SERVER_PORT',
    'Порт, на котором слушает BFF/API. При пустом — из env SERVER_PORT или 3000.',
    '3000',
    'number',
    'Система',
    false,
    false
  ),
  (
    'GAP_CODE_PREFIX',
    'Префикс кода при автогенерации записи реестра архитектурного долга (например GAP-1, GAP-2).',
    'GAP-',
    'string',
    'Арх.долг',
    false,
    false
  ),
  (
    'ADR_ADRP_PREFIX',
    'Префикс кода при создании архитектурного решения по принципу (ADRP-1, …).',
    'ADRP-',
    'string',
    'ADR',
    false,
    false
  ),
  (
    'ADR_ADRA_PREFIX',
    'Префикс кода при создании архитектурного заключения (ADRA-1, …).',
    'ADRA-',
    'string',
    'ADR',
    false,
    false
  ),
  (
    'GRAPH_LAYOUT_DEF',
    'Раскладка графа зависимостей по умолчанию при построении: star, grid, ring (и др., если поддерживаются).',
    'star',
    'string',
    'Граф',
    false,
    false
  ),
  (
    'GRAPH_MAX_NODES',
    'Максимальное число узлов на графе; при превышении — предупреждение или ограничение построения.',
    '200',
    'number',
    'Граф',
    false,
    false
  ),
  (
    'GRAPH_EDGE_FONTSZ',
    'Размер шрифта подписей рёбер на графе (px).',
    '10',
    'number',
    'Граф',
    false,
    false
  ),
  (
    'GRAPH_VIEWBOX_MIN',
    'Минимальная сторона viewBox графа (px); при меньшем размере граф масштабируется.',
    '500',
    'number',
    'Граф',
    false,
    false
  ),
  (
    'ADR_CODE_MAXLEN',
    'Максимальная длина кода инкремента/заключения в форме арх.заключений.',
    '15',
    'number',
    'ADR',
    false,
    false
  ),
  (
    'ADR_FLOW_STATUS_MAP',
    'JSON: код статуса связи инкремента (ar_adr_increment_relation_statuses.code) → код статуса потока (ar_integration_flow_statuses.code). Legacy: русские имена → числовой id потока.',
    '{"ADR_INCR_REL_CREATING":"FLOW_STATUS_PLANNED","ADR_INCR_REL_MODIFYING":"FLOW_STATUS_PRODUCTION","ADR_INCR_REL_IN_USE":"FLOW_STATUS_PRODUCTION","ADR_INCR_REL_REMOVING":"FLOW_STATUS_EXCLUDED","ADR_INCR_REL_PLANNED":"FLOW_STATUS_PLANNED","ADR_INCR_REL_IMPLEMENTING":"FLOW_STATUS_IN_PROGRESS","ADR_INCR_REL_DONE":"FLOW_STATUS_PRODUCTION"}',
    'json',
    'ADR',
    false,
    false
  ),
  (
    'ADR_APPROVED_STATUS_CODES',
    'Коды статусов заключения (ar_adr_statuses.code), при переходе на которые создаются записи в реестре интеграционных потоков.',
    '["ADR_STATUS_APPROVED_ARCH","ADR_STATUS_APPROVED_COUNCIL"]',
    'json',
    'ADR',
    false,
    false
  ),
  (
    'ADR_DRAFT_STATUS_CODE',
    'Код статуса «черновик» в ar_adr_statuses (полное редактирование заключения только в нём).',
    'ADR_STATUS_DRAFT',
    'string',
    'ADR',
    false,
    false
  ),
  (
    'GRAPH_ENTITY_ORDER',
    'Список кодов типов сущностей в порядке отображения в выборе графа.',
    '["system","subsystem","technology","organization_unit","actor","business_service","business_function","principle"]',
    'string_list',
    'Граф',
    false,
    false
  ),
  (
    'ARR_APP_BASE',
    'Базовый URL-путь фронта (для ссылок и конфигурации; сборка использует base из vite).',
    '/',
    'string',
    'Система',
    false,
    false
  ),
  (
    'ARR_MENU_COOKIE',
    'Имя cookie, в котором хранится состояние свёрнутости пунктов меню.',
    'ar-v3-menu-expanded',
    'string',
    'Система',
    false,
    false
  ),
  (
    'ARR_COLS_COOKIE',
    'Префикс имени cookie для сохранения видимых колонок таблиц.',
    'ar_cols_',
    'string',
    'Система',
    false,
    false
  ),
  (
    'ARR_SORT_COOKIE',
    'Префикс имени cookie для сохранения сортировки таблиц.',
    'ar_sort_',
    'string',
    'Система',
    false,
    false
  ),
  (
    'ARR_COOKIE_MAX_DAYS',
    'Срок жизни cookie колонок/сортировки в днях.',
    '365',
    'number',
    'Система',
    false,
    false
  ),
  (
    'SYS_CODE_MAXLEN',
    'Максимальная длина кода ИС в форме каталога систем.',
    '32',
    'number',
    'Системы',
    false,
    false
  ),
  (
    'ARR_EXCEL_SHEET',
    'Имя листа в выгружаемых Excel-файлах, когда не задано явно (fallback).',
    'Sheet1',
    'string',
    'Система',
    false,
    false
  ),
  (
    'ARR_SEARCH_PLACEHOLDER',
    'Текст по умолчанию в поле поиска таблиц (если не переопределён на экране).',
    'Поиск по всем полям таблицы',
    'string',
    'Система',
    false,
    false
  ),
  (
    'ARR_FRONTEND_V3_PATH',
    'Каталог статики веб-интерфейса (относительно cwd сервера).',
    'frontend-v3-dist',
    'string',
    'Система',
    false,
    false
  ),
  (
    'GRAPH_ENTITY_ICONS',
    'JSON: для каждого кода типа сущности — объект с полями icon (имя иконки Lucide: Monitor, Cpu, …), label, listLabel. Влияет на отображение узлов в Анализаторе зависимостей.',
    '{"system":{"label":"Информационная система","icon":"Monitor","listLabel":"ИС"},"subsystem":{"label":"Модуль системы","icon":"Puzzle","listLabel":"Модули систем"},"technology":{"label":"Технология","icon":"Cpu","listLabel":"Технологии"},"organization_unit":{"label":"Организационная единица","icon":"Building2","listLabel":"Орг. единицы"},"actor":{"label":"Актор","icon":"User","listLabel":"Акторы"},"business_service":{"label":"Бизнес-сервис (продукт)","icon":"Package","listLabel":"Продукты"},"business_function":{"label":"Бизнес-функция","icon":"GitBranch","listLabel":"Бизнес-способности"},"principle":{"label":"Принцип","icon":"Scale","listLabel":"Принципы"}}',
    'json',
    'Граф',
    false,
    false
  ),
  (
    'GRAPH_COLLAPSED_SYSTEM_ICON',
    'Имя компонента Lucide для узла ИС на графе анализатора при свёртке модулей в систему (issue #48). Пример: MonitorDot.',
    'MonitorDot',
    'string',
    'Граф',
    false,
    false
  ),
  ('DISP_SYSTEM_TEMPLATE','Шаблон именования в списках выбора систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_SUBSYSTEM_TEMPLATE','Шаблон именования в списках выбора модулей систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_TECHNOLOGY_TEMPLATE','Шаблон именования в списках выбора технологий для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_PARTNER_TEMPLATE','Шаблон именования в списках выбора партнеров для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_OWNER_TEMPLATE','Шаблон именования в списках выбора владельцев систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_HOSTING_TYPE_TEMPLATE','Шаблон именования в списках выбора типов хостинга для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_SYSTEM_STATUS_TEMPLATE','Шаблон именования в списках выбора статусов систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_TECH_CLASS_TEMPLATE','Шаблон именования в списках выбора классов технологий для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_TECH_TYPE_TEMPLATE','Шаблон именования в списках выбора типов технологий для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_TECH_STATUS_TEMPLATE','Шаблон именования в списках выбора статусов технологий для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ADR_STATUS_TEMPLATE','Шаблон именования в списках выбора статусов ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ADR_SYSTEM_STATUS_TEMPLATE','Шаблон именования в списках выбора статусов систем в инкрементах ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ADR_REL_STATUS_TEMPLATE','Шаблон именования в списках выбора статусов связей инкрементов ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ADR_INCREMENT_TYPE_TEMPLATE','Шаблон именования в списках выбора типов инкрементов ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ADRP_TEMPLATE','Шаблон именования в списках выбора принципиальных ADR для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ADRA_TEMPLATE','Шаблон именования в списках выбора архитектурных заключений для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{task_name}','string','Display',false,false),
  ('DISP_GAP_TEMPLATE','Шаблон именования в списках выбора архитектурных долгов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_GAP_TYPE_TEMPLATE','Шаблон именования в списках выбора типов архитектурного долга для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_IMPACT_LEVEL_TEMPLATE','Шаблон именования в списках выбора уровней влияния для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_GAP_STATE_TEMPLATE','Шаблон именования в списках выбора состояний долга для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_FLOW_EVENT_TYPE_TEMPLATE','Шаблон именования в списках выбора типов событий интеграций для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_FLOW_STATUS_TEMPLATE','Шаблон именования в списках выбора статусов интеграционных потоков для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ORG_UNIT_TEMPLATE','Шаблон именования в списках выбора орг. единиц для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ORG_UNIT_CATEGORY_TEMPLATE','Шаблон именования в списках выбора категорий орг. единиц для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ACTOR_TEMPLATE','Шаблон именования в списках выбора акторов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_ACTOR_TYPE_TEMPLATE','Шаблон именования в списках выбора типов акторов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_BUSINESS_SERVICE_TEMPLATE','Шаблон именования в списках выбора бизнес-сервисов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_BUSINESS_SERVICE_STATUS_TEMPLATE','Шаблон именования в списках выбора статусов бизнес-сервисов для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_BUSINESS_FUNCTION_TEMPLATE','Шаблон именования в списках выбора бизнес-функций для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_META_ENTITY_TYPE_TEMPLATE','Шаблон именования в списках выбора типов сущностей метамодели для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  ('DISP_META_REL_TYPE_TEMPLATE','Шаблон именования в списках выбора типов связей метамодели для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )','{name}','string','Display',false,false),
  (
    'DISP_INTEGRATION_FLOW_NAME',
    'Шаблон подписи ребра метамодели для проекции интеграционного потока (ar_metamodel_relations.displayed_name). Плейсхолдеры: {source_name},{target_name},{source_code},{target_code},{status_name},{event_type_name},{transferred_data},{transfer_method},{periodicity},{id}. Условные блоки [[...]] как у других DISP. См. docs/metamodel-projection-ar-integration-flows.md',
    '{source_name} → {target_name} [{status_name}]',
    'string',
    'Display',
    false,
    false
  ),
  (
    'ARR_HOME_KPI_TILES',
    'JSON-массив KPI главной страницы: titleTpl, countFn (archrep.dashboard_home_*), footerTpl, footerFn, icon (ключ из menu icons). См. docs/home-dashboard-catalog-metrics.md',
    '[{"titleTpl":"Информационные системы","countFn":"archrep.dashboard_home_systems_total","footerTpl":"в т.ч. {n} подсистем и модулей","footerFn":"archrep.dashboard_home_systems_with_parent","icon":"desktop"},{"titleTpl":"Интеграционные потоки","countFn":"archrep.dashboard_home_integration_flows","footerTpl":null,"footerFn":null,"icon":"share"},{"titleTpl":"Технологические компоненты","countFn":"archrep.dashboard_home_technologies_total","footerTpl":"в т.ч. {n} иностранных","footerFn":"archrep.dashboard_home_technologies_foreign_null_flag","icon":"radar"},{"titleTpl":"Архитектурные отклонения","countFn":"archrep.dashboard_home_gaps_total","footerTpl":"в т.ч. {n} закрытых","footerFn":"archrep.dashboard_home_gaps_closed","icon":"debt"}]',
    'json',
    'Система',
    false,
    false
  )
ON CONFLICT (code) DO NOTHING;
