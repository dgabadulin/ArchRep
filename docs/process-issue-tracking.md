# Учёт задач: только GitHub Issues

## Правило

- **Новые задачи** заводим **только в GitHub** (`dgabadulin/ArchRep`).
- Файлы `docs/issue-*.md` — это **спецификации и история**; номер в имени файла **не обязан** совпадать с номером issue в GitHub.
- После создания issue в GitHub в соответствующем `.md` в шапке указываем строку **`GitHub: https://github.com/dgabadulin/ArchRep/issues/N`**.

## Соответствие «локальный документ ↔ GitHub» (на момент синхронизации)

| Локальный документ | Смысл | GitHub (актуальный номер) |
|--------------------|--------|---------------------------|
| `issue-33-metamodel-integration-flows-projection.md` | Проекция потоков в метамодель | [#35](https://github.com/dgabadulin/ArchRep/issues/35) *(в GitHub эта тема заведена как #35)* |
| `issue-34-home-dashboard-catalog-metrics.md` | KPI главной | [#34](https://github.com/dgabadulin/ArchRep/issues/34) |
| `issue-35-metamodel-mass-rebuild-ui.md` | Доработки пересборки (RBAC, UX) | [#36](https://github.com/dgabadulin/ArchRep/issues/36) |
| `issue-16-analyzer-summary.md` | Анализатор (в т.ч. п.16 system_child) | [#37](https://github.com/dgabadulin/ArchRep/issues/37) |
| `issue-23-architecture-debt-registry-schema.md` | Спека реестра долга, реализация отдельно | [#38](https://github.com/dgabadulin/ArchRep/issues/38) (umbrella) |
| `issue-51-applied-conclusion-diagrams.md` | Диаграммы Draw.io в архитектурном заключении | [#51](https://github.com/dgabadulin/ArchRep/issues/51) |
| `drawio-increment-diagram-parameters.md` | Сохранение/генерация диаграмм ADR №2 (параметры, БД) | [#53](https://github.com/dgabadulin/ArchRep/issues/53) |
| — | Параметры: JSON в textarea (pretty-print, валидация) | [#54](https://github.com/dgabadulin/ArchRep/issues/54) |
| `issue-52-system-functions-dual-listbox.md` | Функции систем в заключении (Dual Listbox) | [#52](https://github.com/dgabadulin/ArchRep/issues/52) |
| `issue-56-analyzer-module-integration-projections.md` | Проекции интеграций с модулями; граф без дубля из API потоков | [#56](https://github.com/dgabadulin/ArchRep/issues/56) |

**Закрытые (справочно):** страница **Настройки → Сервисные операции** и перенос пересборки потоков — [#39](https://github.com/dgabadulin/ArchRep/issues/39) (закрыт).

## Команды (GitHub CLI)

Из корня репозитория, при необходимости:

```bash
gh issue create --title "…" --body-file docs/github-issue-drafts/….md
```

Список открытых:

```bash
gh issue list --repo dgabadulin/ArchRep
```
