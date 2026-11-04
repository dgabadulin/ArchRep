# Версионирование ядра ИСАР (issue #96)

Статус: **реализовано (MVP)**. Источник версии — git-тег; `package.json` — производная.
Проверка обновлений **не реализуется** (решение: офлайн-инсталляции); всё остальное — ниже.

## 1. Принципы (SemVer)

| Bump | Что входит | Пример |
|---|---|---|
| **MAJOR** | ломающие изменения публичных контрактов: REST API (пути/обязательные поля), коды RBAC-прав, контракт подключаемых модулей (`docs/modules-contract.md` §11), несовместимая схема БД | удалили поле из ответа, переименовали endpoint |
| **MINOR** | новые эндпоинты/поля/реестры/точки расширения; старые клиенты и модули работают | новый реестр, новое право |
| **PATCH** | исправления, тексты, стили | фикс сортировки |

Отдельные оси (не путать с версией продукта):

| Ось | Где | Зачем |
|---|---|---|
| версия продукта | тег `vX.Y.Z`, `package.json` | то, что видит заказчик |
| версия схемы БД | `archrep.ar_schema_info.version` (14-значный префикс миграции) | ловить «код новее схемы» |
| версия контракта модулей | `backend/version.js` → `CONTRACT_VERSION` | против неё модули сверяют `requiresCore` |

## 2. Источник версии и каналы

```
git tag v3.0.1 ──► package.json (bump делает Release Please)
                ──► deploy.bat: --build-arg APP_VERSION/APP_COMMIT/APP_BUILD_TIME
                ──► GET /api/version, /api/health, «О системе»
```

- `APP_VERSION` (env) важнее `package.json`; если не задан — берётся `package.json`.
- Суффикс `+<n>.g<sha>` — коммиты после тега; `+dirty.<sha>` — грязное дерево (в прод не попадает, см. §4).
- Каналы: `stable` (тег без суффиксов), `rc` (`-rc.N`), `dev` (суффикс/не тег).

## 3. Процесс изменения (как это работает)

1. Коммит в `main` в формате **Conventional Commits**:
   `feat(ui): …`, `fix(registry): …`, `perf: …`, `docs: …`;
   ломающее — `feat!:` или тело `BREAKING CHANGE: <что сломано и что делать>`.
2. **CI** (`.github/workflows/ci.yml`): `npm test`, `npm run check:routes`, `npm run modules:status`, сборка фронта.
3. **Release Please** (`.github/workflows/release-please.yml`) на push в `main`:
   - читает коммиты с последнего тега, определяет bump;
   - создаёт/обновляет **один** PR `chore: release X.Y.Z` с изменениями только в
     `CHANGELOG.md`, `package.json`, `frontend-v3/package.json`, `.release-please-manifest.json`.
4. **Утверждение release notes (владелец продукта)**: правки формулировок прямо в PR,
   для MAJOR — раздел «Что сделать администратору»; затем merge.
5. После merge Release Please ставит тег `vX.Y.Z` и создаёт GitHub Release;
   workflow `release-notes.yml` прикладывает к релизу `release-notes.md` (front-matter + секция CHANGELOG).
6. Деплой — только этого тега (§4).
7. Сайт (`archrep-site`) забирает `release-notes.md` → страница «Новости» + RSS.

Повлиять на версию: пустой коммит с футером `Release-As: 2.0.0` (для «забыли `!`» или hotfix).

### 3.1. Автоматизация по триггерам

Фразы «коммит, пуш», «релиз», «задеплой» — явное разрешение выполнить действия без переспрашивания:

| Триггер | Действия |
|---|---|
| «коммит», «пуш» | тесты + `check:routes` → `git add -A` → conventional commit → `git push` (при reject: fetch + backup-ветка + rebase) |
| «релиз», «новая версия» | найти/смержить релизный PR Release Please → подтвердить тег; если PR нет — предложить версию и дождаться «ок» |
| «задеплой», «на прод» | проверить тег и чистоту → `deploy_local.bat` → отчёт `[precheck]` / `/api/version` |

Правило зафиксировано в `.clinerules` (Cline) и `.cursor/rules/git-release-automation.mdc` (Cursor).

## 4. Деплой: строгий гейт (deploy_local.bat == прод)

`infra/prod/deploy.bat` перед упаковкой вызывает `infra/prod/deploy-precheck.ps1`:

| Проверка | Поведение |
|---|---|
| грязное дерево (кроме `.env*`, `deploy_*`, `modules/`, `temp/`, `frontend-v3-dist/`, `docs/exports/`) | **стоп**, список файлов |
| незапушенные коммиты (`HEAD` ≠ upstream) | **стоп** |
| `HEAD` не на теге | **стоп** (деплой только по тегу) |
| `package.json.version` ≠ тег | **стоп** (значит, релизный PR не смержен) |

Только при успехе собирается образ `ar-api-image:<version>` (и `:latest`), запускается **именно тег**;
после health-check печатается `GET /api/version`. Откат:

```cmd
docker stop ar-api-container && docker rm ar-api-container
docker run -d --restart=always --env-file .env.production -e SERVER_PORT=3000 -p 3000:3000 ^
  --name ar-api-container --network ar-network ar-api-image:<предыдущая версия>
```

Образы с тегами не удаляются (`docker image prune -f` чистит только dangling).

## 5. Схема БД и предупреждение о миграциях

Prod-скрипты накатываются **вручную** (`psql -f DB/scripts/…`), поэтому `public.pgmigrations`
(node-pg-migrate) в prod не отражает реальность. Введён маркер:

```sql
-- archrep.ar_schema_info(code='core', version, applied_at, applied_by)
```

**Правило:** каждый новый `DB/scripts/migrate_<ts>_*.sql` заканчивается

```sql
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '<ts>', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version, applied_at = now(), applied_by = EXCLUDED.applied_by;
```

Тогда маркер обновляется и при ручном накате, и через `npm run db:migrate` (demo).

`GET /api/version` → `db`:

| Поле | Значение |
|---|---|
| `source` | `schema_info` → `pgmigrations` → `unknown` |
| `schema_version` | версия последней применённой миграции |
| `applied_at` | когда применена |
| `pending` | массив неприменённых миграций; `null` — «неизвестно» (схема не отслеживается) |
| `warn_mode` | `off` / `admin` / `all` — кому показывать плашку в UI |

Параметр `SYS_DB_SCHEMA_WARN_MODE` (Настройки → Параметры, группа «Система», дефолт `admin`):
`off` — плашку не показываем никому; `admin` — только тем, кто может применить скрипты
(`settings_parameters:write` / `system_admin:restart`); `all` — всем. На сам ответ API режим не влияет:
факты доступны всегда (нужны поддержке).

## 6. Публичный API

```http
GET /api/health   → { "ok": true, "version": "3.1.0" }
GET /api/version  → {
  "product": "ИСАР", "version": "3.1.0", "channel": "stable",
  "commit": "826a27b", "build_time": "2026-11-02T20:00:00Z",
  "contract_version": "1.0",
  "db": { "source": "schema_info", "schema_version": "20261105120000",
          "applied_at": "…", "pending": [], "warn_mode": "admin" },
  "modules": { "drawio-pro": { "version": "0.1.0", "enabled": true, "licensed": true } }
}
```

Оба маршрута **публичные** (в `PUBLIC_PATHS`), секретов не содержат.

## 7. UI «О системе»

`/about` («Справка → О системе», без RBAC-права) показывает версию, коммит, время сборки,
контракт модулей, состояние схемы БД и модули. Плашки:

| Условие | Плашка |
|---|---|
| `channel != stable` | «нерелизная сборка» |
| версия интерфейса ≠ версия API | «обновите страницу (кеш)» |
| `db.pending.length > 0` и режим разрешает | «код новее схемы БД — примените скрипты» |

## 8. Сайт (archrep-site, Astro)

Источник новости — `release-notes.md` из GitHub Release (front-matter `title/date/version/tag/channel`).
Синхронизация — отдельным скриптом в репозитории сайта (`scripts/sync-news.mjs`), затем `astro build`
(страница «Новости» + RSS). Релизы с `channel: rc` не публикуются.

## 9. Чек-лист релиза (владелец продукта)

1. Смержить изменения в `main` (CI зелёный).
2. Дождаться PR от `github-actions[bot]` `chore: release X.Y.Z`.
3. Проверить bump и состав файлов PR (только версии + CHANGELOG).
4. Отредактировать формулировки; для MAJOR — добавить «Что сделать администратору».
5. Merge PR → появился тег и Release (проверить `git fetch --tags`).
6. `deploy_local.bat` → в логе `[version] vX.Y.Z`, образ `ar-api-image:X.Y.Z`, в конце — `GET /api/version`.
7. Открыть `/about` на стенде: версия/схема/модули без красных плашек.
8. При необходимости — применить новые `DB/scripts/*.sql` (вручную) и обновить страницу.

## 10. Диагностика

| Симптом | Причина | Действие |
|---|---|---|
| deploy: `Working tree is dirty` | незакоммиченные правки (кроме allowlist) | закоммитить/откатить; деплой из грязного дерева запрещён |
| deploy: `HEAD is not tagged` | деплой не с тега | сделать релиз (Release Please) |
| deploy: `package.json version != tag` | релизный PR не смержен | смержить релизный PR |
| deploy: `N local commit(s) not pushed` | забыли `git push` | запушить |
| `/api/version` → `db.source=unknown` | маркер не применён (старая БД) | применить `DB/scripts/migrate_20261104120000_schema_info.sql` |
| плашка «код новее схемы» | код из нового тега, скрипты не накатаны | применить скрипты; при необходимости `SYS_DB_SCHEMA_WARN_MODE=off` |
| плашка «версия интерфейса ≠ API» | кеш браузера/CDN | Ctrl+F5 |
| Release Please не создал PR | нет `feat/fix` в коммитах; нет прав у workflow; рассинхрон manifest | см. лог Actions |

