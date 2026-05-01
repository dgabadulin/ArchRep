# Итоговая таблица сущностей и связей для demo-модели

Цель: зафиксировать максимально полный перечень потенциальных сущностей из репозитория и целевой минимум для насыщенной demo-модели.

## 1) Явные сущности в текущем репозитории

| Код сущности | Текущий источник | Тип | Статус для demo | Обязательные связи в demo |
|---|---|---|---|---|
| `system` | `ar_systems` | Каталог | Уже есть | `uses_technology`, `integrates_with`, `realizes_business_service` |
| `technology` | `ar_technologies` | Каталог | Уже есть | `used_by_system` |
| `integration_flow` | `ar_integration_flows` | Реестр связей | Уже есть | `source_system -> target_system` |
| `organization_unit` | `ar_organization_units` | Каталог | Уже есть | `owns_business_service`, `owns_business_function` |
| `actor` | `ar_actors` | Каталог | Уже есть | `performs_business_function` |
| `business_service` | `ar_business_services` | Каталог | Уже есть | `realized_by_system`, `owned_by_org_unit` |
| `business_function` | `ar_business_functions` | Каталог/иерархия | Уже есть | `belongs_to_org_unit`, `supports_business_service` |
| `system_function` | `ar_system_functions` | Каталог (строки внутри ИС) | Есть таблица и API; **нет** связей с бизнес-слоем в схеме | `belongs_to_system` (FK), целевые: `implements_business_function`, `supports_business_service`; опционально проекция в `ar_metamodel_relations` |
| `principle` | `ar_principles` | Каталог | Уже есть | `constrains_system_or_process` |
| `gap` | `ar_gaps` | Реестр | Уже есть | `affects_any_entity` |
| `adr_principle` | `ar_adrs_principle` | Реестр ADRP | Уже есть | Зафиксированный **прикладной принцип** («далее поступаем так, потому что …»: контекст, решение, последствия); связь с ADRA и прочими — см. §7 |
| `adr_applied` | `ar_adrs_applied` | Реестр ADRA | Уже есть | **Архитектурное заключение** по конкретной задаче (`task_name`, ссылка на задачу, текст заключения); инкременты, связь с ИС/`system_function`, gap — см. §7 и §5.1 `applied_gap` |
| `metamodel_relation` | `ar_metamodel_relations` | Универсальные связи | Уже есть | Базовый слой графа |
| `metamodel_entity_type` | `ar_metamodel_entity_types` | Справочник типов | Уже есть | Управляет доступными типами |
| `metamodel_relation_type` | `ar_metamodel_relation_types` | Справочник связей | Уже есть | Управляет допустимыми связями |

## 2) Справочные сущности (уже отдельные таблицы)

| Код сущности | Текущий источник | Примечание для модели |
|---|---|---|
| `partner` | `ar_partners` | Единый справочник контрагентов (вендор/поставщик/поддержка) |
| `system_owner` | `ar_system_owners` | Владелец системы (орг. роль) |
| `system_status` | `ar_system_statuses` | Статус системы |
| `hosting_type` | `ar_system_hosting_types` | Тип хостинга |
| `technology_class` | `ar_technology_classes` | Класс технологии |
| `technology_type` | `ar_technology_types` | Тип технологии |
| `technology_status` | `ar_technology_statuses` | Статус технологии |
| `integration_flow_event_type` | `ar_integration_flow_event_types` | Тип события потока |
| `integration_flow_status` | `ar_integration_flow_statuses` | Статус потока |
| `adr_status` | `ar_adr_statuses` | Статус ADR |
| `organization_unit_category` | `ar_organization_unit_categories` | Категория орг.единицы |
| `actor_type` | `ar_actor_types` | Тип заинтересованного лица |
| `business_service_status` | `ar_business_service_statuses` | Статус бизнес-сервиса |

**Связанно (не отдельная сущность метамодели):** `ar_adr_increment_system_functions` — выбор функций ИС в строке инкремента ADR (журнал/сортировка), не заменяет архитектурные связи `system_function` ↔ бизнес-слой.

## 3) Потенциальные сущности из атрибутов (кандидаты на нормализацию)

| Где сейчас | Атрибут | Потенциальная сущность | Почему выделять |
|---|---|---|---|
| `ar_systems` | `vendor_ar_partners_id` | `vendor` (роль `partner`) | Отдельный тип связи и аналитика по вендорам |
| `ar_systems` | `supplier_ar_partners_id` | `supplier` (роль `partner`) | Прозрачность поставки/поддержки |
| `ar_systems` | `supporter_ar_partners_id` | `support_provider` (роль `partner`) | SLA и ответственность |
| `ar_systems` | `it_lead`, `business_lead` | `person` | Повторно используемые ответственные между объектами |
| `ar_systems`/`ar_technologies` | текстовые `comment`, `description` | `note`/`evidence` | История решений и источников |
| разные сущности | `source`, `category` (где остались) | `source_system`, `domain_category` | Контролируемый vocabulary вместо свободного текста |

## 4) Рекомендуемый целевой минимум для "полной" demo

| Сущность | Минимум объектов | Ключевые связи (минимум) | Приоритет |
|---|---:|---|---|
| `organization_unit` | 8-12 | `owns_business_service`, `owns_business_function` | P0 |
| `actor` | 12-20 | `performs_business_function` | P0 |
| `business_service` | 10-15 | `realized_by_system` | P0 |
| `business_function` | 20-30 | `supports_business_service`, `composed_of` | P0 |
| `system_function` | 2-5 на систему (в сумме 40-100) | `belongs_to_system`; целевые: `implements_business_function`, `supports_business_service` | P1 (цепочка «ИС → функция ИС → бизнес») |
| `system` | 20-30 | `uses_technology`, `integrates_with`, `realizes_business_service` | P0 |
| `technology` | 25-40 | `used_by_system` | P0 |
| `integration_flow` | 30-60 | `source_system -> target_system` | P0 |
| `principle` | 8-12 | `constrains_system_or_process` | P1 |
| `gap` | 10-20 | `affects_any_entity` | P1 |
| `requirement` (новая) | 15-25 | `applies_to_system_or_process` | P2 |
| `process` (новая) | 8-15 | `realizes_business_function` | P2 |
| `data_entity` (новая) | 20-40 | `managed_by_system` | P2 |

## 5) Типы связей метамодели (учёт текущих + целевых)

### 5.1 Уже имеющиеся в `ar_metamodel_relation_types`

| Код связи | From -> To | Смысл / комментарий |
|---|---|---|
| `gap-system` | `gap -> system` | Архитектурный долг относится к системе |
| `system_module` | `system -> subsystem` | Связь формируется автоматически из `ar_systems.parent_ar_systems_id` |
| `applied_gap` | `adr_applied -> gap` | Архитектурное заключение фиксирует/адресует долг |
| `integration_flow` | `system -> system` | Проекция из `ar_integration_flows` |
| `module_technology` | `subsystem -> technology` | Модуль использует технологию |
| `system_technology` | `system -> technology` | ИС использует элемент техстека |
| `integration_flow_system_module` | `system -> subsystem` | Проекция потока: система -> модуль |
| `integration_flow_module_system` | `subsystem -> system` | Проекция потока: модуль -> система |
| `integration_flow_module_module` | `subsystem -> subsystem` | Проекция потока: модуль -> модуль |

### 5.2 Рекомендуемые к добавлению для полной demo-модели

| Код связи | From -> To | Смысл |
|---|---|---|
| `owns` | `organization_unit -> business_service|business_function|process` | Владение |
| `performs` | `actor -> business_function|process` | Исполнение |
| `supports` | `business_function -> business_service` | Поддержка сервиса |
| `realizes` | `system -> business_service|business_function` | Реализация в ИС |
| `integrates_with` | `system -> system` | Явная бизнес-интеграция (кроме тех. проекции `integration_flow`) |
| `manages_data` | `system -> data_entity` | Управление данными |
| `constrains` | `principle -> any` | Ограничение/правило |
| `affects` | `gap -> any` | Универсальное влияние разрыва |
| `addresses` | `adr_applied|work_package -> gap|requirement` | Закрывает/адресует |
| `contains_function` | `system -> system_function` | Функции каталога ИС; в БД уже выражено через `ar_system_functions.ar_systems_id`; в графе — явная проекция (как для `system_module`) |
| `implements_bf` | `system_function -> business_function` | Функция ИС реализует/покрывает бизнес-функцию (Application ↔ Business) |
| `supports_bs` | `system_function -> business_service` | Функция ИС обеспечивает бизнес-сервис (прямая трассировка, если нужна без детализации до BF) |
| `uses_function` | `actor -> system_function` | Опционально: роль/актор опирается на возможность ИС (сценарии владения/потребления) |
| `conforms_to_adr_principle` | `adr_applied -> adr_principle` | ADRA опирается на / соблюдает выбранный ADRP (явная трассировка «конкретное решение ↔ общий принцип») |
| `instantiates_adr_principle` | `adr_principle -> adr_applied` | Обратное чтение: по ADRP найти связанные заключения (редко хранится отдельно от метамодели) |

## 6) Практический порядок заполнения demo

1. Заполнить справочники (`partner`, статусы, типы, категории).
2. Создать оргструктуру (`organization_unit`) и заинтересованных лиц (`actor`).
3. Внести `business_service` и `business_function` с владельцами.
4. Наполнить `system`, `technology`, `integration_flow`.
4a. Для каждой ключевой ИС завести `system_function` (имена из прикладного слоя) и связать с `business_function` / при необходимости с `business_service` (метамодель и/или будущие FK/мост).
5. Проставить связи в `ar_metamodel_relations` по словарю выше.
6. Добавить governance-слой (`principle`, `gap`, далее **ADRP**/**ADRA**, `requirement`/`process`/`data_entity`).
7. Связать ADRA с инкрементами и затронутыми системами / функциями ИС; при необходимости — ADRA ↔ gap (`applied_gap`), ADRA ↔ ADRP (`conforms_to_adr_principle`) в метамодели.

## 7) Матрица покрытия связями (сущность x сущность)

**Вынесено на потом (не входят в эту матрицу):** `integration_flow`, `requirement`, `data_entity` — см. §4–§6 для контекста. Экспорт этой матрицы в CSV: [`exports/demo-full-model-entities-matrix-section7.csv`](exports/demo-full-model-entities-matrix-section7.csv) (актуально: `partner`, **ADRP** / **ADRA**). Файл `docs/demo-full-model-entities-matrix-section7.csv` при необходимости замените копией отсюда или удалите дубликат после синхронизации. Схема в стиле метамодели (draw.io): [`diagrams/demo-full-model-metamodel-section7.drawio`](diagrams/demo-full-model-metamodel-section7.drawio) — на схеме не все ячейки матрицы, а ключевые связи и зоны; остальное по таблице ниже.

Легенда (единообразно по слоям данных):

- **есть** — связь представлена в **метамодели** (`ar_metamodel_relations` и тип в `ar_metamodel_relation_types`), используется в графе/проекциях.
- **частично** — связь выражена в **реляционной модели** (FK, колонка владельца, иерархия `parent_id` и т.п.), но **нет** как управляемая запись в метамодели (или обратное чтение к уже хранимому направлению метамодели).
- **нужно** — **нет** ни в метамодели, ни в реляционной модели; ниже — предлагаемый **код типа связи** для внесения в словарь.

В каждой ячейке: первая строка — статус, вторая — предлагаемое имя типа связи (`code` для `ar_metamodel_relation_types` или проекции). Диагональ (сущность → сама себя): только «—».

**Партнёр (`partner`, `ar_partners`).** В каталоге ИС три роли контрагента задаются FK на строке `ar_systems` (для подсистемы — та же таблица, модуль как дочерняя ИС): **вендор** — `vendor_ar_partners_id`; **партнёр по внедрению** (в схеме БД — поставщик/интегратор) — `supplier_ar_partners_id`; **партнёр по поддержке** — `supporter_ar_partners_id`. В метамодели как три типа связей **system|subsystem → partner** пока не выделены — в матрице это **частично** (реляционно есть, в `ar_metamodel_relations` — по желанию проецировать).

**ADRP и ADRA** (реестры `ar_adrs_principle`, `ar_adrs_applied`; коды сущностей **`adr_principle`**, **`adr_applied`**):

- **ADRP** — архитектурное решение-**принцип**: зафиксированное правило «**далее поступаем так, потому что …**» (контекст, решение, последствия в карточке ADRP).
- **ADRA** — архитектурное **заключение** по **конкретной задаче**: формулировка задачи (`task_name`), ссылка на трекер (`task_link`), текст заключения (`conclusion`). Состав решения раскрывается **инкрементами** (`ar_adr_increments`), к затронутым ИС и связям между ними.

Связь **ADRA → gap** в метамодели уже есть как **`applied_gap`** (§5.1). Связь **ADRA → ADRP**, ADRA ↔ системы и прочие трассировки — в основном **нужно** в метамодели или **частично** через операционные таблицы инкрементов (`ar_adr_increment_systems`, `ar_adr_increment_system_functions`, …).

| From \ To | `organization_unit` | `actor` | `business_service` | `business_function` | `system_function` | `system` | `subsystem` | `partner` | `technology` | `principle` | `gap` | `adr_principle` | `adr_applied` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `organization_unit` | — | частично<br>`org_unit_contains_actor` | частично<br>`owns_business_service` | частично<br>`owns_business_function` | нужно<br>`scopes_system_function` | нужно<br>`owns_system` | нужно<br>`owns_subsystem` | нужно<br>`contracts_with_partner` | нужно<br>`mandates_technology_standard` | нужно<br>`sponsors_principle` | нужно<br>`accountable_for_gap` | нужно<br>`sponsors_adr_principle` | нужно<br>`commissions_adra` |
| `actor` | частично<br>`belongs_to_organization` | — | нужно<br>`consumes_business_service` | нужно<br>`performs_business_function` | нужно<br>`uses_system_function` | нужно<br>`uses_system` | нужно<br>`uses_subsystem` | нужно<br>`engages_partner` | нужно<br>`uses_technology` | нужно<br>`subject_to_principle` | нужно<br>`raises_gap` | нужно<br>`authors_or_accepts_adrp` | нужно<br>`authors_adra` |
| `business_service` | частично<br>`owned_by_organization` | нужно<br>`served_to_actor` | — | нужно<br>`supported_by_business_function` | нужно<br>`realized_by_system_function` | нужно<br>`realized_by_system` | нужно<br>`realized_by_subsystem` | нужно<br>`supplied_by_partner` | нужно<br>`enabled_by_technology` | нужно<br>`constrained_by_principle` | нужно<br>`exposes_gap` | нужно<br>`in_scope_of_adrp` | нужно<br>`in_scope_of_adra` |
| `business_function` | частично<br>`owned_by_organization` | нужно<br>`performed_by_actor` | нужно<br>`supports_business_service` | частично<br>`business_function_hierarchy` | нужно<br>`implemented_by_system_function` | нужно<br>`realized_by_system` | нужно<br>`realized_by_subsystem` | нужно<br>`outsourced_to_partner` | нужно<br>`supported_by_technology` | нужно<br>`constrained_by_principle` | нужно<br>`reveals_gap` | нужно<br>`guided_by_adrp` | нужно<br>`touched_by_adra` |
| `system_function` | нужно<br>`accountable_org_unit` | нужно<br>`used_by_actor` | нужно<br>`supports_bs` | нужно<br>`implements_bf` | — | частично<br>`belongs_to_system` | нужно<br>`scoped_to_subsystem` | нужно<br>`delivered_by_partner` | нужно<br>`runs_on_technology_stack` | нужно<br>`complies_with_principle` | нужно<br>`related_gap` | нужно<br>`subject_to_adrp` | частично<br>`listed_in_adr_increment` |
| `system` | нужно<br>`aligned_with_organization` | нужно<br>`used_by_actor` | нужно<br>`realizes_business_service` | нужно<br>`realizes_business_function` | частично<br>`contains_system_function` | — | есть<br>`system_module` | частично<br>`system_vendor_partner` (вендор)<br>`system_implementation_partner` (внедрение)<br>`system_support_partner` (поддержка) | есть<br>`system_technology` | нужно<br>`constrained_by_principle` | нужно<br>`affected_by_gap` | нужно<br>`constrained_by_adrp` | частично<br>`in_adr_increment_scope` |
| `subsystem` | нужно<br>`owned_by_organization` | нужно<br>`used_by_actor` | нужно<br>`realizes_business_service` | нужно<br>`realizes_business_function` | нужно<br>`exposes_system_function` | частично<br>`part_of_system` | частично<br>`subsystem_hierarchy` | частично<br>`subsystem_vendor_partner`<br>`subsystem_implementation_partner`<br>`subsystem_support_partner` | есть<br>`module_technology` | нужно<br>`constrained_by_principle` | нужно<br>`affected_by_gap` | нужно<br>`constrained_by_adrp` | частично<br>`in_adr_increment_scope` |
| `partner` | нужно<br>`partner_serves_organization` | нужно<br>`partner_interacts_actor` | нужно<br>`partner_offers_business_service` | нужно<br>`partner_supports_business_function` | нужно<br>`partner_delivers_system_function` | частично<br>`referenced_by_system_roles` | частично<br>`referenced_by_subsystem_roles` | — | нужно<br>`partner_provides_technology` | нужно<br>`partner_subject_to_principle` | нужно<br>`partner_related_gap` | нужно<br>`bound_by_adrp` | нужно<br>`named_in_adra` |
| `technology` | нужно<br>`standardized_by_organization` | нужно<br>`relevant_to_actor` | нужно<br>`enables_business_service` | нужно<br>`enables_business_function` | нужно<br>`implements_layer_for_system_function` | частично<br>`system_technology` | частично<br>`module_technology` | нужно<br>`technology_via_partner` | — | нужно<br>`constrained_by_principle` | нужно<br>`impacted_by_gap` | нужно<br>`selected_under_adrp` | нужно<br>`chosen_in_adra` |
| `principle` | нужно<br>`constrains_organization` | нужно<br>`constrains_actor` | нужно<br>`constrains_business_service` | нужно<br>`constrains_business_function` | нужно<br>`constrains_system_function` | нужно<br>`constrains_system` | нужно<br>`constrains_subsystem` | нужно<br>`constrains_partner` | нужно<br>`constrains_technology` | — | нужно<br>`gap_addressing_principle` | нужно<br>`informs_adr_principle` | нужно<br>`referenced_in_adra_text` |
| `gap` | нужно<br>`impacts_organization_unit` | нужно<br>`impacts_actor` | нужно<br>`impacts_business_service` | нужно<br>`impacts_business_function` | нужно<br>`impacts_system_function` | есть<br>`gap-system` | нужно<br>`impacts_subsystem` | нужно<br>`impacts_partner` | нужно<br>`impacts_technology` | нужно<br>`contradicts_principle` | — | нужно<br>`drives_adr_principle` | нужно<br>`addressed_by_adra` |
| `adr_principle` | нужно<br>`adrp_applies_to_org` | нужно<br>`adrp_stakeholder` | нужно<br>`adrp_scopes_bs` | нужно<br>`adrp_scopes_bf` | нужно<br>`adrp_scopes_sf` | нужно<br>`adrp_constrains_system` | нужно<br>`adrp_constrains_subsystem` | нужно<br>`adrp_regulates_partner` | нужно<br>`adrp_standardizes_tech` | нужно<br>`adrp_aligns_catalog_principle` | нужно<br>`adrp_relates_gap` | — | нужно<br>`instantiated_by_adra` |
| `adr_applied` | нужно<br>`adra_owner_org` | нужно<br>`adra_author_actor` | нужно<br>`adra_touches_bs` | нужно<br>`adra_touches_bf` | частично<br>`adra_lists_system_functions` | частично<br>`adra_scopes_systems_via_increment` | частично<br>`adra_scopes_subsystems_via_increment` | нужно<br>`adra_involves_partner` | нужно<br>`adra_selects_technology` | нужно<br>`adra_cites_principle` | есть<br>`applied_gap` | нужно<br>`conforms_to_adr_principle` | — |

**Примечания к классификации (репозиторий):**

- **ADRP / ADRA:** тип связи **`applied_gap`** (`adr_applied → gap`) описан в §5.1. Явного FK **ADRA → ADRP** в таблице `ar_adrs_applied` нет — трассировка «заключение опирается на принцип» в матрице помечена как **нужно** (`conforms_to_adr_principle`). Связь сущностей каталога ИС с ADRA — **частично** через `ar_adr_increment_systems` и `ar_adr_increment_system_functions` (и связанные справочники инкремента), без единого универсального FK «ADRA → system».
- **Партнёр и ИС:** на `ar_systems` три nullable FK на `ar_partners`; в UI уже различаются вендор / поставщик(внедрение) / поддержка. Для **subsystem** используются те же колонки, если для модуля они заполняются. Проекция в метамодель — три типа связи с кодами вроде `system_vendor_partner`, `system_implementation_partner`, `system_support_partner` (и зеркально для `subsystem`, либо единый код с `from_entity_type`).
- `gap-system`: метамодель, направление **gap → system** (см. §5.1); ячейка **system → gap** — «нужно», обратное направление в метамодели отдельно не задано.
- `system_technology` / `module_technology`: в метамодели хранится направление **system|subsystem → technology**; ячейки **technology → system|subsystem** помечены как **частично** (обратное чтение той же связи / отсутствие FK «технология → система»).
- `system_module`: проекция иерархии `ar_systems.parent_ar_systems_id`; **subsystem → system** — **частично** по FK, без симметричного типа «ребёнок → родитель» в списке §5.1.
- Владение орг.единицей: **business_service** / **business_function** → **organization_unit** — **частично** (`ar_organization_units_id` на стороне продукта/функции); обратное направление в таблице матрицы — тот же факт связи.
- **business_function → business_function**: **частично** (`parent_id`), в метамодели как универсальная связь не выделена.
- **system_function → system**: **частично** (`ar_system_functions.ar_systems_id`); **system → system_function** — обратное чтение той же FK.

### 7.1 Приоритет закрытия пробелов (для demo, в рамках матрицы §7)

1. Метамодель: **business_function → business_service** (`supports_business_service`), **actor → business_function** (`performs_business_function`), **system → business_service** (`realizes_business_service`).
2. Метамодель + сущность типа `system_function`: **system_function → business_function** (`implements_bf`), при необходимости **system_function → business_service** (`supports_bs`); запись типа сущности в `ar_metamodel_entity_types` для `ar_system_functions`.
3. Метамодель: **principle → system|subsystem|technology** (`constrains_*`).
4. Расширить **gap** за пределы **gap-system**: универсальный **`affects`** / таргеты на оргструктуру и бизнес-слой (после появления сущностей из п.1).
5. Метамодель: **system|subsystem → partner** — три типа (**вендор**, **внедрение**, **поддержка**) как проекция существующих FK (при необходимости унификация имён кодов с колонками API).
6. Метамодель: **adr_applied → adr_principle** (`conforms_to_adr_principle`); при необходимости проекции **adr_applied → system|subsystem|system_function** из операционных таблиц инкремента в `ar_metamodel_relations`.

Отложенные сущности (**integration_flow**, **requirement**, **data_entity**) вернуть в матрицу отдельной версией документа, когда появятся таблицы/типы связей в репозитории.

## 8) Уточнение: «функция ИС» vs «бизнес-функция»

| Термин в модели | Таблица / код | Уровень |
|---|---|---|
| Бизнес-функция | `ar_business_functions`, сущность `business_function` | Business (TOGAF BCCD / способности и деятельность) |
| Функция ИС (прикладная) | `ar_system_functions`, сущность `system_function` | Application: возможности конкретной системы в каталоге |

**Цепочка для demo:** `system` —`contains_function`→ `system_function` —`implements_bf`→ `business_function` —`supports`→ `business_service` (параллельно допустима прямая `system` —`realizes`→ `business_service`, если не детализируют до функций ИС).

**Реализация связей (эволюция):** слой A — строки в `ar_metamodel_relations` + типы в `ar_metamodel_relation_types`; слой B — FK или мостовая таблица для жёсткой целостности (согласовать с правилами проекций, как для `integration_flow`).
