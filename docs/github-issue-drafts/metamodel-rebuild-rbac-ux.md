## Контекст

Локальная спека: `docs/issue-35-metamodel-mass-rebuild-ui.md`. Базовая пересборка уже есть: `POST /api/togaf/metamodel/rebuild-integration-flow-projections`, UI — **Настройки → Сервисные операции**, SQL `DB/scripts/migrate_issue35_integration_flow_metamodel.sql`.

## Осталось

- Ограничить вызов API пересборки **ролями** (админ / арх. репозиторий) — сейчас endpoint без RBAC.
- В UI: явное **подтверждение** перед пересборкой; опционально отображение результата (успех / ошибка).
- **Логирование** административного действия (кто вызвал, когда).

## Ссылки

- `docs/metamodel-projection-ar-integration-flows.md` §3.2–3.3
- `docs/issue-33-metamodel-integration-flows-projection.md`
