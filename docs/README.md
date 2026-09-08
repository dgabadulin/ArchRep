# Документация ИСАР (docs/)

Карта документации репозитория. Если вы знаете, что искать, — ищите по заголовкам ниже; если нет — начните с разделов **«Начать»** и **«Архитектура и метамодель»**.

> **Статусы документов**
> — 🟢 актуален · 🟡 спека/черновик/на согласовании · 🔴 устарел/дубль (требует ревизии)
> Документы без пометки считаются актуальными. Если документ не соответствует коду — обновите его или пометьте статусом.

---

## Начать (обязательно к прочтению)

| Документ | О чём |
|---|---|
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Текущая и целевая структура репозитория, этапы перехода. |
| [GITFLOW.md](./GITFLOW.md) | Ветки, цикл работы, деплой одной командой по SSH. |
| [process-issue-tracking.md](./process-issue-tracking.md) | Учёт задач: только GitHub Issues, таблица «локальный документ ↔ GitHub». |
| [node-pg-migrate.md](./node-pg-migrate.md) | Как работает инструмент миграций БД и как им пользоваться. |

---

## Архитектура и метамодель

| Документ | О чём |
|---|---|
| [togaf-metamodel-implementation.md](./togaf-metamodel-implementation.md) | Вариант реализации задачи #14: метамодель TOGAF (таблицы, API, фронт). |
| [togaf-metamodel-implementation_gdi.md](./togaf-metamodel-implementation_gdi.md) 🔴 | Дубликат предыдущего (версия «gdi»). Требуется сверка и объединение. |
| [architecture-debt-togaf.md](./architecture-debt-togaf.md) | Учёт архитектурного долга в терминах TOGAF (Gap/Requirement/Constraint/Work Package). |
| [metamodel-projection-ar-integration-flows.md](./metamodel-projection-ar-integration-flows.md) | Проекция `ar_integration_flows` в связи метамодели. |
| [metamodel-projection-system-module-fk.md](./metamodel-projection-system-module-fk.md) | Проекция связи `system_module` по внешнему ключу иерархии ИС. |
| [analyzer-graph-embed.md](./analyzer-graph-embed.md) | Встраивание графа `AnalyzerGraph` (issue #33) на страницы. |
| [architecture-diagram-component.md](./architecture-diagram-component.md) | Компонент архитектурной схемы на странице инкрементов. |
| [contracts/system-technology-metamodel.md](./contracts/system-technology-metamodel.md) | Контракт: связь «ИС/модуль → технология», параметры, триггер. |

---

## Реестры и схемы данных

| Документ | О чём | Issue |
|---|---|---|
| [domain-registry-schema.md](./domain-registry-schema.md) | Реестр доменов: схема, FK, проекции. | [#67](https://github.com/dgabadulin/ArchRep/issues/67) |
| [certificate-registry-schema.md](./certificate-registry-schema.md) | Реестр сертификатов и уведомления о сроках. | [#71](https://github.com/dgabadulin/ArchRep/issues/71) |
| [web-resource-registry-schema.md](./web-resource-registry-schema.md) | Реестр веб-ресурсов: схема и каталог полей. | — |
| [access-control-design.md](./access-control-design.md) | Разграничение прав: роли, permissions, проверки API/UI. | [#66](https://github.com/dgabadulin/ArchRep/issues/66) |
| [adding-new-entity-type.md](./adding-new-entity-type.md) | Как добавить новый тип сущности (сквозной сценарий). | — |

---

## Демо-модель и данные

| Документ | О чём |
|---|---|
| [demo-full-model-entities-matrix.md](./demo-full-model-entities-matrix.md) | Итоговая матрица сущностей и связей demo-модели; источник правды §3.2 — `exports/1.csv`. |
| [demo-dataset-scor-reference-model.md](./demo-dataset-scor-reference-model.md) | Демо-набор данных SCOR (референтная модель), коды `DEMO_SCOR_*`. |
| [diagrams/demo-full-model-metamodel-section7.drawio](./diagrams/demo-full-model-metamodel-section7.drawio) | Схема метамодели: зелёные сущности/рёбра — в репо, оранжевые — целевые. |
| [deploy-drawio-docker.md](./deploy-drawio-docker.md) | Развёртывание Draw.io (diagrams.net) в Docker, сеть `ar-network`. |
| [drawio-edge-routing-reduce-overlap.md](./drawio-edge-routing-reduce-overlap.md) | Уменьшение наслоения связей на диаграммах draw.io. |
| [drawio-increment-diagram-parameters.md](./drawio-increment-diagram-parameters.md) | Параметры стилей и раскладки схем решения (DRAWIO_*). |
---

## Настройки, параметры и UI

| Документ | О чём | Issue |
|---|---|---|
| [settings-parameters-design.md](./settings-parameters-design.md) | Дизайн раздела «Настройки → Параметры». | — |
| [settings-parameters-candidates.md](./settings-parameters-candidates.md) | Кандидаты констант для выноса в параметры. | — |
| [settings-parameters-adr-codes-variant-b.md](./settings-parameters-adr-codes-variant-b.md) | Вариант B: параметры ADR по кодам справочников. | — |
| [home-dashboard-catalog-metrics.md](./home-dashboard-catalog-metrics.md) | Главная страница: KPI объёма каталога и аккордеон. | [#34](https://github.com/dgabadulin/ArchRep/issues/34) |
| [dashboards-echarts.md](./dashboards-echarts.md) | Дашборды ECharts во frontend-v3. | — |
| [display-name-templates-spec.md](./display-name-templates-spec.md) | Шаблоны «видимого имени» для списков и селектов. | — |
| [table-column-filters-spec.md](./table-column-filters-spec.md) | Excel-подобная фильтрация по колонкам. | [#72](https://github.com/dgabadulin/ArchRep/issues/72) |

---

## Сервисные операции и инфраструктура

| Документ | О чём | Issue |
|---|---|---|
| [data-import-service.md](./data-import-service.md) | Сервисный импорт/экспорт Excel в реестры. | [#64](https://github.com/dgabadulin/ArchRep/issues/64) |
| [job-runner-design.md](./job-runner-design.md) | Планировщик заданий: проверка сроков доменов, CHK_*. | [#68](https://github.com/dgabadulin/ArchRep/issues/68) |
| [infra-docker-compose-template.md](./infra-docker-compose-template.md) | Шаблон структуры Docker Compose + PostgreSQL. | — |
| [deploy-prod-vs-demo.md](./deploy-prod-vs-demo.md) 🟡 | Сравнение деплоя prod vs demo (рабочая заметка, перенесена из `temp/`). | — |

---

## Спеки issues и черновики

| Документ | О чём | GitHub |
|---|---|---|
| [issue-16-analyzer-summary.md](./issue-16-analyzer-summary.md) | Рефакторинг модуля «Анализ зависимостей». | [#37](https://github.com/dgabadulin/ArchRep/issues/37) |
| [issue-17-graph-topologies.md](./issue-17-graph-topologies.md) | Топологии графа анализа зависимостей. | — |
| [issue-20-p5-analysis.md](./issue-20-p5-analysis.md) | П.5: анализ с учётом маппинга полей и статусов. | — |
| [issue-23-architecture-debt-registry-schema.md](./issue-23-architecture-debt-registry-schema.md) | Реестр архитектурного долга — спецификация схемы. | [#38](https://github.com/dgabadulin/ArchRep/issues/38) |
| [issue-33-metamodel-integration-flows-projection.md](./issue-33-metamodel-integration-flows-projection.md) | Проекция интеграционных потоков в метамодель. | [#35](https://github.com/dgabadulin/ArchRep/issues/35) |
| [issue-34-home-dashboard-catalog-metrics.md](./issue-34-home-dashboard-catalog-metrics.md) | KPI главной и аккордеон. | [#34](https://github.com/dgabadulin/ArchRep/issues/34) |
| [issue-35-metamodel-mass-rebuild-ui.md](./issue-35-metamodel-mass-rebuild-ui.md) | UI массовой пересборки связей метамодели. | [#36](https://github.com/dgabadulin/ArchRep/issues/36) |
| [issue-51-applied-conclusion-diagrams.md](./issue-51-applied-conclusion-diagrams.md) | Диаграммы решений в заключении. | [#51](https://github.com/dgabadulin/ArchRep/issues/51) |
| [issue-52-system-functions-dual-listbox.md](./issue-52-system-functions-dual-listbox.md) | Функции систем в заключении (Dual Listbox). | [#52](https://github.com/dgabadulin/ArchRep/issues/52) |
| [issue-56-analyzer-module-integration-projections.md](./issue-56-analyzer-module-integration-projections.md) | Модульные проекции интеграций для анализа. | [#56](https://github.com/dgabadulin/ArchRep/issues/56) |
| [issue-70-role-crud-ui.md](./issue-70-role-crud-ui.md) | CRUD ролей через UI. | [#70](https://github.com/dgabadulin/ArchRep/issues/70) |
| [github-issue-drafts/](./github-issue-drafts/) | Черновики текста новых issues (создание: `gh issue create --body-file …`). | — |
---

## Промпты для ИИ

- [prompts/README.md](./prompts/README.md) — как использовать и сохранять промпты (шаблон `_template.md`).
- Готовые промпты: интеграционные потоки, проекции FK, тема UI, режимы demo-деплоя, Open Core, аудит форм и т.д. — см. [prompts/](./prompts/README.md).

---

## Вспомогательные материалы

| Файл | О чём |
|---|---|
| [diagrams/](./diagrams/) | Схемы метамодели (draw.io). Локальные бэкапы `.$*.drawio.bkp` не коммитятся. |
| [exports/](./exports/) | CSV-выгрузки-источники: `1.csv` / `1-with-partner-fk-rows.csv` — §3.2 матрицы demo-модели; дублирующая — `demo-full-model-metamodel-relation-types-section32.csv`. |
| `create-partner-portal-presentation.ps1` 🟡 | Скрипт формирования презентации портала. Кандидат на перенос в `scripts/`. |

---

## Правила ведения документации

1. **Новые задачи — только GitHub Issues** (не локальные `issue-NN`; см. [process-issue-tracking.md](./process-issue-tracking.md)). В спеке в шапке указывайте `GitHub: https://github.com/dgabadulin/ArchRep/issues/N`.
2. **Любое изменение БД** (prod + demo) описывается в `DB/README.md` (раздел про миграции) и ссылается на документ-схему.
3. **Изменение кода** → обновите соответствующий документ в одном коммите (код + док).
4. **Один документ — одна тема.** Перед созданием сверьтесь с этим индексом, чтобы не плодить дубли.
5. **Статусы**: устаревший документ пометьте 🔴 (и по возможности датой); черновик — 🟡.
6. **Имена файлов — латиницей** в нижнем регистре с дефисами (`my-doc.md`). Кириллические имена создают проблемы на case-insensitive ФС и в git-диффах.

---

*Создано: 2026-09-08 · Обновлено: 2026-09-08*