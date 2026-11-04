# Контракт модулей ИСАР (module contract)

Статус: **v0.2 — MVP инфраструктуры реализован в ядре; контракт уточняется по мере подключения модулей.**

> ✅ **Реализовано (MVP):** загрузчик `registerModules()`, реестр `isar_modules`, лицензионный гейт
> (Ed25519), секция `modules` в `GET /api/config`, RBAC-правила и проверка маршрутов модулей,
> реестр поверхностей UI + компонент-хост, адаптеры для DrawIO Pro v0.1.0.
> Карта файлов и порядок старта — §4.3; известные расхождения и адаптеры — §16.6.
> Пошаговая процедура подключения для администратора — **[`docs/modules-admin-guide.md`](./modules-admin-guide.md)**,
> короткий чеклист — **[`docs/modules-connect-checklist.md`](./modules-connect-checklist.md)**.
> Формат/инструмент выпуска лицензионных ключей по-прежнему — отдельная спецификация (§16.3).
Основа: обсуждение ядра [`temp/modules-installation-discussion.md`](../temp/modules-installation-discussion.md), спецификация [`docs/issue-74-adr-linear-save-model.md`](./issue-74-adr-linear-save-model.md).
Пример модуля: **DrawIO Pro** — приватный репозиторий `dgabadulin/isarDiagramEditor`, версия **0.1.0**
(подключается как `@isar/drawio-pro`; код модуля в ядро не копируется и не патчится).

## 1. Назначение

Документ задаёт **единый формат**, по которому делаются и подключаются все модули ИСАР —
и внешние сервисы, и встраиваемые в ядро. Цель: ставить/обновлять/удалять платные модули
**без правок кода ядра**, с понятным гейтом лицензии и совместимостью версий.

Термины:

| Термин | Значение |
|---|---|
| **Ядро** | Открытое приложение ArchRep (BFF + БД + SPA), лицензия Apache-2.0. |
| **Модуль** | Отдельный (обычно приватный/платный) артефакт, расширяющий ядро. |
| **Хост** | Процесс/сборка ядра, в который подключается модуль. |
| **Контракт** | Набор правил и интерфейсов из этого документа. |

> **Терминология.** Чтобы не путать с сущностями метамодели (префикс `ar_*`), расширения ядра
> называем **«подключаемые модули»**. Реестр подключённых — таблица `isar_modules`
> (префикс `isar_`, инфраструктура), а не `ar_*` (метамодель).

## 2. Типы модулей

| Тип | Что это | Точка подключения | Пример |
|---|---|---|---|
| `external` | Отдельный сервис/страница (iframe/редирект) | URL из конфига + пункт меню | Draw.io-контейнер, Тех.радар |
| `backend` | API и/или БД в процессе ядра | `register({ app, ctx })` | сервисные операции модуля |
| `frontend` | Страницы/компоненты внутри SPA | точки расширения UI | страница/форма модуля |
| `hybrid` | Комбинация (backend + frontend) | `register` + точки расширения UI | **DrawIO Pro** |

Модуль объявляет тип в манифесте. `hybrid` — частый случай для платных модулей, которым нужны
и свои API, и «родной» UI.

## 3. Манифест модуля `module.json`

Единая точка правды о модуле. По нему работают: загрузчик, RBAC, меню, миграции, гейт лицензии и
проверка совместимости.

```jsonc
{
  "code": "drawio-pro",                    // уникальный, kebab-case, = префикс маршрутов/прав
  "name": "DrawIO Pro",
  "version": "0.1.0",                      // semver, версия модуля
  "requiresCore": ">=1.0",                 // диапазон совместимых версий ядра (ключевое поле совместимости)
  "type": "hybrid",                        // external | backend | frontend | hybrid
  "entry": "index.js",                     // backend-точка входа (register)
  "frontend": "frontend/index.js",         // frontend-точка входа (для frontend/hybrid)
  "permissions": ["drawio_pro:manage"],    // права, которые предоставляет модуль
  "menu": [                                // пункты меню (опционально)
    { "title": "DrawIO Pro", "route": "/settings/drawio-pro", "requiredPermission": "drawio_pro:manage" }
  ],
  "surfaces": [                            // точки расширения UI (см. §7)
    { "point": "adrAppliedForm.actions", "component": "DrawioProButton" },
    { "point": "diagramEditor.toolbar",  "component": "DrawioProPanel" }
  ],
  "config": [                              // параметры (группа «Модули»)
    { "code": "SYS_MODULE_drawio_pro_ENABLED", "type": "boolean", "public": false }
  ],
  "license": { "required": true, "product": "drawio-pro" },
  "schema": "archrep_mod_drawio_pro"        // схема БД модуля (если своя)
}
```

### 3.1. Поля манифеста

| Поле | Обяз. | Описание |
|---|---|---|
| `code` | да | Уникальный код (kebab-case). Префикс маршрутов и прав. |
| `name` | да | Отображаемое имя. |
| `version` | да | Версия модуля (semver). |
| `requiresCore` | да | Диапазон совместимых версий ядра (semver). **Ключевое поле совместимости**: ядро центрально, модуль подстраивается под него. |
| `type` | да | Тип модуля (§2). |
| `entry` | для `backend/hybrid` | Файл с `register({ app, ctx })`. |
| `frontend` | для `frontend/hybrid` | Точка входа фронта модуля. |
| `permissions` | нет | Права, добавляемые в каталог RBAC. |
| `menu` | нет | Пункты меню (с `requiredPermission`). |
| `surfaces` | для `frontend/hybrid` | Точки расширения UI (§7). |
| `config` | нет | Параметры модуля (группа «Модули»). |
| `license` | нет | Признак платного модуля и продукт для проверки ключа. |
| `schema` | нет | Выделенная схема БД модуля (`archrep_mod_<code>`). |

### 3.2. Legacy-адаптер `manifest.json` — **временное решение**

Первый реальный модуль (`@isar/drawio-pro` 0.1.0) отдаёт **не** `module.json`, а `manifest.json`
с полями `id` / `permissionsProvided` / `surface`. Пока модуль не приведён к контракту, ядро
применяет адаптер `backend/modules/manifest.js → normalizeLegacyManifest()`:

| Legacy `manifest.json` | Контракт `module.json` | Примечание |
|---|---|---|
| `id` | `code` | должен быть kebab-case |
| `permissionsProvided[]` | `permissions[]` | права вида `<code>:<action>` |
| `surface.<screen>.action` | `surfaces[] { point: '<screen>.actions' }` | + `label` / `requiredPermission` |
| `surface.<screen>.toolbar: true` | `surfaces[] { point: 'diagramEditor.toolbar' }` | компонент подставляет ядро |
| `type: "module"` | `type: "hybrid"` | legacy-значение не входит в §2 |
| `endpoints[]` | `routes[]` | нужно ядру и `check:routes` |
| *(нет поля)* | `license: { required: true, product: "<code>" }` | **fail-closed**: legacy-манифест не умеет объявлять лицензию, а первый такой модуль — платный |

**Задача модулю (отдельный тикет):** добавить `module.json`, `register({ app, ctx })`, `install(ctx)`
и `surfaces[]`; после этого адаптер перестаёт применяться (ядро пишет в лог предупреждение
`используется legacy manifest.json …`). Удаление адаптера — **ломающее** изменение не является:
это удаление временной совместимости, выполняется после миграции всех модулей.

## 4. Жизненный цикл модуля

| Операция | Что происходит |
|---|---|
| **install** | Артефакт модуля попадает в хост (npm-пакет / каталог `modules/<code>` / контейнер). Появляется запись в `isar_modules`. |
| **enable** | Код модуля подключается: для `backend/hybrid` ядро вызывает `register({ app, ctx })`; включаются маршруты, права, меню, поверхности UI. |
| **disable** | Маршруты/меню/UI скрываются; данные модуля сохраняются. |
| **upgrade** | Обновление версии; проверка `requiresCore`; прогон миграций модуля. |
| **remove** | Удаление кода и записи; опционально `--drop-schema` (удаление схемы модуля). |

Реестр подключённых модулей: **таблица `isar_modules` — источник правды** (статус/лицензия для UI), **env `ENABLED_MODULES` — аварийный override**.

### 4.1. Установка при build-time (встраивание в сборку ядра)

Применяется для типов `backend` / `frontend` / `hybrid`. «Установка» = подключение модуля к
**сборке** ядра (ядро/образ пересобираются). Целевой способ загрузки фронта — build-time (§7.2).

**Модели поставки:**

| Модель | Кто собирает образ | Как модуль попадает |
|---|---|---|
| **self-build** | клиент | приватный npm-пакет (или zip) + сборка ядра на стороне клиента |
| **vendor-build** | вендор | вендор собирает образ с модулем и отдаёт готовый образ клиенту |

**Последовательность (self-build; для vendor-build шаги 2–6 выполняет вендор):**

1. **Вендор** выдаёт артефакт (приватный npm `@isar/<code>` / zip) и лицензионный ключ (офлайн).
2. **Клиент** добавляет зависимость в корневой `package.json` ядра: `"@isar/<code>": "x.y.z"`
   (или `"file:./modules/<code>"` для zip). **Код ядра не правится.**
3. **Доступ к registry:** `.npmrc` с токеном — как **секрет сборки/CI** (в образ не попадает).
4. **Включение:** `code` в `ENABLED_MODULES` (env) → ядро при старте вызовет `register({ app, ctx })`.
5. **Миграции модуля** (если есть своя схема `archrep_mod_<code>`): dual — `DB/scripts/*.sql` (prod) + `DB/migrations/*.js` (demo).
6. **Сборка образа** (`infra/common/dockerfile`): `npm ci` (подтягивает модуль) → сборка фронта (компоненты модуля попадают в общий бандл) → сборка backend.
7. **Доставка образа** на сервер (prod — `deploy.bat`, demo — compose).
8. **Запуск:** ядро читает `ENABLED_MODULES`, вызывает `register()`, проверяет ключ из env `SYS_MODULE_<code>_LICENSE`.
9. **Проверка:** `GET /api/<code>/manifest` → `active: true`; точка расширения видна в UI.

**Обновление / отключение / удаление:**

| Действие | Последовательность |
|---|---|
| Обновить | 1 → 2 (сменить версию) → (5, если миграции) → 6 (пересборка) → 7 |
| Отключить | убрать из `ENABLED_MODULES` → перезапуск (**без пересборки**; данные сохраняются) |
| Удалить | убрать зависимость → пересборка → (опц. `--drop-schema`) |

**Инфраструктура в ядре (один раз — не на модуль):**
- build-time реестр модулей (список включённых + их фронт-точки);
- backend-загрузчик `registerModules(app, ctx)` — **до** catch-all-статики;
- монтирование точек расширения UI по `surfaces` из манифеста.

> Следствие: обновление фронтового кода модуля требует пересборки образа ядра (см. §16.1 п.8).

### 4.2. Установка при поставке контейнером (`external`)

Применяется для типа `external`: модуль — **отдельный сервис** (свой образ), обмен с ядром по
URL/`postMessage`. Паттерн уже отработан на внешних сервисах (например, контейнер редактора
диаграмм, Тех.радар). Ядро **не пересобирается**.

**Варианты:**

| Вариант | Что в контейнере | UI |
|---|---|---|
| (a) backend/API | API модуля | страница-обёртка ядра + iframe |
| (b) свой SPA | API + UI модуля | отдельный экран модуля (iframe/редирект) за общим nginx/SSO |
| (c) фронт-бандл | статика модуля | [не целевой] runtime-загрузка в ядро |

**Последовательность:**

1. **Вендор** собирает и публикует образ модуля в приватный registry; выдаёт лицензионный ключ.
2. **Клиент:** `docker login <registry>` → `docker pull <image>:<tag>`.
3. **Запуск контейнера** в сети `ar-network` (`docker run` или compose-фрагмент) с env-конфигом
   модуля, включая `SYS_MODULE_<code>_LICENSE`.
4. **Публикация наружу** (при необходимости) — через nginx/TLS (поддомен или путь; см.
   `docs/deploy-drawio-docker.md`).
5. **Ядро:** задать `SYS_MODULE_<code>_URL` (в `ar_settings_parameters` или env) — **без пересборки ядра**.
6. **Ядро:** для `external` используется **общий механизм** — список внешних модулей из конфига →
   пункт меню + маршрут-обёртка с `requiredPermission` (без правок под конкретный модуль).
7. **Проверка:** контейнер поднят, URL отвечает, пункт меню виден.

**Обновление / отключение / удаление:**

| Действие | Последовательность |
|---|---|
| Обновить | `docker pull` новой версии → пересоздать контейнер (**без пересборки ядра**) |
| Отключить | остановить контейнер / убрать URL / снять флаг |
| Удалить | остановить и удалить контейнер, убрать параметр URL |

**Особенности (нужно учесть):**
- **SSO-токен** — передача авторизации в отдельный сервис (открытый вопрос Q4/§16.2, актуален именно для `external`);
- сеть `ar-network`, TLS/прокси, CORS/CSP для `postMessage`;
- собственный релизный цикл и (при необходимости) своя БД/схема;
- логи и мониторинг модуля — отдельно от ядра.

**Плюсы и минусы:**

| Плюсы | Минусы |
|---|---|
| независимые релизы модуля; ядро не пересобирается (соответствует «обновление без пересборки ядра») | UI не «родной» (iframe); склейка/дублирование авторизации; больше эксплуатации (сертификаты, CORS/CSP, логи) |

### 4.3. Реализация MVP в ядре

**Карта файлов**

| Файл | Роль |
|---|---|
| `backend/modules/index.js` | `registerModules(app, ctx)`: поиск модулей, `enabled`, лицензия, монтаж маршрутов, реестр в памяти |
| `backend/modules/manifest.js` | чтение/валидация `module.json`, legacy-адаптер, `resolveModulePackage()`, `discoverModuleCodes()` |
| `backend/modules/semver.js` | проверка `requiresCore` без внешних зависимостей (`>=1.0`, `^1.2`, `~1.2`, `1.x`, `\|\|`) |
| `backend/modules/license.js` | `verifyLicense(key, { instanceId, installRef })` — ключ **v1**: `v`, `license_id`, `kid`, `product`, `installation` (uuid/derived/any + `strict`), `nbf`/`exp`/`grace_days`; публичные ключи по `kid`; кэш по `sha256(ключа)` |
| `backend/modules/registry.js` | `archrep.isar_modules`: чтение/upsert (включая `license_id/kid/binding/checked_at`), fail-open при отсутствии миграции |
| `backend/modules/adapters/legacy.js` | монтаж `handlers` + подмена `/manifest` статусом ядра, вызов `register({app, ctx, coreApi})` |
| `backend/adrIncrements.js` | нормализация `increments[]` (`client_ref`/`from_ref` → имена ядра), merge шапки, валидация mxfile |
| `DB/scripts/migrate_20261103120000_isar_modules.sql` + `DB/migrations/20261103120000_isar_modules.js` | таблица + параметры группы «Модули» |
| `DB/scripts/migrate_20261105120000_isar_modules_license_meta.sql` + `DB/migrations/20261105120000_isar_modules_license_meta.js` | колонки метаданных лицензии (`license_id`, `license_kid`, `license_binding`, `license_checked_at`) |
| `backend/auth/routePermissions.js`, `permissionsCatalog.js` | правила `/api/drawio-pro/*`, право `drawio_pro:manage` |
| `scripts/check-route-permissions.js` | учитывает `endpoints[]`/`routes[]` и `permissions[]` манифестов |
| `backend/modules/__tests__/*.test.js` | loader / license / manifest / payload / RBAC (`npm run test:modules`) |
| `scripts/modules-status.js` | диагностика для администратора: `npm run modules:status` (см. `docs/modules-admin-guide.md`) |
| `frontend-v3/src/modules/registry.js`, `SurfaceHost.vue` | реестр поверхностей и компонент-хост |
| `frontend-v3/src/modules/status.js` | статус модулей: `/api/config.modules` → fallback `/api/<code>/manifest` |
| `frontend-v3/src/modules/adapters/*` | адаптеры DrawIO Pro: компоненты (build-time) и API контроллера |
| `frontend-v3/src/modules/stubs/drawio-pro` | заглушка, чтобы `npm run build:v3` не падал без пакета |

**Порядок старта (критично):**

```
loadParams(pool) → registerModules(app, { db, getParam, logger })
                 → mountFrontendStatic()   // express.static + app.get('*')
                 → app.listen()
```

Иначе SPA-fallback перехватит `/api/<code>/*` (§6.1 п.4). `registerModules` **не бросает**:
ошибка загрузки/манифеста/версии = `enabled=false` в реестре + запись в лог, ядро продолжает работу.

**Включение и лицензия (env):**

| Переменная | Назначение |
|---|---|
| `ENABLED_MODULES` | аварийный override: перечисленные коды включаются, остальные выключаются |
| `SYS_MODULE_<code>_ENABLED` | точечный env-override для одного модуля |
| `SYS_MODULE_<code>_LICENSE` | ключ лицензии (**только env**, в БД/фронт не попадает) |
| `SYS_MODULE_LICENSE_PUBKEYS` | публичные ключи по `kid`: JSON `{"<kid>":"<base64 PEM>"}` (ротация) |
| `SYS_MODULE_LICENSE_PUBLIC_KEY` | одиночный публичный ключ Ed25519 (PEM или base64 от PEM) — fallback для любого `kid` |
| `SYS_MODULE_LICENSE_ALLOW_UNVERIFIED` | `true` — dev-режим без проверки подписи (не для prod) |
| `SYS_INSTANCE_ID` | идентификатор инсталляции: обязателен для `installation.mode:"uuid"` (fallback `<host>:<db>` — только для диагностики) |
| `SYS_INSTALL_REF` | переопределение отпечатка инсталляции для `installation.mode:"derived"` |
| `MODULES_DIR` | альтернативный каталог модулей (по умолчанию `<repo>/modules`) |

**Проверка после старта:**

```sql
select code, version, enabled, licensed, license_expires_at from archrep.isar_modules;
```
```bash
curl -s /api/config | jq '.modules'
curl -s /api/drawio-pro/manifest
```

## 5. Реестр подключаемых модулей `isar_modules`

```sql
CREATE TABLE archrep.isar_modules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar NOT NULL UNIQUE,
  name text NOT NULL,
  version text NOT NULL,               -- версия модуля
  core_version text,                   -- версия ядра на момент установки
  enabled boolean NOT NULL DEFAULT false,
  licensed boolean NOT NULL DEFAULT false,
  license_expires_at timestamptz,
  installed_at timestamptz NOT NULL DEFAULT now(),
  settings_json jsonb,
  -- метаданные лицензии (v1 ключей, docs/module-license-key.md);
  -- миграция DB/scripts/migrate_20261105120000_isar_modules_license_meta.sql
  license_id text,                     -- идентификатор ключа (сверка с реестром лицензий)
  license_kid text,                    -- kid ключа (выбор публичного ключа при ротации)
  license_binding text,                -- any | uuid:match | uuid:mismatch | derived:match | … (:strict)
  license_checked_at timestamptz       -- когда ядро последний раз проверяло ключ
);
```

Синхронизация: ядро пишет строку при каждом старте (`registry.syncModuleRecord()`), источник
статуса — фактически загруженный модуль. **Ключ лицензии и публичный ключ в БД не пишутся** —
в `isar_modules` попадают только `licensed`, `license_expires_at`, `license_id`, `license_kid`,
`license_binding`, `license_checked_at` (см. §10).

## 6. Backend-контракт

Точка входа модуля (для `backend`/`hybrid`) экспортирует:

```js
module.exports.register = function register({ app, ctx }) { /* … */ };
```

### 6.1. `ctx` (контекст ядра) — черновик состава

| Поле | Назначение |
|---|---|
| `db` | Доступ к БД **в рамках разрешённого** (ядро может ограничить/проксировать). |
| `auth` | Контекст авторизации: текущий пользователь, проверка прав. |
| `config` | Чтение/запись параметров модуля (группа «Модули»). |
| `logger` | Логгер хоста (префикс по `code`). |
| `registerRoutes(routes)` | Регистрация маршрутов модуля (с проверкой прав). |
| `addPermission(code)` | Добавление права модуля в каталог RBAC. |
| `menu(items)` | Добавление пунктов меню. |
| `coreVersion` | Версия ядра (для проверки совместимости). |

**Правила:**
1. Модуль **не читает таблицы ядра напрямую** — только через `ctx`/публичный API (иначе обновление ядра ломает модуль).
2. Свои данные модуль хранит в **своей схеме** `archrep_mod_<code>`.
3. Все маршруты модуля — под авторизацией и описаны в RBAC (deny-by-default).
4. Вызов `register()` — **до** catch-all-статики хоста.

### 6.2. Форма вызова

**Решено:** форма вызова — **объектная**: `register({ app, ctx })`. Расширяется без ломающих
изменений — новые сервисы ядра добавляются полями объекта.

## 7. Frontend-контракт

### 7.1. Точки расширения (surfaces)

**Точка расширения** — это именованное место в UI ядра, куда модуль может встроить свой компонент.
Модуль объявляет точки в манифесте (`surfaces`) и не знает деталей реализации ядра.
Именование: `<экран>.<зона>` (например `adrAppliedForm.actions`).

**Категории точек (обобщённо):**

| Категория | Назначение |
|---|---|
| Действия на экране (`*.actions`) | кнопки/действия на существующих формах |
| Панель/тулбар (`*.toolbar`) | панель вокруг встроенного редактора/области |
| Раздел настроек (`settings.section`) | собственный раздел в «Настройках» |
| Навигация (`app.menu`) | пункты меню/сайдбара |
| Колонки/ячейки таблиц (`*.table.columns`) | дополнительная колонка/ячейка в реестрах |

**Примеры конкретных точек** (состав зависит от экранов ядра; полный каталог ведёт ядро):

| Точка (пример) | Где | Для чего |
|---|---|---|
| `adrAppliedForm.actions` | форма архитектурного заключения | добавить действие на форме |
| `diagramEditor.toolbar` | встроенный редактор диаграмм | панель инструментов модуля |
| `settings.section` | экран «Настройки» | раздел настроек модуля |
| `app.menu` | сайдбар | пункт меню модуля |

### 7.2. Загрузка фронта модуля

**Целевой способ — build-time npm:** компоненты модуля подключаются как зависимость и собираются
вместе с ядром. Runtime ESM и microfrontend — **не целевые** (возможное развитие).

| Способ | Статус | Когда |
|---|---|---|
| **build-time npm** | **целевой** | штатный способ: модуль собирается вместе с ядром |
| runtime ESM (`import(url)`) | не целевой | потенциальное развитие |
| microfrontend (`remoteEntry.js`) | не целевой | потенциальное развитие |

> Следствие: изменение фронтового кода модуля требует пересборки образа ядра (см. §16.1 п.8).

### 7.3. Контракт фронт-модуля

```js
// frontend/index.js
export function install(ctx) { /* ctx.ui.registerSurface(point, Component) */ }
export { ModuleButton, ModulePanel };  // компоненты для точек расширения
```

### 7.4. Гейт видимости

Точка расширения отображается, только если модуль **включён и лицензирован**.
Флаг несекретный приходит из `GET /api/config` (например `modules: { "<code>": { enabled, expires_at } }`),
плюс проверка права (`requiredPermission`) на стороне UI.

**Реализация (ядро):**

- `GET /api/config` → `modules: { "<code>": { enabled, licensed, edition, expires_at } }` — **источник
  правды для UI** (§16.6 #9). Ключ лицензии и `settings_json` не отдаются никогда.
- `GET /api/<code>/manifest` — вспомогательный: ядро подменяет `active` модуля на
  `enabled && licensed` из реестра (модуль v0.1.0 отдаёт `active: true` безусловно).
- `frontend-v3/src/modules/SurfaceHost.vue` — единая точка гейта: `enabled && licensed` из
  `modules` (+ `authStore.hasPermission(requiredPermission)`); при отсутствии секции в конфиге —
  одноразовый fallback на `/api/<code>/manifest`.
- Режим «модуль включён, но не лицензирован»: поверхность **скрыта** (не «серая»), причина
  доступна в `manifest.reason` и в логе ядра — см. §16.6 #19.


## 8. RBAC

- Права модуля (`<code>:<action>`) регистрируются в каталоге permissions ядра.
- Ядро работает **deny-by-default**: маршрут без правила прав недоступен никому.
- `scripts/check-route-permissions.js` расширяется: учитывает маршруты из манифестов модулей.
- Без лицензии права модуля ролям **не выдаются** (или маршруты отвечают `403/402` с текстом).

## 9. Конфигурация

- Параметры модуля — в `ar_settings_parameters`, группа **«Модули»**, с префиксом `SYS_MODULE_<code>_` (например `SYS_MODULE_drawio_pro_ENABLED`).
- Гейт приоритета: **env → БД → дефолт** (как в существующем `/api/config`).
- В публичный `/api/config` попадает **только несекретное** (см. §10).

## 10. Лицензирование

- **Ключ не уходит во фронт.** Публично отдаётся только статус: `{ enabled, licensed, edition, expires_at }`.
- Ключ хранится **только в env** — `SYS_MODULE_<code>_LICENSE` (в БД не размещаем).
- Формат ключа — **v1**, единый источник правды: [`docs/module-license-key.md`](./module-license-key.md)
  (контейнер `<base64url(payload)>.<base64url(Ed25519-подпись)>`; поля `v`, `license_id`, `kid`,
  `product`, `edition`, `features`, `limits`, `installation{mode,uuid,ref,strict}`, `iat/nbf/exp`,
  `grace_days`, `trial`).
- Публичные ключи — в env ядра: `SYS_MODULE_LICENSE_PUBKEYS` (JSON `{"<kid>":"<base64 PEM>"}`),
  fallback — одиночный `SYS_MODULE_LICENSE_PUBLIC_KEY`.
- Привязка к инсталляции: `installation.mode` = `uuid` (сравнение с `SYS_INSTANCE_ID`) |
  `derived` (отпечаток `<host>:<port>:<db>`, `strict` — обязательность совпадения) | `any` (без привязки).
- Гейт: без лицензии — маршруты `403/402`, меню и точки расширения скрыты, права не выдаются.

> Инструмент выпуска/ротации ключей и реестр лицензий — на стороне модуля
> (`isar-diagram-editor/tools/license`, см. `docs/license-issuance.md` в репозитории модуля).
> Генерация и хранение **приватного** ключа — зона вендора, в ядро не входит.

## 11. Совместимость и версии

| Проверка | Поведение |
|---|---|
| Версия ядра не удовлетворяет `requiresCore` модуля | модуль **не запускается**, внятное сообщение в лог |
| Миграции модуля | прогон при `enable/upgrade`; при проблемах — **отключение модуля в параметрах** (откат версий не требуется) |

**Правило версионирования ядра (semver):**
- **ломающее** изменение контракта подключения → **MAJOR** ядра (модули требуют обновления);
- **добавление** возможностей/полей → **MINOR** (совместимо: старые модули продолжают работать — благодаря объектной форме `register` и точкам расширения);
- исправления → **PATCH**.

**Что уже добавлено в этой итерации (MINOR, обратная совместимость сохранена):**

| Добавление | Где | Совместимость |
|---|---|---|
| секция `modules` в `/api/config` | `backend/index.js` | новое поле ответа |
| `increment_id` / `increments[]` в ответе `POST/PUT .../full` | `backend/index.js` | поля добавлены, старые сохранены |
| `increments_mode: 'merge'` + `increment_id` в теле `PUT .../full` | `backend/index.js` | опционально, по умолчанию прежнее поведение |
| `mxfile` и `expected_version` в `POST .../diagrams` | `backend/index.js` | опционально, без них — генерация из БД |
| нормализация `client_ref` / `from_ref` / `to_ref` | `backend/adrIncrements.js` | принимаются обе формы ссылок |
| `endpoints[]` / `routes[]` / `permissions[]` в манифесте | `backend/modules/manifest.js` | новые необязательные поля |


Ядро **не хранит список «поколений контракта»** — единственная ось совместимости: версия ядра.

## 12. Распространение и лицензии кода

| Артефакт | Способ поставки |
|---|---|
| Приватный npm-пакет | `@isar/<code>` (для `backend/frontend/hybrid`) |
| Каталог `modules/<code>` в образе | zip/копирование (`COPY modules`) |
| Контейнер | отдельный образ в сети `ar-network` (для `external`) |

- Ядро — **Apache-2.0**; модули — **проприетарные**, не попадают в публичный репозиторий.
- Модуль не должен тянуть код ядра в свой публичный артефакт.

> Сравнение способов поставки (сложность развёртывания и подключения, плюсы/минусы) — **отдельное обсуждение**.

## 13. Безопасность

1. Секреты модуля — только на сервере (env/БД), не во фронте и не в `/api/config`.
2. Все маршруты модуля — под аутентификацией и RBAC.
3. Изоляция данных: модуль использует свою схему; к таблицам ядра — только через `ctx`.
4. Модуль не обходит middleware ядра (не монтирует маршруты до auth).
5. Логи модуля — через `ctx.logger`, без утечки секретов.

## 14. Соглашения

| Объект | Правило | Пример |
|---|---|---|
| Код модуля | kebab-case | `drawio-pro` |
| npm-пакет | `@isar/<code>` | `@isar/drawio-pro` |
| Маршруты | `/api/<code>/*` | `/api/drawio-pro/parse` |
| Права | `<code>:<action>` | `drawio_pro:manage` |
| Параметры | `SYS_MODULE_<code>_` | `SYS_MODULE_drawio_pro_ENABLED` |
| Схема БД | `archrep_mod_<code с _>` | `archrep_mod_drawio_pro` |
| Точки UI | `<screen>.<area>` | `adrAppliedForm.actions` |
| Форма кода модуля | современный формат (ESM) | `"type": "module"` |
| Форма подключения | объектная | `register({ app, ctx })` |
| Способы поставки | оба | build-time (§4.1) и контейнер (§4.2) |

## 15. Чек-лист готовности модуля

- [ ] Есть `module.json` со всеми обязательными полями.
- [ ] `register({ app, ctx })` (для backend/hybrid) не читает таблицы ядра напрямую.
- [ ] Все маршруты описаны в RBAC; `check:routes` проходит.
- [ ] Права модуля добавлены в каталог; выдаются только при активной лицензии.
- [ ] Секреты — только серверные; `/api/config` содержит лишь несекретный статус.
- [ ] Точки расширения UI объявлены в манифесте и гейтятся по флагу+праву.
- [ ] Указан `requiresCore` (совместимость с ядром).
- [ ] Есть инструкция установки/обновления/удаления (install/disable/remove).
- [ ] Миграции модуля (если есть) идут в своей схеме.

## 16. Решения и открытые вопросы

### 16.1. Решено

| # | Вопрос | Решение |
|---|---|---|
| 1 | Форма вызова `register` | **объектная** — `register({ app, ctx })` (расширяется без ломающих изменений). |
| 2 | Формат упаковки модуля | писать **сразу в современном формате (ESM)** — совместим и с сервером, и с браузером. |
| 3 | Способы доставки | сохраняются **оба**: build-time (§4.1) и контейнер (§4.2); выбор — по типу модуля. |
| 4 | Паспорт модуля (манифест) | принимается **как в §3**. |
| 5 | Обновление модуля | **без правок кода ядра**; build-time → пересборка образа ядра; контейнер → `docker pull` без пересборки (**принимаются оба варианта**). |
| 6 | Лицензия | **офлайн** (подписанный ключ v1, Ed25519), **привязка к инсталляции — да**: `installation.mode` = `uuid` (по `SYS_INSTANCE_ID`) \| `derived` (отпечаток инсталляции) \| `any` (без привязки); **trial — да**; ключ — **только в env**; формат — [`docs/module-license-key.md`](./module-license-key.md). |
| 7 | Способ загрузки фронта | **build-time** — целевой (см. §7.2). |
| 8 | UI «родной» vs iframe | **зависит от типа модуля**: `external` → iframe/отдельный экран; `frontend`/`hybrid` → «родной» UI. |
| 9 | Совместимость | ключевое поле — **`requiresCore`** (ядро центрально, модуль подстраивается); «откат» не нужен — модуль **отключается в параметрах**. |
| 10 | Включение/выключение модуля | по §4.1 — список `ENABLED_MODULES`; админ-UI — возможное улучшение. |

### 16.2. Открыто (нужно решение)

#### SSO для модулей типа `external`
- **Суть:** передача авторизации в отдельный сервис/iframe (встроенные модули используют общую сессию — вопроса нет).
- **Рекомендация:** **отложить** — решать при появлении первого `external`-модуля с UI; тогда короткоживущий токен через `postMessage` + проверка `origin`.

### 16.3. Отложено в отдельную спецификацию

#### Ключи лицензий
- **Решение:** хранить **только в env** — `SYS_MODULE_<code>_LICENSE` (в БД не размещаем).
- **Решение (2026-11-02): проверка остаётся офлайн.** Онлайн-активация / лицензионный сервер
  **не вводятся**. Подпись Ed25519 (публичные ключи — в env ядра по `kid`), ключ читается при
  старте, в `/api/config` и `/api/<code>/manifest` уходит только статус.
- **Формат ключа — ЗАКРЫТО (2026-11-04):** v1, единый источник правды
  [`docs/module-license-key.md`](./module-license-key.md). Реализация ядра —
  `backend/modules/license.js` (`verifyLicense()`), ключи выпускает инструмент модуля
  (`isar-diagram-editor/tools/license`). Обратная совместимость со старым payload не поддерживается
  (внедрений не было): `payload.instance_id` → `installation.uuid`, `payload.limit` → `limits`.
- **Принятые ограничения офлайн-модели** (осознанно, см. `docs/modules-admin-guide.md` §4.1):
  ключ вместе с `SYS_INSTANCE_ID` можно скопировать на другой сервер — лицензия там заработает;
  счётчика инсталляций нет; `exp` проверяется по часам сервера; отзыв ключа не действует
  автоматически (CRL — кандидат на v2).
  Компенсация — организационная: ключ выпускается под конкретный `instance_id`
  (генерируется `npm run modules:status -- --new-instance-id`), фиксируется в заявке/акте,
  копирование считается нарушением лицензии; на стендах — синхронизация времени (NTP).
- **Отдельная спека (остаётся):** генерация/хранение **приватного** ключа вендора, порядок ротации
  `kid` и перевыпуска при смене инсталляции (сейчас — на стороне модуля,
  `docs/license-issuance.md` в репозитории модуля).

### 16.4. Версионирование — решено

**Модель «ядро центрально»**: единственная ось совместимости — **`requiresCore`** (диапазон версий ядра).
Список «поколений контракта» (`moduleApiVersion`) **не используется** — ядру не нужно поддерживать множество старых контрактов.

- Модуль объявляет `requiresCore` (semver-диапазон).
- Ядро при старте: если его версия не попадает в диапазон → модуль **не запускается** (понятное сообщение).
- Ядро версионируется по semver: **ломающее** изменение контракта → MAJOR; добавления → MINOR.
- Совместимые добавления безопасны благодаря объектной форме `register` и точкам расширения.
- «Откат» не требуется — несовместимый модуль просто **отключается в параметрах**.

### 16.5. Приоритеты

| Приоритет | Что |
|---|---|
| 🟢 позже | SSO внешних модулей (§16.2) |
| 🟢 отдельная спека | Ключи лицензий (§16.3) |

> Версионирование — **решено** (§16.4). Открытых блокирующих вопросов по контракту подключения нет.

> Ранее «блокирующие» вопросы сняты: форма `register` и формат модулей — **решены** (§16.1);
> вопрос про payload относился к **логике конкретного модуля**, а не к подключению, и в контракт не входит.

### 16.6. Известные расхождения и адаптеры (DrawIO Pro 0.1.0)

Модуль подключён **без форка и правок кода**: все несовпадения закрыты адаптерами ядра.
Каждое расхождение зафиксировано здесь; для модуля — отдельные задачи (не блокируют работу).

| # | Расхождение | Решение в ядре | Кто закрывает |
|---|---|---|---|
| 1 | `manifest.json` (`id`, `permissionsProvided`, `surface`) vs `module.json` (`code`, `permissions`, `surfaces[]`) | legacy-адаптер `normalizeLegacyManifest()` + предупреждение в лог | ядро (адаптер), модуль (перейти на `module.json`) |
| 2 | `register({ app, coreApi })` vs контракт `register({ app, ctx })` | ядро вызывает `register({ app, ctx, db, auth, coreApi })`; если модуль отдаёт `handlers` + `endpoints[]` — маршруты монтирует ядро (`adapters/legacy.js`) | ядро (адаптер), модуль (`ctx`, `install`) |
| 3 | `client_ref` / `from_ref` / `to_ref` vs `local_key` / `from_new_key` / `to_new_key` | `normalizeIncrementPayload()` до `resolveRelationEndpoint()` + тесты | ядро (адаптер), модуль (перейти на имена ядра) |
| 4 | `POST /full` не возвращал `increment_id` | ответ расширен: `{ id, code, increment_id, increments[] }` | ядро |
| 5 | `PUT /full` с телом `{ increments }` затирал шапку | `mergeAppliedHeader()`: отсутствующие поля берутся из БД | ядро |
| 6 | `POST .../diagrams` игнорировал клиентский `mxfile` | принимаем `mxfile` (валидация XML + лимит `DRAWIO_MXFILE_MAX_MB`), сохраняем как новую версию; без `mxfile` — прежняя генерация. Опционально `expected_version` → 409 | ядро |
| 7 | `/api/config` без `modules` | несекретная секция `modules` добавлена | ядро |
| 8 | `DiagramEditorView` без props/events | режим `?module=drawio-pro`: surface `diagramEditor.toolbar`, панель владеет сохранением, автосохранение ядра отключено | ядро |
| 9 | Модуль отдаёт `active: true` безусловно | ядро гейтит по `enabled && licensed` и подменяет `/manifest.active` статусом реестра | ядро, модуль (учитывать `ctx.module.status()`) |
| 10 | Модуль присылает **один** increment, а `PUT /full` по умолчанию заменяет **весь** состав заключения | опциональный `increments_mode: 'merge'` + `increment_id`: пересоздаётся только выбранное решение, остальные и их схемы сохраняются | ядро (адаптер вызова) |
| 11 | Модуль сохраняет `.drawio` из **своей** модели (без ручной раскладки) | перед `createIncrementDiagram` ядро запрашивает `{ action: 'export' }` у Draw.io и передаёт текущий XML; mxfile модуля — только фолбэк | ядро (адаптер API) |
| 12 | `requireActive` модуля отвечает 403 только по своей заглушке `license.active = true` | ядровый гейт `makeGate()` на каждом маршруте: выключен → 403, без лицензии → 402 | ядро |
| 13 | Модуль не объявляет точки расширения в форме контракта | `frontend-v3/src/modules/adapters/drawioPro.js` регистрирует `adrAppliedForm.actions` и `diagramEditor.toolbar` | ядро (адаптер), модуль (`install(ctx)`) |
| 14 | `@isar/drawio-pro` не в `exports` карты пакета (`./frontend/*.vue`) | Vite alias `@isar/drawio-pro` → каталог пакета; при отсутствии — каталог-заглушка | ядро (сборка), модуль (добавить export) |
| 15 | Модуль написан в CommonJS | `build.commonjsOptions.include` для `modules/drawio-pro` и `node_modules` | ядро (сборка) |
| 16 | Модуль не мигрирует свою схему | данных в БД у модуля нет (черновик в памяти); схема `archrep_mod_drawio_pro` пока не создаётся | модуль (когда появятся свои данные) |
| 17 | Событие `saved` не уведомляет форму заключения | форма перечитывает данные при возврате фокуса (модуль открывается в новой вкладке) | ядро |
| 18 | `/api/drawio-pro/*` не покрыт RBAC | правила `GET`/`POST` + право `drawio_pro:manage` в каталоге, `check:routes` учитывает манифесты | ядро |
| 19 | «Включён, но не лицензирован» — неопределённое поведение UI | **решение:** поверхность и меню **скрыты**, API отвечает 402 с причиной, причина в `manifest.reason` и логе | ядро |
| 20 | Формат лицензионного ключа не определён | **закрыто:** ключ **v1** — `<base64url(payload)>.<base64url(Ed25519)>`, поля `v/license_id/kid/product/edition/features/limits/installation/iat/nbf/exp/grace_days/trial`; `verifyLicense(key, { instanceId, installRef })` — стабильный интерфейс (см. `docs/module-license-key.md`) | ядро |
| 21 | Legacy-манифест не объявляет лицензию → платный модуль считался бы бесплатным | legacy-адаптер **fail-closed**: без явного `license` → `{ required: true, product: <code> }`; после перехода на `module.json` действует явное значение | ядро (адаптер), модуль (`module.json` с `license`) |
| 22 | Ядро не понимало ключи v1, которые выпускает `tools/license` модуля (`v`/`kid`/`nbf`/`grace_days`/`installation`) | **переход на v1 (2026-11-04):** `backend/modules/license.js` реализует формат модуля 1:1 (включая `install_ref` = `sha256("<host>:<port>:<db>")[:22]`), выбор публичного ключа по `kid` (`SYS_MODULE_LICENSE_PUBKEYS` → `'*'` → одиночный `SYS_MODULE_LICENSE_PUBLIC_KEY`), `nbf`/`grace_days`, `installation.mode` + `strict`; обратная совместимость со старым payload не поддерживается (внедрений не было) | ядро |
| 23 | В `isar_modules` не было метаданных лицензии | добавлены `license_id`, `license_kid`, `license_binding`, `license_checked_at` (миграция `DB/scripts/migrate_20261105120000_isar_modules_license_meta.sql`); сам ключ и публичный ключ в БД не пишутся | ядро |

### 16.7. Решения по открытым вопросам (часть E задачи)

| # | Вопрос | Решение |
|---|---|---|
| 1 | Чей статус авторитетен для UI: `/api/config.modules` или `/api/<code>/manifest` | **`/api/config.modules`**. Manifest — fallback и диагностика. Модуль не может «включить себя сам» |
| 2 | Где хранить `licensed` / `license_expires_at` | **только в `isar_modules`** (и в памяти процесса). В `settings_json` **не дублируем**: ключ и производные от него — не настройки модуля |
| 3 | Формат ключа и инструмент подписи | интерфейс `verifyLicense(key, { instanceId })` реализован (Ed25519, `exp`, `instance_id`, `trial`, `limit`); формат и генератор — отдельная спека §16.3 |
| 4 | Нужен ли `--drop-schema` для `archrep_mod_<code>` при удалении | **пока нет**: у первого модуля своей схемы нет. Вводим вместе с первой модульной миграцией (флаг `--drop-schema` у скрипта удаления модуля) |
| 5 | Как показывать «включён, но не лицензирован» | **скрывать** точку расширения (не «серая» кнопка). Администратору — статус в `/api/config` и причина в `/api/<code>/manifest.reason`; пользователю — ничего |
| 6 | Онлайн-активация / защита ключа от копирования | **не вводим** (решение 2026-11-02): проверка офлайн, ограничения приняты и описаны в §16.3 и `docs/modules-admin-guide.md` §4.1 |



## 17. Ссылки

- `temp/modules-installation-discussion.md` — исходное обсуждение (варианты 1–4, план этапов).
- `docs/issue-74-adr-linear-save-model.md` — контракт сохранения ADR (пример интеграции).
- `backend/modules/` — загрузчик, манифест, лицензия, реестр, адаптеры (см. §4.3).
- `docs/modules-admin-guide.md` — инструкция администратора: установка, лицензия, включение, диагностика.
- `docs/modules-connect-checklist.md` — короткий чеклист подключения (10 шагов).
- `docs/issue-modules-enabled-duplication.md` — задача «дублирование источников включения модулей» (текст для GitHub).
- `modules/README.md` — drop-in каталог модулей и шпаргалка команд.
- `backend/auth/routePermissions.js`, `scripts/check-route-permissions.js` — RBAC и проверка маршрутов.
- `frontend-v3/src/modules/` — реестр поверхностей, `SurfaceHost`, адаптеры модулей.
- `frontend-v3/src/views/DecisionAppliedForm.vue`, `DiagramEditorView.vue` — точки расширения UI.
- `frontend-v3/src/config/params.js`, `backend/index.js` (`/api/config`) — канал конфигурации.
- `infra/common/dockerfile`, `infra/*/docker-compose.yml` — сборка и поставка.


## Приложение A. Пример манифеста DrawIO Pro

```jsonc
{
  "code": "drawio-pro",
  "name": "DrawIO Pro",
  "version": "0.1.0",
  "requiresCore": ">=1.0",
  "type": "hybrid",
  "entry": "index.js",
  "frontend": "frontend/index.js",
  "permissions": ["drawio_pro:manage"],
  "surfaces": [
    { "point": "adrAppliedForm.actions", "component": "DrawioProButton" },
    { "point": "diagramEditor.toolbar",  "component": "DrawioProPanel" }
  ],
  "license": { "required": true, "product": "drawio-pro" }
}
```

---

*Создано: 2026-09-12. Обновлено: 2026-11-02 — **MVP инфраструктуры реализован** (§4.3), адаптеры и
расхождения зафиксированы (§16.6), решения по открытым вопросам — §16.7.*



