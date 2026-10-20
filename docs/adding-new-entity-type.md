# Добавление нового типа сущности в ИСАР

Документ описывает, что нужно согласовать в **данных**, **параметрах**, **бэкенде**, **фронте** и **анализаторе зависимостей**, когда появляется новый **логический тип объекта** (новая строка в `ar_metamodel_entity_types` и/или новая доменная сущность с собственной таблицей и экранами).

Различают три ситуации:

| Ситуация | Смысл |
|----------|--------|
| **A. Полноценный новый тип** | Новый `code` в `ar_metamodel_entity_types`, своя таблица (или существующая), CRUD API, списки в формах, участие в графе по связям `ar_metamodel_relations`. |
| **B. Новый тип связи между уже существующими типами** | Меняется/добавляется запись в `ar_metamodel_relation_types` (и при необходимости бизнес-логика), без новой сущности-каталога. |
| **C. «Псевдотип» на том же API** | Один и тот же REST-ресурс (например `/api/ar-systems`), но в метамодели и на графе различаются роли (`system` vs `subsystem`). Требуются фильтры запросов и отдельный ключ в `ENTITY_TO_TEMPLATE` / иконках. |

Ниже — ориентир на случай **A**; пункты **B** и **C** отмечены отдельно.

---

## 1. Данные и справочники метамодели

### 1.1. Тип сущности (`ar_metamodel_entity_types`)

- Добавить строку с уникальным **`code`** (латиница, snake_case, совпадает с кодом в API графа и в связях).
- Заполнить **`name`**, при необходимости **`table_name`**, **`description`**.
- Способ вставки: UI **«Справочники» → типы сущностей метамодели** (`ReferencesV2.vue`) или SQL.

**Поведение:** после появления записи форма **«Связь метамодели»** автоматически покажет новый тип в списках «От» / «К» (данные приходят с API `/api/togaf/entity-types`).

### 1.2. Типы связей (`ar_metamodel_relation_types`)

Для каждой **допустимой ориентированной пары** «тип от» → «тип к», для которой пользователю разрешено создавать связи вручную или они создаются системой:

- Добавить строку с **`code`** типа связи (уникален в паре **code + from_entity_type_id + to_entity_type_id**).
- Указать **`from_entity_type_id`** и **`to_entity_type_id`** (FK на `ar_metamodel_entity_types`).

Если новый тип сущности **только** выступает концом связи, всё равно нужны строки типов связей, где он участвует как **from** или **to**, иначе в форме связи комбинация может быть недоступна или семантически пуста.

**Поведение формы связи:** выпадающий список «Тип связи» строится из справочника; пользователь выбирает пару типов сущностей и подходящий тип связи. Имеет смысл задать понятное **`name`** / описание у типа связи.

### 1.3. Экземпляры связей (`ar_metamodel_relations`)

Данные появляются из UI списка связей / импорта / триггеров (как для `system_module`). Новый тип сущности начинает отображаться на графе, когда в `ar_metamodel_relations` есть строки с `from_entity_type` / `to_entity_type`, равными новому `code` (значения должны быть согласованы с метамоделью).

---

## 2. Доменный слой: таблица и API

### 2.1. Таблица и миграция

- Спроектировать таблицу в схеме `archrep` (или принять существующую), индексы, FK на справочники.
- Зафиксировать DDL в `DB/schema/…sql` (и при необходимости скрипты в `DB/scripts/`).

### 2.2. Backend (`backend/queries.js`, `backend/index.js`)

- SQL для списка, одной записи, вставки, обновления, удаления (по принятой политике).
- Маршруты `GET/POST/PUT/DELETE` по аналогии с другими сущностями.
- Для списков и карточек, отдаваемых в UI **выпадающих списков**, желательно обогащать ответ полем **`display_name`** (см. п. 3).

### 2.3. Отображаемые имена (`backend/displayName.js`)

1. Добавить параметр шаблона **`DISP_<НОВЫЙ>_TEMPLATE`** в **`TEMPLATE_DEFS`**:
   - **`fields`** — белый список полей, которые можно использовать в `{placeholder}` (см. `docs/display-name-templates-spec.md`).
   - **`fallback`** — строка по умолчанию, если параметр в БД не задан.
2. В **`ENTITY_TO_TEMPLATE`** сопоставить **ключ сущности** (тот же смысл, что и в `DISPLAY_NAME_PATHS`) с кодом параметра `DISP_*`.

Без этого шага API может отдавать сущности без консистентного `display_name`.

### 2.4. Автоподстановка `display_name` в ответах GET

В **`backend/index.js`** в массиве **`DISPLAY_NAME_PATHS`** добавить пару: **регулярное выражение пути** (список и запись по id) и **ключ сущности** для `applyDisplayName`.

Паттерн должен совпадать с тем, как Express видит `req.path` (например `/api/...`).

**Исключения:** если для одного URL разные строки требуют **разных** шаблонов (как системы с родителем → модуль), обработку делают в хендлере вручную (`applyDisplayName(row, 'subsystem' | 'system')`), а не только через общий middleware.

### 2.5. Валидация параметра в UI настроек

На экране **«Настройки → Параметры»** пользователь создаёт и редактирует строки `ar_settings_parameters`. Для кодов, начинающихся с **`DISP_`**, значение — это **шаблон отображаемого имени** (`{поле}`, условные блоки `[[...]]`, см. `display-name-templates-spec.md`). Чтобы в базу не попадали некорректные шаблоны, бэкенд **перед записью** выполняет проверку.

**Где в коде.** В **`POST /api/settings-parameters`** и **`PUT /api/settings-parameters/:id`** (`backend/index.js`): если `code` начинается с `DISP_`, вызывается **`validateTemplateValue(code, value)`** из **`backend/displayName.js`**. При ошибке API отвечает **HTTP 400** с телом `{ error: "<текст>" }`, запись **не сохраняется**.

**Что именно проверяется:**

1. **Известен ли код параметра** — для переданного `code` должен существовать объект в **`TEMPLATE_DEFS`**. Если параметр завели в БД (например `DISP_WIDGET_TEMPLATE`), но не добавили его в **`TEMPLATE_DEFS`**, сохранение через UI вернёт ошибку вида `Unknown template code: DISP_WIDGET_TEMPLATE`.
2. **Синтаксис условных блоков** — количество `[[` и `]]` должно совпадать; иначе `Invalid conditional block syntax: [[...]] mismatch`.
3. **Белый список полей** — каждый плейсхолдер `{field_name}` должен входить в массив **`fields`** соответствующей записи **`TEMPLATE_DEFS`**; иначе `Template uses non-whitelisted fields: ...`.

**Связь с п. 2.3.** Сначала при разработке нужно обновить **`displayName.js`** (`TEMPLATE_DEFS`, при необходимости **`ENTITY_TO_TEMPLATE`**), затем параметр можно безопасно заводить или менять через UI (или сидом). Обратная ситуация — параметр уже есть в БД, а в **`TEMPLATE_DEFS`** его нет: запись напрямую SQL возможна, но **редактирование через UI** будет падать с 400, пока код не дополнят.

**Итог:** п. 2.5 фиксирует, что шаблоны **`DISP_*`** в базе не расходятся с контрактом в коде: допустимый синтаксис и только разрешённые имена полей в фигурных скобках.

### 2.7. RBAC (права доступа)

Для **полноценного реестра** с собственным CRUD (не только справочник в `ReferencesV2`):

| Слой | Файл / место | Что добавить |
|------|----------------|--------------|
| Каталог прав | `backend/auth/permissionsCatalog.js` | В **`ALL_PERMISSIONS`**: `<resource>:read`, `:write`, `:delete`, `:export` (по принятому префиксу, напр. `domain:*`). |
| Матрица ролей | там же, **`VIEWER` / `ARCHITECT` / …** | `VIEWER`: как минимум `:read` (+ `:export` через `reExport`); `ARCHITECT`: `fullCrud('<resource>')`. |
| Маршруты API | `backend/auth/routePermissions.js` | `...crud('/api/togaf/<path>', '<resource>')`; для списков FK — `listLookup` с `anyOf` (кто может читать реестр для выпадающих списков на чужих формах). |
| Справочники host-типа | `refLookup` / `refCrud` | Если CRUD статусов и т.п. живёт отдельно от реестра — `domain:read` в `anyOf` для GET справочника. |
| Сервисные операции | `routePermissions.js` | Массовые POST (`/api/togaf/metamodel/rebuild-*`) — `metamodel:rebuild` или `service_operations:execute` (как принято в проекте). |
| Импорт данных | `routePermissions.js` | `GET/POST /api/import/*` — `import:execute` (уже есть); сущность должна быть в `importEntities/` и `import_allowed = true`. |
| Bootstrap | `bootstrapAuth` при старте API | Синхронизирует `ar_permissions` и роли из каталога — после добавления прав **перезапустить API**. |
| Frontend — меню | `frontend-v3/src/config/menu.js` | `requiredPermission: '<resource>:read'`. |
| Frontend — роуты | `frontend-v3/src/router/index.js` | `meta.requiredPermissions` на list (`:read`), create (`:write`), edit (`:read` или `:write`). |
| Frontend — экраны | список / форма | `usePermissions('<resource>')` для кнопок экспорта, удаления, readonly-баннера. |

Подробнее: [access-control-design.md](./access-control-design.md).

> Если задача добавляет **новый API-маршрут** (не только тип сущности), см. также [adding-new-api-endpoint.md](./adding-new-api-endpoint.md) — deny-by-default и обязательная регистрация в `routePermissions.js`.

### 2.8. Сервисный импорт / экспорт Excel

Если сущность должна участвовать в **«Настройки → Сервисные операции → Импорт данных»**:

1. Адаптер **`backend/importEntities/<code>.js`** (каталог полей, `loadRefs`, `create`/`update`, `template_version`).
2. Регистрация в **`backend/importEntities/index.js`**.
3. **`import_allowed = true`** для `code` в `ar_metamodel_entity_types` (SQL-миграция + dual `DB/migrations/`).
4. При изменении набора полей — bump **`template_version`** в каталоге.
5. Если сущность — FK на других формах / в импорте других сущностей — справочный лист в шаблоне.

См. [data-import-service.md](./data-import-service.md) §9.

### 2.9. Сиды параметров

- Внести строку в **`DB/scripts/seed_settings_parameters_from_candidates.sql`** (новые установки).
- При необходимости — отдельный **`DB/scripts/migrate_issue…_….sql`** для уже развёрнутых БД (как для issue #32).

---

## 3. Параметры в `ar_settings_parameters`

### 3.1. Обязательно для списков форм

| Параметр | Назначение |
|----------|------------|
| **`DISP_<…>_TEMPLATE`** | Формат подписи в `<select>` и пикерах; whitelist полей в `TEMPLATE_DEFS`. |

### 3.2. Если тип участвует в анализаторе зависимостей

| Параметр | Назначение |
|----------|------------|
| **`GRAPH_ENTITY_ORDER`** | Массив кодов типов; порядок в выпадающем «Тип сущности» на экране анализатора. Добавить новый `code` в нужное место (или выполнить миграцию данных). |
| **`GRAPH_ENTITY_ICONS`** | JSON: для ключа `code` — `icon` (имя Lucide), `label`, `listLabel`. Определяет подписи и иконки узлов на графе; может переопределять дефолты фронта. |

Дополнительно в публичном конфиге `/api/config` (см. **`PUBLIC_CONFIG_DEFAULTS`** в `backend/index.js` и **`frontend-v3/src/config/params.js`) стоит держать **те же дефолты**, что и в сидах, чтобы при отсутствии строк в БД UI не ломался.

Прочие параметры графа (`GRAPH_MAX_NODES`, `GRAPH_LAYOUT_DEF`, …) обычно не требуют изменения при одном новом типе.

---

## 4. Frontend (Vue 3).

### 4.1. Конфиг типов для графа

**`frontend-v3/src/utils/entityTypeConfig.js`**

- Добавить объект с ключом **`code`** (как в метамодели): **`label`**, **`icon`** (имя из `lucide-vue-next`), **`listLabel`**.
- Имеет смысл совпадать с дефолтом из `GRAPH_ENTITY_ICONS` / бэкенда.

### 4.2. Анализатор: загрузка списков и узлов

**`frontend-v3/src/api/graphApi.js`**

- **`listFetchers`** — для нового `code`: функция, вызывающая API списка (с нужными query-параметрами).
- **`entityFetchers`** — для подгрузки одной сущности по id (подпись узла, модалка).

Если для нового типа нужны **особые фильтры** (как `exclude_modules` / `only_modules` у систем), их передают из **`AnalyticsView.vue`** в `loadEntityList`, по аналогии с веткой `system` / `subsystem`.

### 4.3. Экранные формы

Минимальный набор для **полноценной** сущности:

| Экран | Назначение |
|-------|------------|
| Список | Таблица, поиск, ссылки на создание/редактирование (как у других респозиториев). |
| Форма создания/редактирования | Поля сущности, связи с справочниками. |
| Маршруты | Записи в **`frontend-v3/src/router/index.js`**, пункт меню в **`LayoutV3.vue`** (или аналог). |

**Поведение списков выбора (важно):** для опций использовать **`item.display_name \|\| item.name`** (и при необходимости код), чтобы уважать параметры `DISP_*`. То же — в **`RelationPickerModal.vue`** и любых общих пикерах.

### 4.4. Справочники

Если сущность или её атрибуты ведутся через **`ReferencesV2.vue`**, добавить секцию CRUD по образцу существующих блоков (типы сущностей, типы связей, …).

### 4.5. Frontend v2 (если ещё используется)

По необходимости дублировать отображение **`display_name`** в формах v2 для единообразия.

### 4.6. Главная страница: KPI и аккордеон объёма каталога

См. **[home-dashboard-catalog-metrics.md](./home-dashboard-catalog-metrics.md)** (`GET /api/dashboard/home-stats`, `backend/homeDashboard.js`, `HomeView.vue`).

После добавления типа в **`ar_metamodel_entity_types`** он **не попадёт** на главную автоматически. Нужно явно подключить подсчёт.

| Вариант | Когда | Что сделать |
|---------|--------|-------------|
| **Аккордеон** (типично) | Новый реестр с таблицей экземпляров; объём «сколько записей» достаточен в блоке «Другие сущности метамодели» | Добавить запись в **`ACCORDION_COUNT_SQL`** в **`backend/homeDashboard.js`**: ключ = **`code`** типа из метамодели, значение = безопасный `SELECT COUNT(*)::bigint AS c FROM archrep.<таблица>`. |
| **KPI-плитка** (редко) | Тип должен быть в верхних четырёх плитках рядом с ИС / потоками / технологиями / долгом | 1) SQL-функции `archrep.dashboard_home_*` в миграции; 2) имена в **`ALLOWED_COUNT_FUNCTIONS`**; 3) элемент в **`ARR_HOME_KPI_TILES`** (параметр БД + **`DEFAULT_KPI_TILES`**); 4) при необходимости **`code`** в **`ACCORDION_EXCLUDED_ENTITY_CODES`**, чтобы не дублировать цифру в аккордеоне. |

**Проверка:** после деплоя открыть главную → в аккордеоне (или в KPI) должна появиться строка с ненулевым/нулевым count для нового типа. Если записи в `ACCORDION_COUNT_SQL` нет — тип в метамодели есть, на главной **не отображается** (пример: `domain` до добавления строки в whitelist).

Фронт **`HomeView.vue`** менять не нужно — данные приходят с API; достаточно бэкенда (и для KPI — БД + параметр).

### 4.7. ИИ-архитектор: каталог инструментов и системный промпт

См. **[ai-architect.md](./ai-architect.md)** §6.4. Системный промпт и описания инструментов **генерируются**
из каталогов (`ENTITY_TYPES`, `SCREEN_TARGETS`), поэтому тексты правил писать не нужно — достаточно добавить данные.

| Что | Где | Обязательность |
|-----|-----|----------------|
| Реестр в каталоге ИИ: `label`/`plural`, `readPermission`/`writePermission`, ключи `select`/`search`/`get` из `queries.js`, `labelOf`, `brief` (белый список полей), `form` (маршруты), `listPath`, `prefillFields` (+ `prefillStructure`, если черновик — дерево, а не строка) | `backend/ai/tools.js` → `ENTITY_TYPES` | Нужен, чтобы ассистент видел реестр (`search_entities`/`get_entity`/`list_entities`, `open_form`, `prefill_form`) |
| Карточки действий и предзаполнение | `frontend-v3/src/config/aiActions.js` → `AI_ACTION_TARGETS` (+ `AI_PREFILL_FIELD_LABELS`, если есть черновик) | Нужен для `open_form`/`prefill_form` (пути и маршруты форм) |
| Подписи концов связей | `backend/ai/tools.js` → `RELATION_END_META` (`get` + `readPermission`); `backend/relationLabels.js` → `RELATION_END_SOURCES`; в справочнике типов — `table_name` + `disp_param_name` (код `DISP_*`); явная ветка в `archrep.metamodel_entity_search_text` — только если поля шаблона приходят из JOIN/вычисляются | Без записи `get_relations` вернёт `label: null`, а реестр связей покажет `#id`. Для «простых» типов поиск по наименованию работает автоматически по каталогу; для «сложных» (web_resource, domain, certificate, employee) нужна ветка в SQL-функции |
| Экраны без собственного реестра | `backend/ai/tools.js` → `SCREEN_TARGETS` (+ пункт меню в `frontend-v3/src/config/menu.js`) | Если это экран: `open_view` вправе только открыть его |
| Фокус графа у экрана (`?entity=&ids=`) | `focus: true` в записи `SCREEN_TARGETS` + разбор query в самом экране (эталон — `frontend-v3/src/views/AnalyticsView.vue`) | Если экран умеет открываться с предвыбранными объектами: `open_view` соберёт ссылку из `focusEntityType`/`focusIds` |

**Менять не нужно** (выводится автоматически): системный промпт и его правила, перечень реестров с формой в описании
`open_form`, enum-ы инструментов, `GET /api/ai/status`, иконка карточки действия (берётся из `frontend-v3/src/config/menu.js`
по `listPath`), справочники `list_relation_types`/`list_entity_types` (читают данные из БД).

**Проверка:** `node --check backend/ai/tools.js` и разбор `aiActions.js` → `npm run check:routes` → перезапуск backend →
`GET /api/ai/status` (новый тип в `entity_types`) → вопрос агенту («открой реестр …», «от чего зависит …»).

---

## 5. Поведение в анализаторе зависимостей

1. **Выбор типа** — значение `code` из `ar_metamodel_entity_types`, отсортированное по `GRAPH_ENTITY_ORDER`.
2. **Список объектов** — результат `loadEntityList`; строки с **`display_name`** из API облегчают поиск (фильтр учитывает `display_name`, имя, код и т.д.).
3. **Построение графа** — узлы получают `entityType` равный коду из метамодели; для **псевдотипов** на том же id возможна подмена отображаемого типа (пример: модуль системы).
4. **Подписи и иконки** — `getEntityTypeConfig(entityType)`; при отсутствии ключа отображается заглушка (иконка `Circle`).
5. **Связи** — берутся из `loadAllRelations()` (метамодель, включая проекции интеграционных потоков и system–technology). Новый тип появится на графе, когда в данных есть инцидентные связи с выбранными узлами.

---

## 6. Особые случаи

### 6.1. Только новый тип связи (ситуация B)

Достаточно: строки в **`ar_metamodel_relation_types`**, при необходимости бизнес-правил и документации. Новые **`DISP_`** и экраны каталога не обязательны, если не появляется новая таблица экземпляров.

### 6.2. Тот же API, разные роли (ситуация C, пример: subsystem)

- В метамодели отдельный **`code`** (`subsystem`).
- В API списка — фильтры (`exclude_modules` / `only_modules`).
- В **`ENTITY_TO_TEMPLATE`** и **`GRAPH_ENTITY_*`** — отдельные ключи.
- В **`graphApi`**: `subsystem` мапится на тот же `getSystem`, что и `system`.

---

## 7. Краткий чеклист

- [ ] `ar_metamodel_entity_types`: новый `code`, название, описание.
- [ ] `ar_metamodel_relation_types`: пары (from, to) и коды типов связей.
- [ ] DDL + `queries.js` + маршруты в `index.js`.
- [ ] **RBAC:** `permissionsCatalog.js` (`*:read/write/delete/export`), `routePermissions.js` (CRUD + listLookup для FK), роли VIEWER/ARCHITECT; меню и роуты с `requiredPermission(s)`; перезапуск API для bootstrap.
- [ ] `displayName.js`: `TEMPLATE_DEFS`, `ENTITY_TO_TEMPLATE`.
- [ ] `DISPLAY_NAME_PATHS` (+ ручной `applyDisplayName`, если нужны разные шаблоны для одного URL).
- [ ] Параметры: `DISP_*`, при участии в графе — `GRAPH_ENTITY_ORDER`, `GRAPH_ENTITY_ICONS`; сиды/миграции SQL.
- [ ] `/api/config` дефолты и `frontend-v3/src/config/params.js`.
- [ ] `entityTypeConfig.js`, `graphApi.js` (`listFetchers`, `entityFetchers`), при необходимости логика в `Quick pick` анализатора.
- [ ] Роутер, меню, список + форма; селекты через `display_name`.
- [ ] **ИИ-архитектор** (если реестр должен видеть ассистент): `ENTITY_TYPES` в `backend/ai/tools.js` (+ `RELATION_END_META`, если тип — конец связи) и `AI_ACTION_TARGETS` в `frontend-v3/src/config/aiActions.js`; тексты промпта править не нужно (см. §4.7).
- [ ] **Главная:** `ACCORDION_COUNT_SQL[<code>]` в `backend/homeDashboard.js` (или KPI: функции БД + `ALLOWED_COUNT_FUNCTIONS` + `ARR_HOME_KPI_TILES`; см. §4.6).
- [ ] При использовании v2 — синхронизировать отображение в формах.
- [ ] **Импорт/экспорт Excel** (если сущность в сервисном импорте — см. §2.8 и [data-import-service.md](./data-import-service.md)): адаптер `importEntities/<code>.js`, регистрация в `index.js`, **`import_allowed = true`** в метамодели, каталог полей, bump **`template_version`** при смене контракта.
- [ ] Проверка: справочник типов связей, создание связи из UI, построение графа с узлом нового типа, редактирование `DISP_*` в настройках, **строка объёма на главной (аккордеон/KPI)**, импорт (dry-run + apply) при подключённом адаптере.

---

## 8. Связанные документы

- `docs/ai-architect.md` — ИИ-архитектор: каталог инструментов, генерация промпта и чек-лист расширения (§6.4).
- `docs/display-name-templates-spec.md` — язык шаблонов и таблица параметров `DISP_*`.
- `docs/home-dashboard-catalog-metrics.md` — KPI и аккордеон на главной; whitelist `ACCORDION_COUNT_SQL`.
- `docs/settings-parameters-candidates.md` — перечень прочих параметров (в т.ч. графы).
- `docs/data-import-service.md` — сервисный импорт/экспорт Excel, каталог полей, синхронизация при смене полей.
- `DB/README.md` — примеры запуска миграций данных параметров.
