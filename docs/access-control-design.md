# Разграничение прав доступа в ИСАР

**Статус:** **не реализовано в репозитории** — проектная спека. В коде продукта RBAC/аутентификация по этой модели **отсутствуют** (API открыт, как в §2).  
**Версия:** 0.3.6  
**GitHub:** https://github.com/dgabadulin/ArchRep/issues/66  
**Связанные материалы:** `docs/settings-parameters-design.md` (Keycloak — фаза позже), `docs/data-import-service.md`, `docs/web-resource-registry-schema.md`, `frontend-v3/src/config/menu.js`, `frontend-v3/src/router/index.js`, `.env.example` (`AUTH_ENABLED`, bootstrap)

**Изменения 0.3:** локальная авторизация как первый этап; 4 роли (без DOMAIN_LEAD); упрощение permissions ADRA; веб-ресурсы и сервисный импорт; модель данных без audit log и без кода группы у permission. Выключатель авторизации — **env `AUTH_ENABLED`**, не `ar_parameters`. Обязательные пользователи `demo` и `aradmin` — bootstrap из env.

---

## 1. Цели и границы

| Цель | Описание |
|------|----------|
| **Идентификация** | Кто вошёл в систему и от чьего имени идут изменения. |
| **Конфиденциальность** | Ограничение чтения чувствительных разделов (заключения, долги, секретные параметры). |
| **Целостность** | Запрет административных и массовых операций без роли. |
| **Согласованность с TOGAF** | Права по доменам: Governance, Business, Application, Technology, Analytics, Settings. |

**Вне первой очереди:** построчный ABAC по OU/владельцу ИС, роль DOMAIN_LEAD / scope OU, workflow согласования ADR, делегирование прав, Keycloak/OIDC, audit log в БД.

---

## 2. Текущее состояние (as-is)

| Аспект | Состояние |
|--------|-----------|
| API | Все `GET/POST/PUT/DELETE /api/*` без проверки пользователя. |
| Учётные записи | Нет `ar_app_users`; `ar_employees` — каталог, не логин. |
| SSO | В спеке параметров описан Keycloak (`AR_Keycloak_*`), не внедрён. |
| Админ-действия | Только `ADMIN_API_RESTART_SECRET` / `ALLOW_INSECURE_RESTART_WITHOUT_SECRET` для restart Node. |
| RBAC в коде | Не реализован. |

---

## 3. Целевая модель

### 3.1. Аутентификация: сначала локальная, затем Keycloak

#### Выключатель: `AUTH_ENABLED` (env)

| Значение | Поведение |
|----------|-----------|
| `true` / `1` / `yes` | Авторизация **включена**: без JWT → 401; UI показывает `/login`; RBAC активен |
| `false` / `0` / `no` / **не задано** | Авторизация **выключена** (open mode): JWT не требуется; форма логина **не показывается**; API и UI как с полными правами |

\* **Default при отсутствии переменной: `false`** (open mode). На prod при необходимости защиты задавать явно `AUTH_ENABLED=true` в `.env.production`.

| Open mode (`AUTH_ENABLED=false`) | Деталь |
|----------------------------------|--------|
| Токен | **Не используется**: не выдавать, на фронте не хранить; устаревший JWT игнорировать/удалить |
| `GET /api/auth/me` | Без Bearer: `{ auth_enabled: false, user: { login: "anonymous", … }, roles: ["OPEN_ACCESS"], permissions: […все…] }` или `permissions: ["*"]` |
| `requirePermission` | Всегда пропускает |
| `POST /api/auth/login` | `400` — авторизация отключена (или не регистрировать route) |
| UI | Нет редиректа на `/login`; boot → `me`/`config` → сразу приложение |
| `GET /api/config` | Публично отдаёт `auth_enabled: false\|true` (из env), чтобы фронт знал режим до/вместе с `me` |

Флаг **только в env** (не в `ar_parameters`): нельзя выключить защиту из UI скомпрометированным админом; смена — перезапуск процесса API (как и прочие env).

#### Обязательные пользователи (bootstrap)

При развёртывании схемы auth / первом старте API **обязательно** создать двух пользователей с полным набором прав (роль `SYSTEM_ADMIN` или эквивалент «все permissions»):

| login | Назначение |
|-------|------------|
| `demo` | Демонстрационный вход с полным доступом |
| `aradmin` | Администратор репозитория/платформы |

Правила:

- В БД хранится только **`password_hash`** (bcrypt или argon2id). Plaintext паролей в SQL-миграциях и в git **не допускается**.
- Пароли задаются **только через env** на стенде (см. таблицу переменных ниже).
- Создание **идемпотентное**: если пользователь с таким `login` уже есть — не дублировать; hash обновлять только при `AUTH_BOOTSTRAP_RESET_PASSWORDS=true`.
- Если соответствующий `*_PASSWORD` в env **не задан** — пользователя с этим login **не создавать** (или не менять пароль): bootstrap не должен падать в CI без секретов.
- Флаг `must_change_password` при создании bootstrap-пользователей задаётся **из env** (`AUTH_BOOTSTRAP_MUST_CHANGE_PASSWORD`).

| Переменная env | Смысл |
|----------------|--------|
| `AUTH_ENABLED` | Вкл/выкл авторизации; default если не задан — `false` |
| `JWT_SECRET` | Секрет подписи локального JWT (обязателен при `AUTH_ENABLED=true`) |
| `AUTH_BOOTSTRAP_DEMO_PASSWORD` | Plaintext пароль для login `demo` → hash при bootstrap |
| `AUTH_BOOTSTRAP_ARADMIN_PASSWORD` | Plaintext пароль для login `aradmin` → hash при bootstrap |
| `AUTH_BOOTSTRAP_RESET_PASSWORDS` | `true` — перезаписать hash существующих `demo`/`aradmin` из env при старте/bootstrap (осторожно на prod) |
| `AUTH_BOOTSTRAP_MUST_CHANGE_PASSWORD` | `true`/`false` — значение `must_change_password` для создаваемых bootstrap-пользователей |

Шаблон: `.env.example`. Значения с реальными паролями — только в `.env.*` на сервере / secret manager, не в репозитории.

**Фаза A (первая реализация) — локальная авторизация в БД ИСАР** (при `AUTH_ENABLED=true`)

| Элемент | Решение |
|---------|---------|
| Хранение учёток | `ar_app_users` (login, password_hash, …) |
| Вход | `POST /api/auth/login` (login + password) → JWT Bearer (issuer приложения) |
| Управление | UI/API: создание пользователей, сброс/смена пароля, назначение ролей |
| Bootstrap | Обязательные `demo` и `aradmin` (SYSTEM_ADMIN) из env — см. выше |
| Keycloak | Не требуется |

**Фаза B (позже) — Keycloak (OIDC)**

| Элемент | Решение |
|---------|---------|
| Условие | `AR_Keycloak_Enabled=true` |
| Фронт | Authorization Code + PKCE |
| API | JWT Bearer от Keycloak **или** обмен на локальный JWT |
| Связь | `ar_app_users.keycloak_sub` / email → существующая учётка |
| Роли | **Источник истины остаётся БД** (`ar_user_roles`); KC даёт identity, не дублирует матрицу прав |

Связь с каталогом сотрудников (опционально, не блокер фазы A): `ar_app_users.employee_id` → `ar_employees`.

### 3.2. Авторизация (RBAC)

```
Пользователь → Роль(и) → Permission(ы)
```

Effective permissions = объединение permissions всех назначенных ролей.

**Permission:** `<resource>:<action>`

| Действие | Смысл |
|----------|--------|
| `read` | Просмотр списков и карточек, GET API |
| `write` | Создание и изменение (POST, PUT), включая вложенные операции сущности |
| `delete` | Удаление (DELETE) |
| `export` | Выгрузка Excel (`?excel=1` и сервисный экспорт шаблона импорта) |
| `execute` | Сервисные/административные операции без CRUD сущности |

### 3.3. Роли (только эти четыре)

| Код | Название | Назначение |
|-----|----------|------------|
| `VIEWER` | Наблюдатель | Чтение каталогов, аналитика, дашборды, экспорт где разрешён |
| `ARCHITECT` | Архитектор | CRUD доменных реестров, ADR, интеграции, диаграммы, связи метамодели |
| `REPOSITORY_ADMIN` | Администратор репозитория | Как ARCHITECT + параметры, справочники, сервисные операции, пересборка, пользователи/роли |
| `SYSTEM_ADMIN` | Администратор платформы | Как REPOSITORY_ADMIN + restart API |

Роли системные (`is_system`): коды фиксированы, удалять нельзя; матрица permission сидится миграциями.

### 3.4. Упрощение ADRA

Отдельные `adr_applied:diagram:edit` и `adr_applied:increment:write` **не используются**.

| Permission | Покрывает |
|------------|-----------|
| `adr_applied:read` / `export` | Просмотр и выгрузка |
| `adr_applied:write` | Шапка заключения **и** инкременты, системы/связи/функции, сохранение схем Draw.io |
| `adr_applied:delete` | Удаление заключения |

---

## 4. Каталог permissions

### 4.1. Governance

| Permission | Ресурс |
|------------|--------|
| `principle:read` / `write` / `delete` / `export` | `ar_principles` |
| `adr_principle:read` / `write` / `delete` / `export` | `ar_adrs_principle` |
| `adr_applied:read` / `write` / `delete` / `export` | `ar_adrs_applied` (+ инкременты, диаграммы) |
| `gap:read` / `write` / `delete` / `export` | `ar_gaps` |

### 4.2. Business

| Permission | Ресурс |
|------------|--------|
| `organization_unit:read` / `write` / `delete` / `export` | Орг. единицы |
| `actor:read` / `write` / `delete` / `export` | Заинтересованные лица |
| `business_service:read` / `write` / `delete` / `export` | Продукты (бизнес-сервисы) |
| `business_function:read` / `write` / `delete` / `export` | Бизнес-способности |
| `goals:read` | Цели и задачи (placeholder) |

### 4.3. Application

| Permission | Ресурс |
|------------|--------|
| `system:read` / `write` / `delete` / `export` | Каталог ИС и модулей |
| `system_function:read` / `write` / `delete` | Функции ИС |
| `integration_flow:read` / `write` / `delete` / `export` | Реестр интеграций |
| `web_resource:read` / `write` / `delete` / `export` | Реестр веб-ресурсов |
| `partner:read` / `write` / `delete` / `export` | Контрагенты |
| `employee:read` / `write` / `delete` / `export` | Сотрудники (каталог) |

### 4.4. Technology

| Permission | Ресурс |
|------------|--------|
| `technology:read` / `write` / `delete` / `export` | Каталог технологий |
| `tech_radar:read` | Страница iframe «Тех.радар» |

### 4.5. Analytics

| Permission | Ресурс |
|------------|--------|
| `analytics:read` | Анализ зависимостей |
| `dashboard:read` | Дашборды и home-stats |
| `metamodel_relation:read` / `write` / `delete` / `export` | Ручные связи метамодели |
| `metamodel:rebuild` | Пересборка проекций интеграционных потоков |

### 4.6. Settings и администрирование

| Permission | Ресурс |
|------------|--------|
| `references:read` / `write` | Справочники (включая справочники веб-ресурсов) |
| `metamodel_catalog:read` / `write` | Типы сущностей/связей метамодели |
| `settings_parameters:read` / `write` | Системные параметры |
| `service_operations:execute` | Сервисные операции UI (пересборка и пр., **кроме** импорта данных) |
| `import:execute` | Сервисный импорт Excel: экран `/settings/service-operations/import` и `/api/import/*` |
| `users:read` / `write` | Учётные записи приложения |
| `roles:read` / `assign` | Просмотр ролей и назначение ролей пользователям |
| `system_admin:restart` | Перезапуск процесса API |

Импорт Excel: доступ к экрану и API — **`import:execute`**. На `apply` дополнительно требуется `<resource>:write` целевого реестра (например `web_resource:write`). Выгрузка из списка реестра — `<resource>:export`; шаблон/экспорт из формы импорта — `import:execute`.

### 4.7. Публичные endpoint (без JWT)

| Endpoint | Примечание |
|----------|------------|
| `GET /api/health`, `GET /api/health/db` | Мониторинг |
| `POST /api/auth/login` | Локальный вход (если `AUTH_ENABLED`) |
| `GET /api/config` | **Всегда публичный**; включает `auth_enabled` (из env), без секретов |

---

## 5. Матрица «роль × permission»

Обозначения: **R** = read, **W** = write, **D** = delete, **E** = export, **X** = execute / спец., **A** = assign, **—** = нет.

| Permission | VIEWER | ARCHITECT | REPOSITORY_ADMIN | SYSTEM_ADMIN |
|------------|:------:|:---------:|:----------------:|:------------:|
| **Governance** |
| `principle:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `adr_principle:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `adr_applied:read`, `export` | R,E | R,E | R,E | R,E |
| `adr_applied:write`, `delete` | — | W,D | W,D | W,D |
| `gap:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| **Business** |
| `organization_unit:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `actor:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `business_service:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `business_function:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `goals:read` | R | R | R | R |
| **Application** |
| `system:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `system_function:*` | R | R,W,D | R,W,D | R,W,D |
| `integration_flow:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `web_resource:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `partner:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `employee:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| **Technology** |
| `technology:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `tech_radar:read` | R | R | R | R |
| **Analytics** |
| `analytics:read` | R | R | R | R |
| `dashboard:read` | R | R | R | R |
| `metamodel_relation:*` | R,E | R,W,D,E | R,W,D,E | R,W,D,E |
| `metamodel:rebuild` | — | — | X | X |
| **Settings / admin** |
| `references:read` | R | R | R,W | R,W |
| `references:write` | — | — | W | W |
| `metamodel_catalog:read` | R | R | R,W | R,W |
| `metamodel_catalog:write` | — | — | W | W |
| `settings_parameters:read` | — | — | R | R |
| `settings_parameters:write` | — | — | W | W |
| `service_operations:execute` | — | — | X | X |
| `import:execute` | — | — | X | X |
| `users:read` / `write` | — | — | R,W | R,W |
| `roles:read` / `assign` | — | — | R,A | R,A |
| `system_admin:restart` | — | — | — | X |

---

## 6. Матрица «меню и маршруты UI × permission»

| № | Раздел меню | Путь | Просмотр | Создание / правка | Удаление | Доп. |
|---|-------------|------|:--------:|:-----------------:|:--------:|------|
| | **Главная** |
| 1 | — | `/` | `dashboard:read` | — | — | |
| | **Управление архитектурой** |
| 2 | Архитектурные принципы | `/principles` | `principle:read` | `principle:write` | `principle:delete` | export → `principle:export` |
| 3–4 | ADR | `/decisions/principle` (+ new/edit) | `adr_principle:read` | `adr_principle:write` | `adr_principle:delete` | |
| 5–7 | Архитектурные заключения + схема | `/decisions/applied`, diagram-editor | `adr_applied:read` | `adr_applied:write` | `adr_applied:delete` | схема/инкременты = `write` |
| 8–9 | Архитектурный долг | `/architecture-debt` (+ new/edit) | `gap:read` | `gap:write` | `gap:delete` | |
| | **Бизнес-архитектура** |
| 10 | Орг. единицы | `/organization-units` | `organization_unit:read` | `organization_unit:write` | `organization_unit:delete` | |
| 11 | Заинтересованные лица | `/actors` | `actor:read` | `actor:write` | `actor:delete` | |
| 12 | Продукты | `/business-services` | `business_service:read` | `business_service:write` | `business_service:delete` | |
| 13 | Бизнес-способности | `/business-functions` | `business_function:read` | `business_function:write` | `business_function:delete` | |
| 14 | Цели и задачи | `/goals` | `goals:read` | — | — | placeholder |
| | **Информационные системы** |
| 15 | Каталог ИС | `/systems` | `system:read` | `system:write` | `system:delete` | |
| 16 | Реестр интеграций | `/integrations` | `integration_flow:read` | `integration_flow:write` | `integration_flow:delete` | |
| 17 | Реестр веб-ресурсов | `/web-resources` (+ new/edit) | `web_resource:read` | `web_resource:write` | `web_resource:delete` | export → `web_resource:export` |
| | **Технологии** |
| 18 | Каталог технологий | `/technologies` | `technology:read` | `technology:write` | `technology:delete` | |
| 19 | Тех.радар | `/tech-radar` | `tech_radar:read` | — | — | |
| | **Аналитика** |
| 20 | Анализ зависимостей | `/analytics` | `analytics:read` | — | — | |
| 21–22 | Дашборды | `/dashboards`, `/dashboards/catalog` | `dashboard:read` | — | — | |
| 23 | Связи объектов управления | `/metamodel-relations` | `metamodel_relation:read` | `metamodel_relation:write` | `metamodel_relation:delete` | |
| | **Настройки** |
| 24 | Справочники | `/references` | `references:read` | `references:write` | `references:write` | |
| 25 | Параметры | `/settings/parameters` | `settings_parameters:read` | `settings_parameters:write` | — | |
| 26 | Сервисные операции | `/settings/service-operations` | `service_operations:execute` | — | — | |
| 26a | Импорт данных | `/settings/service-operations/import` | `import:execute` | — | — | apply → ещё `<resource>:write` |
| 27 | Пользователи и роли *(новый UI)* | `/settings/users` (условно) | `users:read` | `users:write`, `roles:assign` | — | |

**Фронт:** `requiredPermissions` в `menu.js` / `meta` маршрута; guard `router.beforeEach`; кнопки по `write` / `delete` / `export`.

---

## 7. Матрица «API × permission»

Для CRUD: **GET** → `read`, **POST/PUT** → `write`, **DELETE** → `delete`, **?excel=1** → `export`.

### 7.1. Auth

| API | Permission / доступ |
|-----|---------------------|
| `POST /api/auth/login` | публичный |
| `GET /api/auth/me` | любой аутентифицированный |
| `POST /api/auth/logout` | любой аутентифицированный (если есть revoke) |
| `POST /api/auth/change-password` | свой пароль; админский reset — `users:write` |

### 7.2. Governance

| API | Permission |
|-----|------------|
| `/api/principles` | `principle:*` |
| `/api/decisions/principle` | `adr_principle:*` |
| `/api/decisions/applied`, `.../full`, increments, diagrams, function-selection | `adr_applied:read` или `adr_applied:write` по методу |
| `/api/ar-gaps`, `.../relations` | `gap:*` |
| Справочники долга (`ar-gap-types`, …) | `references:*` |

### 7.3. Application

| API | Permission |
|-----|------------|
| `/api/ar-systems`, add/update | `system:*` |
| `/api/ar-systems/:id/system-functions` | `system_function:*` |
| `/api/integration-flows` | `integration_flow:*` |
| `/api/web-resources` | `web_resource:*` |
| `/api/partners` | `partner:*` |
| `/api/ar-employees` | `employee:*` |
| `/api/systems-technologies` | `system:write` + `technology:read` |

### 7.4. Technology / Business / Metamodel

| API | Permission |
|-----|------------|
| `/api/technologies` | `technology:*` |
| `/api/togaf/organization-units` | `organization_unit:*` |
| `/api/togaf/actors` | `actor:*` |
| `/api/togaf/business-services` | `business_service:*` |
| `/api/togaf/business-functions` | `business_function:*` |
| `/api/togaf/relations` | `metamodel_relation:*` |
| `/api/togaf/entity-types`, `relation-types` | `metamodel_catalog:*` |
| `POST .../rebuild-integration-flow-projections` | `metamodel:rebuild` |
| `GET /api/dashboard/home-stats` | `dashboard:read` |

### 7.5. Settings, import, users

| API | Permission |
|-----|------------|
| `/api/settings-parameters` | `settings_parameters:*` |
| Справочники статусов/типов (в т.ч. web-resource refs) | `references:*` (read для форм — мягко при любом `*:write` домена) |
| `/api/import/entities`, `template`, `export`, `validate`, `apply` | `import:execute`; apply также требует `<entity>:write` |
| `/api/users`, назначение ролей | `users:*`, `roles:assign` |
| `/api/admin/restart-node` | `system_admin:restart` (+ опционально секрет break-glass) |

---

## 8. Матрица «действия UI × permission»

| Действие в UI | Permission |
|---------------|------------|
| Открыть список / карточку | `<resource>:read` |
| Создать / Сохранить | `<resource>:write` |
| Удалить | `<resource>:delete` |
| Выгрузить в Excel (из списка) | `<resource>:export` |
| Редактор схемы / инкременты ADRA | `adr_applied:write` |
| Пересобрать проекции интеграций | `metamodel:rebuild` |
| Импорт данных (проверить/загрузить) | `import:execute` + на apply ещё `<resource>:write` |
| Перезапустить API | `system_admin:restart` |
| Создать пользователя / сбросить пароль | `users:write` |
| Назначить роли | `roles:assign` |

---

## 9. Модель данных

### 9.1. Где что хранится

| Компонент | Где |
|-----------|-----|
| Пользователи, пароли (hash), назначения ролей | БД (`ar_app_users`, `ar_user_roles`) |
| Роли и permissions, матрица роль→permission | БД (сиды миграциями) |
| Секреты/флаги SSO (позже) | параметры / env |
| Audit log | **не в объёме** этой версии спеки |

### 9.2. Таблицы

```sql
-- Учётная запись приложения (не ar_employees)
ar_app_users (
  id                bigserial PRIMARY KEY,
  login             varchar(100) NOT NULL UNIQUE,
  email             varchar(255) NULL UNIQUE,
  display_name      varchar(255) NOT NULL,
  password_hash     text NULL,              -- NULL допустим после перехода на SSO-only
  auth_provider     varchar(20) NOT NULL DEFAULT 'local',  -- local | keycloak | hybrid
  keycloak_sub      varchar(100) NULL UNIQUE,
  employee_id       bigint NULL REFERENCES archrep.ar_employees(id),
  is_active         boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at     timestamptz NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by_user_id bigint NULL REFERENCES archrep.ar_app_users(id)
);

ar_roles (
  id          bigserial PRIMARY KEY,
  code        varchar(64) NOT NULL UNIQUE,  -- VIEWER, ARCHITECT, ...
  name        varchar(255) NOT NULL,
  description text NULL,
  is_system   boolean NOT NULL DEFAULT true,
  is_active   boolean NOT NULL DEFAULT true
);

ar_permissions (
  id          bigserial PRIMARY KEY,
  code        varchar(128) NOT NULL UNIQUE, -- например web_resource:write
  description text NULL,
  is_active   boolean NOT NULL DEFAULT true
);

ar_role_permissions (
  role_id       bigint NOT NULL REFERENCES archrep.ar_roles(id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES archrep.ar_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ar_user_roles (
  user_id            bigint NOT NULL REFERENCES archrep.ar_app_users(id) ON DELETE CASCADE,
  role_id            bigint NOT NULL REFERENCES archrep.ar_roles(id) ON DELETE CASCADE,
  assigned_at        timestamptz NOT NULL DEFAULT now(),
  assigned_by_user_id bigint NULL REFERENCES archrep.ar_app_users(id),
  PRIMARY KEY (user_id, role_id)
);
```

Опционально позже (не обязательно в фазе A): `ar_auth_sessions` для refresh/revoke.

### 9.3. Endpoint идентификации

`GET /api/auth/me` → `{ user, roles[], permissions[] }` — для меню и кнопок после логина.

---

## 10. Реализация проверок

### 10.1. Backend

1. `POST /api/auth/login` — проверка hash, выдача JWT (sub = `ar_app_users.id`, claims: login, roles или только sub + загрузка прав на каждый запрос/кэш).
2. Middleware `authenticate` — Bearer JWT → `req.user`. Нет/невалидный токен → **401**.
3. `requirePermission(...)` — проверка effective permissions из ролей. Не хватает прав → **403** (см. §10.4).
4. По умолчанию **deny** для `/api/*`, кроме whitelist: health, login, публичный config.

`requirePermission` принимает один код или список (AND): например импорт apply — `['import:execute', 'web_resource:write']`. В ответе 403 перечисляются **только недостающие** из запрошенных для этого действия.

### 10.2. Frontend

1. Экран логина; access token в **`sessionStorage`**; все API-вызовы с `Authorization: Bearer …`.
2. После входа (и при F5 при живом токене) — `GET /api/auth/me` → store `{ user, roles, permissions }`.
3. Фильтрация `menu.js`; `router.beforeEach` по `meta.requiredPermissions`; `v-if` на кнопках.
4. Глобальный обработчик ошибок API: **401** → очистить сессию и `/login`; **403** → показать сообщение с `missing_permissions` (и при желании полный `required_permissions`).

Фронт — UX-слой; отказ всегда подтверждается backend.

```mermaid
flowchart TD
  A[Открыли приложение] --> Z{auth_enabled из config/me?}
  Z -->|нет / false| D2[GET /api/auth/me без токена]
  D2 --> E[permissions в store — все]
  E --> F[Построить меню]
  E --> G[router.beforeEach]
  E --> H[v-if на кнопках]
  G --> J[Страница]
  Z -->|true| B{Есть JWT?}
  B -->|нет| C[/login]
  B -->|да| D[GET /api/auth/me + Bearer]
  D -->|401 / ошибка| C
  D --> E
  G -->|нет права на route| I[/forbidden]
  G -->|ок| J
```

### 10.3. Диаграмма последовательности

```mermaid
sequenceDiagram
  autonumber
  actor U as Пользователь
  participant UI as Frontend
  participant Login as POST /api/auth/login
  participant Auth as authenticate
  participant RBAC as requirePermission
  participant API as API handler
  participant DB as PostgreSQL

  U->>UI: login + password
  UI->>Login: credentials
  Login->>DB: user + password_hash, roles
  alt неверные учётные данные / неактивен
    Login-->>UI: 401
  else успех
    Login-->>UI: 200 + JWT
    UI->>UI: сохранить token
    UI->>API: GET /api/auth/me + Bearer
    API->>Auth: verify JWT
    Auth->>DB: roles → permissions
    Auth-->>UI: user, roles[], permissions[]
    UI->>UI: меню, guards, кнопки
  end

  U->>UI: действие (напр. создать веб-ресурс)
  UI->>API: POST /api/web-resources + Bearer
  API->>Auth: verify JWT → req.user
  alt нет / битый JWT
    Auth-->>UI: 401
    UI->>UI: logout → /login
  else OK
    Auth->>RBAC: required = [web_resource:write]
    RBAC->>DB: effective permissions пользователя
    alt недостаёт прав
      RBAC-->>UI: 403 + missing_permissions
      UI->>UI: показать каких прав не хватает
    else права есть
      RBAC->>API: next
      API->>DB: create/update/...
      API-->>UI: 2xx + тело
    end
  end
```

### 10.4. Ответ 403 с конкретными permissions

**Да — корректно и рекомендуется.** Middleware знает список *required* для route/действия и множество *effective* пользователя; разница = `missing_permissions`.

Единый контракт тела при отказе в авторизации (после успешной аутентификации):

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json
```

```json
{
  "error": "forbidden",
  "message": "Недостаточно прав для выполнения операции",
  "required_permissions": ["import:execute", "web_resource:write"],
  "missing_permissions": ["web_resource:write"]
}
```

| Поле | Смысл |
|------|--------|
| `required_permissions` | Все коды, которые требовались для этого запроса (AND) |
| `missing_permissions` | Подмножество required, которых нет у пользователя |
| `message` | Человекочитаемый текст; фронт может дополнить списком кодов или их подписями из справочника |

Правила:

- **401** — не аутентифицирован (нет смысла отдавать missing permissions).
- **403** — аутентифицирован, но не авторизован; `missing_permissions` всегда непустой массив.
- Не включать в ответ полный список прав пользователя (лишнее раскрытие); достаточно required/missing.
- Для UI: тост/баннер вида «Не хватает: веб-ресурсы — изменение (`web_resource:write`)»; маппинг code→подпись можно держать на фронте рядом с каталогом permissions или отдать лёгкий словарь в `/api/auth/me`.

Пример: у пользователя есть `import:execute`, нет `web_resource:write` → apply импорта веб-ресурсов → `missing_permissions: ["web_resource:write"]`.

### 10.5. Draw.io

- Embed может быть без auth на уровне nginx.
- **Сохранение** mxfile — только API с JWT и `adr_applied:write`; отказ — тот же контракт 403.

---

## 11. Этапы внедрения

| Этап | Содержание | Критерий готовности |
|------|------------|---------------------|
| 0 | Согласование этой редакции спеки | Ок владельца продукта |
| 1 | Таблицы + сиды ролей/permissions + bootstrap admin | Можно создать пользователя в БД |
| 2 | Login / JWT / `/api/auth/me` + deny по умолчанию | Без токена API → 401 |
| 3 | UI пользователей и назначения ролей | REPOSITORY_ADMIN управляет доступом |
| 4 | RBAC на write/delete и admin-операции | Нет анонимных изменений |
| 5 | UI: меню, кнопки, guards | Нет «ложных» кнопок |
| 6 | (позже) Keycloak как identity | Локальные роли сохраняются |
| 7 | (позже) audit log / DOMAIN_LEAD+OU | Вне текущего объёма |

---

## 12. Решения (зафиксировано) и остаток

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | Default `AUTH_ENABLED`, если не задан | **`false`** (open mode) |
| 2 | `GET /api/config` | **Да**, всегда публичный; всегда отдаёт `auth_enabled` |
| 3 | Несколько ролей на пользователя | **Да** |
| 4 | Break-glass `ADMIN_API_RESTART_SECRET` вместе с `system_admin:restart` | **Да**, оставить |
| 5 | Право на импорт | Отдельный **`import:execute`** (+ на apply ещё `<resource>:write`) |
| 6 | Где хранить JWT на фронте | **`sessionStorage`** (сессия вкладки; F5 не разлогинивает) |
| 7 | `must_change_password` для bootstrap | Задаётся **из env** `AUTH_BOOTSTRAP_MUST_CHANGE_PASSWORD` |

Также зафиксировано ранее: `AUTH_ENABLED` только env; пользователи `demo` / `aradmin`; пароли через `AUTH_BOOTSTRAP_*_PASSWORD`.

### Что нужно, чтобы начать реализацию

| # | Артефакт | Статус |
|---|----------|--------|
| 1 | Согласование v0.3.x | решения §12 закрыты |
| 2 | GitHub Issue (постановка + ссылка на этот файл) | [#66](https://github.com/dgabadulin/ArchRep/issues/66) |
| 3 | Dual-миграция таблиц + сиды ролей/permissions + bootstrap `demo`/`aradmin` | код |
| 4 | Backend: `AUTH_ENABLED`, login, JWT, `/me`, middleware, `import:execute` | код |
| 5 | Frontend: `/login` при auth on; token в `sessionStorage`; Bearer; flowchart §10.2 | код |

Этапы UI пользователей / полное покрытие write / меню — после работающего login.

---

## 13. Связь с текущими задачами

| Задача / файл | Действие |
|---------------|----------|
| `data-import-service.md` | После RBAC: `import:execute` + resource write на apply |
| `web-resource-registry-schema.md` | Permissions `web_resource:*` |
| `settings-parameters-design.md` | Keycloak — фаза B; локальный auth не зависит от KC |
| Demo-стенд | Убрать insecure restart после появления `SYSTEM_ADMIN` |

---

## Приложение A. Маппинг permission → сущность БД

| Permission prefix | Таблица / объект |
|-------------------|------------------|
| `system` | `ar_systems` |
| `system_function` | `ar_system_functions` |
| `technology` | `ar_technologies` |
| `integration_flow` | `ar_integration_flows` |
| `web_resource` | `ar_web_resources` |
| `principle` | `ar_principles` |
| `adr_principle` | `ar_adrs_principle` |
| `adr_applied` | `ar_adrs_applied` (+ increments/diagrams) |
| `gap` | `ar_gaps` |
| `organization_unit` | `ar_organization_units` |
| `actor` | `ar_actors` |
| `business_service` | `ar_business_services` |
| `business_function` | `ar_business_functions` |
| `partner` | `ar_partners` |
| `employee` | `ar_employees` |
| `metamodel_relation` | `ar_metamodel_relations` |
| `metamodel_catalog` | `ar_metamodel_entity_types`, `ar_metamodel_relation_types` |
| `users` / `roles` | `ar_app_users`, `ar_roles`, `ar_user_roles` |

---

## Приложение B. Пример JWT (локальный issuer)

```json
{
  "iss": "isar-local",
  "sub": "42",
  "login": "architect",
  "display_name": "Иванов И.И.",
  "roles": ["ARCHITECT"],
  "exp": 1735689600
}
```

Маппинг role → permissions — в API из БД (кэш при старте или на логин).

---

## Приложение C. История редакций

| Версия | Дата | Суть |
|--------|------|------|
| 0.2 | — | Черновик с Keycloak-first, DOMAIN_LEAD, дробные ADRA permissions, audit log |
| 0.3 | 2026-08-07 | Local-first auth; 4 роли; упрощение ADRA; `web_resource` + import; модель без audit log и без group_code у permissions |
| 0.3.1 | 2026-08-07 | §10: sequence diagram; контракт 403 с `required_permissions` / `missing_permissions` |
| 0.3.2 | 2026-08-07 | §10.2: flowchart старта приложения (JWT → me → меню/guards) |
| 0.3.3 | 2026-08-07 | Выключатель `AUTH_ENABLED` (env); open mode без логина и без JWT |
| 0.3.4 | 2026-08-07 | Обязательные пользователи `demo` / `aradmin`; пароли через `AUTH_BOOTSTRAP_*` env |
| 0.3.5 | 2026-08-07 | Решения §12: default AUTH off; config public; multi-role; break-glass; `import:execute`; must_change из env |
| 0.3.6 | 2026-08-07 | JWT на фронте: `sessionStorage`; §12 полностью закрыт |
