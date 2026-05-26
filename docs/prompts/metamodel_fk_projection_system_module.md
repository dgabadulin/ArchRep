# Промпт: проекция связи `system_module` по FK `parent_ar_systems_id`

## Контекст

- **Проект/репозиторий:** архитектурный репозиторий (PostgreSQL `archrep`, BFF Node.js, фронт `frontend-v3`, модуль «Анализ зависимостей»).
- **Файлы/схемы:** `ar_systems.parent_ar_systems_id`, `ar_metamodel_relations`, `ar_metamodel_relation_types`, `ar_metamodel_entity_types`; клиент `frontend-v3/src/api/graphApi.js` (`buildSubsystemParentSystemMap`, `relationDisplayName`, `applyModuleCollapse`); бэкенд `backend/queries.js` (`metamodel_relations_select`), `backend/displayName.js` (шаблоны `DISP_*`).
- **Ограничения:** режим «Давай обсудим» — без правок кода/SQL, если не запрошено отдельно; результат — описание алгоритма в `docs/`.

## Цель

Разобрать и задокументировать, как из внешнего ключа иерархии ИС формируется проекция **`system_module`** в метамодели: какие поля в `ar_metamodel_relations`, какие параметры влияют на подписи, как данные доходят до графа анализатора. Отделить от проекций **`integration_flow_*`**.

## Промпт для ИИ (скопировать в чат)

```
Давай обсудим: проанализируй, как формируется проекция связей по внешнему ключу.
На примере связи system_module. Если используются параметры — укажи какие и как.
Опиши алгоритм в md (файл в docs/, без изменений прикладного кода, если не попросят отдельно).
```

## Формат ответа

- Markdown в `docs/metamodel-projection-system-module-fk.md`: источник истины (FK), целевая строка метамодели, жизненный цикл (INSERT/UPDATE/DELETE), таблица параметров/шаблонов, поток до графа (mermaid), отличие от `integration_flow_*`, критерии корректности в БД.
- Краткое резюме в чате со ссылкой на файл.

## Критерии готовности

- [ ] Описан FK `parent_ar_systems_id` и логический тип `subsystem` vs `system`.
- [ ] Зафиксировано направление ребра в `ar_metamodel_relations`, ожидаемое клиентом (`subsystem` → `system`).
- [ ] Перечислены параметры: что влияет на подпись ребра vs узлов vs свёртку модулей.
- [ ] Показан путь: БД → `GET /api/togaf/relations` → `loadAllRelations` → граф / `applyModuleCollapse`.
- [ ] Явно отделено от проекций интеграционных потоков.

## Связанные артефакты

- Результат анализа: [`docs/metamodel-projection-system-module-fk.md`](../metamodel-projection-system-module-fk.md)
- Матрица типов связей: [`docs/demo-full-model-entities-matrix.md`](../demo-full-model-entities-matrix.md) (§3.1)

---
*Создано: 2026-05-03  Обновлено: 2026-05-03*
