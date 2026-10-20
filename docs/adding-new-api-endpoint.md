# Добавление нового API-маршрута (endpoint) в ИСАР

Документ описывает, что нужно согласовать при появлении **нового HTTP-маршрута** в backend: как он попадает под RBAC, какие права завести, где зарегистрировать и как проверить.

> Кратко для ИИ-ассистента: `.cursor/rules/route-permissions-required.mdc`.

---

## 1. Главное правило: deny by default

В проекте **все `/api/*` запрещены по умолчанию**, кроме явного whitelist (`PUBLIC_PATHS` в `backend/auth/routePermissions.js`: health, login, oidc, публичный config).

Middleware (`backend/auth/middleware.js`) на каждый запрос вызывает `resolveRequiredPermissions(method, path, query)`:

- **есть подходящее правило** → проверяются права (AND/anyOf);
- **нет правила** (`null`) → **403 «Недостаточно привилегий»** с пометкой `<no-permission-mapping>` — **для всех, включая `SYSTEM_ADMIN`**.

> ⚠️ **Следствие:** сам факт добавления `app.post('/api/...')` в `index.js` ещё не делает маршрут доступным. Без правила он «молча» отдаёт 403.

---

## 2. Чек-лист при добавлении маршрута

1. **Маршрут в `backend/index.js`** (или в роутере: `authRoutes.js` / `adminRoutes.js` / `jobsRoutes.js`).
2. **Правило в `routePermissions.js`** — в массив `RULES` (см. §3).
3. **Права** — если нужен новый код, добавить в `permissionsCatalog.js` (`ALL_PERMISSIONS` + матрица ролей `VIEWER` / `ARCHITECT` / …), см. §4.
4. **Перезапуск API** — `bootstrapAuth` при старте синхронизирует **`ar_permissions`** и `ar_role_permissions` из каталога (см. §4).
5. **Фронт** (если маршрут вызывается из UI) — метод в `frontend-v3/src/api/client.js`; при необходимости `requiredPermission` в `menu.js` / `meta` роута и `usePermissions(...)` на кнопках.
6. **Проверка** (см. §6): запустить `npm run check:routes` — не должно быть непокрытых маршрутов и неизвестных прав.

---

## 3. Как задать правило в `routePermissions.js`

Правила просматриваются **по порядку**, берётся **первое подходящее**. Поля правила:

| Поле | Смысл |
|------|-------|
| `methods` | список HTTP-методов правила |
| `pattern` | `RegExp` пути (хелперы `re(prefix)`, `listPath(prefix)`) |
| `permissions` | все коды обязательны (AND) |
| `anyOf` | достаточно одного кода (lookup / срез карточки) |
| `requireQuery` | правило матчится, только если query-ключи непусты |
| `exportPermission` | при `?excel=1\|true` подменяет требуемое право на `:export` |

Хелперы:

| Хелпер | Для чего | Пример |
|--------|----------|--------|
| `crud(prefix, resource)` | полный CRUD реестра (`read`/`write`/`delete` + export на GET) | `...crud('/api/togaf/domains', 'domain')` |
| `listLookup(prefix, export, anyOf)` | GET списка для FK/select (anyOf) | `listLookup('/api/ar-systems', 'system:export', SYSTEM_FK_READS)` |
| `refLookup(prefix, ...hostReads)` | GET справочника host-типа | `refLookup('/api/system-statuses', 'system:read')` |
| `refCrud(prefix)` | CRUD справочника в `ReferencesV2` (`references:read` / `:write`) | `...refCrud('/api/adr-system-statuses')` |

Примеры для разных случаев:

```js
// Реестр с CRUD (права <resource>:read/write/delete):
...crud('/api/togaf/domains', 'domain'),

// Справочник статусов в разделе «Справочники»:
refLookup('/api/adr-system-function-statuses', 'adr_applied:read'),
...refCrud('/api/adr-system-function-statuses'),

// GET-выборка/срез для карточки — anyOf:
{ methods: ['GET'], pattern: re('/api/togaf/refs'), anyOf: ['references:read', ...OU_FK_READS] },

// Массовая сервисная операция:
{ methods: ['POST'], pattern: /^\/api\/togaf\/metamodel\/rebuild/, permissions: ['metamodel:rebuild'] },
```

---

## 4. Права: `permissionsCatalog.js` и таблица `ar_permissions`

Если маршруту нужен **новый код** права:

1. Добавить в **`ALL_PERMISSIONS`** (`backend/auth/permissionsCatalog.js`): `<resource>:read`, `:write`, `:delete`, `:export` (по принятому префиксу).
2. Обновить **матрицу ролей** (`ROLE_PERMISSIONS` в том же файле):
   - `VIEWER`: минимум `:read` (+ `:export` через `reExport`);
   - `ARCHITECT`: `fullCrud('<resource>')`;
   - админ-роли: как принято в проекте.
3. **Применить в БД** — перезапустить API: `bootstrapAuth` → `ensureRolesAndPermissions` при старте
   создаёт/обновляет строки прав в таблице **`ar_permissions`** и связи `ar_role_permissions`.

### Как это работает в БД (`ar_permissions`)

`backend/auth/bootstrapAuth.js` при **старте API** синхронизирует каталог с БД:

- **`ar_roles`** — `INSERT … ON CONFLICT (code) DO UPDATE` (имя/описание/is_active включаются);
- **`ar_permissions`** — `INSERT … ON CONFLICT (code) DO NOTHING` (⚠️ **только вставка новых кодов**; существующие не обновляются и **не удаляются**);
- **`ar_role_permissions`** — матрица «роль → право» из `ROLE_PERMISSIONS` (`ON CONFLICT DO NOTHING`),
  а для `SYSTEM_ADMIN` — пересобирается полностью (права всегда = весь `ALL_PERMISSIONS`).

> ⚠️ **Важно (для изменения/удаления):** из-за `DO NOTHING` и отсутствия удаления **снятие кода из
> `ALL_PERMISSIONS` само по себе не убирает его из `ar_permissions` и из `ar_role_permissions`.**
> Лишние права нужно чистить явно (см. §7 про удаление) — иначе они остаются «висеть» в матрице роли.

### Если подходит существующее право

Частый случай для справочников хоста — `references:read/write` (через `refLookup` / `refCrud`),
либо host-право (`adr_applied:read` и т.п.). Тогда **новые коды не нужны**, `ar_permissions` не меняется.

---

## 5. Изменение существующей функциональности

При **изменении** маршрута (путь, метод, права) — синхронно проверить RBAC:

| Что меняется | Что проверить/поправить |
|--------------|--------------------------|
| Путь/префикс маршрута | Обновить `pattern`/`re(prefix)` в правиле `routePermissions.js`. Старое правило убрать, чтобы не матчило лишнее. |
| Метод (напр. было `GET`, стало `GET+PUT`) | Дополнить `methods` в правиле. |
| Ужесточение/смена прав | Обновить `permissions`/`anyOf`; при новых кодах — §4. |
| Маршрут вынесен в отдельный роутер | Учесть префикс `app.use('/api/…', router)` в правиле. |
| Изменился срез/lookup (`anyOf`) | Проверить, что все «хост-права» по-прежнему актуальны (кто вызывает из UI). |

Правило: **изменение кода маршрута и правила RBAC — один и тот же коммит.** Не закрывать задачу, пока правило не соответствует фактическому пути/методу и `npm run check:routes` не проходит.

> Проверка «нужны ли изменения в RBAC»: если меняется **что/как доступно** (путь, метод, набор прав, кто вызывает) — правило почти всегда затрагивается; если меняется только тело обработчика (логика внутри того же маршрута) — RBAC не трогаем.

---

## 6. Проверка: нет ли непокрытых маршрутов

Автопроверка — скрипт **`scripts/check-route-permissions.js`**:

```bash
npm run check:routes
```

Что делает:
- собирает все `app.get/post/put/patch/delete('/api/…')` из `backend/index.js` и роутеров (с учётом монтирования `app.use('/api/…', router)`);
- для каждого `method + path` вызывает `resolveRequiredPermissions` — если `null`, печатает **«НЕ ПОКРЫТ»**;
- печатает список кодов прав, **используемых в `RULES`, но отсутствующих в `ALL_PERMISSIONS`** (забыли добавить в каталог);
- при находках завершается с **кодом 1** (удобно для CI/локальной проверки).

Идея на Node (если пишете разовую проверку):

```js
const perm = require('./backend/auth/routePermissions');
// для каждого { method, path } из app.get/post/... и роутеров:
const required = perm.resolveRequiredPermissions(method, path, {});
if (required === null) console.log('НЕ ПОКРЫТ:', method, path);
```

Правила учёта:
- пути роутеров предваряются их монтированием (`app.use('/api/admin', ...)` и т.п.);
- `PUBLIC_PATHS` считаются покрытыми;
- для GET со срезами проверяйте и `requireQuery`-правила (передавайте нужные query).

---

## 7. Удаление функциональности

Удаление маршрута/функции — это **не только delete кода**. Чек-лист:

1. **Убрать маршрут** из `backend/index.js` (или роутера).
2. **Убрать правило** из `RULES` в `routePermissions.js` (иначе висит «мёртвое» правило; для `refCrud`/`crud` — убрать соответствующий вызов хелпера).
3. **Права:** если код права больше не используется нигде — убрать из `ALL_PERMISSIONS` и из `ROLE_PERMISSIONS` в `permissionsCatalog.js`.
4. **БД (`ar_permissions` / `ar_role_permissions`) — почистить явно**, т.к. `bootstrapAuth` **не удаляет** (см. §4):
   - удалить связь с ролью: `DELETE FROM archrep.ar_role_permissions WHERE permission_id = (SELECT id FROM archrep.ar_permissions WHERE code = '<code>');`
   - деактивировать или удалить право: `UPDATE archrep.ar_permissions SET is_active = false WHERE code = '<code>';` (или `DELETE`, если прав нет у пользователей),
   - после — перезапуск API (bootstrap пересоберёт `SYSTEM_ADMIN`; при желании — миграция `DB/scripts/*.sql` + `DB/migrations/*.js`, см. правило dual).
5. **Фронт:** убрать метод из `client.js`, пункт меню, роут, кнопки и `usePermissions(...)`.
6. **Проверка:** `npm run check:routes` (нет висячих правил и неизвестных прав).

> ⚠️ Осторожно с удалением права, которое могли назначить роли в UI: сначала проверьте `ar_role_permissions` и роли в разделе «Пользователи/Роли».

---

## 8. Типовые ошибки

| Симптом | Причина |
|---------|---------|
| 403 у всех ролей, в теле `<no-permission-mapping>` | для маршрута нет правила в `routePermissions.js` |
| 403 только у части ролей | правило есть, но роль не получает требуемый код (см. матрицу в `permissionsCatalog.js`) |
| GET работает, POST/PUT — нет | в правиле указан только `methods: ['GET']`; добавьте нужные методы |
| `?excel=1` «падает» по правам | не задан `exportPermission` у правила чтения |
| Роут в новом роутере недоступен | не учтён префикс монтирования `app.use('/api/...', router)` |
| Право «висит» в роли после удаления из каталога | `bootstrapAuth` не удаляет из `ar_permissions`/`ar_role_permissions` — нужна явная чистка (§7) |

---

## См. также

- [access-control-design.md](./access-control-design.md) — RBAC: роли, permissions, deny-by-default (§10).
- [adding-new-entity-type.md](./adding-new-entity-type.md) — добавление нового **типа сущности** (данные, API, права, фронт).
- `.cursor/rules/route-permissions-required.mdc` — краткое правило для ИИ-ассистента.