# Реестр функций ИС (issue #76)

Отдельный экран `Реестр функций ИС` (`/system-functions`) для таблицы `archrep.ar_system_functions`.

## API

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/system-functions?search=&system_id=&status_id=` | список реестра: функция, система/модуль, статус в реестре, примечание |
| GET | `/api/system-functions/:id` | карточка + связи метамодели + использование в ADR |
| POST | `/api/system-functions` | создание (`ar_systems_id`, `name`, `description`, `ar_system_function_statuses_id`) |
| PUT | `/api/system-functions/:id` | правка; смена системы допустима, дубликат имени в системе → 409 |
| DELETE | `/api/system-functions/:id` | удаление; занятость в заключениях → 409 (`adr_codes`, `usages`) |

RBAC: `system_function:read` / `:write` / `:delete` / `:export` (каталог `permissionsCatalog.js`).
Список систем доступен с `system_function:read` (`SYSTEM_FK_READS`), статусы реестра — тоже
(`refLookup('/api/system-function-statuses', ...)`).

## Почему связи только для чтения

Связи функции с системой/модулем — проекция FK `ar_system_functions.ar_systems_id`
(`system_system_function` / `subsystem_system_function`, `managed = true`), связь с акторами
(`actor_system_function`) ведётся в реестре «Связи объектов управления». Поэтому карточка
**показывает** связи и ведёт в `/metamodel-relations/:id/edit`, но не дублирует CRUD связей:
ручное изменение управляемых проекций запрещено политикой `relationTypePolicy`.

## Защита от удаления

Перед DELETE выполняется `system_function_increment_usage` (по id функции). Если функция выбрана
в архитектурном заключении, API возвращает 409 с кодами ADR и списком использований; фронт
показывает их в панели сохранения. Это тот же контракт, что у массового удаления из карточки ИС.

Связи метамодели при удалении функции очищаются триггером
`trg_ar_system_functions_parent_metamodel` (миграция `20261119130000_system_function_delete_cleanup`):
до issue #76 триггер не срабатывал на DELETE, и в `ar_metamodel_relations` оставались «висячие» рёбра.

## Связанные задачи

- #52, #74 — функции систем в архитектурном заключении и двухконтурные статусы;
- #93 — маркеры функций на схеме решения.
