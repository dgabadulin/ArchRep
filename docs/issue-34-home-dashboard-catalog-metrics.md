# Issue #34: главная страница — KPI объёма каталога и аккордеон

**Статус:** реализовано (backend + фронт + миграция + сид параметра)  
**GitHub:** https://github.com/dgabadulin/ArchRep/issues/34  
**Спецификация:** [home-dashboard-catalog-metrics.md](./home-dashboard-catalog-metrics.md)

---

## Кратко

На главной (`HomeView.vue`): блок **KPI-плиток** (объём каталога) по конфигу **JSON-параметра `ARR_HOME_KPI_TILES`**, отдельные функции **`archrep.dashboard_home_*`**, визуал карточек (B) + сводка (D); **аккордеон** для остальных типов сущностей метамодели. Обновление данных — по F5.

## Критерии готовности

- [x] Параметр `ARR_HOME_KPI_TILES` в сидах/настройках + значение по умолчанию.
- [x] Функции PostgreSQL: `DB/schema/archrep_issue34_home_dashboard.sql`.
- [x] API `GET /api/dashboard/home-stats` + whitelist в `backend/homeDashboard.js`.
- [x] Вёрстка главной: KPI + аккордеон; типы `system`, `technology`, `gap` исключены из аккордеона.
- [x] Кандидат `ARR_HOME_KPI_TILES` в `docs/settings-parameters-candidates.md`.

## Ссылки

- Спецификация: [home-dashboard-catalog-metrics.md](./home-dashboard-catalog-metrics.md)
- Кандидат параметра: [settings-parameters-candidates.md](./settings-parameters-candidates.md) (`ARR_HOME_KPI_TILES`)
- UI: `frontend-v3/src/views/HomeView.vue`
