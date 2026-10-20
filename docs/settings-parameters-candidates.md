# Кандидаты констант для выноса в параметры

Анализ кода: константы, которые целесообразно вынести в «Настройки → Параметры».  
Имена параметров: префикс по модулю (ARR — общесистемный, SYS — системы, GAP — долг, ADR — решения/заключения, GRAPH — граф/аналитика), длина до 20 символов, UPPERCASE, слова через подчёркивание.

| Имя константы в коде | Где используется | Предлагаемое имя параметра | Описание (на что влияет) | Значение для сохранения в параметры |
|----------------------|------------------|----------------------------|---------------------------|-------------------------------------|
| Порт HTTP-сервера | `backend/index.js`: `process.env.SERVER_PORT \|\| 3000` | **ARR_SERVER_PORT** | Порт, на котором слушает BFF/API. При пустом — из env SERVER_PORT или 3000. | `3000` |
| Префикс кода записи арх.долга | `backend/queries.js`: `'GAP-' \|\| nextval(...)` при INSERT в ar_gaps | **GAP_CODE_PREFIX** | Префикс кода при автогенерации записи реестра архитектурного долга (например GAP-1, GAP-2). | `GAP-` |
| Префикс кода ADR (принцип) | `backend/queries.js`: `'ADRP-' \|\| nextval(...)` при INSERT в ar_adrs_principle | **ADR_ADRP_PREFIX** | Префикс кода при создании архитектурного решения по принципу (ADRP-1, …). | `ADRP-` |
| Префикс кода арх.заключения | `backend/queries.js`: `'ADRA-' \|\| nextval(...)` при INSERT в ar_adrs_applied | **ADR_ADRA_PREFIX** | Префикс кода при создании архитектурного заключения (ADRA-1, …). | `ADRA-` |
| Раскладка графа по умолчанию | `frontend-v3/src/views/AnalyticsView.vue`: при одном выбранном узле вызывается `applyLayout('star', centerId)`, иначе `applyLayout('grid')` | **GRAPH_LAYOUT_DEF** | Раскладка графа зависимостей по умолчанию при построении: star, grid, ring (и др., если поддерживаются). | `star` |
| Максимум узлов на графе | В коде явно не задан; в `docs/settings-parameters-design.md` указан пример 200 | **GRAPH_MAX_NODES** | Максимальное число узлов на графе; при превышении — предупреждение или ограничение построения. | `200` |
| Размер шрифта подписей рёбер | `frontend-v3/src/components/AnalyzerGraph.vue`: `fontSize: 10` в конфиге рёбер | **GRAPH_EDGE_FONTSZ** | Размер шрифта подписей рёбер на графе (px). | `10` |
| Минимальный размер viewBox | `frontend-v3/src/components/AnalyzerGraph.vue`: `MIN_VIEWBOX = 500` при масштабировании | **GRAPH_VIEWBOX_MIN** | Минимальная сторона viewBox графа (px); при меньшем размере граф масштабируется. | `500` |
| Макс. длина кода инкремента/заключения | `frontend-v3/src/views/DecisionAppliedForm.vue`: `maxlength="15"`, `slice(0, 15)` для кода | **ADR_CODE_MAXLEN** | Максимальная длина кода инкремента/заключения в форме арх.заключений. | `15` |
| Маппинг статуса связи инкремента → статус потока | `backend/index.js` + `ar_adr_increment_relation_statuses.code` / `ar_integration_flow_statuses.code` | **ADR_FLOW_STATUS_MAP** | JSON: **код** статуса связи → **код** статуса потока (issue #31). | `{"ADR_INCR_REL_CREATING":"FLOW_STATUS_1",...}` |
| Статусы «утверждено» (коды) | `backend/index.js` — сравнение с `ar_adr_statuses.code` | **ADR_APPROVED_STATUS_CODES** | Список **кодов** статусов заключения; при смене на один из них создаются потоки. | `["ADR_STATUS_APPROVED_ARCH","ADR_STATUS_APPROVED_COUNCIL"]` |
| Статус «черновик» (код) | `backend/index.js` | **ADR_DRAFT_STATUS_CODE** | **Код** статуса черновика в `ar_adr_statuses`. | `ADR_STATUS_DRAFT` |
| Порядок типов сущностей в графе | `frontend-v3/src/views/AnalyticsView.vue`: `entityTypeOrder` — порядок в выпадающем списке «Тип сущности» в Анализаторе | **GRAPH_ENTITY_ORDER** | Список кодов типов сущностей в порядке отображения в выборе графа. | `system,technology,organization_unit,actor,business_service,business_function,principle` (или string_list) |
| Базовый путь приложения | `frontend-v3/vite.config.js`: `base: '/'`; роутер: `createWebHistory(import.meta.env.BASE_URL)` | **ARR_APP_BASE** | Базовый URL-путь (конфиг с бэкенда; роутер берёт base из сборки). | `/` |
| Имя cookie свёрнутого меню | `frontend-v3/src/views/LayoutV3.vue`: `COOKIE_NAME = 'ar-v3-menu-expanded'` | **ARR_MENU_COOKIE** | Имя cookie, в котором хранится состояние свёрнутости пунктов меню. | `ar-v3-menu-expanded` |
| Префикс cookie колонок таблиц | `frontend-v3/src/utils/tableColumns.js`: `COOKIE_PREFIX = 'ar_cols_'` | **ARR_COLS_COOKIE** | Префикс имени cookie для сохранения видимых колонок таблиц. | `ar_cols_` |
| Префикс cookie сортировки | `frontend-v3/src/utils/tableColumns.js`: `SORT_COOKIE_PREFIX = 'ar_sort_'` | **ARR_SORT_COOKIE** | Префикс имени cookie для сохранения сортировки таблиц. | `ar_sort_` |
| Срок хранения cookie (дни) | `frontend-v3/src/utils/tableColumns.js`: `COOKIE_MAX_AGE = 365*24*60*60` | **ARR_COOKIE_MAX_DAYS** | Срок жизни cookie колонок/сортировки в днях. | `365` |
| Макс. длина кода системы | `frontend-v3/src/views/SystemForm.vue`: `maxlength="32"` у поля «Код» | **SYS_CODE_MAXLEN** | Максимальная длина кода ИС в форме каталога систем. | `32` |
| Имя листа Excel по умолчанию | `backend/excelHelper.js`: `sheetName = 'Sheet1'` в `buildExcelBuffer` (если лист не передан, используется это) | **ARR_EXCEL_SHEET** | Имя листа в выгружаемых Excel-файлах, когда не задано явно (в коде у каждого экспорта своё имя — параметр для общего fallback). | `Sheet1` |
| Плейсхолдер поиска по умолчанию | `frontend-v3/src/components/TableToolbar.vue`: `searchPlaceholder` default; во многих списках задаётся явно «Поиск по всем полям таблицы» | **ARR_SEARCH_PLACEHOLDER** | Текст по умолчанию в поле поиска таблиц (если не переопределён на экране). | `Поиск по всем полям таблицы` |
| Путь каталога статики UI (BFF) | `backend/index.js`: `mountFrontendStatic` — только **ARR_FRONTEND_V3_PATH** | **ARR_FRONTEND_V3_PATH** | Каталог сборки фронта (относительно cwd сервера). | `frontend-v3-dist` |
| Иконки и подписи типов сущностей на графе | `frontend-v3/src/utils/entityTypeConfig.js`: для каждого типа сущности (system, technology, …) — icon (имя компонента Lucide), label, listLabel | **GRAPH_ENTITY_ICONS** | JSON: для каждого кода типа сущности — объект с полями icon (имя иконки Lucide: Monitor, Cpu, …), label, listLabel. Влияет на отображение узлов в Анализаторе зависимостей. | `{"system":{"label":"Информационная система","icon":"Monitor","listLabel":"ИС"},"system_child":{"label":"Дочерняя система (в составе родителя)","icon":"Server","listLabel":"ИС (дочерняя)"},"technology":{"label":"Технология","icon":"Cpu","listLabel":"Технологии"},"organization_unit":{"label":"Организационная единица","icon":"Building2","listLabel":"Орг. единицы"},"actor":{"label":"Актор","icon":"User","listLabel":"Акторы"},"business_service":{"label":"Бизнес-сервис (продукт)","icon":"Package","listLabel":"Продукты"},"business_function":{"label":"Бизнес-функция","icon":"GitBranch","listLabel":"Бизнес-способности"},"principle":{"label":"Принцип","icon":"Scale","listLabel":"Принципы"}}` |
| Иконка свёрнутой системы (модули) на графе | `frontend-v3/src/views/AnalyzerGraph.vue`: при свёрнутых модулях узел системы рисуется с `iconOverride` | **GRAPH_COLLAPSED_SYSTEM_ICON** | Имя компонента Lucide для узла системы, когда включено «Свернуть модули» (issue #48). Должно совпадать с экспортом из `lucide-vue-next`. | `MonitorDot` |
| KPI-плитки объёма каталога на главной | `docs/home-dashboard-catalog-metrics.md` | **ARR_HOME_KPI_TILES** | JSON-массив плиток: шаблоны заголовка/подвала + имена функций `archrep` для первой и второй цифры (`countFn`, `footerFn`). См. спецификацию. | Массив из четырёх элементов (системы, потоки, технологии, долг) по примеру в документе |
| Шаблон подписи проекции потока в метамодели | `docs/metamodel-projection-ar-integration-flows.md` (issue #33) | **DISP_INTEGRATION_FLOW_NAME** | Как у DISP: whitelist плейсхолдеров и `[[...]]` в `validateTemplateValue` (`backend/displayName.js`); в БД — подстановка `{source_name}` и др. в `integration_flow_metamodel_displayed_name`. | `{source_name} → {target_name} [{status_name}]` |

### Вынесено в параметры (issue #91): статусы контура заключения и лимиты ИИ

Статусы «в решении» и лимиты черновика перестали быть строками в коде. Источник значений —
`DB/scripts/migrate_20261006120000_adr_increment_status_params.sql` (и парная миграция
`DB/migrations/20261006120000_adr_increment_status_params.js`); после применения нужен перезапуск backend.

| Имя константы в коде | Где используется | Предлагаемое имя параметра | Описание (на что влияет) | Значение для сохранения в параметры |
|----------------------|------------------|----------------------------|---------------------------|-------------------------------------|
| `'ADR_INCR_SYS_CREATING'` (строка в `createSystemFromNew`), `NEW_SYSTEM_STATUS_CODE` (Vue) | `backend/index.js`, `backend/ai/tools.js`, `frontend-v3/src/views/DecisionAppliedForm.vue` | **ADR_INCR_SYS_NEW_STATUS_CODE** | Код статуса «в решении» для новой системы заключения: подставляется при сохранении структуры и в черновике ИИ. | `ADR_INCR_SYS_CREATING` |
| `'ADR_INCR_SYSFUNC_CREATING'` (строка) | `backend/index.js`, `frontend-v3/src/views/DecisionAppliedForm.vue` | **ADR_INCR_SYSFUNC_NEW_STATUS_CODE** | Код статуса «в решении» для новых функций системы заключения. | `ADR_INCR_SYSFUNC_CREATING` |
| Эвристика «применяется» по имени статуса | `frontend-v3/src/views/DecisionAppliedForm.vue` (`defaultApplyStatusId`) | **ADR_INCR_SYS_DEFAULT_STATUS_CODE** | Статус по умолчанию для системы, которая уже есть в реестре (пикер «Статус» на форме заключения). Раньше искался по подстроке в названии и не находился, если статуса с таким названием нет. | `ADR_INCR_SYS_IN_USE` |
| `'ADR_INCR_REL_CREATING'` (строка) | `backend/index.js`, `frontend-v3/src/components/IncrementRelationsModal.vue`, `backend/ai/tools.js` | **ADR_INCR_REL_NEW_STATUS_CODE** | Код статуса связи «в решении» для новых интеграций. | `ADR_INCR_REL_CREATING` |
| `'ADR_INCR_REL_IN_USE'` (строка) | `frontend-v3/src/components/IncrementRelationsModal.vue` | **ADR_INCR_REL_EXISTING_STATUS_CODE** | Код статуса связи для уже существующего потока реестра (модалка интеграций). | `ADR_INCR_REL_IN_USE` |
| `s.name !== 'Черновик'` | `frontend-v3/src/views/DecisionAppliedForm.vue` (`isStatusReadOnly`), `backend/index.js` (`PUT /full`) | **ADR_EDITABLE_STATUS_CODES** | JSON-массив кодов статусов заключения, при которых разрешено править решения, системы и связи. Дефолт воспроизводит прежнее правило; проверяют и форма, и сервер. | `["ADR_STATUS_DRAFT"]` |
| `'FLOW_STATUS_1'` (fallback) | `backend/index.js` (`resolveFlowStatusIdForRelation`), `backend/refCodes.js` | **ADR_FLOW_DEFAULT_STATUS_CODE** | Код статуса потока, применяемый, когда статус связи не описан в `ADR_FLOW_STATUS_MAP`. | `FLOW_STATUS_1` |
| Молчаливый fallback маппингов | `backend/refCodes.js` (`resolveStatusIdFromMap`, `resolveFlowStatusIdFromMap`) | **ADR_STATUS_MAP_STRICT** | `false` — статус по умолчанию подставляется, а расхождение параметра и справочника пишется в консоль (`[refCodes] …`); `true` — статус реестра не меняется. | `false` |
| `10` решений в черновике | `backend/ai/tools.js` (схема `appliedIncrementsSchema`, `normalizeAppliedIncrementsDraft`) | **SYS_AI_PREFILL_MAX_INCREMENTS** | Лимит решений в структурном черновике. Используется ИИ-архитектором при генерации ADR. | `10` |
| `30` систем в решении | `backend/ai/tools.js` | **SYS_AI_PREFILL_MAX_SYSTEMS** | Лимит систем в одном решении черновика. Используется ИИ-архитектором при генерации ADR. | `30` |
| `20` функций у системы | `backend/ai/tools.js` | **SYS_AI_PREFILL_MAX_FUNCTIONS** | Лимит новых функций у одной системы черновика. Используется ИИ-архитектором при генерации ADR. | `20` |
| `30` связей в решении | `backend/ai/tools.js` | **SYS_AI_PREFILL_MAX_RELATIONS** | Лимит связей в одном решении черновика. Используется ИИ-архитектором при генерации ADR. | `30` |
| `5000` символов JSON черновика | `backend/ai/tools.js` (`draftBudget`) | **SYS_AI_PREFILL_MAX_JSON_CHARS** | Бюджет структурной части черновика по размеру JSON (черновик открывается ссылкой `?payload=`). Используется ИИ-архитектором при генерации ADR. | `5000` |
| `50` id в фокусе экрана | `backend/ai/tools.js` (`SCREEN_FOCUS_MAX_IDS`), `frontend-v3/src/views/AnalyticsView.vue` (`DEEPLINK_MAX_IDS`) | **SYS_AI_FOCUS_MAX_IDS** | Максимум id в фокусе экрана «Анализ зависимостей» для действия `open_view`. | `50` |

---

## Примечания

1. **Приоритет значений** (по документу): переменные окружения → параметры из БД → значения по умолчанию в коде. Параметр **ARR_SERVER_PORT** дублирует env SERVER_PORT и позволяет менять порт через UI без перезапуска, если приложение будет читать параметры из БД с нужным приоритетом.

2. **Префиксы кодов (GAP, ADR)** хранятся в БД при создании записи; смена параметра влияет только на новые записи.

3. **GRAPH_*** — параметры графа на фронте**: для применения нужна загрузка параметров (например, отдельный API или включение в общий конфиг при старте приложения).

4. Константы, которые **не выносил** в таблицу как малоприоритетные для параметризации:
   - HTTP-коды ответов (500, 404 и т.д.);
   - чисто визуальные константы (отступы, цвета, размеры кнопок);
   - служебные лимиты SQL (например, `LIMIT 1` в проверках существования).

5. **Иконки графа**: **GRAPH_ENTITY_ICONS** (json) — как в п. выше; **GRAPH_COLLAPSED_SYSTEM_ICON** (string) — иконка узла системы при свёрнутых модулях. Значения приходят с бэкенда из `ar_settings_parameters`; при отсутствии строки в БД бэкенд подставляет `MonitorDot` для `/api/config`. Имена icon — как у компонентов Lucide.

6. **Конфиги сборки** (vite `base`, `port`, `proxy`): задаются при сборке и в dev; для production base уже можно подставлять из **ARR_APP_BASE**, если фронт получает конфиг с бэкенда при старте.

7. **Статусы и лимиты контура заключения (issue #91)**: группа `ADR` — `ADR_INCR_SYS_NEW_STATUS_CODE`, `ADR_INCR_SYSFUNC_NEW_STATUS_CODE`, `ADR_INCR_SYS_DEFAULT_STATUS_CODE`, `ADR_INCR_REL_NEW_STATUS_CODE`, `ADR_INCR_REL_EXISTING_STATUS_CODE`, `ADR_EDITABLE_STATUS_CODES`, `ADR_FLOW_DEFAULT_STATUS_CODE`, `ADR_STATUS_MAP_STRICT`; группа «ИИ-архитектор» — `SYS_AI_PREFILL_MAX_INCREMENTS` / `_SYSTEMS` / `_FUNCTIONS` / `_RELATIONS` / `_JSON_CHARS`, `SYS_AI_FOCUS_MAX_IDS` (последние используются **только** алгоритмами агента — это указано в их описании). Значения читаются через `getParam` (`backend/settingsParams.js`), кэш параметров загружается при старте → **после правки параметра нужен перезапуск backend**. Легаси-параметры `ADR_APPROVED_NAMES` и `ADR_DRAFT_STATUS` (сравнение по именам, issue #31) код не читает — они **удалены** миграцией `DB/scripts/migrate_20261006120000_adr_increment_status_params.sql` (раздел 3); откат миграции возвращает их с исходными значениями.
