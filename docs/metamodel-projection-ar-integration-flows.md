# Проекция `ar_integration_flows` в связи метамодели (`ar_metamodel_relations`)

**Статус:** реализовано в коде (миграция `archrep_issue33_integration_flow_metamodel_projection.sql`, BFF, фронт); применить миграцию и сид на окружении.  
**Связанные задачи:** [issue-33-metamodel-integration-flows-projection.md](./issue-33-metamodel-integration-flows-projection.md) · [issue-35-metamodel-mass-rebuild-ui.md](./issue-35-metamodel-mass-rebuild-ui.md) (доп. админ-UI при необходимости)

---

## 1. Цель

- **`archrep.ar_integration_flows`** остаётся **источником истины**: полный атрибутный состав, FK, бизнес-валидация, API BFF.
- В **`archrep.ar_metamodel_relations`** хранятся **только строки-проекции**, соответствующие потокам: концы **`system` / `subsystem`** и код **`integration_flow*`** вычисляются по `ar_systems.parent_ar_systems_id` (см. issue #56, `migrate_issue56_integration_flow_module_projections.sql`).
- Подписи и отображаемое имя для графа и форм — в метамодели (см. §4); **пересчёт** при изменении потока или шаблона в параметре.

---

## 2. Семантика проекции

| Аспект | Значение |
|--------|----------|
| `from_entity_type` | `'system'` или `'subsystem'` — по `ar_systems.parent_ar_systems_id` на момент синхронизации |
| `from_entity_id` | `source_ar_systems_id` |
| `to_entity_type` | `'system'` или `'subsystem'` — по `parent_ar_systems_id` целевой строки |
| `to_entity_id` | `target_ar_systems_id` |
| `relation_type` | Один из: **`integration_flow`** (system→system), **`integration_flow_system_module`**, **`integration_flow_module_system`**, **`integration_flow_module_module`** — см. `DB/scripts/migrate_issue56_integration_flow_module_projections.sql` и `docs/issue-56-analyzer-module-integration-projections.md`. |

**Связь 1:1:** одна строка **`ar_integration_flows`** ↔ одна **строка-проекция** в `ar_metamodel_relations` с тем же смыслом. Ключ стабильности — **`reference_to_baserow`** (§5).

Полный атрибутивный состав потока в метамодели **не копируется**; детали — из `ar_integration_flows` по **`reference_to_baserow`** (= `id` потока для данного источника).

---

## 3. Механизм синхронизации: триггеры и массовая пересборка

### 3.1. Триггеры на `ar_integration_flows`

На таблицу **`ar_integration_flows`** — триггеры **`AFTER INSERT` и `AFTER UPDATE`** (уровень строк):

- **INSERT / UPDATE:** upsert **одной** строки-проекции в `ar_metamodel_relations` по **`reference_to_baserow`** с актуальным `relation_type` из набора **`integration_flow*`**; обновить `name`, `displayed_name`, при необходимости `description` / `payload` / `updated_at`.

### 3.2. Триггер `DELETE` — не используем

**Договорённость:** триггер **`AFTER DELETE`** на **`ar_integration_flows` не вводится**. Синхронизация после удалений потоков — только **ручная или плановая** пересборка вызовом **`archrep.rebuild_integration_flow_metamodel_relations()`** (§3.3).

- До вызова пересборки в метамодели возможны **устаревшие строки-проекции** (в т.ч. ссылки на уже удалённые потоки).
- **Типичный случай:** удаление **системы** каскадом удаляет строки в **`ar_integration_flows`**, но строки-проекции в **`ar_metamodel_relations`** остаются до пересборки — **это приемлемо**; устранение — **тот же** вызов массовой функции (по расписанию, после импорта, из UI — [issue-35](./issue-35-metamodel-mass-rebuild-ui.md)).

### 3.3. Функция массовой пересборки проекций `integration_flow`

**Имя (зафиксировано в спецификации):** **`archrep.rebuild_integration_flow_metamodel_relations()`**

Сигнатура при реализации: **`RETURNS void`** (при желании позже расширить до отчёта о числе удалённых/вставленных строк — отдельным изменением).

Поведение (идемпотентно):

1. Удаляет из **`ar_metamodel_relations`** только строки-проекции с **`relation_type` в** (`integration_flow`, `integration_flow_system_module`, `integration_flow_module_system`, `integration_flow_module_module`).
2. Вставляет проекции заново **из актуального состава** `ar_integration_flows`.

Так **не** затрагиваются прочие связи метамодели (вручную созданные, другие типы, другие источники проекций).

**Использование:** миграции, починка после сбоя, смена шаблона **`DISP_INTEGRATION_FLOW_NAME`** (пересчёт всех **`displayed_name`** по потокам — см. §4), **плановый** job, вызов из UI ([issue-35](./issue-35-metamodel-mass-rebuild-ui.md)). Готовый одноразовый SQL для БД: **`DB/scripts/migrate_issue35_integration_flow_metamodel.sql`** (проверка предусловий, DSIP→DISP при необходимости, пересборка).

### 3.4. Ограничения

- Прямое редактирование **строк-проекций** пользователем нежелательно (политика UI/API): источник истины — доменная таблица.
- Триггеры при массовых `UPDATE` — следить за производительностью.

---

## 4. Имена на графе и в формах: `name` и `displayed_name`

В **`ar_metamodel_relations`** (миграция):

- Колонка **`name`** — базовое/каноническое наименование связи (по правилам продукта; может задаваться триггером или оставаться фиксированным шаблоном).
- Колонка **`displayed_name`** — вычисляемая подпись по параметру **`DISP_INTEGRATION_FLOW_NAME`** (шаблон как у **других параметров DISP**: строка с плейсхолдерами, формат и описание — по аналогии с существующими DISP в репозитории).

**Правило отображения везде (граф, экранные формы списков/карточек связей):**

1. Показываем **`displayed_name`**, если оно **не пустое** (после `trim`).
2. Иначе показываем **`name`**.

Значение для **`displayed_name`** **не** зашивается одной SQL-строкой в теле триггера: вызывается функция **`archrep.integration_flow_metamodel_displayed_name(flow_id bigint)`**, которая:

1. Читает параметр **`DISP_INTEGRATION_FLOW_NAME`** (через чтение `ar_settings_parameters` или слой, согласованный с ИСАР).
2. Подтягивает справочники и поля потока.
3. Записывает результат в **`displayed_name`**.
4. При пустом или некорректном параметре — **безопасный fallback** (по аналогии с другими DISP-параметрами), зафиксировать в спецификации реализации.

**Пересчёт только из-за смены параметра:** строки `ar_integration_flows` не меняются — обновить все **`displayed_name`** у проекций потоков можно отдельным проходом (та же массовая функция или лёгкий проход по потокам). В документе фиксируем формулировку: *«обновить все **displayed_name** по потокам»* (не путать с **`name`**).

**Чтение параметра из триггера PostgreSQL:** допустимо (`SELECT` из `ar_settings_parameters`); при смене параметра без пересборки подписи устаревают до административного действия.

**Условные блоки `[[ ... ]]`:** при сохранении значения параметра в API действует та же проверка, что и для остальных `DISP_*` (баланс скобок, разрешённые плейсхолдеры). В функции PostgreSQL для потоков по умолчанию используется только подстановка `{placeholder}` через `replace`; интерпретация `[[ ... ]]` в БД не дублируется — при необходимости задавайте шаблон без условных блоков или расширяйте функцию.

---

## 5. Идемпотентность: `reference_to_baserow`

Чтобы одна запись базовой строки всегда мапилась на одну проекцию и **не** опираться на совпадение `(from, to, relation_type)` (между двумя системами может быть **несколько** потоков):

- В **`ar_metamodel_relations`** добавить столбец **`reference_to_baserow`** (тип, например **`bigint`**, `NULL` для строк **без** доменного источника в этой модели).
- **Foreign key не создавать:** источники проекций в будущем могут быть разные (не только `ar_integration_flows`); смысл значения задаётся парой **`relation_type` + соглашение** (для потоков: `reference_to_baserow` = **`ar_integration_flows.id`**).
- Создать **уникальный индекс** по **`reference_to_baserow`** для всех проекций потоков (`integration_flow*`), чтобы гарантировать 1:1 с потоком (см. `ar_metamodel_rel_iflow_proj_ref_uq` в миграции issue #56).

Upsert и поиск проекции для триггера — по этому ключу + `relation_type`.

---

## 6. Зависимости и порядок внедрения (черновик)

1. Тип связи **`integration_flow`** в `ar_metamodel_relation_types` (согласовать с FK на типы сущностей, если актуально).
2. Миграция: колонки **`reference_to_baserow`**, **`displayed_name`**; индекс(ы); уникальность для проекций потоков.
3. Параметр **`DISP_INTEGRATION_FLOW_NAME`** + значение по умолчанию + сид/админка (как у других DISP).
4. Функция вычисления **`displayed_name`** + триггеры **INSERT/UPDATE** на `ar_integration_flows`.
5. Реализовать **`archrep.rebuild_integration_flow_metamodel_relations()`**; backfill через неё же.
6. Документация: [togaf-metamodel-implementation.md](./togaf-metamodel-implementation.md); при необходимости строка в `settings-parameters-candidates.md`.
7. Фронт графа и форм: чтение подписи по правилу **сначала `displayed_name`, иначе `name`**.
8. UI вызова пересборки: [issue-35](./issue-35-metamodel-mass-rebuild-ui.md).

---

## 7. Вне scope данного документа

- Проекции других «жёстких» таблиц (система–подсистема и т.д.) — отдельные задачи по тому же шаблону.

---

## 8. Пояснение: «ручные» рёбра и зона действия пересборки

**О чём этот параграф.** Раньше обсуждался вопрос: могут ли в **`ar_metamodel_relations`** жить связи **system → system**, которые **не** являются проекцией из **`ar_integration_flows`** (например введены вручную в другом экране или придут из другого механизма), при том что на графе они выглядят «как связь между системами».

**Что фиксируем:**

- Спецификация **не запрещает** иметь в таблице **и** проекции потоков (`relation_type = 'integration_flow'`, `reference_to_baserow` = id потока), **и** другие рёбра с теми же типами сущностей, но **другим** `relation_type` или без привязки к потоку.
- Функция **`archrep.rebuild_integration_flow_metamodel_relations()`** трогает **только** строки-проекции с **`relation_type` в** (`integration_flow`, `integration_flow_system_module`, `integration_flow_module_system`, `integration_flow_module_module`). **Любые другие** строки метамодели при пересборке **не удаляются и не перезаписываются**.

Итог: §8 — это страховка от неверного толкования «массовая очистка»: она **не** «чистит все связи между системами», а только **заранее оговоренный срез** проекций интеграционных потоков.
