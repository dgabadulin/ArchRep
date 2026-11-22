# Система → организация-владелец (issue #126)

**GitHub:** [#126](https://github.com/dgabadulin/ArchRep/issues/126)
**Статус:** реализовано

## Что сделано

1. **FK на карточке ИС**: `archrep.ar_systems.owner_ar_organization_units_id` → `archrep.ar_organization_units(id)`
   (`ON DELETE SET NULL`). Поле «**Организация-владелец**» в форме системы заполняется из организационных
   единиц категории **«Организация»** (`ar_organization_unit_categories.code = 'org'`).
2. **Тип связи**: `organization_unit → system`, код **`owns_system`**, имя **«Владеет»**, `managed = true`
   (связь создаётся проекцией, вручную не редактируется).
3. **Проекция**: триггер `archrep.sync_system_owner_org_unit_relation()` на `ar_systems`
   (`AFTER INSERT OR UPDATE OF owner_ar_organization_units_id`, `AFTER DELETE`) поддерживает ровно одну
   строку в `ar_metamodel_relations`. При смене/очистке поля старая связь удаляется, новая создаётся.
4. **Реестр ИС**: колонка «Организация-владелец» (`owner_organization_name`) в таблице и Excel-выгрузке.
5. **Excel-импорт**: поле «Организация-владелец» (по названию организации) и «ID организации-владельца»
   (сырой FK) в шаблоне; справочный лист «Справочник_организации»; `template_version` = **2**.
6. **Схема метамодели**: выпущена **`docs/diagrams/Метамодель ИСАР 2.1.pptx`** (добавлена связь → минор),
   см. `.clinerules` §10 и `docs/diagrams/README.md`.

## Миграции (dual)

- `DB/scripts/migrate_20261122120000_system_owner_org_unit.sql` — прод / уже развёрнутые БД (`psql -f`).
- `DB/migrations/20261122120000_system_owner_org_unit.js` — Демо ИСАР (`node-pg-migrate`), читает тот же SQL.

Применённые ранее скрипты не редактируются (§8 `.clinerules`). После наката — перезапуск backend:
кэшируются параметры и справочник типов связей (`relationTypePolicy`).

## API

| Маршрут | Поле/право |
|---|---|
| `GET /api/ar-systems`, `GET /api/ar-systems/:id` | `owner_ar_organization_units_id`, `owner_organization_name` |
| `POST /api/add-ar-systems`, `PUT /api/update-ar-systems/:id` | принимают `owner_ar_organization_units_id` (`system:write`) |

Проекция связи `owns_system` — managed: ручное создание/правка/удаление таких строк в метамодели
запрещены (см. `relationTypePolicy.js`), источник истины — поле карточки ИС.

## Проверка

1. Применить миграцию (Демо ИСАР — автоматически; Прод ИСАР — вручную `psql -f`).
2. Открыть карточку ИС → выбрать «Организация-владелец» → сохранить.
3. В «Связях объектов управления» появилась связь `owns_system` «Владеет».
4. Сменить организацию — связь пересоздана; очистить поле — связь удалена.
5. В реестре ИС видна колонка «Организация-владелец»; поиск находит по названию организации.
