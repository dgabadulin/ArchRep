# Развёртывание demo-стека (с GitHub до рабочего сервера)

Полный путь: клонирование репозитория → настройка переменных → деплой по SSH с Windows на Linux-хост с Docker. В стек входят **PostgreSQL 17**, **API** (порт 3000), **Draw.io** (порт 8080); после подъёма Postgres выполняется **импорт дампа** `DB/schema/demo/dump-archrep.sql`.

---

## 1. Что должно быть заранее

### На вашей машине (деплой с Windows)

- **Git** и клонирование по HTTPS/SSH с GitHub.
- **OpenSSH** (`ssh`, `scp`) — обычно уже есть в Windows 10/11.
- **Docker** на рабочей станции **не обязателен** для удалённого деплоя (сборка идёт на сервере).

### На целевом Linux-сервере

- Установлены **Docker Engine** и плагин **Docker Compose v2** (`docker compose version`).
- Пользователь для SSH (например `isar`) входит в группу **`docker`** или иначе может выполнять `docker`/`docker compose` без root.
- В домашнем каталоге пользователя будет каталог проекта, по умолчанию **`~/isar`** (имя задаётся переменной `DEPLOY_REMOTE_DIR`).

---

## 2. Клонирование проекта с GitHub

```bash
git clone https://github.com/OWNER/REPO.git
cd REPO
```

Подставьте URL и имя каталога вашего репозитория (например приватный клон по SSH: `git clone git@github.com:OWNER/REPO.git`).

Убедитесь, что в дереве есть:

- `DB/schema/demo/dump-archrep.sql` — дамп для импорта;
- `infra/demo/env.demo`, `infra/demo/docker-compose.yml`, `infra/demo/remote_demo_deploy.sh`, `infra/demo/deploy.bat`.

---

## 3. Все параметры, которые нужно задать

Ниже — **полный перечень** настраиваемых значений для типичного сценария «Windows → Linux по SSH». Порты API и Draw.io по умолчанию заданы в `docker-compose.yml` (**3000** и **8080**); чтобы их сменить, отредактируйте `infra/demo/docker-compose.yml` (секции `ports:`).

### 3.1. Файл `infra/demo/env.demo`

Этот файл участвует в **`docker compose --env-file`** и подключается к контейнеру Postgres как `env_file`. Его нужно привести в соответствие с **реальным хостом** (IP или DNS) и паролями **до** деплоя (или отредактировать на сервере после `scp` и перезапустить стек).

| Переменная | Обязательность | Назначение |
|------------|----------------|------------|
| `POSTGRES_USER` | Да | Суперпользователь кластера PostgreSQL в контейнере; же логин для API (`DB_USER` подставляется из него в compose). |
| `POSTGRES_PASSWORD` | Да | Пароль этого пользователя в Postgres и для API. |
| `POSTGRES_DB` | Да | Имя БД при **первом** initdb. Для сценария с дампом должно быть **`postgres`**, чтобы дамп мог выполнить `CREATE DATABASE archrep` без конфликта. Не меняйте без понимания последствий. |
| `DB_NAME` | Да | Имя БД для **приложения** после импорта дампа — обычно **`archrep`**. |
| `CORS_ORIGIN` | Да для доступа с браузера с другого origin | URL, с которого открывается фронт (часто `http://<ваш-сервер>:3000`). Можно несколько значений через запятую. |
| `DRAWIO_EMBED_BASE` | Да для встраивания Draw.io | Базовый URL Draw.io для клиента; обычно `http://<ваш-сервер>:8080`. |
| `ALLOW_INSECURE_RESTART_WITHOUT_SECRET` | По политике безопасности | Для демо часто `true`; для публичных сред лучше `false` и задать секрет перезапуска в коде/compose (см. корневой `.env.example`). |
| `AUTH_ENABLED` | Нет (default `false`) | `true` — локальный login + JWT + RBAC. Подробно: `docs/access-control-design.md` §3.1. |
| `JWT_SECRET` | Да при `AUTH_ENABLED=true` | Секрет подписи JWT. |
| `AUTH_BOOTSTRAP_DEMO_PASSWORD` | Нет | При старте API создаёт/обновляет login `demo` (SYSTEM_ADMIN). **Не SQL** — код `backend/auth/bootstrapAuth.js`. |
| `AUTH_BOOTSTRAP_ARADMIN_PASSWORD` | Нет | То же для login `aradmin`. |
| `AUTH_BOOTSTRAP_RESET_PASSWORDS` | Нет | `true` — перезаписать hash существующих bootstrap-пользователей из env. |
| `AUTH_BOOTSTRAP_MUST_CHANGE_PASSWORD` | Нет | Флаг `must_change_password` у создаваемых bootstrap-пользователей. |

Шаблон без секретов: **`infra/demo/env.demo.example`** — скопируйте в `env.demo` и заполните:

```text
POSTGRES_USER=…
POSTGRES_PASSWORD=…
POSTGRES_DB=postgres
DB_NAME=archrep
CORS_ORIGIN=http://<DEMO_HOST>:3000
DRAWIO_EMBED_BASE=http://<DEMO_HOST>:8080
ALLOW_INSECURE_RESTART_WITHOUT_SECRET=true
# AUTH_ENABLED=true
# JWT_SECRET=…
# AUTH_BOOTSTRAP_DEMO_PASSWORD=…
# AUTH_BOOTSTRAP_ARADMIN_PASSWORD=…
```

Пользователи `demo` / `aradmin` **не создаются SQL-скриптом**: после наката миграции RBAC они появляются при **старте контейнера API**, если заданы `AUTH_BOOTSTRAP_*_PASSWORD` (см. `docs/access-control-design.md` §3.1). Остальных пользователей — в UI «Настройки → Пользователи».

**Важно:** файл должен быть с окончаниями строк **LF** (в репозитории помогает `.gitattributes`). Скрипт деплоя на сервере дополнительно выполняет `sed` для снятия CR, но правильные LF в репозитории предпочтительны.

### 3.2. Переменные окружения для `infra/demo/deploy.bat` (SSH)

Их можно задавать в интерактивной `cmd` перед вызовом `deploy.bat`, либо одним файлом-обёрткой в корне репозитория (см. ниже).

| Переменная | Обязательность | Назначение |
|------------|----------------|------------|
| `DEPLOY_SSH_USER` | Да | Linux-пользователь на сервере (например `isar`). |
| `DEPLOY_SSH_TARGET_HOST` | Да | IP или DNS **целевого** хоста, куда копируются файлы и где выполняется Docker. |
| `DEPLOY_SSH_JUMP_HOST` | Нет | Промежуточный хост (bastion). Если **пусто**, используется схема `ssh user@target`. Если задано — `user@jump@target` (как в OpenSSH для вашей схемы доступа). |
| `DEPLOY_REMOTE_DIR` | Нет (по умолчанию `isar`) | Имя каталога **внутри домашней папки** пользователя на сервере (`~/isar`). |
| `DEPLOY_MODE` | Нет (по умолчанию `full`) | Режим удалённого деплоя: `full` (пересоздание БД + импорт дампа + миграции + сборка API) или `api-only` (без перезаливки БД, только миграции + пересборка/перезапуск API). |
| `ALLOW_DB_RESEED` | Нет (по умолчанию `false`) | Fail-safe для `full`: перед `DROP DATABASE` требуется явное `ALLOW_DB_RESEED=true`. Для `api-only` оставляйте `false`. |

### 3.3. Корневые обёртки (вариант B, не коммитятся)

В `.gitignore` указаны локальные обёртки в корне:

- **`deploy_demo_full.bat`** — полный цикл (`DEPLOY_MODE=full`);
- **`deploy_demo_api.bat`** — быстрый деплой API (`DEPLOY_MODE=api-only`) без переимпорта БД.

Пример `deploy_demo_full.bat`:

```bat
@echo off
setlocal
cd /d "%~dp0"
set DEPLOY_SSH_USER=isar
set DEPLOY_SSH_JUMP_HOST=
set DEPLOY_SSH_TARGET_HOST=ВАШ_IP_ИЛИ_DNS
set DEPLOY_REMOTE_DIR=isar
set DEPLOY_MODE=full
set ALLOW_DB_RESEED=true
call "%~dp0infra\demo\deploy.bat"
```

Пример `deploy_demo_api.bat`:

```bat
@echo off
setlocal
cd /d "%~dp0"
set DEPLOY_SSH_USER=isar
set DEPLOY_SSH_JUMP_HOST=
set DEPLOY_SSH_TARGET_HOST=ВАШ_IP_ИЛИ_DNS
set DEPLOY_REMOTE_DIR=isar
set DEPLOY_MODE=api-only
set ALLOW_DB_RESEED=false
call "%~dp0infra\demo\deploy.bat"
```

Подставьте свои `DEPLOY_SSH_*` и при необходимости `DEPLOY_SSH_JUMP_HOST`.

### 3.4. SSH-ключ (опционально, но рекомендуется)

Скрипт `infra/demo/deploy.bat` ищет ключ:

**`%USERPROFILE%\.ssh\id_ed25519_isar`**

Если файл есть — `scp`/`ssh` вызываются с `-i` на этот ключ. Если ключа нет — будет запрос **пароля** (дважды: для `scp` и для `ssh`). Чтобы использовать другой ключ, временно скопируйте/переименуйте его в `id_ed25519_isar` или отредактируйте путь в `infra/demo/deploy.bat` (строка с `SSH_KEY`).

### 3.5. Что задаётся только в `docker-compose.yml` (не в `env.demo`)

Для справки — эти значения **не выносятся** в `env.demo` в текущей версии стека:

| Параметр | Значение в demo | Назначение |
|----------|-----------------|------------|
| `NODE_ENV` | `production` | Режим Node; не используйте значение `demo` без файла `.env.demo` в образе. |
| `SERVER_PORT` | `3000` | Порт HTTP внутри контейнера API. |
| `DB_HOST` | `postgres` | Имя сервиса Postgres в сети compose. |
| `DB_PORT` | `5432` | Порт Postgres. |
| Публикация портов | `3000:3000`, `8080:8080` | Доступ с хоста к API и Draw.io. |

Меняйте только при необходимости (несколько стеков на одном хосте, другой внешний порт и т.д.).

---

## 4. Подготовка сервера (один раз)

1. Создайте каталог (если деплой первый): на сервере под пользователем `DEPLOY_SSH_USER` выполните, например:  
   `mkdir -p ~/isar`  
   (если `DEPLOY_REMOTE_DIR=isar`).

2. Проверка Docker:

   ```bash
   docker version
   docker compose version
   ```

3. Убедитесь, что с вашей Windows-машины проходит:

   ```bat
   ssh DEPLOY_SSH_USER@DEPLOY_SSH_TARGET_HOST
   ```

   (или с jump — ваша организационная схема.)

---

## 5. Запуск деплоя с Windows

1. Откройте **cmd** в корне клонированного репозитория.

2. Задайте переменные (включая `DEPLOY_MODE`) **или** запустите обёртки `deploy_demo_full.bat` / `deploy_demo_api.bat` (см. п. 3.3).

3. Выполните:

   ```bat
   infra\demo\deploy.bat
   ```

   Скрипт:

  - копирует на сервер в `~/%DEPLOY_REMOTE_DIR%/` каталоги **`backend`**, **`frontend-v3`**, **`infra`**, **`db`**, **`DB`**, а также **`package.json`**, **`package-lock.json`**, **`.dockerignore`**, **`pgmrc.json`**;
   - нормализует CR/LF у `remote_demo_deploy.sh` и `env.demo` на сервере;
  - запускает **`remote_demo_deploy.sh`** в выбранном режиме:
    - `full`: Postgres + Draw.io → ожидание готовности → роль `postgres` для совместимости с дампом → (только при `ALLOW_DB_RESEED=true`) `DROP DATABASE archrep` → импорт `DB/schema/demo/dump-archrep.sql` → `npm install --include=dev` + `node-pg-migrate up` → запуск API;
    - `api-only`: проверка доступности Postgres (без дропа/импорта БД) → `npm install --include=dev` + `node-pg-migrate up` → запуск `ar-api`.

4. Дождитесь сообщения **`[demo] Готово.`** в выводе. Ошибки `scp`/`ssh`/`docker` смотрите в том же окне.

---

## 6. Проверка успешного развёртывания

С любой машины, имеющей доступ к серверу по сети:

| Проверка | URL / команда |
|----------|----------------|
| API | `http://<DEPLOY_SSH_TARGET_HOST>:3000` |
| Draw.io | `http://<DEPLOY_SSH_TARGET_HOST>:8080` |
| Здоровье API | `http://<DEPLOY_SSH_TARGET_HOST>:3000/api/health` |
| Здоровье + БД | `http://<DEPLOY_SSH_TARGET_HOST>:3000/api/health/db` |

Ответы JSON без фатальных ошибок и успешный `/api/health/db` означают, что контейнер API подключился к БД **`DB_NAME`** после импорта.

---

## 7. Повторный деплой и полный сброс данных

- Повторный запуск в режиме **`full`** (например `deploy_demo_full.bat`) пересоздаёт БД **`archrep`** и снова импортирует дамп.
- Повторный запуск в режиме **`api-only`** (например `deploy_demo_api.bat`) БД не пересоздаёт.
- В обоих режимах перед запуском API выполняется `npm run db:migrate` (`node-pg-migrate up`) против БД `archrep`.
- Чтобы сбросить **том Postgres** (полное удаление данных кластера в demo), на сервере из каталога проекта:

  ```bash
  cd ~/isar
  docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo down -v
  ```

  Затем снова выполните деплой с Windows.

---

## 8. Локальный запуск (Docker Desktop, без SSH)

Из корня репозитория на Windows:

```bat
infra\demo\up_local_demo.bat
```

Перед этим настройте **`infra/demo/env.demo`** (те же переменные, что в п. 3.1; для localhost часто `http://localhost:3000` и `http://localhost:8080`).

---

## 9. Краткий чеклист перед первым продакшен-деплоем demo

- [ ] Репозиторий склонирован, ветка актуальна.
- [ ] В **`infra/demo/env.demo`** заданы пароль, `CORS_ORIGIN`, `DRAWIO_EMBED_BASE` под ваш хост.
- [ ] Заданы **`DEPLOY_SSH_USER`**, **`DEPLOY_SSH_TARGET_HOST`** (и при необходимости **`DEPLOY_SSH_JUMP_HOST`**, **`DEPLOY_REMOTE_DIR`**).
- [ ] SSH-доступ и (желательно) ключ **`%USERPROFILE%\.ssh\id_ed25519_isar`**.
- [ ] На сервере установлены Docker и Compose, пользователь в группе `docker`.
- [ ] На сервере доступен Node.js/npm (для шага `npm install --include=dev` + `node-pg-migrate`).
- [ ] После деплоя открываются **`/api/health`** и **`/api/health/db`**.

---

## 10. Матрица режимов DEPLOY_MODE

| Режим | Данные Postgres | Импорт `dump-archrep.sql` | Миграции `node-pg-migrate up` | Пересборка `ar-api` |
|------|------------------|----------------------------|-------------------------------|---------------------|
| `full` | Пересоздаются (`DROP DATABASE`) при `ALLOW_DB_RESEED=true` | Да | Да | Да |
| `api-only` | Не трогаются | Нет | Да | Да |

Дополнения и нюансы см. в **`README.md`** в этой же папке.
