# Версионирование ядра ИСАР (issue #96)

Статус: **реализовано (MVP)**. Источник версии — git-тег; `package.json` — производная.
Проверка обновлений **не реализуется** (решение: офлайн-инсталляции); всё остальное — ниже.

## 1. Принципы (SemVer)

| Bump | Что входит | Пример |
|---|---|---|
| **MAJOR** | ломающие изменения публичных контрактов: REST API (пути/обязательные поля/формат ответа), коды RBAC-прав, несовместимая схема БД | удалили поле из ответа, переименовали endpoint |
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
2. **CI** (`.github/workflows/ci.yml`): `npm test`, `npm run check:routes`, сборка фронта.
3. **Release Please** (`.github/workflows/release-please.yml`) на push в `main`:
   - читает коммиты с последнего тега, определяет bump;
   - создаёт/обновляет **один** PR `chore: release X.Y.Z` с изменениями только в
     `CHANGELOG.md`, `package.json`, `frontend-v3/package.json`, `.release-please-manifest.json`.
4. **Утверждение release notes (владелец продукта)**: правки формулировок прямо в PR,
   для MAJOR — раздел «Что сделать администратору»; затем merge.
5. После merge Release Please ставит тег `vX.Y.Z` и создаёт GitHub Release;
   workflow `release-notes.yml` прикладывает к релизу `release-notes.md` (front-matter + секция CHANGELOG).
   В `release-please-config.json` зафиксировано `"include-v-in-tag": true` и
   `"include-component-in-tag": false` — иначе Release Please в manifest-режиме делает тег
   `archrep-vX.Y.Z`, который **не совпадает** с `git describe --exact-match` у гейта деплоя
   (`$version = $tag -replace '^v',''`), и ищет предыдущий релиз не по тому имени (→ «шумный» CHANGELOG).
6. Деплой — только этого тега (§4).
7. Сайт (`archrep-site`) забирает `release-notes.md` → страница «Новости» + RSS.

Повлиять на версию: пустой коммит с футером `Release-As: 2.0.0` (для «забыли `!`» или hotfix).

### 3.0. Настройка Release Please в этом репозитории (проверено 2026-11-05)

RP в manifest-режиме перестаёт выпускать тег, если конфигурация не соответствует схеме тегов.
Проверенный рабочий набор:

| Настройка | Значение | Зачем |
|---|---|---|
| `permissions` воркфлоу | `contents: write`, `pull-requests: write`, **`issues: write`** | метки `autorelease: pending/tagged` ставятся через Issues API; без `issues: write` PR остаётся «pending» и RP падает |
| `separate-pull-requests` | **не задавать** | при `false` подключается плагин Merge, который находит уже смерженный PR и прерывает прогон (`There are untagged, merged release PRs outstanding - aborting`) — тег не создаётся |
| `include-component-in-tag` | `false` | иначе тег `archrep-vX.Y.Z` не совпадает с гейтом деплоя и RP не находит прошлые релизы |
| `last-release-sha` | коммит последнего выпущенного релиза | RP строит диапазон коммитов от него; нужен после перехода с ручных тегов |

Диагностика «тег не создался» — по логу прогона: `Merging 1 pull requests`/`aborting` (плагин Merge),
`No latest release found` (схема тегов), `adding labels: autorelease: tagged` (успех).

Имя ветки релизного PR содержит компонент (`release-please--branches--main--components--archrep`),
поэтому PR искать **по метке** `autorelease: pending`, а не по `--head`.

### 3.1. Автоматизация по триггерам

Фразы «коммит, пуш», «релиз», «задеплой» — явное разрешение выполнить действия без переспрашивания:

| Триггер | Действия |
|---|---|
| «коммит», «пуш» | тесты + `check:routes` → `git add -A` → conventional commit → `git push` (при reject: fetch + backup-ветка + rebase) |
| «релиз», «новая версия» | найти/смержить релизный PR Release Please → подтвердить тег; если PR нет — предложить версию и дождаться «ок» |
| «задеплой», «на прод» | проверить тег и чистоту → `deploy_local.bat` → отчёт `[precheck]` / `/api/version` |

Правило зафиксировано в `.clinerules` (Cline) и `.cursor/rules/git-release-automation.mdc` (Cursor).

## 4. Деплой: гейт с режимами (deploy_local.bat == прод)

`infra/prod/deploy.bat` перед упаковкой вызывает `infra/prod/deploy-precheck.ps1`.
Режим задаёт `-Gate strict|ahead|dirty` или env `DEPLOY_GATE`; **по умолчанию `strict`**.

| Проверка | strict | ahead | dirty |
|---|---|---|---|
| грязное дерево (кроме `.env*`, `deploy_*`, `temp/`, `frontend-v3-dist/`, `docs/exports/`) | **стоп** | **стоп** | разрешено, помечается |
| незапушенные коммиты (`HEAD` ≠ upstream) | **стоп** | **стоп** | **стоп** |
| `HEAD` не на теге (N коммитов впереди) | **стоп** | разрешено, версия `X.Y.Z+N.g<sha>` | разрешено |
| `package.json.version` ≠ базовый тег | **стоп** | **стоп** | **стоп** |

Состояние деплоя передаётся в образ (`APP_DEPLOY_STATE`, `APP_BASE_TAG`, `APP_AHEAD_COMMITS`,
`APP_DIRTY_FILES`) и отдаётся в `GET /api/version`:

```json
"deploy": { "state": "ahead", "base_tag": "v4.0.1", "ahead_commits": 3,
            "dirty_files": 0, "warn_mode": "admin" }
```

Правила:
* `state=release` — канал `stable`; `state=ahead|dirty` — канал `dev` (даже если `APP_CHANNEL=stable`);
* образ для ahead/dirty называется `ar-api-image:X.Y.Z-N.g<sha>[-dirty]` (Docker не допускает `+`);
* страница «О системе» показывает пометку «Деплой не из релиза» / «Грязный деплой»;
  кому видно — параметр `SYS_DEPLOY_WARN_MODE` (`off|admin|all`, по умолчанию `admin`);
* `ahead` применяется **осознанно** (hotfix до релиза): `deploy_local.bat ahead`
  (аргумент пробрасывается в precheck) или `set DEPLOY_GATE=ahead`;
* `dirty` — аварийный режим (код вне git, сборка не воспроизводима): `deploy_local.bat dirty`
  с предварительным `set CONFIRM_DIRTY=1`; применять только по решению и с записью diff в артефакт.

Только при успехе собирается образ `ar-api-image:<APP_IMAGE_TAG>` (и `:latest`), запускается
**именно этот тег**; после health-check печатается `GET /api/version`. Откат:

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
          "applied_at": "…", "pending": [], "warn_mode": "admin" }
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

Источник новости — `release-notes.md` (asset GitHub Release, front-matter `title/date/version/tag/channel`).
Синхронизация — отдельным скриптом в репозитории сайта (`scripts/sync-news.mjs`), затем `astro build`
(страница «Новости» + RSS). Релизы с `channel: rc` не публикуются.

Как собирается asset (`scripts/release-notes.js` + `.github/workflows/release-notes.yml`):

* текст берётся из **тела GitHub Release** (`--body-file`; согласованные формулировки), fallback —
  секция `CHANGELOG.md` на теге (`--from-release`/локальный запуск без gh — CHANGELOG);
* **служебные релизы** (в теле только `Служебное → release X.Y.Z`) заменяются шаблоном
  «только служебные изменения, пользовательских изменений нет» — чтобы на сайте не появлялась
  пустая новость;
* workflow запускается: (1) событием `release: published` для релизов, созданных вручную;
  (2) `workflow_dispatch` с input `tag`; (3) **из `release-please.yml`** (`workflow_call`) — потому что
  релиз, созданный RP через `GITHUB_TOKEN`, не порождает событие `release` (защита от рекурсии);
* пересобрать asset для существующего тега: `gh workflow run release-notes.yml -f tag=vX.Y.Z`.

## 9. Чек-лист релиза (владелец продукта)

1. Смержить изменения в `main` (CI зелёный).
2. Дождаться PR от `github-actions[bot]` `chore: release X.Y.Z` (искать по метке `autorelease: pending`).
3. Проверить bump и состав файлов PR (только версии + CHANGELOG).
4. **Согласовать release notes — стоп-шаг: без «ок» владельца PR не мержить.** Текст notes = `scope` +
   `subject` согласованных коммитов (`feat`/`fix`/`perf`, блок `BREAKING CHANGE`); согласование идёт
   **до** коммита — `.clinerules` §1 п.4 (после пуша сообщение не переписывается). На релизе показать
   секцию CHANGELOG из PR и сверить с этими `subject`-ами; для MAJOR — добавить «Что сделать администратору».
   `CHANGELOG.md` в PR правится только по просьбе владельца (после последнего прогона RP и сразу мерж),
   «нарратив» — после релиза в body релиза. Источник asset для сайта — **body релиза**.
5. Merge PR → RP создаёт тег и Release, отдельный job собирает `release-notes.md` (workflow_call);
   проверить `git fetch --tags` и `gh release view vX.Y.Z` (asset на месте).
6. `deploy_local.bat` → в логе `[precheck] OK (state)`, `[version]`, образ `ar-api-image:<APP_IMAGE_TAG>`,
   в конце — `GET /api/version` (включая `deploy.state`).
7. Открыть `/about`: версия/схема/состояние деплоя без красных плашек (пометка «не из релиза» — норма
   только для режима `ahead`).
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

