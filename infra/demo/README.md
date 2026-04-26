# infra/demo

**Пошаговая инструкция развёртывания (GitHub → сервер):** **[DEPLOYMENT.md](DEPLOYMENT.md)** — клонирование, все переменные в `env.demo` и для SSH, проверка успеха.

Demo-стек: Postgres 17 + API + Draw.io. Compose-файл: `docker-compose.yml`, переменные: `env.demo` (в репозитории для изолированного демо; для других хостов скопируйте из `env.demo.example`).



## Удалённый деплой (Linux-сервер по SSH)



1. На сервере: пользователь с правами на Docker, каталог `~/%DEPLOY_REMOTE_DIR%` (по умолчанию `~/isar`).

2. С рабочей станции Windows задайте переменные и вызовите `infra\demo\deploy.bat`, либо используйте корневые обёртки **`deploy_demo_full.bat`** / **`deploy_demo_api.bat`** (оба в `.gitignore`, не коммитятся — создаются локально).



Пример без jump-хоста:



```bat

set DEPLOY_SSH_USER=isar

set DEPLOY_SSH_TARGET_HOST=194.67.202.47

set DEPLOY_REMOTE_DIR=isar

infra\demo\deploy.bat

```



С jump-хостом (как в prod):



```bat

set DEPLOY_SSH_USER=isar

set DEPLOY_SSH_JUMP_HOST=gateway.example.com

set DEPLOY_SSH_TARGET_HOST=app.internal

set DEPLOY_REMOTE_DIR=isar

infra\demo\deploy.bat

```



Скрипт копирует `backend`, `frontend-v3`, `infra`, `DB`, манифесты и на сервере выполняет `remote_demo_deploy.sh` в режиме `DEPLOY_MODE`:
- `full` — полный цикл с импортом `DB/schema/demo/dump-archrep.sql` (требует `ALLOW_DB_RESEED=true` как подтверждение на `DROP DATABASE`);
- `api-only` — миграции + пересборка/перезапуск `ar-api`, без пересоздания БД.



## Локально (Docker Desktop, Windows)



Из корня репозитория:



```bat

infra\demo\up_local_demo.bat

```



Или только compose без переимпорта БД:



```bat

docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo up -d --build

```



## Замечания



- **`POSTGRES_DB=postgres`** в `env.demo`: initdb создаёт служебную БД `postgres`; дамп сам выполняет `CREATE DATABASE archrep` и схему. Приложение подключается к **`DB_NAME=archrep`**.

- **Роль `postgres` в кластере:** при `POSTGRES_USER=isar` официальный образ не создаёт роль БД `postgres`, а в дампе есть `OWNER TO postgres`. Перед импортом скрипты создают роль `postgres` (`SUPERUSER NOLOGIN`), если её ещё нет.

- **`NODE_ENV`**: в compose для API задано `production`, чтобы не требовался файл `.env.demo` в образе (см. `backend/index.js` и загрузку `.env.${NODE_ENV}`).

- Перед запуском `ar-api` скрипт выполняет `npm run db:migrate` (`node-pg-migrate up`) в БД `archrep`.

- Скрипт `remote_demo_deploy.sh` должен иметь LF-окончания строк; при копировании с Windows деплой-скрипт выполняет `sed -i 's/\r$//' …` на сервере.


