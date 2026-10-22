# ИИ-архитектор: встроенный ИИ-агент в ядре ИСАР

GitHub: https://github.com/dgabadulin/ArchRep/issues/78

Документ фиксирует архитектуру и границы функции **«ИИ-архитектор»** — встроенного в ядро ИСАР ИИ-агента
с кнопкой в футере левого меню и выдвижной чат-панелью, умеющей открывать и заполнять экранные формы.

> Кратко для ИИ-ассистента: работаем существующими механизмами ядра —
> `backend/auth/routePermissions.js` + `permissionsCatalog.js` + `npm run check:routes`,
> `PUBLIC_CONFIG_DEFAULTS` + `GET /api/config`, `ar_settings_parameters`, dual-миграции
> (`DB/scripts/*.sql` + `DB/migrations/*.js`). См. `.cursor/rules/route-permissions-required.mdc`,
> `db-migrations-dual.mdc`, `module-contract-first.mdc`.

---

## 1. Что делаем

1. **Кнопка** «ИИ-архитектор» в **фиксированном футере левого меню** (`.sidebar-footer` в `LayoutV3.vue`).
2. **Выдвижная чат-панель**, которая:
   - живёт в `LayoutV3.vue` и **переживает переходы** между разделами;
   - ведёт диалог с LLM **агентным циклом** (модель вызывает инструменты, получает данные ИСАР);
   - **открывает** экранные формы (`open_form`) и **заполняет черновики** (`prefill_form`);
   - хранит историю диалогов в БД **бессрочно**.
3. **Инструменты** — безопасные **read-only** обёртки над запросами `backend/queries.js`
   с проверкой прав текущего пользователя. Модель **не пишет SQL** и **не изменяет данные**.

---

## 2. Почему это функция ядра, а не модуль (ADR)

**Решение:** ИИ-архитектор реализуется как **функция ядра**, а не как модуль по `docs/modules-contract.md`.

**Контекст:**

- контракт модулей (`docs/modules-contract.md`, v0.1) в коде ядра **не реализован**: нет загрузчика модулей,
  реестра `isar_modules`, точки `register({ app, ctx })`;
- функциональность требует **точек UI самого ядра**: футер бокового меню, раскладка `LayoutV3.vue`,
  доступ ко всем экранным формам реестров и заключений; точки расширения UI для модулей контрактом
  ещё не описаны;
- агент должен читать данные через те же права RBAC, что и пользователь, — это ядерный механизм
  (`routePermissions.js`, `permissionsCatalog.js`).

**Следствия:**

- размещение — `backend/ai/*` (изолированно, без правок существующих обработчиков) + фронт в `frontend-v3/src`;
- маршруты `/api/ai/*`, права `ai_architect:*`, параметры `SYS_AI_*`, таблицы в схеме `archrep`
  (не `archrep_mod_<code>` — модульной схемы у ядра нет);
- когда появится загрузчик модулей, функция **может** быть переупакована в модуль; сейчас это было бы
  «параллельным механизмом», что запрещено `module-contract-first.mdc` §2.

**Альтернативы и почему отклонены:**

- *Модуль по контракту* — нет загрузчика и точек UI; потребовало бы сперва реализовать контракт в ядре.
- *Внешний виджет/iframe* — не даёт доступа к роутеру и формам SPA (нельзя открывать формы), ломает RBAC-сессию.
- *Запись данных агентом (tool-calling с INSERT/UPDATE)* — отклонено из-за рисков: агент делает только черновик,
  сохранение — пользователь в обычной форме (см. §7).

---

## 3. Компоненты

### 3.1 Backend: `backend/ai/`

| Файл | Ответственность |
|------|-----------------|
| `config.js` | Чтение серверных настроек (env) и публичных параметров (`SYS_AI_*` из `ar_settings_parameters`): endpoint, модель, ключ, лимиты, таймауты |
| `provider.js` | Клиент LLM (OpenAI-совместимый `/v1/chat/completions`): потоковый ответ, сборка `tool_calls`, таймауты, ошибки |
| `tools.js` | Описания инструментов (`tools` для LLM) + исполнители над `queries.js` с проверкой прав |
| `prompt.js` | Системный промпт: роль, правила, контракт UI-действий |
| `conversations.js` | SQL истории: создать диалог, добавить сообщение, загрузить историю, список, удалить |
| `aiService.js` | Агентный цикл: история → модель → инструменты → финальный ответ; эмиссия событий SSE |
| `aiRoutes.js` | HTTP-роутер: `POST /chat` (SSE), история диалогов |

Монтирование в `backend/index.js` — **после** auth-middleware, рядом с другими роутерами:

```js
app.use('/api/ai', createAiRouter(pool, queries));
```

### 3.2 Frontend: `frontend-v3/src`

| Файл | Ответственность |
|------|-----------------|
| `config/aiActions.js` | Реестр `entityType → { label, permission, listRoute, editRoute, newRoute }` — единственный источник истины для навигации из чата |
| `config/params.js` | Дефолты `SYS_AI_*` (как у остальных параметров из `/api/config`) |
| `api/aiClient.js` | `aiChatStream()` (POST + чтение SSE), список/сообщения/удаление диалогов |
| `composables/useAiPanel.js` | Состояние панели: открыта/ширина, диалог, сообщения, стриминг; локальное сохранение состояния |
| `components/ai/AiArchitectPanel.vue` | Панель: шапка, лента сообщений, ввод, стриминг |
| `components/ai/AiActionCard.vue` | Карточка UI-действия с проверкой прав и навигацией |
| `views/LayoutV3.vue` | Кнопка в `.sidebar-footer`, монтирование `<AiArchitectPanel>`, push/resize раскладки |

---

## 4. RBAC

### 4.1 Права

| Код | Смысл | Кому по умолчанию |
|-----|-------|-------------------|
| `ai_architect:use` | Доступ к панели ИИ-архитектора и маршрутам `/api/ai/*` | `VIEWER` (→ и `ARCHITECT` / `REPOSITORY_ADMIN` / `SYSTEM_ADMIN`) |

Инструменты **не имеют собственных прав**: каждый инструмент проверяет право чтения ресурса
(`system:read`, `technology:read`, …) против `req.permissions`. Нет права — инструмент возвращает модели
отказ, а не данные.

### 4.2 Правила маршрутов (`routePermissions.js`)

```js
// ИИ-архитектор (ядро): панель, диалоги, чат. Гейт — ai_architect:use + SYS_AI_ENABLED (на сервере).
{ methods: ['POST'], pattern: re('/api/ai/chat'), permissions: ['ai_architect:use'] },
{ methods: ['GET', 'POST', 'DELETE'], pattern: re('/api/ai/conversations'), permissions: ['ai_architect:use'] },
```

Проверка: `npm run check:routes` — роутер `/api/ai` учтён в карте `scripts/check-route-permissions.js`.

### 4.3 Гейт UI

Кнопка и панель показываются, если **одновременно**: `SYS_AI_ENABLED=true` (значение из `/api/config`) **и**
`authStore.hasPermission('ai_architect:use')`. Иначе функция полностью скрыта.

---

## 5. Параметры и секреты

### 5.1 Публичные (`/api/config`, таблица `ar_settings_parameters`, группа «ИИ-архитектор»)

| Код | Тип | Дефолт | Смысл |
|-----|-----|--------|-------|
| `SYS_AI_ENABLED` | boolean | `false` | Включение функции (кнопка + панель + маршруты) |
| `SYS_AI_MODEL` | string | — (в коде не задаётся) | Имя модели. Источник — env `SYS_AI_MODEL` (приоритет) или этот параметр БД |
| `SYS_AI_TITLE` | string | `ИИ-архитектор` | Заголовок панели |
| `SYS_AI_PANEL_WIDTH` | number | `400` | Ширина панели на десктопе, px |
| `SYS_AI_HISTORY_LIMIT` | number | `20` | Сколько последних сообщений отправлять в модель |
| `SYS_AI_PREFILL_MAX_INCREMENTS` | number | `10` | Лимит решений в структурном черновике заключения (issue #91). Используется ИИ-архитектором при генерации ADR — лишнее отбрасывается с `warning` |
| `SYS_AI_PREFILL_MAX_SYSTEMS` | number | `30` | Лимит систем в одном решении черновика. Используется ИИ-архитектором при генерации ADR |
| `SYS_AI_PREFILL_MAX_FUNCTIONS` | number | `20` | Лимит новых функций у одной системы черновика. Используется ИИ-архитектором при генерации ADR |
| `SYS_AI_PREFILL_MAX_RELATIONS` | number | `30` | Лимит связей в одном решении черновика. Используется ИИ-архитектором при генерации ADR |
| `SYS_AI_PREFILL_MAX_JSON_CHARS` | number | `5000` | Бюджет структурной части черновика по размеру JSON (черновик открывается ссылкой `?payload=`). Используется ИИ-архитектором при генерации ADR |
| `SYS_AI_FOCUS_MAX_IDS` | number | `50` | Максимум id в фокусе экрана «Анализ зависимостей» (`open_view`); то же значение читает фронт (`DEEPLINK_MAX_IDS`) |

> Изменение значения в UI («Настройки → Параметры») попадает в БД сразу, но применяется **после перезапуска API**:
> кэш настроечных параметров читается один раз при старте (`loadParams`). Env-значение применяется с рестартом сервиса.

### 5.2 Серверные (только env, **никогда** в `/api/config` и во фронт)

| Переменная | Дефолт | Смысл |
|------------|--------|-------|
| `AI_BASE_URL` | `https://ai.example.com/api/v1` | OpenAI-совместимый endpoint LLM |
| `AI_API_KEY` | — | Ключ доступа к LLM (**обязателен** для работы) |
| `AI_TIMEOUT_MS` | `120000` | Таймаут одного запроса к LLM |
| `AI_MAX_TOKENS` | `2048` | Лимит токенов ответа |
| `AI_TEMPERATURE` | `0.2` | Температура |
| `AI_MAX_ITERATIONS` | `6` | Максимум шагов агентного цикла (защита от циклов) |
| `SYS_AI_ENABLED` | — | Позволяет включить функцию из env, минуя БД |
| `SYS_AI_MODEL` | — | Имя модели (`model` в запросе к LLM); приоритет над параметром БД. В `/api/config` публикуется как `SYS_AI_MODEL` |

Приоритет: env → параметр БД → дефолт в коде. У `SYS_AI_MODEL` **дефолта в коде нет**: если имя модели не задано
ни в env, ни в БД, функции нечего вызывать — `/api/ai/chat` отвечает `503 AI_NOT_CONFIGURED`, а `/api/ai/status`
возвращает `configured: false`, `model: null`. Наименование модели хранится только в env и в параметрах БД,
в исходниках оно не дублируется. Значения `SYS_AI_ENABLED` и `SYS_AI_MODEL`, заданные в env, переопределяют БД и
публикуются в `/api/config` (`aiPublicEnvOverrides` в `backend/ai/aiConfig.js`) — «только env» в заголовке выше
означает «не секреты».

---

## 6. Агентный цикл и инструменты

### 6.1 Цикл

```
история сообщений + system prompt (+ tools)
  → LLM (stream)
      ├─ текстовые дельты → клиенту (SSE event: delta)
      └─ tool_calls → сервер исполняет инструмент (queries.js + права)
                        → результат в messages (role: tool)
                        → снова LLM
  → финальный ответ (SSE event: done) + сохранение в ar_ai_messages
```

Лимит шагов — `AI_MAX_ITERATIONS`. Если сервер LLM не поддерживает `tools`, включается **JSON-fallback**:
модель отвечает объектом `{"tool": "...", "args": {...}}` или `{"answer": "..."}`, сервер разбирает его тем же
исполнителем инструментов. Формат зафиксирован в системном промпте.

### 6.2 Инструменты (только чтение)

| Инструмент | Аргументы | Право | Источник |
|------------|-----------|-------|----------|
| `search_entities` | `query`, `types?`, `limit?` | `<type>:read` по типу | `systems_select_search`, `technologies_select_search`, `adrs_applied_select_search`, `gaps_select_search` |
| `get_entity` | `entityType`, `id` | `<type>:read` | `systems_get`, `technologies_get`, `adrs_applied_get`, `gaps_get`; для `adr_applied` — плюс контур инкремента (`adr_increments_by_applied` → системы и связи решения со статусами) |
| `list_entities` | `entityType`, `limit?` | `<type>:read` | `systems_select`, `technologies_select`, `adrs_applied_select`, `gaps_select` |
| `get_home_stats` | — | `dashboard:read` | `buildHomeStats(pool)` |
| `open_form` | `entityType`, `id?`, `mode` | право формы | формирует UI-действие (§7) |
| `prefill_form` | `entityType`, `fields` | `<type>:write` | формирует UI-действие с черновиком (§7); у `adr_applied` в `fields` есть `status_code` и структура `increments` (решения → системы → функции → связи), проверяемые по справочникам и лимитам |
| `open_view` | `entityType`, `search?`, `focusEntityType?`, `focusIds?` | `<type>:read` (реестр) или право экрана | формирует UI-действие «открыть реестр» с фильтром `?search=`, экран `analytics`/`dashboards`/`tech_radar`, либо `analytics` с фокусом графа (`?entity=&ids=`, §7) |
| `get_relations` | `entityType`, `id`, `direction?` (`from`/`to`/`both`), `relationType?`, `limit?` | `metamodel_relation:read` | `metamodel_relations_by_from` / `metamodel_relations_by_to`; подписи концов — карточки реестров (`RELATION_END_META`) |
| `search_relations` | `query`, `limit?` | `metamodel_relation:read` | `metamodel_relations_select_search` |
| `rank_relations` | `groupBy` (`from`/`to`), `entityType?`, `relationTypes?`, `limit?` | `metamodel_relation:read` | `metamodel_relations_rank_to` / `metamodel_relations_rank_from`: `GROUP BY` конца связи + `ORDER BY count DESC`, плюс `totalGroups`/`totalRelations`; подписи концов — `RELATION_END_META` |
| `list_relation_types` | `search?`, `limit?` | `metamodel_catalog:read` | `metamodel_relation_types_select` |
| `list_entity_types` | `limit?` | `metamodel_catalog:read` | `metamodel_entity_types_select` |
| `list_adr_increment_statuses` | `search?`, `limit?` | `adr_applied:read` | `adr_increment_types_select`, `adr_increment_system_statuses_select`, `adr_increment_system_function_statuses_select`, `adr_increment_relation_statuses_select` |

Ограничения: `limit` ≤ 50 (у связей ≤ 20); результат усекается по размеру; возвращаются те же поля, что видит
пользователь в реестре. `get_relations`/`search_relations` отдают подпись конца связи **только** если у пользователя
есть право чтения реестра этого типа — иначе `label: null` (модель не получает данных, которых не видит пользователь,
и не придумывает названия). Экраны `analytics`/`dashboards`/`tech_radar` собственных данных не отдают: граф «Анализа
зависимостей» фронт строит из связей метамодели (`GET /api/togaf/relations`, `frontend-v3/src/api/graphApi.js`),
поэтому источник ответов ИИ про зависимости — `get_relations`. Полный перечень реестров, доступных агенту (права,
пути, формы, предзаполнение), — §6.5.

**Рейтинги («где больше всего»).** Вопросы вида «сервер с наибольшим числом систем», «система с максимумом
функций» решаются инструментом `rank_relations`: агрегат считается в SQL (`GROUP BY` по концу связи,
`ORDER BY count DESC`), поэтому один вызов заменяет перебор сущностей через `get_relations`. Ответ содержит
`count` по каждой сущности, `totalGroups` (сколько сущностей в рейтинге) и `totalRelations` (сколько связей
всего), а подписи берутся из `RELATION_END_META` с проверкой права чтения реестра. Фильтр `relationTypes`
принимает массив: например, для серверов нужно передавать `system_infrastructure` **и** `subsystem_infrastructure`,
иначе модули в подсчёт не попадут.

**Контур инкремента заключения.** Карточка ADR (`adrs_applied_get`) показывает только шапку, поэтому контур
отдаётся отдельно: `get_entity` (`entityType=adr_applied`) дополняет карточку полем `incrementContour`
(решения → системы и связи со статусами их справочников; запросы `adr_increments_by_applied`,
`adr_increment_systems_by_increment`, `adr_increment_relations_by_increment`), а справочники типов решений и
статусов систем / функций / связей (`ADR_INCR_SYS_*`, `ADR_INCR_SYSFUNC_*`, `ADR_INCR_REL_*`) — инструментом
`list_adr_increment_statuses`. Все четыре lookup-маршрута контура закрыты одним правом `adr_applied:read`
(`backend/auth/routePermissions.js`), поэтому у инструмента ровно одно право, а состав берётся из белого списка
`queries.js` (новых SQL не требуется). Без этих инструментов модель либо выдумывала коды статусов, либо
отрицала существование контура. Если выборка контура упала, `get_entity` возвращает карточку и причину
(`incrementContourError`) — запись заключения остаётся полезной.

**Черновик состава заключения.** `prefill_form` для `adr_applied` умеет предложить заключение целиком: поля
шапки плюс `increments` — решения (`ar_adr_increment_types_id` из справочника), их системы (реестровые по
`ar_systems_id` из `search_entities`; новые — `kind:"new"` с `key`/`code`/`name`), функции систем и связи между
системами решения (`from`/`to`: `s:<ar_systems_id>` | `n:<key>`). Схема поля — функция
`appliedIncrementsSchema(caps)` из `ENTITY_TYPES.adr_applied.prefillStructure`, она попадает в описание инструмента,
а разбор — в `normalizeAppliedIncrementsDraft`: id типов решений и коды статусов сверяются со справочниками
контура (`list_adr_increment_statuses`), лимиты (`SYS_AI_PREFILL_MAX_INCREMENTS`, `SYS_AI_PREFILL_MAX_SYSTEMS`,
`SYS_AI_PREFILL_MAX_FUNCTIONS`, `SYS_AI_PREFILL_MAX_RELATIONS`, дефолты 10 / 30 / 20 / 30) и бюджет размера
ссылки формы (`SYS_AI_PREFILL_MAX_JSON_CHARS`) отсекают лишнее. Всё отброшенное возвращается в `warnings` (и в
результат, и в карточку действия), поэтому модель видит, что именно не попало в черновик. Проверка двухслойная:
сервер — справочники и лимиты, форма — существование id систем в загруженном реестре (`hydrateAiStructure` в
`DecisionAppliedForm.vue`). Статус новой системы в черновике — код параметра `ADR_INCR_SYS_NEW_STATUS_CODE`
(§7, issue #91), а не строка в коде. Статус заключения в черновике всегда «Черновик» (`ADR_DRAFT_STATUS_CODE`):
структуру сервер пишет только в статусах из `ADR_EDITABLE_STATUS_CODES` (дефолт — только черновик), в другом
статусе сохраняется лишь шапка, поэтому агент статусом не управляет и данные не сохраняет — как и раньше,
сохранение делает пользователь.

Экран `analytics` дополнительно принимает **фокус графа** (`focusEntityType` + `focusIds`, до
`SYS_AI_FOCUS_MAX_IDS` id — дефолт 50): сервер собирает ссылку `?entity=<код типа>&ids=<csv id>`, а фронт
(`AnalyticsView.vue`) отмечает эти объекты и сразу строит граф из тех же связей метамодели. Фокус прав не
расширяет: тип неизвестен, id битые или нет права чтения типа — экран открывается без фокуса, а модель получает
предупреждение в тексте результата.

### 6.3 Что агенту запрещено

- Выполнять произвольный SQL и любые изменяющие операции (`INSERT/UPDATE/DELETE`).
- Обходить RBAC: нет права у пользователя — нет данных.
- Возвращать секреты, env и содержимое `ar_settings_parameters` (кроме публичных `SYS_AI_*`).
- Сохранять предложенный состав заключения: `prefill_form` отдаёт **несохранённый** черновик со статусом
  «Черновик» (структуру в другом статусе сервер вообще не пишет), а данные записывает пользователь кнопкой
  «Сохранить» — модель лишь формулирует предложение и предупреждения (§7).
- Отдавать «Анализ зависимостей» готовым графом: инструменты возвращают только рёбра метамодели
  (`get_relations`/`search_relations`), экран ИИ лишь открывает (`open_view`), а построение графа делает фронт;
  фокус (`focusEntityType`/`focusIds`) — это предвыбор объектов в пикере через ссылку `?entity=&ids=`, прав он не
  расширяет и данных модели не отдаёт.
- Подменять анализ зависимостей реестром интеграционных потоков: `ar_integration_flows` — проекция связей в
  `ar_metamodel_relations` (issue #56), то есть подмножество, а не полный набор зависимостей.
- Отвечать на «где больше всего» перебором сущностей: для рейтингов (сервер с максимумом систем, система с
  максимумом функций) есть `rank_relations` — один агрегат вместо десятков `get_relations`, которые упираются
  в лимит шагов (`AI_MAX_ITERATIONS`). Фильтр по нескольким типам связи передаётся массивом `relationTypes`.
- Предлагать экран как источник данных («в Дашбордах обычно есть разрезы»): экраны данных агенту **не отдают**
  (`SCREEN_TARGETS` — только переход), источник ответа — инструменты; если нужного разреза инструментами нет —
  сказать прямо, чего не хватает.
- Утверждать, что экрана или реестра не существует: перечень реестров и экранов задаётся промптом
  (`ENTITY_TYPES` + `SCREEN_TARGETS`), и отсутствие данных — это отсутствие связей в модели.

### 6.4 Добавление новой сущности или экрана (чек-лист)

Каталог ИИ строится из данных, а не из текста промпта: **системный промпт, перечни в правилах и описания
инструментов генерируются из `ENTITY_TYPES` и `SCREEN_TARGETS`**, поэтому дублировать их руками не нужно.
Ниже — что всё-таки требует правки (и что нет).

| Что появилось | Правки в коде | Почему |
|---------------|---------------|--------|
| Новый **реестр** с формой UI | 1) `backend/ai/tools.js` → `ENTITY_TYPES`; 2) `frontend-v3/src/config/aiActions.js` → `AI_ACTION_TARGETS`; 3) при необходимости `RELATION_END_META` | 1) даёт `search_entities`/`get_entity`/`list_entities`/`open_form`/`prefill_form` и строку в промпте; 2) даёт маршруты форм для карточек действий |
| Новый **экран** (не реестр) | 1) `backend/ai/tools.js` → `SCREEN_TARGETS`; 2) `frontend-v3/src/config/menu.js` (пункт меню); 3) `routePermissions.js` | `open_view` получает код экрана, промпт получает правило «экран существует» и иконку из меню |
| Экран принимает **фокус** (`?entity=&ids=`) | 1) `focus: true` в `SCREEN_TARGETS`; 2) разбор query в самом экране (эталон — `AnalyticsView.vue`) | сервер сам соберёт ссылку `?entity=&ids=` из `focusEntityType`/`focusIds`; описание инструмента и промпт выводятся из данных |
| Сущность может быть **концом связи** метамодели | `backend/ai/tools.js` → `RELATION_END_META` (`get` + `readPermission`) | без записи `get_relations` вернёт `label: null` (безопасная деградация: id без названия, без домыслов) |
| Новый **тип связи** или **тип сущности** в БД (`ar_metamodel_relation_types`, `ar_metamodel_entity_types`) | ничего | `list_relation_types`/`list_entity_types` читают справочники из БД; правка нужна только для подписей концов (см. строку выше) |
| Код типа сущности **в каталоге БД не совпадает** с кодом агента | `backend/ai/tools.js` → `ENTITY_TYPE_ALIASES` (`код каталога` → `код агента`) | `aiRegistry` в `list_entity_types` и аргументы `search_entities`/`get_entity`/`list_entities`/`open_view`/`open_form`/`prefill_form` считаются по коду агента: без синонима тип показывается «без инструментов», а его код — «неизвестным». Пример: каталог `applied` (ADRA, `ar_adrs_applied`) ↔ агент `adr_applied`. **`principle` ↔ `adr_principle` — НЕ синонимы**: это разные реестры (`ar_principles` / `ar_adrs_principle`) |
| **Поля черновика** у существующей сущности | 1) `prefillFields` в `ENTITY_TYPES`; 2) `AI_PREFILL_FIELD_LABELS` в `aiActions.js`; 3) применение payload в форме (`useAiPrefill.js`) | расхождение = поле молча не применится (§7) |
| Новый **справочник контура** заключения (типы инкрементов, статусы систем / функций / связей) | 1) `ADR_INCREMENT_CATALOGS` в `backend/ai/tools.js`; 2) если справочник задаёт статус — поле черновика в `prefillFields` + `AI_PREFILL_FIELD_LABELS` + применение кода в форме (§7) | описание `list_adr_increment_statuses`, его ответ и правило 12 промпта выводятся из этого списка — дублировать текст не нужно |

Шаблон записи в `ENTITY_TYPES` (`backend/ai/tools.js`):

```js
new_entity: {
  label: 'Единица', plural: 'Реестр единиц',
  readPermission: 'new_entity:read', writePermission: 'new_entity:write',
  select: 'new_entities_select', search: 'new_entities_select_search', get: 'new_entities_get',
  labelOf: (r) => [r.code, r.name].filter(Boolean).join(' — ') || `#${r.id}`,
  brief: (r) => pick(r, ['id', 'code', 'name', 'status']),   // белый список полей для модели
  form: { new: () => '/new-entities/new', edit: (id) => `/new-entities/${id}/edit`, view: (id) => `/new-entities/${id}/edit` },
  listPath: '/new-entities',
  prefillFields: [],                                          // пусто — черновик не поддерживается
},
```

Шаблон записи в `AI_ACTION_TARGETS` (`frontend-v3/src/config/aiActions.js`):

```js
new_entity: {
  label: 'Единица',
  readPermission: 'new_entity:read', writePermission: 'new_entity:write',
  listRoute: { name: 'new-entities' }, listPath: '/new-entities',
  newRoute: { name: 'new-entity-new' }, editRoute: { name: 'new-entity-edit' },
  viewRoute: { name: 'new-entity-edit' },
  prefill: false,                                             // должно совпадать с prefillFields
},
```

Тип может быть зарегистрирован и **без** `listPath`/`form` (например `system_function` — функции ИС правятся
внутри формы системы): тогда агенту доступны только `search_entities` и `get_entity`, а `open_view`/`open_form`
отвечают понятным отказом. `prefillFields: []` обязателен у типов с `form` — это поле читают описание инструмента
и разбор черновика.

**Изменять НЕ нужно** (выводится автоматически): системный промпт и его правила 4/9, перечень реестров с формой
в описании `open_form`, enum-ы всех инструментов, `GET /api/ai/status`, `summarizeToolResult` в `aiService.js`,
иконка карточки действия (берётся из `config/menu.js` по `listPath`, см. `aiActionIconKey`).

**Проверка после правки:** `node --check` изменённых файлов → `npm run check:routes` (новые права/маршруты) →
перезапуск backend → `GET /api/ai/status` (в `entity_types`/`tools` появилась сущность) → контрольный вопрос
агенту («какие поля у …», «открой реестр …»).

Полный порядок добавления сущности в ИСАР (БД, API, RBAC, экраны, импорт, главная) — **[adding-new-entity-type.md](./adding-new-entity-type.md)** §4.7 и §7.

### 6.5 Покрытие реестров (что агент умеет читать)

Перечень строится из `ENTITY_TYPES` (`backend/ai/tools.js`) — это единственный источник и для системного промпта,
и для enum-ов инструментов. `list_entity_types` сопоставляет коды каталога метамодели (`ar_metamodel_entity_types`)
с этим реестром — напрямую или через карту синонимов `ENTITY_TYPE_ALIASES` (§6.4) — и отдаёт флаги `aiRegistry`
(есть ли у типа инструменты) и `aiAccess` (хватает ли пользователю права чтения).

| Код в `ENTITY_TYPES` | Реестр | `open_view` (`listPath`) | `open_form` (форма новой записи) | `prefill_form` |
|---|---|---|---|---|
| `system` | Информационные системы | `/systems` | ✅ `SystemForm` | ✅ |
| `subsystem` | Модули систем | `/systems` | ✅ `SystemForm` | ✅ |
| `technology` | Технологии | `/technologies` | ✅ `TechnologyForm` | ✅ |
| `adr_applied` | Архитектурные заключения | `/decisions/applied` | ✅ `DecisionAppliedForm` | ✅ (+ состав `increments`, §6.2) |
| `adr_principle` | Прикладные арх. решения (ADRP) | `/decisions/principle` | ✅ `DecisionPrincipleForm` | ✅ |
| `principle` | Архитектурные принципы | `/principles` | — (форма-модалка в `Principles.vue`) | — |
| `integration_flow` | Интеграционные потоки | `/integrations` | ✅ `IntegrationFlowForm` | ✅ |
| `metamodel_relation` | Связи объектов управления | `/metamodel-relations` | ✅ `MetamodelRelationForm` | — (концы задаются парой тип+id; в UI — выбор объекта по наименованию, см. `docs/metamodel-relations-display-names.md`) |
| `actor` | Заинтересованные лица | `/actors` | ✅ `ActorForm` | ✅ |
| `gap` | Архитектурный долг | `/architecture-debt` | ✅ `GapForm` | ✅ |
| `organization_unit` | Организационные единицы | `/organization-units` | ✅ `OrganizationUnitForm` | — |
| `business_service` | Бизнес-сервисы (продукты) | `/business-services` | ✅ `BusinessServiceForm` | — |
| `business_function` | Бизнес-способности | `/business-functions` | ✅ `BusinessFunctionForm` | — |
| `web_resource` | Веб-ресурсы | `/web-resources` | ✅ `WebResourceForm` | — |
| `domain` | Домены | `/domains` | ✅ `DomainForm` | — |
| `certificate` | Сертификаты | `/certificates` | ✅ `CertificateForm` | — |
| `employee` | Сотрудники | `/references` ¹ | — (модалка в «Справочниках») | — |
| `partner` | Партнёры | `/references` ¹ | — (модалка в «Справочниках») | — |
| `system_function` | Функции ИС | — ² | — | — |

¹ Сотрудники и партнёры правятся в модалках вкладок страницы «Справочники»: отдельного маршрута формы нет, а
deep-link на вкладку `ReferencesV2.vue` пока не читает — `open_view` ведёт на `/references`.

² У `system_function` нет экранного реестра (функции правятся внутри формы системы): агенту доступны только
`search_entities` и `get_entity`, а `open_view`/`open_form` отвечают понятным отказом.

**Оговорки.**
- `prefill_form` включён только у типов, чьи формы читают `?payload=` через `useAiPrefill` (§7): у остальных
  инструмент отвечает «предзаполнение не поддерживается», а не теряет черновик молча.
- `subsystem` читает общий каталог ИС (`systems_select` — отдельного SQL «только модули» в `queries.js` нет),
  поэтому модуль модель отличает по `parent_name`.
- Для `system_function` в `queries.js` добавлен `system_functions_select` (без параметров): существующий
  `system_functions_select_search` требует `$1` и не подходит для `list_entities`, который читает `select` без
  аргументов.
- Типы, у которых в каталоге метамодели код отличается от кода агента (`applied` → `adr_applied`), сопоставляются
  картой синонимов — см. §6.4.

---

## 7. UI-действия: «чат открывает формы»

Сервер возвращает (валидируя перед отправкой) типизированное действие:

```json
{ "type": "open_form", "entityType": "system", "entityId": 42, "mode": "edit",
  "label": "Открыть «Система X»", "permission": "system:read" }
```

```json
{ "type": "prefill_form", "entityType": "adr_applied", "mode": "new",
  "label": "Создать заключение с черновиком", "permission": "adr_applied:write",
  "draft": { "task_name": "…", "conclusion": "…", "status_code": "ADR_STATUS_DRAFT",
             "increments": [ { "order_index": 1, "name": "Целевой этап", "ar_adr_increment_types_id": 1,
                               "systems": [ { "ar_systems_id": 12, "increment_system_status_code": "ADR_INCR_SYS_IN_USE",
                                              "functions": [ { "name": "Выставление счетов" } ] },
                                            { "kind": "new", "key": "billing", "code": "SYS-N1", "name": "Биллинг 2.0" } ],
                               "relations": [ { "from": "s:12", "to": "n:billing",
                                                "increment_relation_status_code": "ADR_INCR_REL_CREATING" } ] } ] },
  "warnings": [ "Новая система «Биллинг 2.0» в решении всегда «Создаётся» — код … проигнорирован." ] }
```

Черновик `adr_applied` — это **шапка + состав заключения**: `status_code` (всегда «Черновик»), решения с
системами (реестровыми по id и новыми по `key`), функциями и связями. Значения не строки, а дерево, поэтому
форма применяет их своей гидратацией (`hydrateAiStructure`), а не общим маппером полей.

```json
{ "type": "open_view", "entityType": "system", "entityLabel": "Информационные системы",
  "listPath": "/systems", "search": "биллинг", "path": "/systems?search=биллинг",
  "permission": "system:read" }
```

```json
{ "type": "open_view", "entityType": "analytics", "entityLabel": "Анализ зависимостей",
  "listPath": "/analytics", "path": "/analytics?entity=system&ids=12",
  "query": { "entity": "system", "ids": "12" },
  "focusIds": [12], "focusLabel": "Информационная система",
  "permission": "analytics:read" }
```

**Фронт** (`AiActionCard.vue` + `config/aiActions.js`):

1. перепроверяет `permission` через `authStore.hasPermission` (сервер — не единственная защита);
2. `open_form`: `router.push({ name: editRoute, params: { id } })` (или `listRoute` при `mode: 'view'`);
3. `prefill_form`: сохраняет черновик и открывает **новую** форму (`newRoute`), где пользователь
   подтверждает сохранение обычной кнопкой «Сохранить» (при `mode: 'edit'` — форму изменения
   записи `editRoute`, черновик ложится поверх загруженных значений); строки черновика для карточки
   собирает `aiActionDraftEntries` (массивы сворачиваются в сводку), а `warnings`/`ignoredFields`
   сервера показываются списком (`AiActionCard.vue`);
   для `adr_applied` дополнительно: `status_code` разрешается в id справочника, а `increments` раскладываются
   в память формы (`DecisionAppliedForm.vue` → `hydrateAiStructure`) — решения, системы (реестровые и новые),
   функции и связи становятся обычными несохранёнными правками, которые собирает штатный
   `buildIncrementsPayload`; что применилось и что отброшено, видно в плашке `prefillNotice`;
4. `open_view`: собирает переход из `listPath` + `search` (`utils/listSearchQuery.js::listRoute`,
   ключ фильтра — `LIST_SEARCH_QUERY_KEY = 'search'`); если сервер прислал только готовую ссылку
   (`action.path = '/systems?search=…'`), путь и фильтр разбираются из неё (`searchFromQuery`).
   Ключ `search` читают **все** реестры через `composables/useListSearch.js` (поле поиска ↔ `route.query.search`),
   поэтому фильтр не теряется ни при прямом переходе, ни при F5;
   фокус экрана приходит полем `action.query` (`{ entity, ids }`) и добавляется к переходу белым списком ключей
   (`aiActionViewExtraQuery` в `config/aiActions.js`) — реестры его не читают;
5. действие без прав — кнопка неактивна с подсказкой «Недостаточно привилегий».

**Действие — это предложение, а не выполнение.** Сервер не исполняет `open_view`/`open_form`/`prefill_form`: он лишь
отдаёт карточку, а навигацию выполняет клик пользователя (`AiActionCard.vue` → `openAction` в `AiArchitectPanel.vue` →
`router.push`). Поэтому модель (правило 4 промпта) не должна писать, что экран «уже открыт», что она «перешла» или
«показала» раздел: без клика навигации не происходит, и такое утверждение расходится с реальным состоянием UI.
При **повторном** запросе («покажи/открой зависимости» ещё раз) действие прикладывается заново, даже если уже
прикладывалось в этом диалоге, — иначе повторный запрос остаётся без карточки и без перехода.

**Детерминированный фокус (страховка от модели).** Если модель всё же не приложила переход (типично для повторных
запросов: она отвечает из истории и не вызывает инструменты, а иногда пишет, что экран «уже открыт»), `runAgent`
в `backend/ai/aiService.js` прикладывает `open_view` на `analytics` **сам** — по последней сущности, для которой
считались связи (`get_relations` текущего хода, иначе — последний `get_relations` из истории). Право `analytics:read`
проверяет `runOpenView`; если сущность неизвестна или права нет — действие не добавляется. Так карточка перехода на
граф появляется независимо от поведения модели (правила 4/10 промпта — только первый, не единственный слой защиты).

**Контракт фокуса экрана (`analytics`):** ссылка `/analytics?entity=<код типа>&ids=<csv id>` (до 50 id).
`AnalyticsView.vue` при загрузке разбирает query, выставляет тип сущности, отмечает объекты и сразу строит граф
по связям метамодели. Тот же разбор выполняется и по изменению query: если экран уже открыт, Vue Router
переиспользует компонент и `onMounted` не вызывается — без этого клик по карточке ИИ на открытом
«Анализе зависимостей» не строил граф. Кнопка «Новый граф» очищает фокус из URL, поэтому F5 не возвращает
прежний граф. Без параметров экран работает как обычно, битые значения игнорируются. Лимит id и ключи
параметров синхронизированы с `SCREEN_FOCUS_MAX_IDS` и `SCREEN_FOCUS_QUERY_KEYS` в `backend/ai/tools.js`.
Клик по действию, ведущему на текущую страницу (ссылка совпадает), — no-op с пояснением в панели
(`state.notice`): раньше он выглядел как «кнопка не нажимается».

**Контракт prefill:**

- Кодирование: `payload = btoa(encodeURIComponent(JSON.stringify({ form: draft })))`, чтение —
  `JSON.parse(decodeURIComponent(atob(payload)))`. Эталон — `DecisionAppliedForm.vue`; серверный
  генератор `prefill_form` (`backend/ai/tools.js`) обязан собирать ту же строку
  (`Buffer.from(encodeURIComponent(JSON.stringify(...)), 'utf8').toString('base64')`) и
  percent-кодировать её в query. Порядок обязателен: base64 строится от **percent-encoded ASCII-JSON**,
  иначе `atob` получает не-ASCII байты и падает — черновик молча не применяется.
- Разделение полей действия (не кодировать дважды — это дефект, из-за которого черновик «исчезал»):
  `action.path` — «чистый» путь формы (`/systems/new`), `action.payload` — **сырой** base64
  (`=`, `+`, `/` как есть); query-кодирование делает роутер
  (`router.push({ path: action.path, query: { payload: action.payload } })`), а форма читает уже
  декодированное значение. Pre-encoded строка `?payload=<percent-encoded base64>` есть только в
  `result.path` (текст/ссылка для модели); передавать её в `query.payload` через `encodeURIComponent`
  нельзя — тогда `atob` получает `%3D`/`%2B` и падает.
- `adr_applied` — используется существующий механизм формы: `?payload=<base64(JSON)>`
  (см. `DecisionAppliedForm.vue`); черновик кладётся в `payload.form`. Кроме полей шапки
  (`task_name`, `task_link`, `conclusion`) черновик задаёт **статусы контура кодами** справочников:
  `increment_system_status_code` (статус систем решения) и `increment_relation_status_code` (статус связей).
  Коды берутся из `list_adr_increment_statuses`, а форма разрешает их в id по уже загруженным справочникам —
  неизвестный (выдуманный моделью) код молча игнорируется. Предзаполненный статус систем переживает выбор
  решения: пикер «Статус» получает его вместо встроенного дефолта (`defaultApplyStatusId`, код —
  `ADR_INCR_SYS_DEFAULT_STATUS_CODE`), он же подставляется в модалку новой системы. Статус связей передаётся в
  `IncrementRelationsModal` как `defaultRelationStatusId` и приоритетнее её собственного дефолта
  (`ADR_INCR_REL_NEW_STATUS_CODE` для новой связи, `ADR_INCR_REL_EXISTING_STATUS_CODE` для связи из реестра).
  Статусы контура — параметры (issue #91): `ADR_INCR_SYS_NEW_STATUS_CODE`, `ADR_INCR_SYSFUNC_NEW_STATUS_CODE`,
  `ADR_INCR_SYS_DEFAULT_STATUS_CODE`, `ADR_INCR_REL_NEW_STATUS_CODE`, `ADR_INCR_REL_EXISTING_STATUS_CODE`,
  `ADR_EDITABLE_STATUS_CODES` (при каких статусах заключения форма правит состав). Структура решения
  (сами инкременты, системы, функции, связи) черновиком не задаётся: её добавляет пользователь в форме.
- Остальные формы подключаются общим composable `frontend-v3/src/composables/useAiPrefill.js`
  (разбор `?payload=`, белый список полей, удаление `payload` из адреса после применения).
  Вызов — **после** загрузки записи: так форма помечается как изменённая и срабатывает guard
  несохранённых данных. Состав форм и полей:

  | Форма | `entityType` | Поля черновика |
  |-------|--------------|----------------|
  | `SystemForm.vue` | `system` | `name`, `fullname`, `description`, `comment`, `external_system`; `technologies` — подсказка «связать вручную» |
  | `TechnologyForm.vue` | `technology` | `name`, `description`, `approve_document` |
  | `IntegrationFlowForm.vue` | `integration_flow` | `transferred_data`, `transfer_method`, `periodicity` (связи «источник → приёмник» — вручную) |
  | `DecisionPrincipleForm.vue` | `adr_principle` | `name`, `context`, `decision`, `consequences` |
  | `GapForm.vue` | `gap` | `name`, `description`, `consequences`, `remediation_effort`, `responsible_person`, `source` |
  | `ActorForm.vue` | `actor` | `name`, `description` |
  | `DecisionAppliedForm.vue` | `adr_applied` | `task_name`, `task_link`, `conclusion`; `increment_system_status_code`, `increment_relation_status_code` — коды статусов контура (`list_adr_increment_statuses`), неизвестный код игнорируется (свой механизм `?payload=`, см. выше) |
  | `MetamodelRelationForm.vue` | `metamodel_relation` | — (предзаполнение не поддерживается: концы связи задаются парой «тип + id») |

  Имена полей совпадают с `prefillFields` в `backend/ai/tools.js` и подписями `AI_PREFILL_FIELD_LABELS`
  в `frontend-v3/src/config/aiActions.js` (расхождение — дефект: поле молча не применится).
  Сценарий возврата к заключению (`?returnTo=…`: payload описывает черновик ADR) черновик не применяет.
  Расширение на новый тип — запись в `aiActions.js`/`tools.js` плюс вызов `useAiPrefill` в его форме.

Все типы стартового набора имеют форму в UI, поэтому `open_form` и `prefill_form` доступны для них;
у `metamodel_relation` форма есть, но предзаполнение не поддерживается.
`open_view` работает для любого типа из `ENTITY_TYPES` (у всех задан `listPath`) и для экранов из `SCREEN_TARGETS`:
`analytics` («Анализ зависимостей», право `analytics:read`), `dashboards` (`dashboard:read`), `tech_radar` (`tech_radar:read`).
У экранов фильтр `search` не поддерживается: их данные ИИ отдаёт инструментом `get_relations`, а `open_view` только
переносит пользователя на экран (`config/aiActions.js` для экранов не нужен — переход строится по `listPath`).

---

## 8. БД

Dual-миграция: `DB/scripts/migrate_20261001120000_ai_architect.sql` (prod) +
`DB/migrations/20261001120000_ai_architect.js` (demo, `npm run db:migrate`).

| Таблица | Поля |
|---------|------|
| `archrep.ar_ai_conversations` | `id`, `user_login`, `title`, `created_at`, `updated_at` |
| `archrep.ar_ai_messages` | `id`, `conversation_id` (FK, CASCADE), `role` (`user`/`assistant`/`tool`), `content`, `tool_name`, `payload jsonb`, `created_at` |

Изоляция истории: все выборки фильтруются по `user_login` текущего пользователя.
История хранится бессрочно (ретеншен — отдельная задача при необходимости).

---

## 9. Раскладка панели (Hybrid)

| Условие | Поведение |
|---------|-----------|
| Десктоп (`min-width: 1100px`) | Панель — третий flex-ребёнок `.layout`: **push** контента, ширина из `SYS_AI_PANEL_WIDTH` (380–720), ресайз перетаскиванием за левую границу |
| Узкий экран | **overlay** поверх контента (без push), затемнение фона, закрытие по `Esc`/клику |
| `minimalLayout` маршруты (например, редактор диаграмм) | Панель и кнопка скрыты |

Ширина сохраняется в `localStorage`.

---

## 10. Ошибки и деградация

| Ситуация | Поведение |
|----------|-----------|
| `SYS_AI_ENABLED=false` | Кнопки нет; маршруты доступны только по праву (функция «выключена» в UI) |
| Нет `AI_API_KEY` | Ответ `503` «ИИ-архитектор не настроен: задайте AI_API_KEY» |
| LLM недоступен/таймаут | SSE `event: error` с понятным текстом; история сохраняется |
| Модель не поддерживает `tools` | JSON-fallback (§6.1) |
| Превышен `AI_MAX_ITERATIONS` | Ответ с пометкой «достигнут лимит шагов»; действия не выполняются |
| Нужен разрез, которого нет инструментом | Ответ по ближайшему инструменту + явно «чего не хватает»; рейтинги («где больше всего») — `rank_relations`, а не перебор сущностей через `get_relations` |

---

## 11. Вне scope

- RAG/эмбеддинги и векторный поиск.
- Генерация SQL моделью; любые записи в БД агентом.
- Мобильный UX, i18n, rate-limit и учёт стоимости токенов.
- Автосохранение сущностей и инлайн-редактирование из чата.

---

## 12. Ссылки

- `docs/adding-new-api-endpoint.md` — чек-лист «маршрут ↔ RBAC».
- `docs/access-control-design.md` — RBAC, deny-by-default.
- `docs/modules-contract.md` — контракт модулей (обоснование §2).
- `backend/queries.js` — источник данных инструментов.
- `frontend-v3/src/router/index.js` — имена маршрутов форм для `aiActions.js`.


