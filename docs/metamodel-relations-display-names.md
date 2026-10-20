**GitHub issue:** [#81](https://github.com/dgabadulin/ArchRep/issues/81)

# Связи объектов управления: наименования объектов вместо идентификаторов

**Статус:** реализуется
**Экраны:** `Аналитика → Связи объектов управления` (`/metamodel-relations`), форма связи (`/metamodel-relations/:id/edit`)
**API:** `GET /api/togaf/relations`, `GET /api/togaf/relations/:id`
**БД:** функция `archrep.metamodel_entity_search_text(text, bigint)` (структура хранения не меняется)

## 1. Проблема

Реестр связей метамодели (`frontend-v3/src/views/MetamodelRelationsList.vue`) выводит концы связи как
`код_типа : id` (`system : 12`), а тип связи — как код (`composed_of`). Пользователь не видит, между какими
объектами связь и как она называется. Форма (`MetamodelRelationForm.vue`) требует вводить числовые id.

Данные для отображения есть: `displayed_name` — вычисляемая подпись объекта по параметру `DISP_*`
(`backend/displayName.js`), `relation_type_name` — наименование типа связи из справочника
(`archrep.ar_metamodel_relation_types`), `DISP_META_REL_TYPE_TEMPLATE` — шаблон подписи типа связи.

## 2. Решение

| # | Требование | Реализация |
|---|---|---|
| 1 | В реестре — тип объекта и наименование объекта | Две колонки на каждый конец: «Тип объекта» (только `display_name` типа, без кода) и «Объект» (подпись объекта по `DISP_*`) |
| 2 | «Тип связи» — наименование | `relation_type_display_name` (рендер `DISP_META_REL_TYPE_TEMPLATE` на бэкенде) |
| 3 | То же в форме редактирования | Выбор объекта по наименованию (`<select>` со всеми объектами выбранного типа), в модель пишется прежний числовой `id` |
| 4 | Поиск по наименованиям объектов | SQL-функция `archrep.metamodel_entity_search_text` + `ILIKE` в `metamodel_relations_select_search` |
| 5 | Изменения только в отображении | Структура хранения не меняется: миграция добавляет только функцию |

## 3. Что НЕ меняется

- состав и семантика `archrep.ar_metamodel_relations` (нет новых таблиц/колонок);
- контракт записи (`POST/PUT /api/togaf/relations`) — идентификаторы по-прежнему числа;
- права доступа: экрану достаточно `metamodel_relation:read`; чтение «чужих» реестров не расширяется
  (нет прав — подпись не резолвится, фронт показывает `#id`);
- ИИ-архитектор (`backend/ai/tools.js`) — не затрагивается.

## 4. Бэкенд

### 4.1 SQL-функция поиска (миграция)

`DB/scripts/migrate_20261019120000_metamodel_entity_search_text.sql` (`DB/migrations/20261019120000_…js`) — первичная версия;
`DB/scripts/migrate_20261019130000_metamodel_entity_types_disp_param.sql` (`DB/migrations/20261019130000_…js`) —
колонка `disp_param_name` в каталоге + каталог-driven версия функции.

Алгоритм (PL/pgSQL, «простые» типы):

1. по `code` берём из `ar_metamodel_entity_types` → `table_name` + `disp_param_name`;
2. по `disp_param_name` читаем шаблон из `ar_settings_parameters`;
3. плейсхолдеры `{field}` шаблона (+ всегда `code`, `name`) → список полей;
4. `EXECUTE format('SELECT concat_ws('' '', %s) FROM archrep.%I t WHERE t.id = $1', …)`.

Ключевой приём — `to_jsonb(t)->>'field'`: отсутствующее поле даёт `NULL`, а не ошибку, поэтому шаблон можно
править в настройках, не ломая поиск. Защита от мусора в каталоге: regexp на `table_name`, `to_regclass`,
`%I`-квотирование; `disp_param_name` валидируется форматом и наличием параметра (`value_type=string`).

**Новый тип сущности** = строка в справочнике (`code` + `table_name` + `disp_param_name`) — правок кода не нужно.

Статические ветки (у этих типов поля шаблона приходят из JOIN или вычисляются — generic-ветка их не покроет):

| Код типа | Что не лежит в таблице | Где в SQL-функции |
|---|---|---|
| `web_resource` | `status_*`, `category_*`, `stage_type_*`, `system_*`, `parent_system_name` | явная ветка с JOIN'ами |
| `domain` | `status_*`, `registrar_name`, `company_name`, `business_owner_name` | явная ветка с JOIN'ами |
| `certificate` | `domain_name`, `ca_name`, `responsible_name` | явная ветка с JOIN'ами |
| `employee` | `status` — вычисляемое (`CASE WHEN active`) | явная ветка |

Неизвестный код (метамодель расширяется в UI) → `NULL`: поиск просто не матчит, ошибки нет.

### 4.2 Поиск

`backend/queries.js` → `metamodel_relations_select_search`: в `WHERE` добавляются

```sql
OR archrep.metamodel_entity_search_text(r.from_entity_type, r.from_entity_id) ILIKE $1
OR archrep.metamodel_entity_search_text(r.to_entity_type,   r.to_entity_id)   ILIKE $1
```

`metamodel_relations_select` (без поиска) не меняется.

### 4.3 Подписи для отображения

`backend/relationLabels.js` (новый):

- карта `код типа → { select, entity }`, где `select` — ключ запроса из `backend/queries.js` без параметров
  (переиспользуется как подзапрос: `SELECT * FROM (<select>) q WHERE q.id = ANY($1::bigint[])`),
  `entity` — ключ `ENTITY_TO_TEMPLATE` из `displayName.js`;
- `resolveRelationEndLabels(pool, pairs)` — пакетный резолв по типам + кэш в процессе (TTL 60 с, лимит 5000);
- подпись = `display_name` (после `applyDisplayName`) → `name` → `short_name` → `full_name` → `code` → `task_name`.

`backend/index.js`:

- `GET /api/togaf/relations` и `GET /api/togaf/relations/:id` возвращают дополнительные read-only поля
  `from_entity_name`, `to_entity_name`, `relation_type_display_name` — **только при `?with_labels=1`**
  (иначе Анализатор зависимостей, который грузит все связи, не платит за резолв подписей);
- `relation_type_display_name` = `applyDisplayName({ code, name: relation_type_name }, 'meta_relation_type').display_name`
  (то есть ровно параметр `DISP_META_REL_TYPE_TEMPLATE`); при пустом `relation_type_name` — код типа связи.

## 5. Фронтенд

### 5.1 Реестр (`MetamodelRelationsList.vue`)

Колонки (`tableId: metamodel-relations-v2` — чтобы старые cookie не скрыли новые колонки):

| Ключ | Заголовок | Значение |
|---|---|---|
| `from_type` | Тип объекта «От» | `display_name` типа из `/api/togaf/entity-types` (без кода) |
| `from_name` | Объект «От» | `from_entity_name`, иначе `#id` |
| `relation_type` | Тип связи | `relation_type_display_name` → `relation_type_name` → код |
| `to_type` | Тип объекта «К» | как `from_type` |
| `to_name` | Объект «К» | `to_entity_name`, иначе `#id` |
| `name` | Название | `relationDisplayName(row)` (displayed_name → name → тип) |
| `actions` | — | ссылка «Изменить/Открыть» |

Сортировка и фильтры остаются клиентскими (`useRegistryTable`), тип фильтра для новых колонок — `text`.

### 5.2 Форма (`MetamodelRelationForm.vue`)

- «Тип сущности» и «Тип связи» уже выводят `display_name` — не меняются;
- вместо `input[type=number]` — `<select>` со всеми объектами выбранного типа
  (`loadEntityList` из `frontend-v3/src/api/graphApi.js`, кэш на сессию формы);
- опция: `display_name || name || short_name || full_name || code || #id` (конвенция `docs/adding-new-entity-type.md`);
  значение — числовой `id` (`form.from_entity_id` / `form.to_entity_id`), `submit()` не меняется;
- если текущего `id` нет в загруженном списке — синтетическая опция `#id` (значение не теряется);
- режим просмотра (`canWrite=false`) и управляемые проекции (`integration_flow` + `reference_to_baserow`) — поля
  выключены, видны наименования из `from_entity_name` / `to_entity_name`;
- при смене типа конца список объектов перезагружается, id сбрасывается;
- в `graphApi.listFetchers` добавляются `system_child` и `integration_flow`.

## 6. Ограничения

- Индекса у поиска нет: функция вычисляется на каждый запрос. При текущем объёме (список без пагинации) приемлемо;
  при росте — материализация `search_text` + триггеры (отдельная задача).
- Поиск матчит «сырые» поля реестров, а не литералы `DISP_*` и не условные блоки `[[...]]` — подписи для
  отображения по-прежнему рендерит `displayName.js`.
- Пагинация списка отсутствует (как и до изменений).
- RLS/права на реестры-источники не реализуются: нет права → `from_entity_name = null` → в таблице `#id`.

## 7. Проверка

1. `npm run db:migrate` (или ручной прогон SQL-скрипта) — функция создана.
2. Смоук SQL:

```sql
SELECT r.id,
       archrep.metamodel_entity_search_text(r.from_entity_type, r.from_entity_id) AS from_txt,
       archrep.metamodel_entity_search_text(r.to_entity_type,   r.to_entity_id)   AS to_txt
FROM archrep.ar_metamodel_relations r
WHERE archrep.metamodel_entity_search_text(r.from_entity_type, r.from_entity_id) ILIKE '%<часть названия>%'
   OR archrep.metamodel_entity_search_text(r.to_entity_type,   r.to_entity_id)   ILIKE '%<часть названия>%'
LIMIT 20;
```

3. `npm run build:v3` — сборка фронта.
4. Ручные сценарии: реестр (типы/объекты/тип связи, поиск по названию объекта и по описанию связи, фильтры,
   сортировка, скрытие/показ колонок), форма (создание, правка, просмотр, управляемая проекция),
   пользователь без прав на реестр-источник.

## 8. Файлы

| Файл | Изменение |
|---|---|
| `DB/scripts/migrate_20261019120000_metamodel_entity_search_text.sql` | функция поиска |
| `DB/migrations/20261019120000_metamodel_entity_search_text.js` | миграция-обёртка |
| `backend/relationLabels.js` | новый: карта типов + пакетный резолв подписей |
| `backend/relationTypePolicy.js` | новый: политика `managed` из справочника типов связей (кэш) |
| `DB/scripts/migrate_20261020120000_metamodel_relation_types_managed.sql` | `managed` + сид + переименование `subsystem_system_function` |
| `DB/migrations/20261020120000_metamodel_relation_types_managed.js` | миграция-обёртка |
| `backend/queries.js` | `metamodel_relations_select_search`: поиск по объектам |
| `backend/index.js` | обогащение ответов `relations` |
| `frontend-v3/src/views/MetamodelRelationsList.vue` | новые колонки, `tableId` |
| `frontend-v3/src/views/MetamodelRelationForm.vue` | выбор объекта вместо id |
| `DB/scripts/migrate_20261019130000_metamodel_entity_types_disp_param.sql` | `disp_param_name` + каталог-driven функция |
| `DB/migrations/20261019130000_metamodel_entity_types_disp_param.js` | миграция-обёртка |
| `frontend-v3/src/views/ReferencesV2.vue` | `disp_param_name` в типах сущностей, `managed` в типах связей |
| `frontend-v3/src/views/ReferencesTogaf.vue` | legacy-экран: добавлен только `disp_param_name` |
| `frontend-v3/src/api/graphApi.js` | `listFetchers`: `system_child`, `integration_flow` |
| `docs/adding-new-entity-type.md` | чек-лист для нового типа-конца |
| `DB/README.md` | порядок наката миграции (prod `psql` / demo `db:migrate`), проверка |
| `docs/ai-architect.md`, `docs/table-column-filters-spec.md` | упоминания колонок |

## 9. Проекционные («managed») типы связей

Часть типов связей создаётся и поддерживается **вне формы связей**: триггерами из реляционной модели
или карточкой-источником (стек технологий ИС). Ручное создание/правка/удаление таких рёбер запрещены —
иначе триггер затирает строку или появляются дубли.

Источник истины — `ar_metamodel_relation_types.managed` (миграция `…20261020120000_metamodel_relation_types_managed`).
`managed = true` для кодов:

`system_module`, `integration_flow`, `integration_flow_system_module`, `integration_flow_module_system`,
`integration_flow_module_module`, `system_it_lead`, `subsystem_it_lead`, `system_business_lead`,
`subsystem_business_lead`, `system_partner_vendor/implementer/supporter`, `subsystem_partner_*`,
`technology_partner_vendor`, `system_system_function`, `subsystem_system_function`,
`organization_unit_business_service`, `organization_unit_business_function`, `system_web_resource`,
`subsystem_web_resource`, `web_resource_domain`, `certificate_domain`, `certificate_employee_responsible`,
`system_technology`, `module_technology`.

Поведение:

- `GET /api/togaf/relation-types` отдаёт `managed`; в справочнике типов связей — чекбокс «Управляется автоматически»;
- форма связи: «Новая» — managed-типы скрыты; «Редактирование» — поля заблокированы, баннер с источником;
- в форме также скрываются типы, не подходящие выбранной паре «От»/«К» (`from_entity_type_code`/`to_entity_type_code`);
- `POST /api/togaf/relations` — 400 для managed-типа; `PUT` — 400 и для правки managed-ребра, и для смены типа на managed; `DELETE` — 400;
- реестр: колонка «Источник» = «Автоматически» / «Вручную» (поле `relation_type_managed` в ответе API).

Отдельно исправлен дубль кода: направление «модуль → функция ИС» получило код `subsystem_system_function`
(раньше обе стороны писали `system_system_function`; триггер `sync_ar_system_functions_parent_metamodel`
обновлён, существующие рёбра переименованы). Бизнес-логика на этот код не завязана — проверено по backend/frontend.


## 10. Статус реализации

- [x] спецификация и issue [#81](https://github.com/dgabadulin/ArchRep/issues/81);
- [x] миграция `archrep.metamodel_entity_search_text` — **требуется применить на стенде**: `npm run db:migrate`;
- [x] каталог-driven поиск: колонка `disp_param_name` в `ar_metamodel_entity_types` + generic-ветка (миграция `…130000…`);
- [x] справочники типов: поле `disp_param_name` в `ReferencesV2` и `ReferencesTogaf` (+ валидация на бэке);
- [x] поиск по наименованиям объектов в `metamodel_relations_select_search`;
- [x] `backend/relationLabels.js` (смоук-тест: подписи по `DISP_*`, батчинг по типам, кэш, фолбэк `null`);
- [x] `with_labels=1` в `GET /api/togaf/relations[/:id]`;
- [x] реестр: колонки «Тип объекта»/«Объект» для «От» и «К», «Тип связи» — `display_name`; `tableId` → `metamodel-relations-v2`;
- [x] форма: выбор объекта по наименованию, в модель — числовой `id`; read-only для просмотра и проекций;
- [x] `graphApi.listFetchers`: `system_child`, `integration_flow`;
- [x] проекционные типы связей: флаг `managed`, фильтрация в форме, read-only в правке, запрет POST/PUT/DELETE, колонка «Источник»;
- [x] исправлен дубль кода `system_system_function` → `subsystem_system_function` (+ триггер);
- [x] сборка `frontend-v3` (`vite build`) — успешно;
- [ ] ручная проверка на стенде после применения миграции.

## 11. Приёмка и ограничения

Автоматические проверки (выполнены):

- `node --check` для `backend/index.js`, `queries.js`, `relationLabels.js`, `relationTypePolicy.js` и миграций — `exit=0`;
- смоук-тест резолвера подписей (`relationLabels`): DISP-подписи, батчинг по типам, кэш, фолбэк `null`;
- `vite build` — успешно; бандл содержит новые колонки и поля («Источник», «DISP-параметр», фильтрацию managed).

Ручная проверка на стенде (после наката миграций):

1. Реестр: тип/объект для «От» и «К», тип связи, «Источник», поиск по названию объекта, фильтры/сортировка.
2. Форма: создание (managed-типов нет, типы отфильтрованы по паре), правка ручной связи, открытие managed-связи
   (поля заблокированы), попытка смены типа на managed (400).
3. Карточка ИС: стек технологий (`system_technology`/`module_technology`) добавляется/удаляется, в реестре
   связей отображается как «Автоматически».
4. Справочник типов связей: чекбокс «Управляется автоматически» применяется в течение 60 с (кэш) или после рестарта.

Известные ограничения:

- `ReferencesTogaf.vue` — legacy-экран (не подключён в роутере, использует старый контракт
  `from_entity_types`/`to_entity_types`); `managed` в нём не поддержан;
- политика `managed` кэшируется в процессе backend на 60 с;
- без миграции `…20261020120000_metamodel_relation_types_managed` справочник типов связей и форма вернут ошибку —
  накатывать до выката кода.



