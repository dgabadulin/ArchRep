# Дашборды ECharts (frontend-v3)

## Назначение

Раздел визуальной аналитики на [Apache ECharts](https://echarts.apache.org/) с отдельной галереей, полноэкранным просмотром и справочником доступных дашбордов.

## Маршруты

| URL | Описание |
|-----|----------|
| `/dashboards` | Галерея: карточки с превью и кнопкой «На весь экран» |
| `/dashboards/catalog` | Таблица-справочник (метаданные из реестра в коде) |
| `/dashboards/full/:slug` | Один дашборд на рабочую область layout |

## Меню

- **Аналитика → Дашборды** — галерея.
- **Настройки → Справочник дашбордов** — каталог с описаниями и ссылками.

## Реестр дашбордов

Файл: `frontend-v3/src/dashboards/registry.js`

Каждая запись содержит:

- `slug` — сегмент URL (`/dashboards/full/<slug>`);
- `title`, `description`, `category` — для UI и справочника;
- `component` — Vue-компонент графика.

Чтобы добавить дашборд: создать компонент, импортировать в `registry.js` и добавить объект в массив `dashboards`.

## Первый дашборд: treemap бизнес-функций

- **Slug:** `business-functions-treemap`
- **Данные:** `GET /api/togaf/business-functions` (через `togafApi.businessFunctions()`), дерево по полю `parent_id`.
- **Поведение:** drill-down по клику (`nodeClick: 'zoomToNode'`), хлебные крошки ECharts внизу диаграммы (светлая тема для читаемости).
- **Галерея:** карточка по ширине превью (`min(100%, max(22rem, 50vw))`), без пустой полосы на весь экран; заголовок только в шапке карточки (`showTitle=false` у графика).
- **Подписи:** в превью (`compact`) — уменьшенный шрифт, `overflow: 'truncate'` (без `break`, чтобы в узких плитках не рвалось по 1–2 символа), меньше `borderWidth`/`gapWidth`. В полноэкранном режиме — перенос только по пробелам (`wrapLabelAtSpaces`), без комбинации с `overflow: 'break'`.

Файлы:

- `frontend-v3/src/components/dashboards/businessFunctionsTreemap.js` — построение дерева и опции ECharts;
- `frontend-v3/src/components/dashboards/BusinessFunctionsTreemapChart.vue` — загрузка данных и `<v-chart>`.

## Дашборд «Целевая архитектура: матрица»

- **Slug:** `target-architecture-matrix`
- **Данные:** `GET /api/dashboard/target-architecture-matrix` (право `dashboard:read`). Источник — только таблицы `archrep` и связи с `payload->>'source' = 'architecture_capability_matrix'`; внешние файлы и `temp/` не используются.
- **Формат:** строки — бизнес-функции (с группировкой по родительской функции), колонки — продукты (бизнес-сервисы), ячейки — системы на пересечении связей `system_business_function` и `system_business_service`.
- **Легенда:** зелёный — система в промышленной или опытной эксплуатации; оранжевый — новая или планируемая; серый — прочие статусы.
- **Порядок колонок:** системный параметр `ARR_TARGET_MATRIX_ORDER` (`string_list`, коды бизнес-сервисов); без параметра — порядок реестра. Продукты вне списка идут после, в порядке реестра. Значение кэшируется при старте backend — после правки нужен перезапуск.
- **Файлы:** `frontend-v3/src/components/dashboards/TargetArchitectureMatrixChart.vue`, `frontend-v3/src/components/dashboards/targetArchitectureMatrix.js`; backend — `backend/targetArchitectureMatrix.js`; сид параметра — `DB/scripts/migrate_20261121120000_target_matrix_product_order.sql`.

## Регистрация ECharts

Точечное подключение модулей (treemap, canvas, tooltip, title): `frontend-v3/src/echarts/registerDashboardCharts.js`, импорт в `main.js` до монтирования приложения.

## Зависимости

В `frontend-v3/package.json`: `echarts`, `vue-echarts`. После клонирования выполнить:

```bash
cd frontend-v3 && npm install && npm run build
```

## Связанные изменения в коде

- `router/index.js` — дочерние маршруты под `LayoutV3`;
- `config/menu.js` — пункты меню;
- `components/Breadcrumbs.vue` — подписи для сегментов `dashboards`, `catalog`, `full` и slug из реестра;
- `views/HomeView.vue` — описания плиток для новых путей.

## Лицензии

ECharts распространяется под **Apache License 2.0**; `vue-echarts` — **MIT**. Для коммерческого использования сверяйте условия с политикой компании.
