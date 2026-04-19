# Связь «ИС / модуль → технология» в метамодели

Связи хранятся в **`ar_metamodel_relations`**. API **`/api/systems-technologies`** работает с метамоделью.

## Параметры настроек

| Код (`ar_settings_parameters.code`) | Смысл | Дефолт в коде |
|-------------------------------------|--------|----------------|
| **`SYS_TECH_STACK_RELATION_CODE`** | Тип связи для **корневой ИС** (`parent_ar_systems_id IS NULL`) | `system_technology` |
| **`MODULE_TECH_STACK_RELATION_CODE`** | Тип связи для **модуля** (`parent_ar_systems_id IS NOT NULL`) | `module_technology` |

## Строка в `ar_metamodel_relations`

| Роль записи в `ar_systems` | `from_entity_type` | `relation_type` (обычно) |
|----------------------------|--------------------|---------------------------|
| Корневая ИС | `system` | значение `SYS_TECH_STACK_RELATION_CODE` |
| Модуль | `subsystem` | значение `MODULE_TECH_STACK_RELATION_CODE` |

- **`from_entity_id`**: `ar_systems.id`
- **`to_entity_type`**: `technology`
- **`to_entity_id`**: `ar_technologies.id`

## Триггер (issue #45)

При **изменении** `ar_systems.parent_ar_systems_id` триггер **`trg_systems_sync_tech_stack_on_parent`** обновляет существующие связи к технологиям для этой строки: переключает пару **`(from_entity_type, relation_type)`** в соответствии с новым признаком «модуль / корень» и значениями параметров из **`ar_settings_parameters`**.

Скрипт развёртывания: `DB/scripts/migrate_issue45_module_tech_trigger.sql`.

## Прочее

Миграция переноса с `ar_systems_technologies`: `DB/scripts/migrate_issue44_system_technology_metamodel.sql`.
