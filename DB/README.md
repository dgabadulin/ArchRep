# db — схема и скрипты БД

Всё, что относится к PostgreSQL архитектурного репозитория (схемы `archrep`, `archrep_test`).

**Целевая структура:**

- `schema/` — DDL (создание схем, таблиц). Сюда перенести текущие файлы из `DB/` (например `archrep_test.sql`).
- `migrations/` — версионированные миграции при появлении инструмента миграций.
- `scripts/` — разовые или периодические скрипты: очистка «висящих» записей, выгрузка данных, отчёты.

Большие дампы (`dump-*.sql`) в репозиторий не коммитить; они остаются в `.gitignore`.

Сводка таблиц `archrep`, нужных для наполнения схем инкремента (draw.io) и параметров `DRAWIO_*`: раздел **«Контекст схемы БД»** в `docs/drawio-increment-diagram-parameters.md`.

Колонка **`code`** у статусов системы в инкременте (`ar_adr_increment_system_statuses`): скрипт **`DB/scripts/migrate_adr_increment_system_statuses_code.sql`** (см. тот же документ, справочник `ADR_INCR_SYS_*`).

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
