# db — схема и скрипты БД

Всё, что относится к PostgreSQL архитектурного репозитория (схемы `archrep`, `archrep_test`).

**Целевая структура:**

- `schema/` — DDL (создание схем, таблиц). Сюда перенести текущие файлы из `DB/` (например `archrep_test.sql`).
- `migrations/` — версионированные миграции **`node-pg-migrate`** (JS) — прежде всего цепочка для **демо**-деплоя и `npm run db:migrate`.
- `scripts/` — разовые SQL-скрипты для **прода** и уже развёрнутых БД (`psql -f …`), плюс сиды и отчёты.

### Договорённость: prod и demo

Новое изменение схемы или данных, которое нужно накатывать и на **прод**, и на **демо**, оформляем **в двух вариантах**:

| Среда | Каталог | Формат | Как применяется |
|--------|---------|--------|------------------|
| **Прод** | `DB/scripts/` | **SQL** (`migrate_*.sql`, идемпотентно где возможно) | Вручную или пайплайном: `psql … -f DB/scripts/…` |
| **Демо** | `DB/migrations/` | **JS** (`exports.up` / `exports.down` для `node-pg-migrate`) | Автоматически в `infra/demo/remote_demo_deploy.sh` и локально: `npm run db:migrate` |

Смысл изменений в паре файлов должен **совпадать**; отличается только механизм наката. Краткое правило для ИИ: `.cursor/rules/db-migrations-dual.mdc`.

Большие дампы (`dump-*.sql`) в репозиторий не коммитить; они остаются в `.gitignore`.

Сводка таблиц `archrep`, нужных для наполнения схем инкремента (draw.io) и параметров `DRAWIO_*`: раздел **«Контекст схемы БД»** в `docs/drawio-increment-diagram-parameters.md`.

Колонка **`code`** у статусов системы в инкременте (`ar_adr_increment_system_statuses`): скрипт **`DB/scripts/migrate_adr_increment_system_statuses_code.sql`** (см. тот же документ, справочник `ADR_INCR_SYS_*`).

---

## Миграции через `node-pg-migrate`

- Файлы цепочки для демо и локальной накатки — в **`DB/migrations/`** (см. договорённость **prod + demo** выше: для прода параллельно добавляйте **`DB/scripts/*.sql`**).
- Конфиг: `pgmrc.json` (история миграций — таблица `public.pgmigrations` в целевой БД).
- Подробно, как устроен инструмент по шагам: **`docs/node-pg-migrate.md`**.
- Базовая команда:

```bash
npm run db:migrate
```

Для demo-деплоя команда запускается автоматически из `infra/demo/remote_demo_deploy.sh` в режимах `full` и `api-only`.

**Словарь типов связей по матрице demo:** `DB/scripts/migrate_20260506120000_demo_full_model_entities_matrix_relation_dictionary.sql` (пара `DB/migrations/20260506120000_demo_full_model_entities_matrix_relation_dictionary.js`) — выравнивание `ar_metamodel_relation_types` с `docs/demo-full-model-entities-matrix.md` §3.1–§3.2; после наката перезапуск backend.

**Демо-набор SCOR («СеверЛогистик»):** `DB/scripts/migrate_20260507120000_demo_scor_reference_dataset.sql` и `DB/migrations/20260507120000_demo_scor_reference_dataset.js` — объекты и связи по [`docs/demo-dataset-scor-reference-model.md`](docs/demo-dataset-scor-reference-model.md) (коды сущностей с префиксом `DEMO_SCOR_`); идемпотентный накат на демо-БД. После наката — перезапуск backend.

---

## Параметр `TECH_RADAR_EMBED_URL` (страница «Тех.радар»)

В приложении **нет** захардкоженного URL: значение только из **`ar_settings_parameters`** или env **`TECH_RADAR_EMBED_URL`**. Для уже развёрнутой БД (в т.ч. после старого дампа без этой строки):

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_tech_radar_embed_url_parameter.sql
```

Скрипт идемпотентен (`ON CONFLICT (code) DO NOTHING`). После выполнения — **перезапуск backend**.

---

## Issue #32: модули систем (subsystem) в анализаторе

Для уже развёрнутой БД (параметры заведены без `subsystem`) выполните по очереди:

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_issue32_disp_subsystem_template.sql
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_issue32_graph_analyzer_params.sql
```

Скрипты идемпотентны. После выполнения перезапустите backend, чтобы подтянуть кэш параметров.

---

## Issue #44: связи ИС–технологии в метамодели (`system_technology`)

Перенос с `archrep.ar_systems_technologies` на `ar_metamodel_relations`, параметр **`SYS_TECH_STACK_RELATION_CODE`** (по умолчанию в коде `system_technology`). После скрипта — **перезапуск backend**.

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_issue44_system_technology_metamodel.sql
```

Контракт: `docs/contracts/system-technology-metamodel.md`.

---

## Issue #45: модули и стек технологий (`MODULE_TECH_STACK_RELATION_CODE`, триггер)

Параметр **`MODULE_TECH_STACK_RELATION_CODE`** (по умолчанию `module_technology`), разовый перенос связей модулей и триггер на **`ar_systems`**: при смене **`parent_ar_systems_id`** строки **`ar_metamodel_relations`** к технологиям получают корректные **`from_entity_type`** и **`relation_type`**. После скрипта — **перезапуск backend**.

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_issue45_module_tech_trigger.sql
```

На PostgreSQL &lt; 14 при ошибке `EXECUTE FUNCTION` замените в скрипте на **`EXECUTE PROCEDURE`**.

---

## Issue #48: иконка ИС при свёртке модулей (`GRAPH_COLLAPSED_SYSTEM_ICON`)

Параметр в **`ar_settings_parameters`** (группа «Граф»), строковое имя иконки Lucide. Для уже развёрнутой БД:

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_issue48_graph_collapsed_system_icon_param.sql
```

Также добавлено в **`DB/scripts/seed_settings_parameters_from_candidates.sql`**. После выполнения — **перезапуск backend**.

Если строки в БД нет, **`GET /api/config`** всё равно отдаёт **`MonitorDot`** как запасной вариант в коде (аналогично заполнению **`GRAPH_ENTITY_ICONS`** по умолчанию).

---

## FK функций каталога ИС и заключений ADR (`ar_adr_increment_system_functions`)

Удаление строки **`ar_system_functions`** не должно молча снимать выбор функции в заключении. Для уже развёрнутой БД (где FK был **ON DELETE CASCADE**):

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_system_functions_fk_restrict.sql
```

После миграции **`DELETE /api/ar-systems/:id/system-functions`** при использовании функции в ADR возвращает **409** с перечнем заключений; идемпотентный повтор скрипта безопасен.

---

## Issue #42: поле «Ответственное лицо» в `archrep.ar_gaps`

На уже развёрнутой БД (после issue #23):

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_issue42_gap_responsible_person.sql
```

---

## Issue #34: KPI главной страницы (`/api/dashboard/home-stats`)

После таблиц систем, технологий, потоков и **`archrep.ar_gaps`** (issue #23):

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/schema/archrep_issue34_home_dashboard.sql
```

Затем при необходимости вставьте параметр **`ARR_HOME_KPI_TILES`**: `DB/scripts/seed_settings_parameters_from_candidates.sql` (или вручную в настройках). Перезапуск backend для кэша параметров.

---

## Issue #33: проекция интеграционных потоков в метамодель

После **`archrep_integration_flows`**, **`archrep_togaf_metamodel`**, желательно **`archrep_issue21_migration.sql`** (поле `periodicity`):

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/schema/archrep_issue33_integration_flow_metamodel_projection.sql
```

Создаёт колонки **`reference_to_baserow`**, **`displayed_name`**, тип связи **`integration_flow`**, триггер на **`ar_integration_flows`**, функции **`archrep.rebuild_integration_flow_metamodel_relations()`**, **`archrep.integration_flow_metamodel_displayed_name(bigint)`**, первичную пересборку данных. Параметр **`DISP_INTEGRATION_FLOW_NAME`** — из сида `seed_settings_parameters_from_candidates.sql` (или вручную). Пересборка из API/UI: `POST /api/togaf/metamodel/rebuild-integration-flow-projections`, в интерфейсе — **Настройки → Сервисные операции**. Перезапуск backend после сида параметров.

**Один проход (параметр + DSIP→DISP + тот же DDL):** `DB/scripts/bundle_uncommitted_sql_integration_flow_metamodel.sql` — порядок: сначала вставка/переименование **`DISP_INTEGRATION_FLOW_NAME`**, затем содержимое `archrep_issue33_integration_flow_metamodel_projection.sql` (идемпотентно).

Если в **`ar_settings_parameters`** уже заведён старый код **`DSIP_INTEGRATION_FLOW_NAME`** (опечатка), один раз:

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_rename_dsip_to_disp_integration_flow_name.sql
```

Или выполните **итоговый скрипт issue #35** (включает переименование DSIP→DISP, актуализацию **`integration_flow_metamodel_displayed_name`** и **`rebuild_integration_flow_metamodel_relations()`**) — см. ниже.

---

## Issue #35: массовая пересборка проекций потоков в метамодели

После DDL issue #33 и (при необходимости) сида **`DISP_INTEGRATION_FLOW_NAME`** — для выравнивания БД без UI (смена шаблона, после импорта, «висячие» проекции после каскадных удалений):

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_issue35_integration_flow_metamodel.sql
```

Эквивалент из приложения: **`POST /api/togaf/metamodel/rebuild-integration-flow-projections`**. После скрипта перезапустите backend.

---

## Issue #56: проекции потоков с учётом модулей (system/subsystem)

После DDL issue #33 и (при необходимости) issue #35 — типы связей `integration_flow_system_module`, `integration_flow_module_system`, `integration_flow_module_module`, обновлённые `upsert`/`rebuild`, триггер на `ar_systems.parent_ar_systems_id`:

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_issue56_integration_flow_module_projections.sql
```

Скрипт в конце вызывает массовую пересборку проекций. После выполнения перезапустите backend.

---

## Сотрудники и лиды ИС (`ar_employees`, FK на `ar_systems`)

Таблица **`archrep.ar_employees`** (`full_name`, `active`), без отдельной колонки фамилии: уникальность «по фамилии» для дедупа — **выражение** `lower(trim(split_part(full_name,' ',1)))` в уникальном индексе. Колонки **`it_lead_employee_id`** / **`business_lead_employee_id`** на **`ar_systems`**, проекции в **`ar_metamodel_relations`** (триггер на `ar_systems`), параметр **`DISP_EMPLOYEE_TEMPLATE`** для отображения сотрудника в справочниках, четыре **`*_RELATION_CODE`**. Подпись ребра на графе для этих проекций — из **`ar_metamodel_relation_types.name`**, не из **`displayed_name`**. В скрипте функция **`normalize_lead_text`** используется только при переносе legacy-текстов и в конце **удаляется**.

**Прод (полная цепочка сотрудники + подписи рёбер + снятие текстовых полей лидов):**

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_20260501120000_ar_employees_system_leads.sql
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_20260502120000_employee_lead_edge_labels.sql
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_20260503120000_drop_ar_systems_legacy_lead_text.sql
```

Второй файл идемпотентен и нужен в первую очередь, если первый скрипт уже выполнялся **до** появления в репозитории правок по единым именам типов связей и очистке **`displayed_name`**. Третий скрипт удаляет **`it_lead`** / **`business_lead`** из **`ar_systems`** — накатывайте **после** выката backend/frontend, которые больше не читают эти колонки.

**Демо:** миграции `DB/migrations/20260501120000_ar_employees_system_leads.js`, `DB/migrations/20260502120000_employee_lead_edge_labels.js`, `DB/migrations/20260503120000_drop_ar_systems_legacy_lead_text.js` (`npm run db:migrate`). После наката перезапустите backend.

**Анализ зависимостей:** в коде обновлены дефолты **`GRAPH_ENTITY_ORDER`** и **`GRAPH_ENTITY_ICONS`** (`employee` после `actor`). Если в **`ar_settings_parameters`** уже задан свой **`GRAPH_ENTITY_ORDER`**, добавьте в массив код **`employee`** вручную (см. `docs/adding-new-entity-type.md` §3.2).

---

## Миграция «Архитектурные решения» (ADR)

Чтобы работали раздел «Реестр архитектурных решений» и связанные справочники, нужно один раз выполнить скрипт:

**Вариант 1 — через `psql` (Windows cmd), из корня репозитория:**

Задайте при необходимости переменные окружения (как в `.env.development` / `.env.production`):

```cmd
set PGHOST=localhost
set PGPORT=5432
set PGUSER=postgres
set PGDATABASE=имя_вашей_базы
set PGPASSWORD=ваш_пароль
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB\schema\archrep_adr.sql
```

**Вариант 2 — вручную через psql (bash):**
```bash
psql -h localhost -p 5432 -U postgres -d ИМЯ_БАЗЫ -f DB/schema/archrep_adr.sql
```
Подставьте свои `-h`, `-p`, `-U`, `-d` (как в переменных `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`).

Если в проекте используется схема **archrep_test** вместо **archrep**, перед запуском замените в файле `DB/schema/archrep_adr.sql` все вхождения `archrep` на `archrep_test`.

---

## Миграция v2: принципиальные и прикладные решения (ADRP / ADRA)

После выполнения первой миграции (archrep_adr.sql) выполните **один раз**:

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/schema/archrep_adr_v2.sql
```

Или из корня репозитория (Windows cmd), с теми же переменными `PG*`:

```cmd
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB\schema\archrep_adr_v2.sql
```

Миграция v2 создаёт таблицы принципиальных (ar_adrs_principle) и прикладных (ar_adrs_applied) решений, инкременты, переименовывает справочники и таблицы систем/интеграций, удаляет старую таблицу ar_adrs.

---

## Миграция «Поиск по связям объектов управления» (issue #81)

Реестр `/metamodel-relations` ищет связи по наименованиям концов. Структура хранения связей не меняется:
добавляется функция `archrep.metamodel_entity_search_text(text, bigint)`, а в каталог типов — колонка
`disp_param_name` (код параметра `DISP_*`, чьи плейсхолдеры задают поля поиска).

**Прод (идемпотентно, по порядку):**

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_20261019120000_metamodel_entity_search_text.sql
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_20261019130000_metamodel_entity_types_disp_param.sql
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_20261020120000_metamodel_relation_types_managed.sql
```

**Демо:** `npm run db:migrate` (миграции `20261019120000_metamodel_entity_search_text`,
`20261019130000_metamodel_entity_types_disp_param`, `20261020120000_metamodel_relation_types_managed`).

Порядок: **сначала миграция, затем выкат backend/frontend**. Без функции поиск в реестре связей вернёт 500
(`metamodel_relations_select_search` вызывает её в `WHERE`). Проверка после наката:

```sql
SELECT archrep.metamodel_entity_search_text('system', 1);
```

**Новый тип сущности:** заполните в справочнике (Настройки → Справочники → «Типы сущностей метамодели»)
поля `Таблица` и `DISP-параметр` — поиск в реестре связей подхватит его автоматически. Явная ветка в
`metamodel_entity_search_text` нужна только если поля шаблона приходят из JOIN или вычисляются
(сейчас так у `web_resource`, `domain`, `certificate`, `employee`).

**Новый тип связи, создаваемый триггером:** установите `managed = true` в
`archrep.ar_metamodel_relation_types` (справочник «Типы связей метамодели») — форма связей не даст создать,
изменить или удалить такое ребро вручную, а в реестре оно будет помечено как «Автоматически».

Подписи концов резолвит `backend/relationLabels.js` (сопоставление кодов типов с реестрами-источниками);
новый тип-конец требует записи там, ветки в этой функции и в `RELATION_END_META` (`backend/ai/tools.js`) —
см. `docs/adding-new-entity-type.md`. Полное описание — `docs/metamodel-relations-display-names.md`.


---

## Каталог инфраструктуры из Netbox (issue #92)

Read-only реестр серверов (ВМ и физических) + задание синхронизации `infrastructure_sync`.
Полное описание — `docs/infrastructure-registry-netbox.md`.

**Прод (идемпотентно):**

```bash
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_20261021120000_infrastructure_registry.sql
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f DB/scripts/migrate_20261021130000_infrastructure_relation_labels.sql
```

**Демо:** `npm run db:migrate` (миграции `20261021120000_infrastructure_registry`,
`20261021130000_infrastructure_relation_labels`).

Создаёт:

- справочник `archrep.ar_infrastructure_object_types` (`virtual_server`, `physical_server`);
- реестр `archrep.ar_infrastructure_objects` (комментарии к таблице и всем столбцам — в DDL);
- тип сущности `infrastructure_object`, типы связей `system_infrastructure` / `subsystem_infrastructure`
  (`managed = true`);
- параметры `NETBOX_*` и `DISP_INFRA_TEMPLATE`;
- право `infrastructure:read`;
- задание `infrastructure_sync` (`enabled = false`, интервал 86400 с);
- триггеры очистки связей при удалении сервера/ИС и при смене родителя ИС;
- ветку `infrastructure_object` в `archrep.metamodel_entity_search_text`;
- запись типа в `GRAPH_ENTITY_ORDER` / `GRAPH_ENTITY_ICONS`.

`20261021130000_infrastructure_relation_labels` — корректирующая миграция: очищает ранее записанный
`displayed_name` у связей инфраструктуры (если `20261021120000` уже накатывалась). Подпись ребра
на графе и в реестре берётся из `ar_metamodel_relation_types.name` — «Размещена на». Порядок выката:
сначала backend с исправлением, затем эта миграция; не запускайте старую версию задания между ними.

Перед запуском задания задайте параметр `NETBOX_URL` и переменную окружения `NETBOX_TOKEN` (токен в БД
не хранится), затем перезапустите API и включите задание в «Управлении заданиями».

