# Задача #35: вызов функции массовой пересборки связей метамодели (из интерфейса)

**Статус:** API и кнопка в **Настройки → Сервисные операции** — в коде; усиление прав/логирования — по необходимости.  
**GitHub:** перенос кнопки в **Настройки → Сервисные операции** — https://github.com/dgabadulin/ArchRep/issues/39 (закрыт). Доработки RBAC/логи — https://github.com/dgabadulin/ArchRep/issues/36  
**Итоговый SQL для БД (без UI):** `DB/scripts/migrate_issue35_integration_flow_metamodel.sql`  
**Связано со спецификацией:** [metamodel-projection-ar-integration-flows.md](./metamodel-projection-ar-integration-flows.md) (§3.2–3.3)  
**Процесс учёта задач:** [process-issue-tracking.md](./process-issue-tracking.md)

---

## Зачем

При **отказе от триггера `DELETE`** на `ar_integration_flows` (или для административного выравнивания после смены шаблона **`DISP_INTEGRATION_FLOW_NAME`**, импорта, сбоев) нужен **явный вызов** хранимой функции массовой пересборки **строк-проекций** с `relation_type = 'integration_flow'` из интерфейса (роль с правами администратора / арх. репозитория).

---

## Кратко

- Backend: защищённый endpoint (например `POST /api/admin/metamodel/rebuild-integration-flow-projections`) или существующий паттерн админ-операций, вызывающий **`SELECT archrep.rebuild_integration_flow_metamodel_relations();`** (имя зафиксировано в [metamodel-projection-ar-integration-flows.md](./metamodel-projection-ar-integration-flows.md) §3.3).
- Frontend: кнопка/действие в разделе настроек или метамодели с подтверждением, отображение результата (успех / ошибка / число затронутых строк — по возможности БД).
- Логирование и права доступа обязательны.

## Критерии готовности

- [x] Реализована **`archrep.rebuild_integration_flow_metamodel_relations()`** (issue #33 / `archrep_issue33_integration_flow_metamodel_projection.sql`).
- [x] API вызывает только эту функцию (без произвольного SQL).
- [x] Итоговый скрипт БД: **`DB/scripts/migrate_issue35_integration_flow_metamodel.sql`** (DSIP→DISP при наличии, актуализация **`integration_flow_metamodel_displayed_name`**, пересборка).
- [ ] UI: действие видно только нужным ролям; есть подтверждение (доработать при появлении RBAC на endpoint).
- [x] Когда нажимать / запускать: см. `DB/README.md` (Issue #35), §3.2–3.3 в [metamodel-projection-ar-integration-flows.md](./metamodel-projection-ar-integration-flows.md).

## Ссылки

- [metamodel-projection-ar-integration-flows.md](./metamodel-projection-ar-integration-flows.md)
- [issue-33-metamodel-integration-flows-projection.md](./issue-33-metamodel-integration-flows-projection.md)
