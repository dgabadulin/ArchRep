## Контекст

Локальная сводка: `docs/issue-16-analyzer-summary.md`, раздел «Пункт 16».

## Проблема

При раскрытии связей («Добавить связи») узлы систем создаются с типом `system`, хотя у части систем задан `parent_ar_systems_id` — для них нужен тип **`system_child`** (как при первичном выборе из списка).

## Предлагаемое решение

В `AnalyticsView.vue`: в **`resolveNodeNames`** при получении сущности `system` через API проверять `parent_ar_systems_id`; если задан — выставлять `entityType: 'system_child'` вместе с именем.

## Ссылки

- `docs/issue-16-analyzer-summary.md`
- `docs/issue-17-graph-topologies.md` (контекст анализатора)
