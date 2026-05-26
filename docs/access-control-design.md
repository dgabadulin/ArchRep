# Разграничение прав доступа в ИСАР

**Статус:** проект / обсуждение  
**Версия:** 0.2  
**Связанные материалы:** `docs/settings-parameters-design.md` (Keycloak), `docs/github-issue-drafts/metamodel-rebuild-rbac-ux.md`, `frontend-v3/src/config/menu.js`, `frontend-v3/src/router/index.js`

---

## 1. Цели и границы

| Цель | Описание |
|------|----------|
| **Идентификация** | Кто выполнил изменение (аудит ADR, диаграммы, пересборка метамодели). |
| **Конфиденциальность** | Ограничение чтения чувствительных разделов (заключения, долги, секретные параметры). |
| **Целостность** | Запрет административных и массовых операций без роли. |
| **Согласованность с TOGAF** | Права по доменам метамодели: Governance, Business, Application, Technology, Analytics, Settings. |

**Вне первой очереди:** построчный ABAC по OU/владельцу ИС, workflow согласования ADR, делегирование прав между пользователями.

---

## 2. Текущее состояние (as-is)

| Аспект | Состояние |
|--------|-----------|
| API | Все `GET/POST/PUT/DELETE /api/*` без проверки пользователя. |
| Учётные записи | Нет `ar_app_users`; `ar_employees` — каталог, не логин. |
| SSO | В спеке параметров описан Keycloak (`AR_Keycloak_*`), не внедрён. |
| Админ-действия | Только `ADMIN_API_RESTART_SECRET` / `ALLOW_INSECURE_RESTART_WITHOUT_SECRET` для restart Node. |
| RBAC в коде | Упоминается для `POST /api/togaf/metamodel/rebuild-integration-flow-projections` — не реализован. |

---

## 3. Целевая модель

### 3.1. Аутентификация

**Prod / demo (HTTPS):** Keycloak (OIDC), фронт — Authorization Code + PKCE, API — JWT Bearer.

| Режим | Условие |
|-------|---------|
| SSO включён | `AR_Keycloak_Enabled=true` (параметр / env) |
| Dev без SSO | Только `NODE_ENV=development`: технический пользователь из env |

Связь с каталогом (фаза 2): `ar_app_users.keycloak_sub` → опционально `employee_id` → `ar_employees`.

### 3.2. Авторизация (RBAC)

```
Пользователь → Роль(и) → Permission(ы)
```

**Permission:** `<resource>:<action>`

| Действие | Смысл |
|----------|--------|
| `read` | Просмотр списков и карточек, GET API |
| `write` | Создание и изменение (POST, PUT) |
| `delete` | Удаление (DELETE) |
| `export` | Выгрузка Excel (`?excel=1`) |
| `execute` | Сервисные/административные операции без CRUD сущности |

Дополнительные действия (узкие):

| Permission | Назначение |
|------------|------------|
| `adr_applied:diagram:edit` | Редактор схемы Draw.io (iframe + save mxfile) |
| `adr_applied:increment:write` | Инкременты, системы/связи/диаграммы внутри заключения |
| `metamodel:rebuild` | `POST /api/togaf/metamodel/rebuild-integration-flow-projections` |
| `system_admin:restart` | `POST /api/admin/restart-node` |
| `references:write` | Справочники статусов, типов, классификаторов (раздел «Справочники») |
| `metamodel_catalog:write` | Типы сущностей/связей метамодели (опасные изменения схемы связей) |

### 3.3. Роли

| Код | Название | Назначение |
|-----|----------|------------|
| `VIEWER` | Наблюдатель | Чтение каталогов, аналитика, дашборды |
| `ARCHITECT` | Архитектор | CRUD метамодели, ADR, интеграции, диаграммы |
| `DOMAIN_LEAD` | Руководитель домена | Как ARCHITECT + scope по OU (фаза 2) |
| `REPOSITORY_ADMIN` | Администратор репозитория | Параметры, справочники, сервисные операции, пересборка |
| `SYSTEM_ADMIN` | Администратор платформы | Restart API, управление ролями (если не только в KC) |

Роли предпочтительно заводить в **Keycloak** (realm/client roles) с маппингом 1:1 на коды приложения.

### 3.4. Scope (фаза 2, опционально)

К permission добавляется ограничение:

- `scope=all` — без ограничений;
- `scope=own_ou` — записи с `ar_organization_units_id` из списка OU пользователя.

Применимо к: `system`, `business_function`, `business_service`, `organization_unit`.

---

## 4. Каталог permissions (полный)

### 4.1. Governance — управление архитектурой

| Permission | Ресурс |
|------------|--------|
| `principle:read` / `write` / `delete` / `export` | `ar_principles` |
| `adr_principle:read` / `write` / `delete` / `export` | ADR (`ar_adrs_principle`) |
| `adr_applied:read` / `write` / `delete` / `export` | Архитектурные заключения |
| `adr_applied:diagram:edit` | Редактор схемы |
| `adr_applied:increment:write` | Инкременты, системы, связи, диаграммы в ADRA |
| `gap:read` / `write` / `delete` / `export` | Архитектурный долг (`ar_gaps`) |

### 4.2. Business — бизнес-архитектура

| Permission | Ресурс |
|------------|--------|
| `organization_unit:read` / `write` / `delete` / `export` | Орг. единицы |
| `actor:read` / `write` / `delete` / `export` | Заинтересованные лица |
| `business_service:read` / `write` / `delete` / `export` | Продукты (бизнес-сервисы) |
| `business_function:read` / `write` / `delete` / `export` | Бизнес-способности |
| `goals:read` | Цели и задачи (placeholder, пока без API) |

### 4.3. Application — информационные системы

| Permission | Ресурс |
|------------|--------|
| `system:read` / `write` / `delete` / `export` | Каталог ИС и модулей (`ar_systems`) |
| `system_function:read` / `write` / `delete` | Функции ИС |
| `integration_flow:read` / `write` / `delete` / `export` | Реестр интеграций |
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
| `analytics:read` | Анализ зависимостей (граф метамодели) |
| `dashboard:read` | Дашборды и home-stats |
| `metamodel_relation:read` / `write` / `delete` / `export` | Ручные связи метамодели |
| `metamodel:rebuild` | Пересборка проекций интеграционных потоков |

### 4.6. Settings

| Permission | Ресурс |
|------------|--------|
| `references:read` / `write` | Справочники (статусы, типы, классификаторы ADR/ИС/потоков) |
| `metamodel_catalog:read` / `write` | Типы сущностей и типы связей (`ar_metamodel_*_types`) |
| `settings_parameters:read` / `write` | Системные параметры |
| `service_operations:execute` | Сервисные операции UI |
| `system_admin:restart` | Перезапуск процесса API |

### 4.7. Публичные endpoint (без JWT)

| Endpoint | Примечание |
|----------|------------|
| `GET /api/health`, `GET /api/health/db` | Мониторинг |
| `GET /api/config` | Публичное подмножество (без секретов); опционально урезать для анонима |

---

## 5. Матрица «роль × permission» (сводная)

Обозначения: **R** = read, **W** = write, **D** = delete, **E** = export, **X** = execute / спец. действие, **—** = нет доступа.

| Permission | VIEWER | ARCHITECT | DOMAIN_LEAD | REPOSITORY_ADMIN | SYSTEM_ADMIN |
|------------|:------:|:---------:|:-----------:|:----------------:|:------------:|
| **Governance** |
| `principle:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `adr_principle:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `adr_applied:read`, `export` | R,E | R,E | R,E* | R,E | R,E |
| `adr_applied:write`, `delete` | — | W,D | W,D* | W,D | W,D |
| `adr_applied:diagram:edit` | — | X | X* | X | X |
| `adr_applied:increment:write` | — | W | W* | W | W |
| `gap:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| **Business** |
| `organization_unit:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `actor:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `business_service:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `business_function:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `goals:read` | R | R | R* | R | R |
| **Application** |
| `system:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `system_function:*` | R | R,W,D | R,W,D* | R,W,D | R,W,D |
| `integration_flow:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `partner:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `employee:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| **Technology** |
| `technology:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `tech_radar:read` | R | R | R* | R | R |
| **Analytics** |
| `analytics:read` | R | R | R* | R | R |
| `dashboard:read` | R | R | R* | R | R |
| `metamodel_relation:*` | R,E | R,W,D,E | R,W,D,E* | R,W,D,E | R,W,D,E |
| `metamodel:rebuild` | — | — | — | X | X |
| **Settings** |
| `references:read` | R | R | R* | R,W | R,W |
| `references:write` | — | — | — | W | W |
| `metamodel_catalog:read` | R | R | R* | R,W | R,W |
| `metamodel_catalog:write` | — | — | — | W | W |
| `settings_parameters:read` | — | — | — | R | R |
| `settings_parameters:write` | — | — | — | W | W |
| `service_operations:execute` | — | — | — | X | X |
| `system_admin:restart` | — | — | — | — | X |

\* **DOMAIN_LEAD** — те же права, что у ARCHITECT, но с фильтром `scope=own_ou` на read/write/delete (фаза 2).

---

## 6. Матрица «меню и маршруты UI × permission»

| № | Раздел меню | Путь | Маршрут (name) | Просмотр | Создание / правка | Удаление | Доп. permission |
|---|-------------|------|----------------|:--------:|:-----------------:|:--------:|-----------------|
| | **Главная** |
| 1 | — | `/` | `home` | `dashboard:read` | — | — | |
| | **Управление архитектурой** |
| 2 | Архитектурные принципы | `/principles` | `principles` | `principle:read` | `principle:write` | `principle:delete` | export → `principle:export` |
| 3 | ADR (решения) | `/decisions/principle` | `decisions-principle` | `adr_principle:read` | `adr_principle:write` | `adr_principle:delete` | |
| 4 | ADR — новая/правка | `/decisions/principle/new`, `.../edit` | `decision-principle-*` | `adr_principle:read` | `adr_principle:write` | — | |
| 5 | Архитектурные заключения | `/decisions/applied` | `decisions-applied` | `adr_applied:read` | `adr_applied:write` | `adr_applied:delete` | |
| 6 | ADRA — новая/правка | `/decisions/applied/new`, `.../edit` | `decision-applied-*` | `adr_applied:read` | `adr_applied:write` | — | инкременты → `adr_applied:increment:write` |
| 7 | Редактор схемы | `/decisions/applied/diagram-editor` | `decision-applied-diagram-editor` | `adr_applied:read` | `adr_applied:diagram:edit` | — | save → API diagrams |
| 8 | Архитектурный долг | `/architecture-debt` | `architecture-debt` | `gap:read` | `gap:write` | `gap:delete` | |
| 9 | Долг — новая/правка | `/architecture-debt/new`, `.../edit` | `gap-*` | `gap:read` | `gap:write` | — | |
| | **Бизнес-архитектура** |
| 10 | Орг. единицы | `/organization-units` | `organization-units` | `organization_unit:read` | `organization_unit:write` | `organization_unit:delete` | |
| 11 | Заинтересованные лица | `/actors` | `actors` | `actor:read` | `actor:write` | `actor:delete` | |
| 12 | Продукты | `/business-services` | `business-services` | `business_service:read` | `business_service:write` | `business_service:delete` | |
| 13 | Бизнес-способности | `/business-functions` | `business-functions` | `business_function:read` | `business_function:write` | `business_function:delete` | |
| 14 | Цели и задачи | `/goals` | `goals` | `goals:read` | — | — | placeholder |
| | **Информационные системы** |
| 15 | Каталог ИС | `/systems` | `systems` | `system:read` | `system:write` | `system:delete` | модули = тот же `system:*` |
| 16 | Реестр интеграций | `/integrations` | `integrations` | `integration_flow:read` | `integration_flow:write` | `integration_flow:delete` | |
| | **Технологии** |
| 17 | Каталог технологий | `/technologies` | `technologies` | `technology:read` | `technology:write` | `technology:delete` | |
| 18 | Тех.радар | `/tech-radar` | `tech-radar` | `tech_radar:read` | — | — | iframe внешний URL |
| | **Аналитика** |
| 19 | Анализ зависимостей | `/analytics` | `analytics` | `analytics:read` | — | — | использует `metamodel_relation:read` + каталоги |
| 20 | Дашборды | `/dashboards` | `dashboards` | `dashboard:read` | — | — | |
| 21 | Справочник дашбордов | `/dashboards/catalog` | `dashboards-catalog` | `dashboard:read` | — | — | |
| 22 | Связи метамодели | `/metamodel-relations` | `metamodel-relations` | `metamodel_relation:read` | `metamodel_relation:write` | `metamodel_relation:delete` | |
| | **Настройки** |
| 23 | Справочники | `/references` | `references` | `references:read` | `references:write` | `references:write` | вкладки ADR/ИС/потоков/тех |
| 24 | Параметры | `/settings/parameters` | `settings-parameters` | `settings_parameters:read` | `settings_parameters:write` | `settings_parameters:write` | секреты — только read маской |
| 25 | Сервисные операции | `/settings/service-operations` | `settings-service-operations` | `service_operations:execute` | — | — | rebuild, restart |

**Реализация на фронте:** в `menu.js` / `meta` маршрута — `requiredPermissions: ['system:read']`; guard в `router.beforeEach`; кнопки «Создать», «Удалить», «Excel» — по `write` / `delete` / `export`.

---

## 7. Матрица «API × permission»

Группировка по префиксу API. Для всех CRUD: **GET** → `read`, **POST/PUT** → `write`, **DELETE** → `delete`, **?excel=1** → `export`.

### 7.1. Governance

| API | Permission |
|-----|------------|
| `GET/POST/PUT/DELETE /api/principles` | `principle:*` |
| `GET/POST/PUT/DELETE /api/decisions/principle` | `adr_principle:*` |
| `GET/POST/PUT/DELETE /api/decisions/applied` | `adr_applied:*` |
| `POST /api/decisions/applied/full`, `PUT .../full` | `adr_applied:write` |
| `GET/POST/PUT/DELETE /api/decisions/applied/:id/increments` | `adr_applied:increment:write` |
| `GET/POST/DELETE /api/increments/:id/systems` | `adr_applied:increment:write` |
| `GET/POST/PUT/DELETE /api/increments/:id/relations` | `adr_applied:increment:write` |
| `GET/POST/PUT/DELETE /api/increments/:incrementId/diagrams` | `adr_applied:diagram:edit` |
| `POST .../diagrams/:id/merge` | `adr_applied:diagram:edit` |
| `GET/PUT /api/adr-increment-systems/:rowId/function-selection` | `adr_applied:increment:write` |
| `GET/POST/PUT/DELETE /api/ar-gaps`, `.../relations` | `gap:*` |
| `GET/POST/PUT/DELETE /api/ar-gap-types`, `ar-impact-level-types`, `ar-gap-states` | `references:write` (справочники долга) |

### 7.2. Application

| API | Permission |
|-----|------------|
| `GET/POST /api/add-ar-systems`, `PUT /api/update-ar-systems/:id` | `system:write` |
| `GET /api/ar-systems`, `.../:id`, `parent-systems` | `system:read` |
| `GET/POST/DELETE /api/ar-systems/:id/system-functions` | `system_function:write` |
| `GET /api/system-functions` | `system_function:read` |
| `GET/POST/PUT/DELETE /api/integration-flows` | `integration_flow:*` |
| `GET/POST/PUT/DELETE /api/partners` | `partner:*` |
| `GET/POST/PUT/DELETE /api/ar-employees` | `employee:*` |
| `GET/POST/PUT/DELETE /api/systems-technologies` | `system:write` + `technology:read` |

### 7.3. Technology

| API | Permission |
|-----|------------|
| `GET/POST/PUT/DELETE /api/technologies` | `technology:*` |
| `GET/POST/PUT/DELETE /api/technology-classes`, `technology-statuses`, `technology-types` | `references:write` |

### 7.4. Business (TOGAF API)

| API | Permission |
|-----|------------|
| `GET/POST/PUT/DELETE /api/togaf/organization-units` | `organization_unit:*` |
| `GET/POST/PUT/DELETE /api/togaf/actors` | `actor:*` |
| `GET/POST/PUT/DELETE /api/togaf/business-services` | `business_service:*` |
| `GET/POST/PUT/DELETE /api/togaf/business-functions` | `business_function:*` |
| `GET/POST/PUT/DELETE /api/togaf/refs/*` | `references:write` |

### 7.5. Metamodel & Analytics

| API | Permission |
|-----|------------|
| `GET/POST/PUT/DELETE /api/togaf/relations` | `metamodel_relation:*` |
| `GET/POST/PUT/DELETE /api/togaf/entity-types`, `relation-types` | `metamodel_catalog:write` |
| `POST /api/togaf/metamodel/rebuild-integration-flow-projections` | `metamodel:rebuild` |
| `GET /api/dashboard/home-stats` | `dashboard:read` |

### 7.6. Settings & Admin

| API | Permission |
|-----|------------|
| `GET/POST/PUT/DELETE /api/settings-parameters` | `settings_parameters:*` |
| `GET/POST/PUT/DELETE /api/system-statuses`, `hosting-types`, `owners`, `adr-statuses`, `adr-system-statuses`, `adr-relation-statuses`, `classificators`, `system-assignments`, `integration-flow-event-types`, `integration-flow-statuses` | `references:write` (чтение списков для форм — `references:read` или наследование `*:read` каталога) |
| `GET /api/admin/restart-node/status` | `system_admin:restart` |
| `POST /api/admin/restart-node` | `system_admin:restart` (+ опционально секрет break-glass) |

### 7.7. Вспомогательные read для форм

Эндпоинты вроде `GET /api/system-statuses`, `GET /api/adr-statuses` используются при редактировании карточек. Варианты политики:

1. **Мягко:** доступны при любом `*:write` соответствующего домена;
2. **Строго:** отдельно `references:read`.

Рекомендация для фазы 1: **мягко** (меньше 403 на формах).

---

## 8. Матрица «действия UI × permission»

| Действие в UI | Permission |
|---------------|------------|
| Открыть список | `<resource>:read` |
| Открыть карточку | `<resource>:read` |
| Кнопка «Создать» | `<resource>:write` |
| Кнопка «Сохранить» | `<resource>:write` |
| Кнопка «Удалить» | `<resource>:delete` |
| «Выгрузить в Excel» | `<resource>:export` |
| «Открыть схему» / редактор Draw.io | `adr_applied:diagram:edit` |
| Добавить инкремент / систему в ADRA | `adr_applied:increment:write` |
| «Пересобрать проекции интеграций» | `metamodel:rebuild` |
| «Перезапустить API» | `system_admin:restart` |
| Просмотр параметра с `is_secret` | `settings_parameters:read` (значение маскируется) |
| Изменение секретного параметра | `settings_parameters:write` + только из env (без записи значения в БД) |

---

## 9. Модель данных

### 9.1. Рекомендуемый гибрид

| Компонент | Где хранить |
|-----------|-------------|
| Роли | Keycloak (основной источник) |
| Permissions | Код приложения (константы) + документация (этот файл) |
| Пользователь | `ar_app_users` |
| Аудит | `ar_audit_log` |
| Переопределения | `ar_user_roles` (опционально, если не только KC) |

### 9.2. Черновик таблиц

```sql
-- Учётная запись приложения (не ar_employees)
ar_app_users (
  id, keycloak_sub UNIQUE, email, display_name,
  employee_id NULL REFERENCES ar_employees(id),
  is_active, created_at, updated_at
);

ar_roles (id, code UNIQUE, name, description);
ar_permissions (id, code UNIQUE, description);
ar_role_permissions (role_id, permission_id, PRIMARY KEY (role_id, permission_id));
ar_user_roles (user_id, role_id);  -- опционально

ar_audit_log (
  id, occurred_at, user_id, user_email,
  action, resource_type, resource_id,
  http_method, path, details jsonb, ip
);
```

### 9.3. Endpoint идентификации

`GET /api/auth/me` → `{ user, roles, permissions[], employee? }` — для фронта после логина.

---

## 10. Реализация проверок

### 10.1. Backend

1. Middleware `authenticateJwt` — проверка Bearer, заполнение `req.user`.
2. Middleware `requirePermission('system:write')` — проверка списка permissions из ролей.
3. По умолчанию **deny** для `/api/*`, кроме whitelist: health, config (публичное), auth callback.
4. Логирование отказов 403 и критичных 200 (rebuild, restart, delete).

### 10.2. Frontend

1. После логина — загрузка `/api/auth/me`.
2. Фильтрация `menu.js` по permissions.
3. `router.beforeEach` — редирект на `/forbidden`.
4. `v-if` на кнопках по permissions.

### 10.3. Draw.io

- Embed `/drawio/` может оставаться без auth на уровне nginx.
- **Сохранение** mxfile — только через API с JWT (`adr_applied:diagram:edit`).

---

## 11. Этапы внедрения

| Этап | Содержание | Критерий готовности |
|------|------------|---------------------|
| 0 | Согласование матрицы (этот документ) | Подписан владельцем продукта |
| 1 | Keycloak + JWT + `/api/auth/me` | Без токена API → 401 |
| 2 | RBAC на write/delete и rebuild/restart | Нет анонимных изменений данных |
| 3 | UI: меню, кнопки, guards | Нет «ложных» кнопок |
| 4 | `ar_audit_log` | Трассируемость rebuild/ADR |
| 5 | DOMAIN_LEAD + scope OU | Фильтр списков по OU |

---

## 12. Открытые решения

1. Анонимный read на demo или обязательный login?
2. `GET /api/config` — полностью публичный или только после auth?
3. Экспорт Excel — отдельное `export` или часть `read`?
4. Управление ролями — только Keycloak или дублирование в UI?
5. Break-glass: оставить `ADMIN_API_RESTART_SECRET` вместе с `system_admin:restart`?
6. DOMAIN_LEAD: привязка к OU через `ar_employees` или отдельная таблица `ar_user_organization_units`?

---

## 13. Связь с текущими задачами

| Задача / файл | Действие |
|---------------|----------|
| `metamodel-rebuild-rbac-ux.md` | Первый endpoint: `metamodel:rebuild` + аудит |
| `settings-parameters-design.md` | Параметры `AR_Keycloak_*`, таймаут сессии |
| `infra/demo/env.demo` | Не хранить роли в env; только флаги SSO |
| Demo-стенд | Убрать `ALLOW_INSECURE_RESTART_WITHOUT_SECRET` после роли `SYSTEM_ADMIN` |

---

## Приложение A. Маппинг permission → сущность БД

| Permission prefix | Таблица / объект |
|-------------------|------------------|
| `system` | `ar_systems` |
| `system_function` | `ar_system_functions` |
| `technology` | `ar_technologies` |
| `integration_flow` | `ar_integration_flows` |
| `principle` | `ar_principles` |
| `adr_principle` | `ar_adrs_principle` |
| `adr_applied` | `ar_adrs_applied` |
| `gap` | `ar_gaps` |
| `organization_unit` | `ar_organization_units` |
| `actor` | `ar_actors` |
| `business_service` | `ar_business_services` |
| `business_function` | `ar_business_functions` |
| `partner` | `ar_partners` |
| `employee` | `ar_employees` |
| `metamodel_relation` | `ar_metamodel_relations` |
| `metamodel_catalog` | `ar_metamodel_entity_types`, `ar_metamodel_relation_types` |

---

## Приложение B. Пример claims JWT (Keycloak)

```json
{
  "sub": "uuid",
  "email": "architect@example.com",
  "preferred_username": "architect",
  "realm_access": { "roles": ["ARCHITECT"] },
  "resource_access": {
    "isar-api": { "roles": ["ARCHITECT"] }
  }
}
```

Маппинг role → permissions выполняется в API при старте (таблица соответствия в коде или БД).
