# Вариант реализации задачи #14: метамодель TOGAF

## Цель задачи

Расширить модель данных и функциональность системы до метамодели TOGAF: реализовать все объекты и их связи.

## Текущее состояние (что уже есть)

| TOGAF-подобная сущность               | В репозитории                                                      | Связи                                  |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| Application / Information System      | `ar_systems`                                                       | parent, status, vendor, owner, hosting |
| Technology Component                  | `ar_technologies`                                                  | vendor, class, type, status            |
| Application ↔ Technology              | `ar_metamodel_relations` (`system_technology`)                        | system–technology (deployment)         |
| Integration (Application–Application) | `ar_integration_flows`                                             | source_system–target_system            |
| Principle                             | `ar_principles`                                                    | —                                      |
| Architecture Decision (ADR)           | `ar_adrs_principle`, `ar_adrs_applied`, инкременты                 | ADR–система, ADR–интеграция            |
| Organization / Partner                | `ar_partners`, `ar_system_owners`                                  | системы ↔ партнёры/владельцы           |
| Справочники                           | статусы систем, типы хостинга, типы событий/статусы потоков и т.д. | —                                      |

То есть уже покрыты: системы (приложение), технологии, интеграции система–система, принципы, архитектурные решения, организации/владельцы. Не хватает сущностей и связей бизнес- и данных-уровня, а также части связей TOGAF.

## Ядро метамодели TOGAF (что добавить)

Ориентация на **TOGAF 9.2 Content Metamodel** (Core + распространённые расширения).

### 1. Бизнес-уровень (Business Architecture)

| Сущность                  | Описание                                     | Таблица / маппинг                                          |
| ------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| Organization Unit         | Организационная единица с целями и метриками | Новая: `ar_organization_units`                             |
| Actor                     | Роль/актор (вне или внутри системы)          | Новая: `ar_actors` или расширить роли в `ar_system_owners` |
| Business Service          | Бизнес-сервис, явно управляемый организацией | Новая: `ar_business_services`                              |
| Business Function         | Функция как единица бизнес-способности       | Новая: `ar_business_functions`                             |
| Process                   | Процесс (поток работ)                        | Новая: `ar_processes`                                      |
| Value Stream              | Цепочка создания ценности                    | Опционально: `ar_value_streams`                            |
| Driver / Goal / Objective | Цели и драйверы                              | Опционально: `ar_goals`, `ar_objectives`                   |

Связи: Organization Unit → owns → Business Service; Business Service → realized by → Application (ar_systems); Function → part of → Process; Actor → performs → Function и т.д.

### 2. Уровень приложений и данных (уже частично есть)

| Сущность               | Действие                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| Application Component  | Уже как `ar_systems` (при необходимости переименовать концепт в документации). |
| Data Entity            | Сущность данных (логическая модель)                                            |
| Logical Data Component | Компонент данных                                                               |
| Application Service    | Сервис приложения (интерфейс)                                                  |

Связи: Application → serves → Application Service; Application → manages → Data Entity; Integration Flow можно трактовать как связь между Application Services.

### 3. Технологический уровень (уже есть)

- **Technology Component** — `ar_technologies`.
- **Application deployed on Technology** — `ar_metamodel_relations` (`system_technology`).
- При необходимости: **Platform Service**, **Technology Service** — новые таблицы или атрибуты/справочники.

### 4. Governance и реализация

| Сущность             | Описание                                        | Реализация                                                  |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Principle            | Уже есть `ar_principles`.                       | —                                                           |
| Requirement          | Требование                                      | Новая: `ar_requirements` (связь с системой/процессом/ADR)   |
| Constraint           | Ограничение                                     | Новая: `ar_constraints` или атрибут к принципам/требованиям |
| Contract / Interface | Контракт/интерфейс между сервисами              | Можно расширить `ar_integration_flows` или новая таблица    |
| Gap                  | Разрыв (Gap) между текущим и целевым состоянием | Новая: `ar_gaps` (связь с Work Package / ADR при желании)   |
| Work Package         | Рабочий пакет реализации                        | Опционально; можно связать с `ar_adrs_applied`              |
| Capability           | Способность (зрелость)                          | Опционально: справочник или атрибут к сервисам/функциям     |

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



### Новые сущности: бизнес-уровень

**ar_organization_units** (Organization Unit)

| Атрибут                         | Тип                                         | Описание                                        |
| ------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| id                              | bigserial PK                                | Идентификатор                                   |
| code                            | varchar UNIQUE                              | Код подразделения                               |
| name                            | varchar NOT NULL                            | Краткое наименование                            |
| fullname                        | varchar                                     | Полное наименование                             |
| parent_id                       | bigint FK → ar_organization_units           | Родительское подразделение                      |
| description                     | text                                        | Описание                                        |
| leader                          | varchar                                     | Руководитель                                    |
| organization_unit_categories_id | bigint FK → ar_organization_unit_categories | Категория/тип (например, департамент, дирекция) |
| created_at, updated_at          | timestamptz                                 | Аудит                                           |

---



**ar_business_services** (Продукты компании)

| Атрибут                         | Тип              | Описание                           |
| ------------------------------- | ---------------- | ---------------------------------- |
| id                              | bigserial PK     | Идентификатор                      |
| code                            | varchar UNIQUE   | Код сервиса                        |
| name                            | varchar NOT NULL | Краткое наименование               |
| fullname                        | varchar          | Полное наименование                |
| description                     | text             | Описание                           |
| ar_organization_units_id        | bigint FK        | Владелец (организационная единица) |
| ar_business_service_statuses_id | bigint FK        | Статус (справочник)                |
| source                          | varchar          | Источник                           |
| category                        | varchar          | Категория                          |
| created_at, updated_at          | timestamptz      | Аудит                              |

---

**ar_business_functions** (Бизнес-способность)

| Атрибут                  | Тип                               | Описание                        |
| ------------------------ | --------------------------------- | ------------------------------- |
| id                       | bigserial PK                      | Идентификатор                   |
| code                     | varchar UNIQUE                    | Код функции                     |
| name                     | varchar NOT NULL                  | Наименование                    |
| description              | text                              | Описание                        |
| parent_id                | bigint FK → ar_business_functions | Родительская функция (иерархия) |
| ar_organization_units_id | bigint FK                         | Владелец (опционально)          |
| source                   | varchar                           | Источник                        |
| category                 | varchar                           | Категория                       |
| created_at, updated_at   | timestamptz                       | Аудит                           |

---

**ar_processes** — в текущем объёме не реализуется (исключено из списка).

---

**ar_goals_and_objectives** (Goal / Objective — опционально, единая таблица с иерархией)

| Атрибут                | Тип              | Описание                 |
| ---------------------- | ---------------- | ------------------------ |
| id                     | bigserial PK     | Идентификатор            |
| code                   | varchar UNIQUE   | Код цели/задачи          |
| name                   | varchar NOT NULL | Формулировка цели/задачи |
| description            | text             | Детализация              |
| parent_id              | bigint FK        | Родительская цель/задача |
| source                 | varchar          | Источник                 |
| created_at, updated_at | timestamptz      | Аудит                    |

---

---

### Новые сущности: данные и приложения

В текущем объёме не реализуются: Data Entity, Logical Data Component, Application Service (секция оставлена пустой по решению).

---

### Новые сущности: governance и реализация

В текущем объёме не реализуются: Requirement, Constraint, Gap, Work Package, Capability (секция оставлена пустой по решению).

---

### Справочники для новых сущностей (перечень таблиц)

- **ar_organization_unit_categories** — категории организационных единиц (департамент, дирекция, отдел и т.д.): `id`, `code`, `name`, `description`.
- **ar_actor_types** — типы акторов (внутренний, внешний, система): `id`, `code`, `name`, `description`.
- **ar_business_service_statuses** — статусы бизнес-сервисов: `id`, `name`, `description`.

---

### Справочники метамодели и универсальные связи

**ar_metamodel_entity_types** (типы сущностей)

| Атрибут     | Тип              | Описание                                                                                                                       |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| id          | bigserial PK     | Идентификатор                                                                                                                  |
| code        | varchar UNIQUE   | Код типа (system, technology, business_service, process, data_entity, actor, organization_unit, principle, requirement и т.д.) |
| name        | varchar NOT NULL | Наименование для отображения                                                                                                   |
| table_name  | varchar          | Имя таблицы в БД (если сущность хранится в отдельной таблице)                                                                  |
| description | text             | Описание типа                                                                                                                  |

---

**ar_metamodel_relation_types** (типы связей)

| Атрибут           | Тип              | Описание                                                                                           |
| ----------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| id                | bigserial PK     | Идентификатор                                                                                      |
| code              | varchar UNIQUE   | Код (realizes, serves, implements, composed_of, assigned_to, depends_on, manages, triggers и т.д.) |
| name              | varchar NOT NULL | Наименование для отображения                                                                       |
| description       | text             | Описание                                                                                           |
| from_entity_types | varchar[]        | Допустимые типы сущности-источника (NULL = любые)                                                  |
| to_entity_types   | varchar[]        | Допустимые типы сущности-цели (NULL = любые)                                                       |

---

**ar_metamodel_relations** (универсальная таблица связей)

| Атрибут                | Тип              | Описание                                                   |
| ---------------------- | ---------------- | ---------------------------------------------------------- |
| id                     | bigserial PK     | Идентификатор                                              |
| from_entity_type       | varchar NOT NULL | Код типа сущности-источника (из ar_metamodel_entity_types) |
| from_entity_id         | bigint NOT NULL  | id сущности-источника в соответствующей таблице            |
| to_entity_type         | varchar NOT NULL | Код типа сущности-цели                                     |
| to_entity_id           | bigint NOT NULL  | id сущности-цели                                           |
| relation_type          | varchar NOT NULL | Код типа связи (из ar_metamodel_relation_types)            |
| name                   | varchar          | Наименование связи (опционально)                           |
| description            | text             | Описание связи                                             |
| payload                | jsonb            | Произвольные данные (опционально)                          |
| created_at, updated_at | timestamptz      | Аудит                                                      |

Индексы: (from_entity_type, from_entity_id), (to_entity_type, to_entity_id), (relation_type).

---

## Уточнённое решение (по файлу _gdi)

**В объёме реализации:**

- Сущности, уже существующие в репозитории (без изменений атрибутного состава, при необходимости только дополнения вроде `source`/`category` по мере надобности).
- Новые таблицы бизнес-уровня: **ar_organization_units** (со справочником ar_organization_unit_categories), **ar_actors** (со справочником ar_actor_types), **ar_business_services** (со справочником ar_business_service_statuses), **ar_business_functions**.
- Опционально: **ar_goals_and_objectives** (единая таблица целей/задач с иерархией через parent_id).
- Метамодель связей: **ar_metamodel_entity_types**, **ar_metamodel_relation_types**, **ar_metamodel_relations**.

**Вне текущего объёма (не делаем):**

- Process (ar_processes), Value Stream (ar_value_streams).
- Data Entity, Logical Data Component, Application Service.
- Requirement, Constraint, Gap, Work Package, Capability.

Этапы 3 и 4 из исходного плана (данные, требования, контракты; цели/драйверы/расширения) выполняются только в части, пересекающейся с перечнем выше (например, ar_goals_and_objectives — по решению). Остальное — при последующем расширении.

---

## Дерево меню в UI

Предлагаемая структура меню для фронта (например, меню в `frontend-v3`), согласованная с текущим и добавляемым функционалом:

```
Главная
Управление архитектурой
  ├──Архитектурные принципы
  └── Архитектурные решения
      ├── Принципиальные решения
      └── Прикладные решения
Бизнес-архитектура                   
  ├── Организационные единицы
  ├── Акторы
  ├── Продукты
  ├── Бизнес-способности
  └── Цели и задачи        
Информационные системы
  ├── Каталог ИС
  └── Реестр интеграций
Технологии
  ├── Каталог технологий
  └── Тех.радар
Аналитика
  └── Анализ зависимостей             (компонент «Анализатор», задача #13)
  └── Связи объектов управления       (список/фильтр связей, при необходимости граф)
Настройки
  └── Справочники
        ├── Статусы систем
        ├── Типы хостинга
        ├── Владельцы (направления)
        ├── Партнёры (вендоры)
        ├── Статусы решений (ADR)
        ├── Типы событий интеграций
        ├── Статусы интеграционных потоков
        ├── Статусы систем в решении (инкременты)
        ├── Статусы интеграций в решении
        ├── Типы событий интеграций (реестр)
        ├── Статусы интеграционных потоков (реестр)
        ├── Категории орг. единиц      ← новый (ar_organization_unit_categories)
        ├── Типы акторов              ← новый (ar_actor_types)
        └── Статусы бизнес-сервисов   ← новый (ar_business_service_statuses)
```

**Вариант без отдельного раздела «Метамодель»:** пункт «Связи метамодели» можно вынести в «Аналитика» рядом с «Анализ зависимостей» (один экран — граф/анализатор, другой — таблица связей с фильтрами).

**Итог:** раздел «Бизнес-архитектура» с подпунктами под новые каталоги; раздел «Метамодель» (или подпункт в «Аналитика») для работы со связями; в «Справочники» добавлены три новых справочника под новые сущности.

---

## Этапы реализации

### Этап 1: Ядро метамодели связей (2–4 недели)

- Документировать текущие сущности как отображение TOGAF: System = Application Component, Integration Flow = Application–Application interface, и т.д.
- Ввести справочники **ar_metamodel_entity_types** и **ar_metamodel_relation_types**, таблицу **ar_metamodel_relations** (миграция, индексы).
- API: CRUD связей между сущностями по типам из справочников.
- Фронт: пункт меню «Метамодель → Связи метамодели» (или «Аналитика → Связи метамодели») — список связей с фильтром по типу сущности и типу связи. Опционально: интеграция с компонентом «Анализатор» (задача #13).

### Этап 2: Бизнес-сущности (2–3 недели)

- Справочники: **ar_organization_unit_categories**, **ar_actor_types**, **ar_business_service_statuses** (миграции + seed при необходимости).
- Таблицы: **ar_organization_units**, **ar_actors**, **ar_business_services**, **ar_business_functions** с атрибутами по разделу выше.
- Связи в **ar_metamodel_relations**: Organization Unit ↔ Business Service; Business Service ↔ Application (ar_systems); Actor ↔ Organization Unit; при необходимости Function ↔ Business Service и т.д.
- CRUD API и списки/формы: раздел меню «Бизнес-архитектура» с подпунктами (Организационные единицы, Акторы, Бизнес-сервисы, Бизнес-функции).
- В «Справочники» добавить вкладки/подпункты: Категории орг. единиц, Типы акторов, Статусы бизнес-сервисов.
- По желанию: «Анализатор» (задача #13) — выбор бизнес-сервисов/функций/орг. единиц и построение графа по ar_metamodel_relations.

### Этап 3 (опционально): Цели и задачи

- Таблица **ar_goals_and_objectives** (code, name, description, parent_id, source, created_at, updated_at).
- API и UI: пункт «Бизнес-архитектура → Цели и задачи» (дерево/список с иерархией).
- Связи в метамодели: Goal/Objective ↔ Organization Unit, ↔ Business Service и т.д. — по потребности.

### Дальнейшее расширение (вне текущего объёма)

- Data Entity, Application Service, Requirement, Constraint, Process, Value Stream, Gap, Work Package, Capability — при появлении требований; структура меню и метамодели позволит добавить их без ломки существующего.

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
