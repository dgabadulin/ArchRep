# Вариант B: параметры ADR по кодам справочников (не по названиям и не по сырым id)

Документ фиксирует целевую архитектуру для замены **`ADR_APPROVED_NAMES`** и **`ADR_FLOW_STATUS_MAP`** (строковые названия на русском) на конфигурацию по **стабильным кодам** (`code`), хранимым в таблицах справочников.

---

## 1. Цели

| Цель | Как достигается |
|------|-----------------|
| Переименование статуса в UI не ломает логику | Логика сравнивает `code`, `name` меняется свободно |
| Переносимость между окружениями | Коды одинаковы в dev/test/prod; id могут отличаться |
| Читаемость конфига | `["ADR_STATUS_APPROVED_ARCH"]` понятнее, чем `[3]` без контекста |
| Единый стиль с остальными параметрами | UPPERCASE, латиница, подчёркивания (как в `settings-parameters-candidates.md`) |

---

## 2. Принципы

1. **Источник истины для кодов — БД.** Параметры хранят только **коды**; при старте или при обработке запроса бэкенд **резолвит** `code → id` по справочникам.
2. **Значения в маппинге потоков** — по возможности тоже через код второго справочника (`ar_integration_flow_statuses.code`), чтобы не привязывать конфиг к `id` статусов потоков между БД.
3. **Единый формат:** использовать только параметры по кодам, без fallback на параметры по именам.

---

## 3. Изменения схемы БД

### 3.1. `archrep.ar_adr_statuses`

Добавить:

- `code varchar(64) NOT NULL` — уникальный стабильный код (например `ADR_STATUS_DRAFT`, `ADR_STATUS_APPROVED_ARCH`).
- `CONSTRAINT ar_adr_statuses_code_key UNIQUE (code)`.

**Заполнение существующих строк:** одноразовый `UPDATE` по соответствию с текущими `name` (или ручное сопоставление), затем `ALTER ... SET NOT NULL` (если сначала nullable для миграции).

**Новые записи:** поле `code` обязательно; UI создания/редактирования статуса ADR — поле «Код» с валидацией `[A-Z0-9_]+`.

### 3.2. `archrep.ar_adr_increment_relation_statuses`

Аналогично:

- `code varchar(64) NOT NULL UNIQUE`
- Примеры: `INCR_REL_CREATING`, `INCR_REL_MODIFYING`, `INCR_REL_IN_USE`, `INCR_REL_REMOVING` (или короче: `CREATING`, `MODIFYING` — если не конфликтуют с другими справочниками; лучше префикс `ADR_INCR_REL_*`).

### 3.3. `archrep.ar_integration_flow_statuses` (рекомендуется)

Сейчас в коде в **`ADR_FLOW_STATUS_MAP`** подставляются **id** статусов потоков (`1`, `3`, `4`…). Для полного варианта B:

- Добавить `code varchar(64) NOT NULL UNIQUE` в `ar_integration_flow_statuses`.
- Заполнить коды для сидов (например `FLOW_STATUS_PLANNED`, `FLOW_STATUS_ACTIVE`, … — в соответствии с бизнес-смыслом ваших строк в `archrep_integration_flows_seed.sql`).

Тогда параметр хранит **код → код**, без числовых id.

---

## 4. Новые параметры (замена старых)

| Старый параметр | Новый код параметра | Тип `value_type` | Формат `value` (пример) |
|-----------------|---------------------|------------------|-------------------------|
| `ADR_APPROVED_NAMES` | **`ADR_APPROVED_STATUS_CODES`** | `json` (массив строк) | `["ADR_STATUS_APPROVED_ARCH","ADR_STATUS_APPROVED_COUNCIL"]` |
| `ADR_DRAFT_STATUS` (имя черновика) | **`ADR_DRAFT_STATUS_CODE`** | `string` | `ADR_STATUS_DRAFT` |
| `ADR_FLOW_STATUS_MAP` (имя → id потока) | **`ADR_FLOW_STATUS_MAP_BY_CODE`** | `json` (объект) | `{"INCR_REL_CREATING":"FLOW_STATUS_PLANNED","INCR_REL_MODIFYING":"FLOW_STATUS_ACTIVE",...}` |

Ключи и значения в JSON — **коды справочников**, не id и не локализованные имена.

**Статус (issue #91):** `ADR_APPROVED_NAMES` и `ADR_DRAFT_STATUS` **удалены** миграцией
`DB/scripts/migrate_20261006120000_adr_increment_status_params.sql` (раздел 3) — код работает
только по кодам (`ADR_APPROVED_STATUS_CODES`, `ADR_DRAFT_STATUS_CODE`, `ADR_EDITABLE_STATUS_CODES`).
Параметр `ADR_FLOW_STATUS_MAP` оставлен под тем же кодом (сменилась только семантика — коды),
дополнительно введены `ADR_FLOW_DEFAULT_STATUS_CODE` и `ADR_STATUS_MAP_STRICT`.

**Именование:** можно оставить один параметр `ADR_FLOW_STATUS_MAP`, сменив только семантику (в документации и UI указать «коды»); либо ввести новый код, чтобы явно отделить миграцию.

---

## 5. Логика на бэкенде

### 5.1. Кэш резолва кодов

При старте после `loadParams(pool)` (или лениво при первом использовании):

1. Загрузить из БД пары `(code, id)` для трёх таблиц (или двух, если значения маппинга оставить числовыми id — неполный B).
2. Держать в памяти `Map` / объекты: `adrStatusCodeToId`, `incrRelStatusCodeToId`, `flowStatusCodeToId`.

При изменении справочников через API (если есть CRUD) — либо инвалидировать кэш, либо перечитывать при следующем запросе (проще — перезапуск приложения для редких справочников).

### 5.2. Утверждение заключения → потоки

Текущая логика: `newStatusId` → `SELECT name` → `approvedNames.includes(name)`.

**Новая логика:**

1. Прочитать из параметра массив кодов `ADR_APPROVED_STATUS_CODES`.
2. По `newStatusId` получить строку `code` из `ar_adr_statuses` (один запрос или кэш `id → code`).
3. Условие: `approvedCodes.includes(statusCode)`.

**Черновик:** вместо сравнения `status_name === 'Черновик'` — сравнение `statusCode === getParam('ADR_DRAFT_STATUS_CODE', 'ADR_STATUS_DRAFT')` (или резолв id черновика по коду и сравнение id).

### 5.3. Создание потоков из связей инкремента

Текущая логика: `status_name` связи → ключ в объекте маппинга → `flowStatusId`.

**Новая логика:**

1. В выборке `adr_increment_relations_*` гарантировать поля `ar_adr_increment_relation_statuses_id` и **`increment_relation_status_code`** (join к справочнику).
2. Прочитать `ADR_FLOW_STATUS_MAP_BY_CODE` (или обновлённый `ADR_FLOW_STATUS_MAP`).
3. По `increment_relation_status_code` найти **код** статуса потока в объекте маппинга.
4. `flowStatusCodeToId[thatCode]` → подставить в `integration_flows_insert`.

Если для связи `status_id` NULL — политика по умолчанию (как сейчас `?? 1`): отдельный параметр `ADR_FLOW_STATUS_DEFAULT_CODE` или жёсткий дефолт в коде.

### 5.4. Ошибки конфигурации

- Неизвестный код в параметре → лог `warn`, пропуск или дефолт (политика на усмотрение: fail-fast в dev, мягко в prod).
- Дубли кодов в справочнике — запрещены UNIQUE.

---

## 6. Изменения SQL (`queries.js`)

- Все запросы, отдающие статусы ADR / статусы связи инкремента для UI и для бэкенд-логики, должны включать **`code`** (и при необходимости оставить `name` для отображения).
- `adr_status_get_name` → дополнить или добавить `adr_status_get_by_id` с полями `id, name, code`.
- `adr_increment_relations_by_increment` — добавить join к `ar_adr_increment_relation_statuses` и поле `status_code` (или `increment_relation_status_code`).

---

## 7. Фронтенд (v3)

- Формы справочников **статусов ADR** и **статусов связи инкремента**: обязательное поле «Код», подсказка про стабильность и использование в параметрах.
- Экран **«Настройки → Параметры»**: для JSON-параметров маппинга — желательно подсказка со списком допустимых кодов (опционально: мини-API `GET /api/ref-status-codes` или расширение существующих списков).
- Форма заключения не обязана меняться: по-прежнему выбор статуса по **id**; меняется только серверная интерпретация.

---

## 8. Документы и сиды

- Обновить **`docs/settings-parameters-candidates.md`**: описать новые параметры и убрать/пометить устаревшие.
- **`DB/scripts/seed_settings_parameters_from_candidates.sql`**: новые значения по умолчанию с кодами.
- Сиды **`archrep_adr_v2.sql`**, **`archrep_integration_flows_seed.sql`**: вставка строк с **`code`** (или отдельная миграция `ALTER` + `UPDATE` после добавления колонки).

---

## 9. Миграция с продакшена (пошагово)

1. Выкатить миграцию БД: колонки `code` (nullable → заполнить → NOT NULL + UNIQUE).
2. Заполнить параметры в БД новыми кодами (скрипт или ручной ввод).
3. Выкатить бэкенд, который использует только code-based параметры (`ADR_APPROVED_STATUS_CODES`, `ADR_DRAFT_STATUS_CODE`, `ADR_FLOW_STATUS_MAP`).

---

## 10. Краткий чеклист работ

| # | Задача |
|---|--------|
| 1 | Миграция: `code` + UNIQUE для `ar_adr_statuses`, `ar_adr_increment_relation_statuses`, `ar_integration_flow_statuses` |
| 2 | Заполнение `code` для существующих строк + обновление INSERT в сидах |
| 3 | API/UI: CRUD справочников с полем `code`, валидация |
| 4 | `queries.js`: поля `code` в нужных SELECT |
| 5 | Кэш/резолвер `code ↔ id` на бэкенде |
| 6 | Замена логики в `createFlowsFromConclusion` и в `PUT .../decisions/applied/:id/full` |
| 7 | Новые параметры в `settingsParams` / `GET /api/config` (если нужны на фронте — обычно нет) |
| 8 | Обновление `seed_settings_parameters_from_candidates.sql` и документации |
| 9 | Проверка всех окружений после отключения legacy-поддержки |

---

## 11. Пример целевых кодов (для согласования с бизнесом)

**`ar_adr_statuses.code`**

- `ADR_STATUS_DRAFT`
- `ADR_STATUS_APPROVED_ARCH`
- `ADR_STATUS_APPROVED_COUNCIL`

**`ar_adr_increment_relation_statuses.code`** (пример, привязка к текущим смыслам)

- `ADR_INCR_REL_CREATING` — «Создаётся»
- `ADR_INCR_REL_MODIFYING` — «Модифицируется»
- `ADR_INCR_REL_IN_USE` — «Используется»
- `ADR_INCR_REL_REMOVING` — «Удаляется»

**`ar_integration_flow_statuses.code`** — задать в соответствии с вашими сид-строками (имена сейчас на русском в `archrep_integration_flows_seed.sql`); после добавления `code` параметр может выглядеть так:

```json
{
  "ADR_INCR_REL_CREATING": "FLOW_STATUS_REGISTERED",
  "ADR_INCR_REL_MODIFYING": "FLOW_STATUS_ACTIVE",
  "ADR_INCR_REL_IN_USE": "FLOW_STATUS_ACTIVE",
  "ADR_INCR_REL_REMOVING": "FLOW_STATUS_DECOMMISSIONED"
}
```

Точные значения правой части — по вашей модели статусов потоков.

---

## 12. Реализация в репозитории (issue #31)

- Миграция БД: `DB/schema/archrep_issue31_adr_ref_codes.sql` — колонка `code` и заполнение для `ar_adr_statuses`, `ar_adr_increment_relation_statuses`, `ar_integration_flow_statuses`.
- Кэш резолва: `backend/refCodes.js`, загрузка после `loadParams` при старте; перезагрузка после CRUD статусов связи и статусов потоков.
- Логика заключений: `backend/index.js` — только `ADR_APPROVED_STATUS_CODES`, `ADR_DRAFT_STATUS_CODE`, `ADR_FLOW_STATUS_MAP` (код→код), без fallback на параметры по именам.
- Сиды параметров: `DB/scripts/seed_settings_parameters_from_candidates.sql`; для уже развёрнутых БД — `DB/scripts/migrate_settings_params_adr_codes.sql`.

*Исходно: вариант B для обсуждения; коды зафиксированы в миграции и сидах.*
