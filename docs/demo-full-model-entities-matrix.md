# Итоговая таблица сущностей и связей для demo-модели

Цель: зафиксировать максимально полный перечень потенциальных сущностей из репозитория и целевой минимум для насыщенной demo-модели.

**Структура документа (номера разделов):** **§1** — единая таблица **сущностей** (каталоги, реестры, справочник `partner`). **§2** — целевые **объёмы** объектов для demo (с отсылкой к № строки §1). **§2.1** — сущности **на будущее** (ещё не в репозитории / вне ближайшего объёма demo). **§3** — типы **связей** метамодели: **§3.1** — уже в `ar_metamodel_relation_types`; **§3.2** — целевые связи для demo (источник правды — [`exports/1.csv`](exports/1.csv) или [`exports/1-with-partner-fk-rows.csv`](exports/1-with-partner-fk-rows.csv) при блокировке `1.csv`); **§3.3** — связи на будущее (вне этого набора). **§4** — порядок наполнения. **§5** — матрица «кто с кем». **§6** — уточнение терминов.

## 1) Сущности репозитория (единый перечень)

Каталоги, реестры и справочник контрагентов. Три nullable FK на `ar_partners` в `ar_systems` (**вендор**, **внедрение**, **поддержка**) — это **связи** «ИС/модуль → партнёр», а не отдельные коды сущностей; детали — в §5 (текст про партнёра) и в проекциях типов связей при наполнении метамодели.

| №   | Код сущности        | Текущий источник        | Тип                        | Статус для demo                                           | Связи и примечания для demo                                                                                                                                                                                                        |
| --- | ------------------- | ----------------------- | -------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `system`            | `ar_systems`            | Каталог                    | Уже есть                                                  | `uses_technology`, `integrates_with`, `realizes_business_service`; дочерние записи — см. `subsystem`                                                                                                                               |
| 2   | `subsystem`         | `ar_systems`            | Каталог (логический тип)   | Уже есть                                                  | Те же строки, что `system`, с заполненным `parent_ar_systems_id`; в метамодели — `system_module`, лиды — §3.1                                                                                                                      |
| 3   | `technology`        | `ar_technologies`       | Каталог                    | Уже есть                                                  | `used_by_system`                                                                                                                                                                                                                   |
| 4   | `integration_flow`  | `ar_integration_flows`  | Реестр связей              | Уже есть                                                  | `source_system → target_system` (проекции типов связей — §3.1)                                                                                                                                                                     |
| 5   | `organization_unit` | `ar_organization_units` | Каталог                    | Уже есть                                                  | `owns_business_service`, `owns_business_function`                                                                                                                                                                                  |
| 6   | `actor`             | `ar_actors`             | Каталог                    | Уже есть                                                  | `performs_business_function`                                                                                                                                                                                                       |
| 7   | `business_service`  | `ar_business_services`  | Каталог                    | Уже есть                                                  | `realized_by_system`, `owned_by_org_unit`                                                                                                                                                                                          |
| 8   | `business_function` | `ar_business_functions` | Каталог/иерархия           | Уже есть                                                  | `belongs_to_org_unit`, `supports_business_service`                                                                                                                                                                                 |
| 9   | `employee`          | `ar_employees`          | Справочник                 | Уже есть                                                  | FK с `system` / `subsystem`: ИТ-лид и владелец (`it_lead_employee_id`, `business_lead_employee_id`); проекции с кодами `system_it_lead`, …; подпись ребра на графе — из `ar_metamodel_relation_types.name`, не из `displayed_name` |
| 10  | `system_function`   | `ar_system_functions`   | Каталог (строки внутри ИС) | Есть таблица и API; **нет** связей с бизнес-слоем в схеме | `belongs_to_system` (FK), целевые: `implements_business_function`, `supports_business_service`; опционально проекция в `ar_metamodel_relations`                                                                                    |
| 11  | `principle`         | `ar_principles`         | Каталог                    | Уже есть                                                  | `constrains_system_or_process`                                                                                                                                                                                                     |
| 12  | `gap`               | `ar_gaps`               | Реестр                     | Уже есть                                                  | `affects_any_entity`                                                                                                                                                                                                               |
| 13  | `adr_principle`     | `ar_adrs_principle`     | Реестр ADRP                | Уже есть                                                  | Зафиксированный **прикладной принцип** («далее поступаем так, потому что …»: контекст, решение, последствия); связь с ADRA и прочими — см. §5                                                                                      |
| 14  | `adr_applied`       | `ar_adrs_applied`       | Реестр ADRA                | Уже есть                                                  | **Архитектурное заключение** по конкретной задаче (`task_name`, ссылка на задачу, текст заключения); инкременты, связь с ИС/`system_function`, gap — см. §5 и §3.1 `applied_gap`                                                   |
| 15  | `partner`           | `ar_partners`           | Справочник                 | Уже есть                                                  | Единый справочник контрагентов; на ИС — три nullable FK в `ar_systems` (вендор / поставщик·внедрение / поддержка); проекция в метамодель — §5                                                                                      |

## 2) Рекомендуемый целевой минимум для "полной" demo

Таблица покрывает **все коды сущностей из §1**, которые входят в ближайший объём demo (колонка **№ §1**). **`subsystem`** — тот же физический каталог, что `system` (№1–2 §1); отдельная строка здесь — для планирования числа **модулей** относительно корневых ИС. Сущности **без таблицы в репозитории** и с приоритетом P2 вынесены в **§2.1**.

| №   | Сущность            | № §1 | Минимум объектов                          | Ключевые связи (минимум)                                                                  | Приоритет                               |
| --- | ------------------- | ---- | -----------------------------------------:| ----------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | `organization_unit` | 5    | 8-12                                      | `owns_business_service`, `owns_business_function`                                         | P0                                      |
| 2   | `actor`             | 6    | 12-20                                     | `performs_business_function`                                                              | P0                                      |
| 3   | `business_service`  | 7    | 10-15                                     | `realized_by_system`                                                                      | P0                                      |
| 4   | `business_function` | 8    | 20-30                                     | `supports_business_service`, иерархия `parent_id` (частично в БД)                         | P0                                      |
| 5   | `system_function`   | 10   | 2-5 на систему (в сумме 40-100)           | `belongs_to_system`; целевые: `implements_business_function`, `supports_business_service` | P1 (цепочка «ИС → функция ИС → бизнес») |
| 6   | `system`            | 1    | 20-30                                     | `uses_technology`, `integrates_with`, `realizes_business_service`                         | P0                                      |
| 7   | `subsystem`         | 2    | 1-4 модуля на ключевую ИС (в сумме 30-80) | `system_module`, лиды §3.1, `module_technology`                                           | P0                                      |
| 8   | `technology`        | 3    | 25-40                                     | `used_by_system`                                                                          | P0                                      |
| 9   | `integration_flow`  | 4    | 30-60                                     | `source_system -> target_system`                                                          | P0                                      |
| 10  | `employee`          | 9    | 30-60                                     | FK лидов на `ar_systems`; типы связей §3.1 (`system_*_lead`, `subsystem_*_lead`)          | P0                                      |
| 11  | `partner`           | 15   | 10-20                                     | FK на `ar_systems` (три роли); проекция в метамодель — §5, §3.2                           | P1                                      |
| 12  | `principle`         | 11   | 8-12                                      | `constrains_system_or_process`                                                            | P1                                      |
| 13  | `gap`               | 12   | 10-20                                     | `affects_any_entity`                                                                      | P1                                      |
| 14  | `adr_principle`     | 13   | 6-12                                      | Связи с каталогом и ADRA — §5, §3.2                                                       | P1                                      |
| 15  | `adr_applied`       | 14   | 8-15                                      | Инкременты, `applied_gap` (§3.1), целевое `adr_applied_adr_principle` — §3.2              | P1                                      |

### 2.1 Сущности на будущее

Плановые сущности **вне §1** (отдельных таблиц в репозитории пока нет): целевые объёмы и связи — для дорожной карты после появления каталогов/реестров. Ранее строки **№16–18** находились в таблице §2.

| № §2.1 | Сущность              | № §1 | Минимум объектов | Ключевые связи (минимум)       | Приоритет |
| ------ | --------------------- | ---- | ----------------:| ------------------------------ | --------- |
| 1      | `requirement` (новая) | —    | 15-25            | `applies_to_system_or_process` | P2        |
| 2      | `process` (новая)     | —    | 8-15             | `realizes_business_function`   | P2        |
| 3      | `data_entity` (новая) | —    | 20-40            | `managed_by_system`            | P2        |

## 3) Типы связей метамодели (учёт текущих + целевых)

### 3.1 Уже имеющиеся в `ar_metamodel_relation_types`

Значения **`code`**, **`name`**, **`description`** — снимок для согласования документации с БД и UI.

| №   | Код связи (`code`)               | Имя (`name`)                            | Описание (`description`)                                                  | From → To                |
| --- | -------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| 1   | `gap-system`                     | Относится к                             | Арх. долг относится к системе                                             | `gap → system`           |
| 2   | `system_module`                  | Модуль системы                          | Связь формируется автоматически из `ar_systems.parent_ar_systems_id`      | `system → subsystem`     |
| 3   | `applied_gap`                    | Фиксирует арх.долг                      | Архитектурное заключение фиксирует арх.долг                               | `adr_applied → gap`      |
| 4   | `integration_flow`               | Интеграционный поток                    | Проекция из `ar_integration_flows`; синхронизация триггером и пересборкой | `system → system`        |
| 5   | `module_technology`              | Использует                              | Модуль использует технологию                                              | `subsystem → technology` |
| 6   | `system_technology`              | Использует                              | Связь информационной системы с элементом технологического стека           | `system → technology`    |
| 7   | `integration_flow_system_module` | Интеграционный поток (Система → Модуль) | Проекция из `ar_integration_flows`; синхронизация триггером и пересборкой | `system → subsystem`     |
| 8   | `integration_flow_module_system` | Интеграционный поток (Модуль → Система) | Проекция из `ar_integration_flows`; синхронизация триггером и пересборкой | `subsystem → system`     |
| 9   | `integration_flow_module_module` | Интеграционный поток (Модуль → Модуль)  | Проекция из `ar_integration_flows`; синхронизация триггером и пересборкой | `subsystem → subsystem`  |
| 10  | `subsystem_it_lead`              | ИТ-лид модуля                           | Ответственный от ИТ (модуль)                                              | `subsystem → employee`   |
| 11  | `system_it_lead`                 | ИТ-лид ИС                               | Ответственный от ИТ (корневая система)                                    | `system → employee`      |
| 12  | `subsystem_business_lead`        | Бизнес-лид модуля                       | Ответственный от бизнеса (модуль)                                         | `subsystem → employee`   |
| 13  | `system_business_lead`           | Бизнес-лид ИС                           | Ответственный от бизнеса (корневая система)                               | `system → employee`      |

**Примечание:** в репозитории возможны миграции с унифицированными подписями («Ответственный от ИТ» / «Владелец системы») в `name`; при расхождении ориентируйтесь на фактические строки `ar_metamodel_relation_types` в вашей БД.

### 3.2 Рекомендуемые к добавлению для полной demo-модели

Таблица **синхронизирована с** [`exports/1.csv`](exports/1.csv) (код **`code`** в формате **`<сущность_от>_<сущность_к>`**); при блокировке файла в Nextcloud полный набор строк (включая связи с `partner`) — в [`exports/1-with-partner-fk-rows.csv`](exports/1-with-partner-fk-rows.csv). Дублирующая выгрузка (запятая): [`exports/demo-full-model-metamodel-relation-types-section32.csv`](exports/demo-full-model-metamodel-relation-types-section32.csv).

| №   | Код связи (`code`)                    | Имя (целевое `name`)     | Описание (целевое `description`)                                        | From → To                               |
| --- | ------------------------------------- | ------------------------ | ----------------------------------------------------------------------- | --------------------------------------- |
| 1   | `organization_unit_business_service`  | Отвечает за              | Орг. единица владеет бизнес-сервисом                                    | `organization_unit → business_service`  |
| 2   | `organization_unit_business_function` | Отвечает за              | Орг. единица владеет бизнес-функцией                                    | `organization_unit → business_function` |
| 3   | `actor_business_function`             | Отвечает за              | Заинтересованное лицо исполняет бизнес-функцию                          | `actor → business_function`             |
| 4   | `business_function_business_service`  | Поддерживает сервис      | Бизнес-функция обеспечивает бизнес-сервис                               | `business_function → business_service`  |
| 5   | `system_business_service`             | Обеспечивает продукт     | ИС реализует бизнес-сервис                                              | `system → business_service`             |
| 6   | `system_business_function`            | Реализует бизнес-функцию | ИС реализует бизнес-функцию                                             | `system → business_function`            |
| 7   | `system_system_function`              | Содержит функцию ИС      | Система включает функцию ИС; в БД — `ar_system_functions.ar_systems_id` | `system → system_function`              |
| 8   | `system_function_business_function`   | Реализует бизнес-функцию | Функция ИС покрывает бизнес-функцию                                     | `system_function → business_function`   |
| 9   | `system_function_business_service`    | Обеспечивает продукт     | Функция ИС обеспечивает бизнес-сервис                                   | `system_function → business_service`    |
| 10  | `actor_system_function`               | Использует функцию ИС    | Действующее лицо опирается на возможность системы                       | `actor → system_function`               |
| 11  | `adr_applied_adr_principle`           | Соблюдает принцип        | ADRA опирается на ADRP                                                  | `adr_applied → adr_principle`           |
| 12  | `system_partner_vendor`               | Вендор                   | Корневая ИС — вендор (контрагент)                                       | `system → partner`                      |
| 13  | `system_partner_implementer`          | Интегратор               | Корневая ИС — интегратор / поставщик внедрения                          | `system → partner`                      |
| 14  | `system_partner_supporter`            | Поддерживает             | Корневая ИС — партнёр по поддержке                                      | `system → partner`                      |
| 15  | `subsystem_partner_vendor`            | Вендор                   | Модуль (подсистема) — вендор                                            | `subsystem → partner`                   |
| 16  | `subsystem_partner_implementer`       | Интегратор               | Модуль — интегратор / поставщик внедрения                               | `subsystem → partner`                   |
| 17  | `subsystem_partner_supporter`         | Поддерживает             | Модуль — партнёр по поддержке                                           | `subsystem → partner`                   |
| 18  | `technology_partner_vendor`           | Вендор                   | Технология — вендор (поставщик технологии)                              | `technology → partner`                  |

#### Проекции связей из внешних ключей (план реализации)

Ниже — **как планируется** поддерживать в `ar_metamodel_relations` типы §3.2, для которых источник истины уже задан колонками FK (аналогично уже принятой в продукте логике проекций **`integration_flow`** и лидов **`employee`** в §3.1: операционная таблица → словарь типов связи → строки метамодели).

**1) Словарь типов.** Перед появлением рёбер в метамодели в `ar_metamodel_relation_types` должны существовать строки с кодами из таблицы §3.2 (в т.ч. `system_partner_vendor`, …, `technology_partner_vendor`). Имена и описания — как в §3.2; при расхождении с фактической БД приоритет у миграции/seed репозитория.

**2) Соответствие «колонка FK → тип связи» (идея «ровно один тип на колонку»).**

| Тип связи §3.2 (код)            | Таблица-источник             | Колонка FK                 | Направление в метамодели           |
| ------------------------------- | ---------------------------- | -------------------------- | ---------------------------------- |
| `system_partner_vendor`         | `ar_systems`                 | `vendor_ar_partners_id`    | корневая ИС (`system`) → `partner` |
| `system_partner_implementer`    | `ar_systems`                 | `supplier_ar_partners_id`  | `system` → `partner`               |
| `system_partner_supporter`      | `ar_systems`                 | `supporter_ar_partners_id` | `system` → `partner`               |
| `subsystem_partner_vendor`      | `ar_systems` (строка модуля) | `vendor_ar_partners_id`    | `subsystem` → `partner`            |
| `subsystem_partner_implementer` | `ar_systems`                 | `supplier_ar_partners_id`  | `subsystem` → `partner`            |
| `subsystem_partner_supporter`   | `ar_systems`                 | `supporter_ar_partners_id` | `subsystem` → `partner`            |
| `technology_partner_vendor`     | `ar_technologies`            | `vendor_ar_partners_id`    | `technology` → `partner`           |
| `system_system_function`        | `ar_system_functions`        | `ar_systems_id`            | `system` → `system_function`       |

Для **корневой ИС** и **модуля** используется **одна** таблица `ar_systems`: тип сущности «от» (`system` vs `subsystem`) определяется по правилам каталога (наличие/отсутствие родителя и т.п., как в приложении). На одной строке три nullable FK — значит, независимо до **трёх** рёбер в метамодели (по одному на каждый непустой FK).

**3) Семантика строки в `ar_metamodel_relations`.** Для проекции по FK каждая комбинация *(тип связи, id объекта «от», id объекта «к»)* либо отсутствует, либо представлена **не более чем одной** строкой: при `NULL` в колонке FK соответствующее ребро **удаляется** (или не создаётся); при смене значения FK — **обновляется** целевой `id` «к» или выполняется delete+insert под тот же бизнес-ключ.

**4) Механизм синхронизации (на выбор при реализации, можно комбинировать).**

- **Триггеры в БД** на `ar_systems` (колонки партнёров и, при необходимости, признак корень/модуль) и на `ar_technologies` (`vendor_ar_partners_id`), плюс на `ar_system_functions` (`ar_systems_id`) для `system_system_function`: после изменения FK вызывается общая функция «пересобрать проекции для затронутой строки».
- **Сервисный слой / API:** при сохранении карточки ИС, модуля или технологии после commit транзакции публиковать событие или вызывать модуль проекций (удобно, если триггеры в БД нежелательны).
- **Фоновая задача (job):** периодический или по очереди «догоняющий» пересчёт для записей с флагом «грязная проекция» — страховка от пропусков при массовых импортах.

Рекомендация для **demo и prod**: зафиксировать один основной путь (часто триггер + идемпотентный SQL для первичного backfill), чтобы граф метамодели не расходился с каталогом.

**5) Первичное наполнение (backfill).** Однократный скрипт: `SELECT` по строкам с непустыми FK → `INSERT` в `ar_metamodel_relations` с привязкой к `ar_metamodel_relation_types.id` по коду типа; для уже существующих рёбер — `ON CONFLICT` / предварительное удаление дублей по бизнес-ключу (как принято в вашей схеме таблицы связей).

**6) UI и ручное редактирование.** Для рёбер, полностью определяемых FK, в интерфейсе разумно **не** давать расходящееся редактирование «только в метамодели»: либо только чтение ребра из проекции, либо изменение только через поля FK карточки ИС/модуля/технологии с последующей автоматической пересборкой строки в `ar_metamodel_relations`.

**Кратко для №12–18:** строки **`ar_metamodel_relations`** обязаны **воспроизводить** те же факты, что уже в **`vendor_ar_partners_id`**, **`supplier_ar_partners_id`**, **`supporter_ar_partners_id`** на `ar_systems` (для ИС и модуля) и **`vendor_ar_partners_id`** на **`ar_technologies`**. Подробнее о ролях на ИС в матрице — §5.

### 3.3 Связи на будущее

Связи, **не вошедшие** в [`exports/1.csv`](exports/1.csv) / §3.2, но полезные для расширения метамодели (см. также §5, черновые коды в ячейках матрицы).

| №   | Код связи (`code`)          | Имя (черновик)            | Описание (кратко)                                                  | From → To                     |
| --- | --------------------------- | ------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| 1   | `actor_process`             | Исполняет                 | Актор и процесс (`process` — §2.1)                                 | `actor → process`             |
| 2   | `system_system`             | Интегрируется с           | Явная ИС→ИС помимо проекции `integration_flow` (§3.1)              | `system → system`             |
| 3   | `system_data_entity`        | Управляет данными         | ИС → сущность данных (`data_entity` — §2.1)                        | `system → data_entity`        |
| 4   | `principle_entity`          | Ограничивает              | Принцип → произвольная цель (`*` в типе/данных связи)              | `principle → *`               |
| 5   | `gap_entity`                | Затрагивает               | Долг → произвольная цель                                           | `gap → *`                     |
| 6   | `adr_applied_gap`           | Закрывает разрыв          | Синоним по смыслу §3.1 `applied_gap`; при унификации имён — см. БД | `adr_applied → gap`           |
| 7   | `work_package_gap`          | Закрывает разрыв          | Пакет работ → gap (`work_package` вне §1)                          | `work_package → gap`          |
| 8   | `adr_principle_adr_applied` | Проявляется в заключениях | Обратное чтение ADRP → ADRA                                        | `adr_principle → adr_applied` |

## 4) Практический порядок заполнения demo

1. Заполнить справочники (`partner`, статусы, типы, категории).
2. Создать оргструктуру (`organization_unit`) и заинтересованных лиц (`actor`).
3. Внести `business_service` и `business_function` с владельцами.
4. Наполнить `system`, `technology`, `integration_flow`.
   4a. Для каждой ключевой ИС завести `system_function` (имена из прикладного слоя) и связать с `business_function` / при необходимости с `business_service` (метамодель и/или будущие FK/мост).
5. Проставить связи в `ar_metamodel_relations` по словарю §3.
6. Добавить governance-слой (`principle`, `gap`, далее **ADRP**/**ADRA**); сущности §2.1 (`requirement`, `process`, `data_entity`) — после появления таблиц в репозитории.
7. Связать ADRA с инкрементами и затронутыми системами / функциями ИС; при необходимости — ADRA ↔ gap (`applied_gap`, §3.1), ADRA ↔ ADRP (`adr_applied_adr_principle`, §3.2) в метамодели.

## 5) Матрица покрытия связями (сущность x сущность)

**Вынесено на потом (не входят в эту матрицу):** `integration_flow` — см. §2–§4; `requirement`, `process`, `data_entity` — §2.1. Экспорт этой матрицы в CSV: [`exports/demo-full-model-entities-matrix-section7.csv`](exports/demo-full-model-entities-matrix-section7.csv) (актуально: **`employee`**, `partner`, **ADRP** / **ADRA**). Файл `docs/demo-full-model-entities-matrix-section7.csv` при необходимости замените копией отсюда или удалите дубликат после синхронизации. Схема метамодели (draw.io): [`diagrams/demo-full-model-metamodel-section7.drawio`](diagrams/demo-full-model-metamodel-section7.drawio) — **все сущности §1** на схеме с **зелёной** заливкой (уже в репозитории); рёбра **§3.1** — **зелёные**, рёбра **§3.2** — **оранжевые** (в т.ч. ИС/модуль/технология → партнёр с пометкой проекции по FK); подписи рёбер — столбец **Имя (`name`)** из §3.1 / §3.2 / [`exports/1.csv`](exports/1.csv). Полная матрица — в таблице ниже.

Легенда (единообразно по слоям данных):

- **есть** — связь представлена в **метамодели** (`ar_metamodel_relations` и тип в `ar_metamodel_relation_types`), используется в графе/проекциях.
- **частично** — связь выражена в **реляционной модели** (FK, колонка владельца, иерархия `parent_id` и т.п.), но **нет** как управляемая запись в метамодели (или обратное чтение к уже хранимому направлению метамодели).
- **нужно** — **нет** ни в метамодели, ни в реляционной модели; ниже — предлагаемый **код типа связи** для внесения в словарь.

В каждой ячейке: первая строка — статус, вторая — предлагаемое имя типа связи (`code` для `ar_metamodel_relation_types` или проекции). Диагональ (сущность → сама себя): только «—».

**Партнёр (`partner`, `ar_partners`).** В каталоге ИС три роли контрагента задаются FK на строке `ar_systems` (для подсистемы — та же таблица, модуль как дочерняя ИС): **вендор** — `vendor_ar_partners_id`; **партнёр по внедрению** (в схеме БД — поставщик/интегратор) — `supplier_ar_partners_id`; **партнёр по поддержке** — `supporter_ar_partners_id`. В метамодели как три типа связей **system|subsystem → partner** пока не выделены — в матрице это **частично** (реляционно есть, в `ar_metamodel_relations` — по желанию проецировать).

**ADRP и ADRA** (реестры `ar_adrs_principle`, `ar_adrs_applied`; коды сущностей **`adr_principle`**, **`adr_applied`**):

- **ADRP** — архитектурное решение-**принцип**: зафиксированное правило «**далее поступаем так, потому что …**» (контекст, решение, последствия в карточке ADRP).
- **ADRA** — архитектурное **заключение** по **конкретной задаче**: формулировка задачи (`task_name`), ссылка на трекер (`task_link`), текст заключения (`conclusion`). Состав решения раскрывается **инкрементами** (`ar_adr_increments`), к затронутым ИС и связям между ними.

Связь **ADRA → gap** в метамодели уже есть как **`applied_gap`** (§3.1). Связь **ADRA → ADRP**, ADRA ↔ системы и прочие трассировки — в основном **нужно** в метамодели или **частично** через операционные таблицы инкрементов (`ar_adr_increment_systems`, `ar_adr_increment_system_functions`, …).

| №   | From \ To           | `organization_unit`                     | `actor`                               | `business_service`                          | `business_function`                           | `system_function`                               | `system`                                        | `subsystem`                                        | `employee`                                                                                   | `partner`                                                                                                                           | `technology`                            | `principle`                              | `gap`                               | `adr_principle`                      | `adr_applied`                         |
| --- | ------------------- | --------------------------------------- | ------------------------------------- | ------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------- |
| 1   | `organization_unit` | —                                       | частично<br>`org_unit_contains_actor` | частично<br>`owns_business_service`         | частично<br>`owns_business_function`          | нужно<br>`scopes_system_function`               | нужно<br>`owns_system`                          | нужно<br>`owns_subsystem`                          | нужно<br>`org_employs_or_aligns`                                                             | нужно<br>`contracts_with_partner`                                                                                                   | нужно<br>`mandates_technology_standard` | нужно<br>`sponsors_principle`            | нужно<br>`accountable_for_gap`      | нужно<br>`sponsors_adr_principle`    | нужно<br>`commissions_adra`           |
| 2   | `actor`             | частично<br>`belongs_to_organization`   | —                                     | нужно<br>`consumes_business_service`        | нужно<br>`performs_business_function`         | нужно<br>`uses_system_function`                 | нужно<br>`uses_system`                          | нужно<br>`uses_subsystem`                          | частично<br>`may_match_employee`                                                             | нужно<br>`engages_partner`                                                                                                          | нужно<br>`uses_technology`              | нужно<br>`subject_to_principle`          | нужно<br>`raises_gap`               | нужно<br>`authors_or_accepts_adrp`   | нужно<br>`authors_adra`               |
| 3   | `business_service`  | частично<br>`owned_by_organization`     | нужно<br>`served_to_actor`            | —                                           | нужно<br>`supported_by_business_function`     | нужно<br>`realized_by_system_function`          | нужно<br>`realized_by_system`                   | нужно<br>`realized_by_subsystem`                   | нужно<br>`product_owner_employee`                                                            | нужно<br>`supplied_by_partner`                                                                                                      | нужно<br>`enabled_by_technology`        | нужно<br>`constrained_by_principle`      | нужно<br>`exposes_gap`              | нужно<br>`in_scope_of_adrp`          | нужно<br>`in_scope_of_adra`           |
| 4   | `business_function` | частично<br>`owned_by_organization`     | нужно<br>`performed_by_actor`         | нужно<br>`supports_business_service`        | частично<br>`business_function_hierarchy`     | нужно<br>`implemented_by_system_function`       | нужно<br>`realized_by_system`                   | нужно<br>`realized_by_subsystem`                   | нужно<br>`process_owner_employee`                                                            | нужно<br>`outsourced_to_partner`                                                                                                    | нужно<br>`supported_by_technology`      | нужно<br>`constrained_by_principle`      | нужно<br>`reveals_gap`              | нужно<br>`guided_by_adrp`            | нужно<br>`touched_by_adra`            |
| 5   | `system_function`   | нужно<br>`accountable_org_unit`         | нужно<br>`used_by_actor`              | нужно<br>`system_function_business_service` | нужно<br>`system_function_business_function`  | —                                               | частично<br>`belongs_to_system`                 | нужно<br>`scoped_to_subsystem`                     | нужно<br>`dev_owner_employee`                                                                | нужно<br>`delivered_by_partner`                                                                                                     | нужно<br>`runs_on_technology_stack`     | нужно<br>`complies_with_principle`       | нужно<br>`related_gap`              | нужно<br>`subject_to_adrp`           | частично<br>`listed_in_adr_increment` |
| 6   | `system`            | нужно<br>`aligned_with_organization`    | нужно<br>`used_by_actor`              | нужно<br>`realizes_business_service`        | нужно<br>`realizes_business_function`         | частично<br>`contains_system_function`          | —                                               | есть<br>`system_module`                            | есть<br>`system_it_lead` (ИТ-лид ИС)<br>`system_business_lead` (Бизнес-лид ИС)               | частично<br>`system_vendor_partner` (вендор)<br>`system_implementation_partner` (внедрение)<br>`system_support_partner` (поддержка) | есть<br>`system_technology`             | нужно<br>`constrained_by_principle`      | нужно<br>`affected_by_gap`          | нужно<br>`constrained_by_adrp`       | частично<br>`in_adr_increment_scope`  |
| 7   | `subsystem`         | нужно<br>`owned_by_organization`        | нужно<br>`used_by_actor`              | нужно<br>`realizes_business_service`        | нужно<br>`realizes_business_function`         | нужно<br>`exposes_system_function`              | частично<br>`part_of_system`                    | частично<br>`subsystem_hierarchy`                  | есть<br>`subsystem_it_lead` (ИТ-лид модуля)<br>`subsystem_business_lead` (Бизнес-лид модуля) | частично<br>`subsystem_vendor_partner`<br>`subsystem_implementation_partner`<br>`subsystem_support_partner`                         | есть<br>`module_technology`             | нужно<br>`constrained_by_principle`      | нужно<br>`affected_by_gap`          | нужно<br>`constrained_by_adrp`       | частично<br>`in_adr_increment_scope`  |
| 8   | `employee`          | частично<br>`employed_under_org`        | частично<br>`same_person_as_actor`    | нужно<br>`owns_or_sponsors_bs`              | нужно<br>`owns_or_sponsors_bf`                | нужно<br>`maintains_system_function`            | частично<br>`lead_for_system` (обратно к FK)    | частично<br>`lead_for_subsystem`                   | —                                                                                            | нужно<br>`partner_contact`                                                                                                          | нужно<br>`technology_steward`           | нужно<br>`governed_by_principle`         | нужно<br>`touches_gap`              | нужно<br>`subject_to_adrp`           | частично<br>`authors_adra_as_person`  |
| 9   | `partner`           | нужно<br>`partner_serves_organization`  | нужно<br>`partner_interacts_actor`    | нужно<br>`partner_offers_business_service`  | нужно<br>`partner_supports_business_function` | нужно<br>`partner_delivers_system_function`     | частично<br>`referenced_by_system_roles`        | частично<br>`referenced_by_subsystem_roles`        | нужно<br>`partner_account_manager`                                                           | —                                                                                                                                   | нужно<br>`partner_provides_technology`  | нужно<br>`partner_subject_to_principle`  | нужно<br>`partner_related_gap`      | нужно<br>`bound_by_adrp`             | нужно<br>`named_in_adra`              |
| 10  | `technology`        | нужно<br>`standardized_by_organization` | нужно<br>`relevant_to_actor`          | нужно<br>`enables_business_service`         | нужно<br>`enables_business_function`          | нужно<br>`implements_layer_for_system_function` | частично<br>`system_technology`                 | частично<br>`module_technology`                    | нужно<br>`technology_expert`                                                                 | нужно<br>`technology_via_partner`                                                                                                   | —                                       | нужно<br>`constrained_by_principle`      | нужно<br>`impacted_by_gap`          | нужно<br>`selected_under_adrp`       | нужно<br>`chosen_in_adra`             |
| 11  | `principle`         | нужно<br>`constrains_organization`      | нужно<br>`constrains_actor`           | нужно<br>`constrains_business_service`      | нужно<br>`constrains_business_function`       | нужно<br>`constrains_system_function`           | нужно<br>`constrains_system`                    | нужно<br>`constrains_subsystem`                    | нужно<br>`constrains_employee_scope`                                                         | нужно<br>`constrains_partner`                                                                                                       | нужно<br>`constrains_technology`        | —                                        | нужно<br>`gap_addressing_principle` | нужно<br>`informs_adr_principle`     | нужно<br>`referenced_in_adra_text`    |
| 12  | `gap`               | нужно<br>`impacts_organization_unit`    | нужно<br>`impacts_actor`              | нужно<br>`impacts_business_service`         | нужно<br>`impacts_business_function`          | нужно<br>`impacts_system_function`              | есть<br>`gap-system`                            | нужно<br>`impacts_subsystem`                       | нужно<br>`impacts_employee`                                                                  | нужно<br>`impacts_partner`                                                                                                          | нужно<br>`impacts_technology`           | нужно<br>`contradicts_principle`         | —                                   | нужно<br>`drives_adr_principle`      | нужно<br>`addressed_by_adra`          |
| 13  | `adr_principle`     | нужно<br>`adrp_applies_to_org`          | нужно<br>`adrp_stakeholder`           | нужно<br>`adrp_scopes_bs`                   | нужно<br>`adrp_scopes_bf`                     | нужно<br>`adrp_scopes_sf`                       | нужно<br>`adrp_constrains_system`               | нужно<br>`adrp_constrains_subsystem`               | нужно<br>`adrp_constrains_employee`                                                          | нужно<br>`adrp_regulates_partner`                                                                                                   | нужно<br>`adrp_standardizes_tech`       | нужно<br>`adrp_aligns_catalog_principle` | нужно<br>`adrp_relates_gap`         | —                                    | нужно<br>`instantiated_by_adra`       |
| 14  | `adr_applied`       | нужно<br>`adra_owner_org`               | нужно<br>`adra_author_actor`          | нужно<br>`adra_touches_bs`                  | нужно<br>`adra_touches_bf`                    | частично<br>`adra_lists_system_functions`       | частично<br>`adra_scopes_systems_via_increment` | частично<br>`adra_scopes_subsystems_via_increment` | частично<br>`adra_author_as_employee`                                                        | нужно<br>`adra_involves_partner`                                                                                                    | нужно<br>`adra_selects_technology`      | нужно<br>`adra_cites_principle`          | есть<br>`applied_gap`               | нужно<br>`adr_applied_adr_principle` | —                                     |

**Примечания к классификации (репозиторий):**

- **ADRP / ADRA:** тип связи **`applied_gap`** (`adr_applied → gap`) описан в §3.1. Явного FK **ADRA → ADRP** в таблице `ar_adrs_applied` нет — трассировка «заключение опирается на принцип» в матрице помечена как **нужно** (`adr_applied_adr_principle`, §3.2). Связь сущностей каталога ИС с ADRA — **частично** через `ar_adr_increment_systems` и `ar_adr_increment_system_functions` (и связанные справочники инкремента), без единого универсального FK «ADRA → system».
- **Сотрудники и ИС:** тип сущности **`employee`** (`ar_employees`: **`full_name`**, **`active`**). На `ar_systems` — **`it_lead_employee_id`**, **`business_lead_employee_id`**; в метамодели четыре типа связи с **`name`/`description`** по §3.1 (например **ИТ-лид ИС**, **Бизнес-лид модуля**). Подпись ребра на графе — из **`ar_metamodel_relation_types.name`**; список сотрудников — **`DISP_EMPLOYEE_TEMPLATE`**.
- **Партнёр и ИС:** на `ar_systems` три nullable FK на `ar_partners`; в UI уже различаются вендор / поставщик(внедрение) / поддержка. Для **subsystem** — те же колонки строки модуля. Целевые коды типов связей в §3.2: `system_partner_vendor`, `system_partner_implementer`, `system_partner_supporter` и зеркально `subsystem_partner_*` (проекция по FK — см. примечание под таблицей §3.2). В ячейках матрицы §5 могут оставаться черновики `system_vendor_partner` и т.п. до выравнивания с репозиторием.
- `gap-system`: метамодель, направление **gap → system** (см. §3.1); ячейка **system → gap** — «нужно», обратное направление в метамодели отдельно не задано.
- `system_technology` / `module_technology`: в метамодели хранится направление **system|subsystem → technology**; ячейки **technology → system|subsystem** помечены как **частично** (обратное чтение той же связи / отсутствие FK «технология → система»).
- `system_module`: проекция иерархии `ar_systems.parent_ar_systems_id`; **subsystem → system** — **частично** по FK, без симметричного типа «ребёнок → родитель» в списке §3.1.
- Владение орг.единицей: **business_service** / **business_function** → **organization_unit** — **частично** (`ar_organization_units_id` на стороне продукта/функции); обратное направление в таблице матрицы — тот же факт связи.
- **business_function → business_function**: **частично** (`parent_id`), в метамодели как универсальная связь не выделена.
- **system_function → system**: **частично** (`ar_system_functions.ar_systems_id`); **system → system_function** — обратное чтение той же FK.

### 5.1 Приоритет закрытия пробелов (для demo, в рамках матрицы §5)

1. Метамодель: **business_function → business_service** (`supports_business_service`), **actor → business_function** (`performs_business_function`), **system → business_service** (`realizes_business_service`).
2. Метамодель + сущность типа `system_function`: **system_function → business_function** (`system_function_business_function`), при необходимости **system_function → business_service** (`system_function_business_service`); запись типа сущности в `ar_metamodel_entity_types` для `ar_system_functions`.
3. Метамодель: **principle → system|subsystem|technology** (`constrains_*`).
4. Расширить **gap** за пределы **gap-system**: универсальный **`affects`** / таргеты на оргструктуру и бизнес-слой (после появления сущностей из п.1).
5. Метамодель: **system|subsystem → partner** — три типа (**вендор**, **внедрение**, **поддержка**) как проекция существующих FK (при необходимости унификация имён кодов с колонками API).
6. Метамодель: **adr_applied → adr_principle** (`adr_applied_adr_principle`); при необходимости проекции **adr_applied → system|subsystem|system_function** из операционных таблиц инкремента в `ar_metamodel_relations`.
7. При необходимости расширить матрицу **employee ↔** оргструктура/бизнес/партнёры отдельными кодами связей (сейчас в §5 многие ячейки — **нужно**/обратное чтение от FK лидов).

Отложенные сущности: **`integration_flow`** — уже в репозитории, в матрицу §5 можно вернуть отдельной версией; **`requirement`**, **`process`**, **`data_entity`** (§2.1) — в матрицу после появления таблиц и типов связей в репозитории.

## 6) Уточнение: «функция ИС» vs «бизнес-функция»

| №   | Термин в модели         | Таблица / код                                         | Уровень                                                |
| --- | ----------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| 1   | Бизнес-функция          | `ar_business_functions`, сущность `business_function` | Business (TOGAF BCCD / способности и деятельность)     |
| 2   | Функция ИС (прикладная) | `ar_system_functions`, сущность `system_function`     | Application: возможности конкретной системы в каталоге |

**Цепочка для demo:** `system` —`system_system_function`→ `system_function` —`system_function_business_function`→ `business_function` —`business_function_business_service`→ `business_service` (параллельно допустима прямая `system` —`system_business_service`→ `business_service`, если не детализируют до функций ИС; коды связей — §3.2).

**Реализация связей (эволюция):** слой A — строки в `ar_metamodel_relations` + типы в `ar_metamodel_relation_types`; слой B — FK или мостовая таблица для жёсткой целостности (согласовать с правилами проекций, как для `integration_flow`).
