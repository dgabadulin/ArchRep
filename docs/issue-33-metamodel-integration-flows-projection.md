# Задача #33: проекция интеграционных потоков в метамодель

**Статус:** реализовано (миграция БД, BFF, фронт списка/формы, сид `DISP_INTEGRATION_FLOW_NAME`)  
**GitHub:** https://github.com/dgabadulin/ArchRep/issues/35 *(в репозитории документ назван «issue-33» — это id спеки; в GitHub та же тема = **#35**)*  
**Процесс учёта задач:** [process-issue-tracking.md](./process-issue-tracking.md)  
**Спецификация:** [metamodel-projection-ar-integration-flows.md](./metamodel-projection-ar-integration-flows.md)  
**Связано:** [issue-35-metamodel-mass-rebuild-ui.md](./issue-35-metamodel-mass-rebuild-ui.md) — расширение UI админки (пересборка: **Настройки → Сервисные операции**); доработки RBAC → GitHub **#36**

---

## Кратко

**`archrep.ar_integration_flows`** → строки-проекции в **`ar_metamodel_relations`** (`relation_type = integration_flow`, **`reference_to_baserow`** = id потока). Подпись **`displayed_name`** по **`DISP_INTEGRATION_FLOW_NAME`**. Триггер **INSERT/UPDATE** на потоках; пересборка **`archrep.rebuild_integration_flow_metamodel_relations()`** и **POST `/api/togaf/metamodel/rebuild-integration-flow-projections`**.

## Критерии готовности

- [x] Миграция `DB/schema/archrep_issue33_integration_flow_metamodel_projection.sql`
- [x] Параметр **`DISP_INTEGRATION_FLOW_NAME`** в сиде
- [x] API: пересборка, запрет правки/удаления управляемых проекций через TOGAF relations
- [x] Запросы `queries.js`: `displayed_name`, `reference_to_baserow`
- [x] Фронт: `relationDisplayName`, список связей, форма (read-only для проекции), пересборка в **Настройки → Сервисные операции**

## Ссылки

- Миграция: `DB/schema/archrep_issue33_integration_flow_metamodel_projection.sql`
- Потоки: `DB/schema/archrep_integration_flows.sql`
