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
- **Настройки → Справочники → вкладка «Дашборды»** — каталог с описаниями, необходимыми данными и ссылками
  (issue #127; отдельный пункт меню «Справочник дашбордов» убран, маршрут `/dashboards/catalog` сохранён для старых ссылок).

## Реестр дашбордов

Файл: `frontend-v3/src/dashboards/registry.js`

Каждая запись содержит:

- `slug` — сегмент URL (`/dashboards/full/<slug>`);
- `title`, `description`, `category` — для UI и справочника;
- `requires` — какие данные нужны для корректной работы (реестры, типы связей, системные параметры);
- `component` — Vue-компонент графика.

Чтобы добавить дашборд: создать компонент, импортировать в `registry.js` и добавить объект в массив `dashboards`.

## Галерея и масштабирование

- Карточки располагаются **по две в ряд** (`grid-template-columns: repeat(2, minmax(0, 1fr))`).
- Контейнерная адаптация: `.page` — `container-type: inline-size`; при сужении рабочей области
  (включая открытую панель ИИ-архитектора, когда она «раздвигает» layout) сетка переходит в одну колонку,
  а график масштабируется вместе с карточкой (`autoresize` у `vue-echarts`).
- Высота превью — `clamp(220px, 32vh, 420px)`, чтобы две карточки помещались на экран.

## Первый дашборд: treemap бизнес-функций

- **Slug:** `business-functions-treemap`
- **Данные:** `GET /api/togaf/business-functions` (через `togafApi.businessFunctions()`), дерево по полю `parent_id`.
- **Поведение:** drill-down по клику (`nodeClick: 'zoomToNode'`), хлебные крошки ECharts внизу диаграммы (светлая тема для читаемости).
- **Галерея:** карточка занимает колонку сетки (две карточки в ряд), без пустой полосы на весь экран; заголовок только в шапке карточки (`showTitle=false` у графика).
- **Подписи:** в превью (`compact`) — уменьшенный шрифт, `overflow: 'truncate'` (без `break`, чтобы в узких плитках не рвалось по 1–2 символа), меньше `borderWidth`/`gapWidth`. В полноэкранном режиме — перенос только по пробелам (`wrapLabelAtSpaces`), без комбинации с `overflow: 'break'`.

Файлы:

- `frontend-v3/src/components/dashboards/businessFunctionsTreemap.js` — построение дерева и опции ECharts;
- `frontend-v3/src/components/dashboards/BusinessFunctionsTreemapChart.vue` — загрузка данных и `<v-chart>`.

## Дашборд «Карта ИТ ландшафта» (ранее «Целевая архитектура: матрица»)

- **Slug:** `target-architecture-matrix` (не меняется — сохранены ссылки и закладки).
- **Данные:** `GET /api/dashboard/target-architecture-matrix` (право `dashboard:read`). Источник — только таблицы `archrep` и связи с `payload->>'source' = 'architecture_capability_matrix'`; внешние файлы и `temp/` не используются.
- **Формат:** строки — бизнес-функции (с группировкой по родительской функции), колонки — продукты (бизнес-сервисы), ячейки — системы на пересечении связей `system_business_function` и `system_business_service`.
- **Легенда:** зелёный — система в промышленной или опытной эксплуатации; оранжевый — новая или планируемая; серый — прочие статусы.
- **Порядок колонок:** системный параметр `ARR_TARGET_MATRIX_ORDER` (`string_list`, коды бизнес-сервисов); без параметра — порядок реестра. Продукты вне списка идут после, в порядке реестра.
- **Порядок строк (issue #127):** системный параметр `ARR_TARGET_MATRIX_FUNCTION_ORDER` (`json`, массив `[{"code":"...","order":1}]`; допускаются названия). Способности вне списка идут после, сохраняя порядок SQL-запроса (родитель, наименование). Повторная сортировка на фронте убрана, чтобы параметр имел приоритет.
- **Файлы:** `frontend-v3/src/components/dashboards/TargetArchitectureMatrixChart.vue`, `frontend-v3/src/components/dashboards/targetArchitectureMatrix.js`; backend — `backend/targetArchitectureMatrix.js`; сиды параметров — `DB/scripts/migrate_20261121120000_target_matrix_product_order.sql`, `DB/scripts/migrate_20261122120100_target_matrix_function_order.sql`.
- **Необходимые данные:** реестры «Системы», «Бизнес-способности», «Продукты»; типы связей `system_business_function`, `system_business_service`; параметры `ARR_TARGET_MATRIX_ORDER`, `ARR_TARGET_MATRIX_FUNCTION_ORDER`.

Значения параметров кэшируются при старте backend — после правки нужен перезапуск.

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
