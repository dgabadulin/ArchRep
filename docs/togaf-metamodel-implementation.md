# Вариант реализации задачи #14: метамодель TOGAF

## Цель задачи

Расширить модель данных и функциональность системы до метамодели TOGAF: реализовать все объекты и их связи.

## Текущее состояние (что уже есть)

| TOGAF-подобная сущность | В репозитории | Связи |
|-------------------------|---------------|--------|
| Application / Information System | `ar_systems` | parent, status, vendor, owner, hosting |
| Technology Component | `ar_technologies` | vendor, class, type, status |
| Application ↔ Technology | `ar_metamodel_relations` (`relation_type` из `SYS_TECH_STACK_RELATION_CODE`, по умолчанию `system_technology`) | system–technology (deployment) |
| Integration (Application–Application) | `ar_integration_flows` | source_system–target_system |
| Principle | `ar_principles` | — |
| Architecture Decision (ADR) | `ar_adrs_principle`, `ar_adrs_applied`, инкременты | ADR–система, ADR–интеграция |
| Organization / Partner | `ar_partners`, `ar_system_owners` | системы ↔ партнёры/владельцы |
| Справочники | статусы систем, типы хостинга, типы событий/статусы потоков и т.д. | — |

То есть уже покрыты: системы (приложение), технологии, интеграции система–система, принципы, архитектурные решения, организации/владельцы. Не хватает сущностей и связей бизнес- и данных-уровня, а также части связей TOGAF.

## Ядро метамодели TOGAF (что добавить)

Ориентация на **TOGAF 9.2 Content Metamodel** (Core + распространённые расширения).

### 1. Бизнес-уровень (Business Architecture)

| Сущность | Описание | Таблица / маппинг |
|----------|----------|--------------------|
| Organization Unit | Организационная единица с целями и метриками | Новая: `ar_organization_units` |
| Actor | Роль/актор (вне или внутри системы) | Новая: `ar_actors` или расширить роли в `ar_system_owners` |
| Business Service | Бизнес-сервис, явно управляемый организацией | Новая: `ar_business_services` |
| Business Function | Функция как единица бизнес-способности | Новая: `ar_business_functions` |
| Process | Процесс (поток работ) | Новая: `ar_processes` |
| Value Stream | Цепочка создания ценности | Опционально: `ar_value_streams` |
| Driver / Goal / Objective | Цели и драйверы | Опционально: `ar_goals`, `ar_objectives` |

Связи: Organization Unit → owns → Business Service; Business Service → realized by → Application (ar_systems); Function → part of → Process; Actor → performs → Function и т.д.

### 2. Уровень приложений и данных (уже частично есть)

| Сущность | Действие |
|----------|----------|
| Application Component | Уже как `ar_systems` (при необходимости переименовать концепт в документации). |
| Data Entity | Сущность данных (логическая модель) | Новая: `ar_data_entities` |
| Logical Data Component | Компонент данных | Новая: `ar_data_components` или связь Data Entity ↔ Application |
| Application Service | Сервис приложения (интерфейс) | Можно выделить из `ar_integration_flows` + новая таблица `ar_application_services` при необходимости |

Связи: Application → serves → Application Service; Application → manages → Data Entity; Integration Flow можно трактовать как связь между Application Services.

### 3. Технологический уровень (уже есть)

- **Technology Component** — `ar_technologies`.
- **Application deployed on Technology** — `ar_metamodel_relations` (тип `system_technology`, issue #44).
- При необходимости: **Platform Service**, **Technology Service** — новые таблицы или атрибуты/справочники.

### 4. Governance и реализация

| Сущность | Описание | Реализация |
|----------|----------|------------|
| Principle | Уже есть `ar_principles`. | — |
| Requirement | Требование | Новая: `ar_requirements` (связь с системой/процессом/ADR) |
| Constraint | Ограничение | Новая: `ar_constraints` или атрибут к принципам/требованиям |
| Contract / Interface | Контракт/интерфейс между сервисами | Можно расширить `ar_integration_flows` или новая таблица |
| Gap | Разрыв (Gap) между текущим и целевым состоянием | Новая: `ar_gaps` (связь с Work Package / ADR при желании) |
| Work Package | Рабочий пакет реализации | Опционально; можно связать с `ar_adrs_applied` |
| Capability | Способность (зрелость) | Опционально: справочник или атрибут к сервисам/функциям |

### 5. Универсальная модель связей (рекомендуется)

Чтобы не плодить десятки таблиц под каждую пару сущностей, удобно ввести **общую таблицу связей** между «объектами метамодели»:

- **ar_metamodel_entity_types** — типы сущностей (system, technology, business_service, process, data_entity, actor, organization_unit, principle, requirement, …).
- **ar_metamodel_relations** — связи:
  - `from_entity_type`, `from_entity_id`
  - `to_entity_type`, `to_entity_id`
  - `relation_type` (например: realizes, serves, implements, composed_of, assigned_to, depends_on)
  - опционально: `name`, `description`, `payload` (JSON)

Тогда многие связи TOGAF (Actor–Function, Function–Process, Service–Application, System–Data Entity и т.д.) хранятся в одной модели, а существующие таблицы (`ar_systems`, `ar_integration_flows`, …) остаются источниками истины для «первичных» сущностей; при необходимости часть связей можно дублировать в `ar_metamodel_relations` для единого графа.

Альтернатива — отдельные таблицы под каждый тип связи (например, `ar_system_business_services`, `ar_process_functions`); гибче — универсальная таблица, проще в реализации — явные таблицы под 2–3 приоритетных связи.

---

## Предлагаемый атрибутный состав сущностей

Общие для многих сущностей TOGAF атрибуты: **id**, **name** (краткое наименование), **description** (описание), **owner** / **source** (источник/владелец), **category** (пользовательская категория). Ниже — состав по таблицам; поля, которых ещё нет в БД, помечены как предлагаемые.

### Сущности, уже существующие в репозитории

**ar_systems** (Application Component)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigint PK | Идентификатор |
| code | varchar UNIQUE | Код системы |
| name | varchar | Краткое наименование |
| fullname | varchar | Полное наименование |
| parent_ar_systems_id | bigint FK | Родительская система (иерархия) |
| parent_name | varchar | Денормализованное имя родителя |
| ar_system_statuses_id | bigint FK | Статус системы |
| vendor_ar_partners_id | bigint FK | Вендор/разработчик |
| supplier_ar_partners_id | bigint FK | Поставщик/интегратор |
| supporter_ar_partners_id | bigint FK | Партнёр по поддержке |
| ar_system_owners_id | bigint FK | Владелец (направление бизнеса) |
| ar_system_hosting_types_id | bigint FK | Тип хостинга |
| description | text | Описание |
| it_lead_employee_id | bigint FK | Ответственный от ИТ (`ar_employees`) |
| business_lead_employee_id | bigint FK | Владелец системы / ответственный от бизнеса (`ar_employees`) |
| comment | text | Примечание |
| technologies | text | Текстовое перечисление технологий (legacy) |

*Предлагаемое дополнение (опционально):* `source` varchar — источник информации; `category` varchar — пользовательская категория/тег.

---

**ar_technologies** (Technology Component)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigint PK | Идентификатор |
| name | varchar | Наименование |
| vendor_ar_partners_id | bigint FK | Вендор |
| technology_classes_id | bigint FK | Класс технологии |
| technology_types_id | bigint FK | Тип технологии |
| technology_statuses_id | bigint FK | Статус в техрадаре |
| radar_include_flag | boolean | Включение в техрадар |
| domestic_flag | boolean | Отечественное ПО |
| description | text | Описание |
| approve_document | varchar | Основание для включения в каталог |

*Предлагаемое дополнение:* `code` varchar UNIQUE; `source` varchar; `category` varchar.

---

**ar_integration_flows** (Application–Application interface)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigint PK | Идентификатор |
| source_ar_systems_id | bigint FK | Система-источник |
| target_ar_systems_id | bigint FK | Система-получатель |
| ar_integration_flow_event_types_id | bigint FK | Тип инициирующего события |
| ar_integration_flow_statuses_id | bigint FK | Статус потока |
| transferred_data | text | Передаваемые данные |
| transfer_method | text | Способ передачи |
| created_at, updated_at | timestamptz | Аудит |

*Предлагаемое дополнение:* `name` varchar — наименование связи/интерфейса; `description` text; `source` varchar.

---

**ar_principles** (Principle)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigint PK | Идентификатор |
| name | varchar | Наименование |
| statement | text | Формулировка |
| rationale | text | Обоснование |
| implications | text | Последствия |
| is_approved | boolean | Признак утверждения |
| approve_document | varchar | Документ утверждения |

*Дополнение (по TOGAF):* `source` varchar; `category` varchar.

---

**ar_partners** (Partner / контрагент)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigint PK | Идентификатор |
| name | varchar | Наименование |

*Дополнение:* `description` text; `category` varchar (вендор/поставщик/поддержка).

---

**ar_system_owners** (Organization Unit — владелец систем)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigint PK | Идентификатор |
| name | varchar | Наименование |
| leader | varchar | Руководитель направления |

*Дополнение:* `description` text; `code` varchar.

---

**ar_adrs_principle** (Architecture Decision — принципиальное решение)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код (ADRP-…) |
| name | varchar NOT NULL | Наименование |
| context | text | Контекст |
| decision | text | Решение |
| consequences | text | Последствия |
| ar_adr_statuses_id | bigint FK | Статус |
| author | varchar | Автор |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_adrs_applied** (Architecture Decision — прикладное решение)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код (ADRA-…) |
| task_name | varchar | Наименование задачи |
| task_link | varchar | Ссылка на задачу |
| conclusion | text | Заключение |
| ar_adr_statuses_id | bigint FK | Статус |
| author | varchar | Автор |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_adr_increments** (инкремент прикладного решения)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| ar_adrs_applied_id | bigint FK | Прикладное решение |
| order_index | int | Порядок |
| name | varchar | Наименование инкремента |
| ar_adr_increment_types_id | bigint FK | Тип (временное/целевое) |

---

**ar_adr_increment_systems**, **ar_adr_increment_relations** — связи инкремента с системами и интеграциями (атрибуты уже заданы в миграции; при необходимости добавляются `source`, `description`).

---

### Новые сущности: бизнес-уровень

**ar_organization_units** (Organization Unit)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код подразделения |
| name | varchar NOT NULL | Краткое наименование |
| fullname | varchar | Полное наименование |
| parent_id | bigint FK → ar_organization_units | Родительское подразделение |
| description | text | Описание |
| leader | varchar | Руководитель |
| source | varchar | Источник информации |
| category | varchar | Категория/тип (например, департамент, дирекция) |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_actors** (Actor)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код |
| name | varchar NOT NULL | Наименование роли/актора |
| description | text | Описание |
| ar_organization_units_id | bigint FK | Организационная единица (опционально) |
| actor_type | varchar | Тип: внутренний / внешний / система |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_business_services** (Business Service)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код сервиса |
| name | varchar NOT NULL | Краткое наименование |
| fullname | varchar | Полное наименование |
| description | text | Описание |
| ar_organization_units_id | bigint FK | Владелец (организационная единица) |
| ar_business_service_statuses_id | bigint FK | Статус (справочник) |
| source | varchar | Источник |
| category | varchar | Категория |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_business_functions** (Business Function)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код функции |
| name | varchar NOT NULL | Наименование |
| description | text | Описание |
| parent_id | bigint FK → ar_business_functions | Родительская функция (иерархия) |
| ar_organization_units_id | bigint FK | Владелец (опционально) |
| source | varchar | Источник |
| category | varchar | Категория |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_processes** (Process)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код процесса |
| name | varchar NOT NULL | Наименование |
| description | text | Описание |
| ar_process_statuses_id | bigint FK | Статус процесса (справочник) |
| ar_organization_units_id | bigint FK | Владелец процесса |
| source | varchar | Источник |
| category | varchar | Категория (например, основной/вспомогательный) |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_value_streams** (Value Stream — опционально)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код |
| name | varchar NOT NULL | Наименование |
| description | text | Описание |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_goals** (Goal — опционально)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код цели |
| name | varchar NOT NULL | Формулировка цели |
| description | text | Детализация |
| ar_organization_units_id | bigint FK | Владелец (опционально) |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_objectives** (Objective — опционально)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код |
| name | varchar NOT NULL | Формулировка |
| description | text | Описание |
| ar_goals_id | bigint FK | Цель, к которой относится |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

### Новые сущности: данные и приложения

**ar_data_entities** (Data Entity)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код сущности |
| name | varchar NOT NULL | Логическое имя сущности данных |
| description | text | Описание, назначение |
| source | varchar | Источник (модель, система-источник) |
| category | varchar | Категория (сущность предметной области, справочник, журнал и т.д.) |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_data_components** (Logical Data Component — опционально)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код компонента |
| name | varchar NOT NULL | Наименование |
| description | text | Описание |
| ar_data_entities_id | bigint FK | Ссылка на сущность данных (опционально) |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_application_services** (Application Service — опционально)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код сервиса |
| name | varchar NOT NULL | Наименование интерфейса/сервиса |
| description | text | Описание |
| ar_systems_id | bigint FK | Система, предоставляющая сервис |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

### Новые сущности: governance и реализация

**ar_requirements** (Requirement)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код требования |
| name | varchar NOT NULL | Краткая формулировка |
| description | text | Детальное описание |
| ar_requirement_statuses_id | bigint FK | Статус (справочник: предложено/принято/реализовано/отклонено) |
| priority | varchar / int | Приоритет (опционально) |
| source | varchar | Источник (документ, заявка) |
| category | varchar | Категория (функциональное/нефункциональное и т.д.) |
| created_at, updated_at | timestamptz | Аудит |

*Связи с системой, процессом, ADR — через ar_metamodel_relations.*

---

**ar_constraints** (Constraint)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код |
| name | varchar NOT NULL | Формулировка ограничения |
| description | text | Детализация |
| constraint_type | varchar | Тип (организационное, техническое, регуляторное) |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_gaps** (Gap — опционально)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код |
| name | varchar NOT NULL | Наименование разрыва |
| description | text | Описание (текущее vs целевое состояние) |
| ar_gap_statuses_id | bigint FK | Статус (выявлен/запланирован/закрыт) |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

**ar_work_packages** (Work Package — опционально)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код пакета |
| name | varchar NOT NULL | Наименование |
| description | text | Описание работ |
| ar_work_package_statuses_id | bigint FK | Статус |
| planned_start_date | date | Планируемая дата начала |
| planned_end_date | date | Планируемая дата окончания |
| source | varchar | Источник |
| created_at, updated_at | timestamptz | Аудит |

---

### Справочники метамодели и универсальные связи

**ar_metamodel_entity_types** (типы сущностей)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код типа (system, technology, business_service, process, data_entity, actor, organization_unit, principle, requirement и т.д.) |
| name | varchar NOT NULL | Наименование для отображения |
| table_name | varchar | Имя таблицы в БД (если сущность хранится в отдельной таблице) |
| description | text | Описание типа |

---

**ar_metamodel_relation_types** (типы связей)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| code | varchar UNIQUE | Код (realizes, serves, implements, composed_of, assigned_to, depends_on, manages, triggers и т.д.) |
| name | varchar NOT NULL | Наименование для отображения |
| description | text | Описание |
| from_entity_types | varchar[] | Допустимые типы сущности-источника (NULL = любые) |
| to_entity_types | varchar[] | Допустимые типы сущности-цели (NULL = любые) |

---

**ar_metamodel_relations** (универсальная таблица связей)

| Атрибут | Тип | Описание |
|---------|-----|----------|
| id | bigserial PK | Идентификатор |
| from_entity_type | varchar NOT NULL | Код типа сущности-источника (из ar_metamodel_entity_types) |
| from_entity_id | bigint NOT NULL | id сущности-источника в соответствующей таблице |
| to_entity_type | varchar NOT NULL | Код типа сущности-цели |
| to_entity_id | bigint NOT NULL | id сущности-цели |
| relation_type | varchar NOT NULL | Код типа связи (из ar_metamodel_relation_types) |
| name | varchar | Наименование связи (опционально) |
| description | text | Описание связи |
| payload | jsonb | Произвольные данные (опционально) |
| created_at, updated_at | timestamptz | Аудит |

Индексы: (from_entity_type, from_entity_id), (to_entity_type, to_entity_id), (relation_type).

---

## Этапы реализации

### Этап 1: Ядро без ломки текущей модели (2–4 недели)

- Документировать текущие сущности как отображение TOGAF: System = Application Component, Integration Flow = Application–Application interface, и т.д.
- Ввести справочник **типов сущностей метамодели** и **типов связей** (таблицы или enum в коде + миграция).
- Добавить универсальную таблицу **ar_metamodel_relations** (from/to entity_type + id, relation_type) и индексы.
- Реализовать API: создание/чтение/удаление связей между любыми парами сущностей (по типам из справочника).
- На фронте: минимальный экран или вкладка «Связи метамодели» (список связей с фильтром по типу сущности и типу связи). Опционально — интеграция с компонентом «Анализатор» (задача #13): узлы и рёбра графа подтягиваются из метамодели.

Результат: все уже существующие связи (система–технология, система–система через интеграции, ADR–система) можно отразить в едином графе связей и при необходимости дублировать в `ar_metamodel_relations` для единообразного обхода.

### Этап 2: Бизнес-сущности (2–3 недели)

- Таблицы: **ar_organization_units**, **ar_business_services**, **ar_business_functions**, **ar_processes** (минимальный набор полей: name, description, code, owner_id, status_id).
- Связи в `ar_metamodel_relations`: Organization Unit → Business Service; Business Service → Application (ar_systems); Function → Process; при необходимости Actor (если вводится отдельная таблица).
- CRUD API и простые списки/формы в разделе «Справочники» или новом разделе «Бизнес-архитектура».
- В «Анализаторе» (задача #13): возможность выбирать бизнес-сервисы/функции/процессы и строить граф по связям из метамодели.

### Этап 3: Данные, требования, контракты (2–3 недели)

- Таблицы: **ar_data_entities**, **ar_requirements** (и при необходимости **ar_application_services**).
- Связи: Application ↔ Data Entity, Application ↔ Application Service, Requirement → System/Process/ADR.
- API и UI: каталоги данных, требований; в форме системы — вкладка «Данные» и «Требования».
- При необходимости: расширение интеграционных потоков до «контрактов» (интерфейс, формат, SLA) или отдельная таблица контрактов.

### Этап 4: Доработки и расширения

- Цели и драйверы (Goal, Driver, Objective), Value Stream — при появлении запроса.
- Gaps, Work Packages, Capability — по приоритету.
- Полноценные матрицы и отчёты TOGAF (Business/Application/Data/Technology) на основе графа метамодели и существующих каталогов.

## Технические решения

- **Миграции:** каждая новая таблица/связь — отдельный файл в `DB/schema/` по образцу `archrep_integration_flows.sql`.
- **Backend:** новые маршруты в `backend/index.js`, запросы в `queries.js`; при росте числа сущностей — вынести маршруты по доменам (business, data, metamodel).
- **Фронт:** новые пункты меню (например, «Бизнес-архитектура», «Каталог данных») и общие компоненты списка/формы; граф зависимостей (задача #13) подключается к API метамодели.
- **Документация:** обновить README и при необходимости завести `docs/togaf-entity-mapping.md` — таблица соответствия «таблица/сущность репозитория ↔ сущность TOGAF».

## Критерии готовности по задаче #14

- В БД присутствуют сущности и связи, покрывающие **Core Content Metamodel** TOGAF (организация, сервис/функция/процесс, приложение, данные, технология, принципы, требования/ограничения и связи между ними).
- Все объекты и связи доступны через API и при необходимости отображаются в UI (каталоги, формы, граф зависимостей).
- Документировано соответствие «модель репозитория ↔ TOGAF» и порядок расширения (например, через данный файл и промпты в `docs/prompts/togaf_metamodel.md`).

## Ссылки

- TOGAF 9.2 Content Metamodel: [Open Group](https://pubs.opengroup.org/architecture/togaf91-doc/arch/chap34.html), [KnowledgeHut overview](https://www.knowledgehut.com/blog/it-service-management/togaf-content-metamodel).
- Текущие схемы: `DB/schema/`, `backend/queries.js`.
- Промпты для дальнейшей детализации: `docs/prompts/togaf_metamodel.md`.
