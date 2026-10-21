# Каталог инфраструктуры из Netbox (read-only)

**Статус:** реализовано (issue #92)  
**GitHub:** [#92](https://github.com/dgabadulin/ArchRep/issues/92)  
**Источник данных:** Netbox (`virtualization.virtualmachine`, `dcim.device`)  
**Синхронизация:** задание `infrastructure_sync` (Job Runner), ручной запуск — «Настройки → Управление заданиями»  
**Экран:** «Инфраструктура → Каталог инфраструктуры» (`/infrastructure`)

---

## 1. Назначение

Каталог серверов (физических и виртуальных), которые ведутся в Netbox и относятся к информационным
системам ИСАР через теги `IS:<код системы>`. В ИСАР реестр доступен **только для просмотра**:
создание, изменение и удаление выполняются в Netbox, откуда данные приходят при синхронизации.

Связь «ИС ↔ сервер» — **N:M**: у одного сервера может быть несколько тегов `IS:`, у одной ИС — много
серверов. Связи хранятся в `archrep.ar_metamodel_relations` (типы `system_infrastructure` /
`subsystem_infrastructure`), отдельной link-таблицы нет.

## 2. Контракт тегов Netbox

| Свойство | Значение |
|---|---|
| `name` тега | `IS:<КОД>` (например `IS:ADAB`) |
| `slug` | производный (`isadab`); использовать как источник кода нельзя |
| Сопоставление | `tag.name` без учёта регистра, префикс `IS:` (параметр `NETBOX_TAG_PREFIX`) |
| Код системы | остаток после префикса, `trim`; сравнивается с `ar_systems.code` без учёта регистра |
| Несколько тегов | несколько связей; дубли по одной ИС схлопываются |
| Тег без ИС | сервер в каталоге остаётся, связи нет, в списке — «ИС не определена» |

Фильтрация на стороне Netbox по `?tag=` не используется: фильтр работает по slug, а код системы
восстанавливается из `name`. Объекты читаются страницами и фильтруются локально.

## 3. Параметры

`ar_settings_parameters`:

| Код | Тип | Секрет | Значение по умолчанию | Смысл |
|---|---|---|---|---|
| `NETBOX_URL` | string | нет | — | Базовый URL Netbox, например `https://netbox.st.tech` |
| `NETBOX_TAG_PREFIX` | string | нет | `IS:` | Префикс имени тега |
| `NETBOX_INCLUDE_VMS` | boolean | нет | `true` | Импортировать виртуальные машины |
| `NETBOX_INCLUDE_DEVICES` | boolean | нет | `true` | Импортировать физические устройства |
| `NETBOX_PAGE_SIZE` | number | нет | `100` | Размер страницы API |
| `NETBOX_VERIFY_TLS` | boolean | нет | `true` | Проверять TLS-сертификат |
| `NETBOX_REQUEST_TIMEOUT_MS` | number | нет | `30000` | Таймаут запроса |
| `DISP_INFRA_TEMPLATE` | string | нет | `{name}` | Шаблон подписи сервера |

**Токен Netbox — только переменная окружения `NETBOX_TOKEN`.** В БД, `/api/config` и логи не попадает.

После изменения параметров нужен перезапуск API (кэш `settingsParams`).

## 4. Модель данных

### 4.1. Справочник типов

`archrep.ar_infrastructure_object_types` — типы объектов инфраструктуры; единица учёта — сервер.

| Код | Наименование |
|---|---|
| `virtual_server` | Виртуальный сервер |
| `physical_server` | Физический сервер |

Справочник редактируется в «Настройки → Справочники → Типы объектов инфраструктуры»
(права `references:read` / `references:write`). Удаление типа, на который ссылаются записи, запрещено
(`ON DELETE RESTRICT`).

### 4.2. Реестр

`archrep.ar_infrastructure_objects`:

| Поле | Смысл |
|---|---|
| `source` | Система-источник (`netbox`) |
| `external_id` | id объекта в Netbox |
| `ar_infrastructure_object_types_id` | FK на справочник типов |
| `name` | Наименование сервера |
| `description` | Описание из Netbox |
| `primary_ip` | Основной IP (без маски) |
| `status` | Статус в Netbox (человекочитаемый) |
| `site`, `cluster`, `platform`, `tenant` | Площадка, кластер, платформа, арендатор |
| `vcpus`, `memory_gb`, `disk_gb` | Ресурсы; память пересчитывается из МБ Netbox в ГБ |
| `netbox_updated_at` | `last_updated` объекта в Netbox |
| `synced_at` | Метка последней синхронизации строки (для удаления устаревших) |
| `payload` | Исходный JSON Netbox (включая теги) |

Естественный ключ: `(source, ar_infrastructure_object_types_id, external_id)`.

`system_code` и FK на `ar_systems` отсутствуют: связь N:M живёт в метамодели.

### 4.3. Связи метамодели

- Тип сущности: `infrastructure_object` («Сервер инфраструктуры»).
- Типы связей: `system_infrastructure` (ИС → сервер), `subsystem_infrastructure` (модуль → сервер),
  оба `managed = true`.
- Для каждого тега `IS:<код>`: если код найден в `ar_systems`, создаётся связь
  `system` (корневая ИС) или `subsystem` (модуль с заполненным `parent_ar_systems_id`).
- `displayed_name` **не заполняется** — как у остальных проекций (сертификаты, веб-ресурсы, партнёры, лиды):
  подпись ребра на графе и в реестре берётся из `ar_metamodel_relation_types.name` («Размещена на»).
  `DISP_INFRA_TEMPLATE` относится только к подписи **объекта** (узла) сервера.
- `reference_to_baserow` = `external_id`; `payload` = `{source, kind, external_id, tag_code}`.

Защита целостности:

1. `AFTER DELETE` на `ar_infrastructure_objects` удаляет связи объекта.
2. Триггер на `ar_systems`: при удалении ИС удаляет её связи с серверами; при смене
   `parent_ar_systems_id` переключает `system_infrastructure` ↔ `subsystem_infrastructure`.
3. Partial unique index по `(from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type)`
   для наших типов.

> Если миграция `20261021120000` уже накатывалась со старой версией кода (когда `displayed_name`
> заполнялся именем сервера), примените корректирующую
> `DB/scripts/migrate_20261021130000_infrastructure_relation_labels.sql` — она очищает `displayed_name`
> у связей инфраструктуры. Для новых БД обе миграции идут по порядку.

## 5. Синхронизация

Операция: `backend/infrastructureSync.js`, HTTP-клиент: `backend/netboxClient.js`.
Задание: `infrastructure_sync`, интервал по умолчанию 86400 с, `enabled = false` до настройки токена.

Алгоритм (идемпотентный, **без полной очистки реестра**):

1. Прочитать параметры; без `NETBOX_URL` / `NETBOX_TOKEN` — задание падает с понятной ошибкой.
2. Для каждого включённого вида (ВМ/устройства) прочитать **все** страницы Netbox.
   Ошибка на любой странице → прогон `failed`, удалений нет.
3. Загрузить карту `ar_systems` (`id`, `code`, `parent_ar_systems_id`).
4. Для каждого объекта: разобрать теги `IS:`, найти ИС; выполнить upsert по естественному ключу
   и выставить `synced_at = run_ts`; удалить прежние связи объекта и создать связи по найденным ИС.
   `displayed_name` у связей не заполняется — подпись ребра берётся из типа связи.
5. После успешного чтения вида удалить устаревшие строки:
   `DELETE ... WHERE type_id = $type AND synced_at < $run_ts`. Связи удалит триггер.
6. Вернуть сводку: `vms_fetched`, `devices_fetched`, `created`, `updated`, `deleted`,
   `relations_synced`, `unmatched_codes`.

Почему не `TRUNCATE` + вставка заново: при сбое остаётся частичный каталог; меняются `id`, на которые
ссылаются связи; лишние блокировки и bloat. Удаляются только реально исчезнувшие объекты.

## 6. API и права

| Маршрут | Право | Назначение |
|---|---|---|
| `GET /api/infrastructure?search=` | `infrastructure:read` | Список серверов |
| `GET /api/infrastructure/:id` | `infrastructure:read` | Карточка (read-only) |
| `GET/POST/PUT/DELETE /api/togaf/refs/infrastructure-object-types` | `references:read` / `references:write` | Справочник типов |
| `POST /api/jobs/:id/run` | `jobs:execute` | Ручной запуск синхронизации |

Список обогащается: `type_name`, `type_code`, `system_names`, `system_count`, `tag_codes`, `netbox_url`.
`netbox_url` формируется на бэкенде, чтобы не отдавать `NETBOX_URL` во фронт.

## 7. Интерфейс

- Меню: группа **«Инфраструктура»** после «Технологии» → **«Каталог инфраструктуры»** (`/infrastructure`).
- Таблица: тип, наименование (ссылка на Netbox), ИС (агрегат из связей), статус, площадка, кластер,
  платформа, арендатор, IP, vCPU, RAM (ГБ), диск (ГБ), изменён в Netbox, синхронизирован.
- Сквозной поиск по всем полям (как в других каталогах), фильтры по колонкам.
- Нет кнопок создания/изменения/удаления; при отсутствии ИС — «ИС не определена».
- Главная: строка объёма в аккордеоне (`infrastructure_object`).
- Анализатор зависимостей: тип `infrastructure_object` в `GRAPH_ENTITY_ICONS` / `GRAPH_ENTITY_ORDER`.

## 8. Чек-лист `adding-new-entity-type.md`

| Пункт | Реализация |
|---|---|
| Тип сущности | `infrastructure_object`, `table_name`, `disp_param_name`, `import_allowed=false` |
| Типы связей | `system_infrastructure`, `subsystem_infrastructure`, `managed=true` |
| DDL + queries + routes | Таблицы, справочник, GET-роуты, запросы синхронизации |
| RBAC | `infrastructure:read`; справочник — `references:*`; запуск — `jobs:execute` |
| `displayName.js` | `DISP_INFRA_TEMPLATE`, `ENTITY_TO_TEMPLATE` |
| `DISPLAY_NAME_PATHS` | `/api/infrastructure`, `/api/infrastructure/:id` |
| Параметры | `DISP_*`, `NETBOX_*`, `GRAPH_ENTITY_*` |
| `/api/config` | Не требуется (секреты и URL Netbox наружу не отдаются) |
| `entityTypeConfig.js`, `graphApi.js` | Добавлены `listFetchers` / `entityFetchers` |
| `relationLabels.js` | `infrastructure_object → infrastructure_objects_label_select` |
| `metamodel_entity_search_text` | Ветка `infrastructure_object` |
| Роутер, меню, список | Добавлены; формы нет (read-only) |
| ИИ-архитектор | `ENTITY_TYPES` + `RELATION_END_META` (без формы и предзаполнения) |
| Главная | `ACCORDION_COUNT_SQL.infrastructure_object` |
| Импорт/экспорт Excel | Не применимо (read-only, `import_allowed=false`) |

## 9. Проверка

1. `npm run check:routes` — все маршруты покрыты правами.
2. Задать `NETBOX_URL` (параметр) и `NETBOX_TOKEN` (env), перезапустить API.
3. В «Управлении заданиями» включить `infrastructure_sync` и запустить вручную.
4. Проверить:
   - на графе подпись ребра «ИС → сервер» — **«Размещена на»** (из `ar_metamodel_relation_types.name`), а не имя сервера;
   - новый сервер с тегом появился в каталоге и в «Связях объектов управления»;
   - смена тега пересоздала связь;
   - удаление сервера в Netbox удалило запись и связь;
   - недоступный Netbox → задание `failed`, каталог не изменился;
   - тег без ИС → запись есть, связи нет.
5. `GET /api/infrastructure` под пользователем с `infrastructure:read`; без права — 403.

