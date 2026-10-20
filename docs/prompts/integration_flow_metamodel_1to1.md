# Промпт: интеграционные потоки 1:1 в метамодель (модули + анализатор без дублей)

## Контекст

- **Проект/репозиторий:** архитектурный репозиторий (backend Node.js BFF, PostgreSQL `archrep`, фронт `frontend-v3`).
- **Файлы/схемы:** `ar_integration_flows`, `ar_systems.parent_ar_systems_id`, `ar_metamodel_relations`, `ar_metamodel_relation_types`; триггер/функции проекции из issue #33; фронт `frontend-v3/src/api/graphApi.js` (`loadAllRelations`); BFF `backend/index.js` (ограничения на ручное редактирование проекций).
- **Ограничения:** один поток = одно направленное ребро; «встречные» потоки — отдельные записи в `ar_integration_flows`; источник истины по атрибутам потока — реестр, не метамодель; пересборка через существующую сервисную операцию.

## Цель

Сделать проекции интеграций в `ar_metamodel_relations` строго **1:1** с `ar_integration_flows`: корректные концы `system` / `subsystem` и типы связей `integration_flow`, `integration_flow_system_module`, `integration_flow_module_system`, `integration_flow_module_module` по факту `parent_ar_systems_id`. Убрать из анализатора подмешивание `/api/integration-flows` как синтетических `system→system`. При смене иерархии системы обновлять проекции (триггер на `parent_ar_systems_id` и/или пересборка). Защитить API метамодели от ручного создания/правки/удаления строк-проекций потоков.

## Промпт для ИИ (скопировать в чат)

```
Сделай модель 1:1: проекции ar_integration_flows в ar_metamodel_relations с верными типами связей(integration_flow, integration_flow_system_module, integration_flow_module_system, integration_flow_module_module)
и концами system/subsystem по ar_systems.parent_ar_systems_id. Один поток — одна строка метамодели, reference_to_baserow = id потока.

Расширь rebuild_integration_flow_metamodel_relations и upsert_integration_flow_metamodel_projection; добавь уникальный индекс
по reference_to_baserow для всех integration_flow*. Добавь триггер на UPDATE parent_ar_systems_id у ar_systems: пересинхронизировать
все потоки, где система — source или target.

Фронт: loadAllRelations только из togafApi.relations, без отдельной загрузки integration-flows API.

Бэкенд: запретить POST/PUT/DELETE ручных операций над строками с reference_to_baserow и relation_type из набора проекций потоков.

Добавь SQL-миграцию в DB/scripts, обнови DB/README и спеки docs/issue-56-analyzer-module-integration-projections.md,
docs/metamodel-projection-ar-integration-flows.md при необходимости.
```

## Формат ответа

- Готовый SQL-миграционный скрипт в репозитории; правки `backend/index.js` и `frontend-v3/src/api/graphApi.js`; обновлённые документы в `docs/` и `DB/README.md`; краткое резюме для деплоя (прогон миграции, перезапуск backend).

## Критерии готовности

- В БД заведены три новых типа связей (плюс существующий `integration_flow` для system→system).
- `upsert` выставляет `from_entity_type` / `to_entity_type` / `relation_type` по текущему `parent_ar_systems_id`; при смене родителя проекции обновляются (триггер или пересборка).
- `rebuild` удаляет только строки всех четырёх типов проекций потоков и пересоздаёт их из реестра.
- `loadAllRelations` не вызывает API интеграционных потоков для графа.
- API метамодели не позволяет вручную создавать/менять/удалять проекции потоков с `reference_to_baserow`.
- Документация и `DB/README` содержат команду применения миграции.

---
*Создано: 14.04.2026  Обновлено: 14.04.2026*
