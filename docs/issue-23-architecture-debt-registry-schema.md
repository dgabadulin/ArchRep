# Issue #23: реестр архитектурного долга — спецификация схемы данных

**GitHub (реализация / umbrella):** https://github.com/dgabadulin/ArchRep/issues/38  
**Процесс учёта задач:** [process-issue-tracking.md](./process-issue-tracking.md)

Документ описывает структуру БД для реестра архитектурного долга. **Реализация пока не выполняется** — только проектирование.

---

## 1. Справочник типов архитектурного долга

**Таблица:** `archrep.ar_gap_types`

| Атрибут     | Тип           | Описание                    |
|-------------|---------------|-----------------------------|
| id          | bigserial PK  | Идентификатор               |
| name        | varchar NOT NULL | Наименование             |
| description | text NULL     | Описание                    |

**Значения по умолчанию:**
- Архитектурное отклонение
- Архитектурное исключение

---

## 2. Справочник степеней влияния

**Таблица:** `archrep.ar_impact_level_types`

| Атрибут     | Тип           | Описание        |
|-------------|---------------|-----------------|
| id          | bigserial PK  | Идентификатор   |
| name        | varchar NOT NULL | Наименование  |
| description | text NULL     | Описание        |

**Значения по умолчанию:**
- Критический
- Высокий
- Средний
- Низкий

---

## 3. Справочник состояний разрыва (арх.долга)

**Таблица:** `archrep.ar_gap_states`

| Атрибут     | Тип           | Описание        |
|-------------|---------------|-----------------|
| id          | bigserial PK  | Идентификатор   |
| name        | varchar NOT NULL | Наименование  |
| description | text NULL     | Описание        |

**Примеры значений:** Выявлен, Запланирован, В работе, Закрыт (при необходимости уточнить перечень).

---

## 4. Статус утверждения

Используется **существующий** справочник `archrep.ar_adr_statuses` (черновик, утверждено архитектором, утверждено арх.советом). Отдельная таблица не создаётся. На форме редактирования справочников нужно вывести этот справочник под названием «Статус утверждения» (если ещё не выведен).

---

## 5. Реестр архитектурного долга (основная таблица)

**Таблица:** `archrep.ar_gaps`

| Атрибут                  | Тип           | Описание |
|--------------------------|---------------|----------|
| id                       | bigserial PK  | Идентификатор |
| code                     | varchar UNIQUE NOT NULL | Код записи (например, GAP-1, GAP-2 или автогенерация) |
| name                     | varchar NOT NULL | Краткое наименование / описание архитектурного долга |
| description              | text NULL     | Детальное описание (текущее vs целевое состояние) |
| consequences             | text NULL     | Последствия |
| ar_impact_level_types_id | int8 NULL FK  | Степень влияния → ar_impact_level_types |
| remediation_effort       | varchar NULL  | Оценка трудоёмкости устранения |
| target_date              | date NULL     | Желаемая дата устранения |
| ar_gap_states_id         | int8 NULL FK  | Состояние → ar_gap_states |
| resolved_date            | date NULL     | Фактическая дата устранения |
| ar_adr_statuses_id       | int8 NULL FK  | Статус утверждения → ar_adr_statuses (тот же, что у арх.заключения) |
| ar_gap_types_id          | int8 NULL FK  | Тип архитектурного долга → ar_gap_types (отклонение / исключение) |
| source                   | varchar NULL  | Источник информации |
| created_at               | timestamptz   | Дата создания |
| updated_at               | timestamptz   | Дата обновления |

**Внешние ключи:**
- `ar_impact_level_types_id` → `archrep.ar_impact_level_types(id)` ON DELETE SET NULL
- `ar_gap_states_id` → `archrep.ar_gap_states(id)` ON DELETE SET NULL
- `ar_adr_statuses_id` → `archrep.ar_adr_statuses(id)` ON DELETE SET NULL
- `ar_gap_types_id` → `archrep.ar_gap_types(id)` ON DELETE SET NULL

**Индексы:** по code, по ar_gap_states_id, по ar_impact_level_types_id, по ar_gap_types_id, по target_date (для отчётов).

---

## 6. Связи арх.долга с другими сущностями

Связи хранятся в **существующей** таблице `archrep.ar_metamodel_relations`:

- `from_entity_type` = `'gap'` (или код типа сущности для gap в ar_metamodel_entity_types)
- `from_entity_id` = id записи из ar_gaps
- `to_entity_type` / `to_entity_id` — система, технология, процесс, ADR и т.д.
- `relation_type` — например, `gap_affects`, `related_to` (типы добавить в ar_metamodel_relation_types при реализации).

В **ar_metamodel_entity_types** нужно добавить тип сущности с кодом `gap` и table_name = `ar_gaps`, чтобы связи в графе метамодели и в форме «Связи» работали единообразно.

---

## 7. Зависимости от других функций

- **Справочники:** формы редактирования ar_impact_level_types, ar_gap_states, ar_gap_types; на форме справочников — блок «Статус утверждения» (ar_adr_statuses).
- **Меню и главный экран:** пункт «Архитектурный долг», плитка на главной.
- **Табличная форма:** список ar_gaps (аналогично системам/технологиям) — поиск, сортировка, переход в карточку.
- **Форма редактирования арх.долга:** две вкладки — «Архитектурный долг» (все атрибуты, включая тип ar_gap_types_id) и «Связи» (просмотр/добавление/удаление записей в ar_metamodel_relations где from_entity_type='gap' и from_entity_id = id текущей записи).
- **Анализ зависимостей:** при реализации — учесть сущность gap в графе метамодели и в отчётах (например, «неучтённые зависимости» с учётом связей долга).

---

## 8. Порядок внедрения (когда будет реализация)

1. Миграция: создать ar_gap_types, ar_impact_level_types, ar_gap_states, заполнить начальные значения.
2. Миграция: создать ar_gaps с полями выше и FK.
3. В ar_metamodel_entity_types добавить тип `gap`, table_name = `ar_gaps`.
4. В ar_metamodel_relation_types при необходимости добавить типы связей для gap (например, gap_affects).
5. Backend: API для CRUD ar_gaps, справочников, связей (по аналогии с системами/ADR).
6. Frontend: пункт меню, плитка, список, форма с вкладками «Архитектурный долг» и «Связи».
7. Формы редактирования справочников ar_impact_level_types, ar_gap_states, ar_gap_types + вывод «Статус утверждения» (ar_adr_statuses).
