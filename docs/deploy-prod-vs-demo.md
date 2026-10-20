# Сравнение деплоя: prod vs demo

Сводка по скриптам **`infra/prod/deploy.bat`** и цепочке **`infra/demo/deploy.bat`** → **`infra/demo/remote_demo_deploy.sh`** (без хостов, паролей и путей к конкретным машинам).

## Prod: файлы миграций в образе и шаг `db:migrate`

В **`infra/prod/deploy.bat`** на сервер копируются **`DB`** и **`pgmrc.json`** вместе с остальным деревом — они нужны **`docker build`** (`COPY` в **`infra/common/dockerfile`**). При этом в сгенерированном **`remote_script.sh`** по-прежнему **нет** вызова **`npm run db:migrate`**: **`node-pg-migrate`** на проде не запускается автоматически. Таблица **`public.pgmigrations`** и накат миграций — отдельная процедура (ручной **`psql`** по **`DB/scripts/`**, одноразовый контейнер с **`npm run db:migrate`**, и т.п.), если вы её не добавите в свой пайплайн.

На **demo** в **`infra/demo/deploy.bat`** в **`scp`** также есть **`DB`**, **`pgmrc.json`**, **`db`**. После копирования **`remote_demo_deploy.sh`** делает **`npm run db:migrate`** внутри одноразового контейнера **`ar-api`** с **`npm install --include=dev`**.

---

## Таблица шагов

| Шаг процесса                             | Prod (`infra/prod/deploy.bat` + сгенерированный `remote_script.sh`)                                                                            | Demo (`infra/demo/deploy.bat` + `remote_demo_deploy.sh`)                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Локальная обёртка                        | Любой `call` с заданными `DEPLOY_*` (например `deploy_local.bat`).                                                                             | То же + **`DEPLOY_MODE`** (`full` / `api-only`), **`ALLOW_DB_RESEED`** для `full`.                                                                                                              |
| Проверка SSH-переменных                  | Обязательны **user, jump, target** (jump не может быть пустым в текущем скрипте).                                                              | Обязательны **user, target**; **jump** опционален (пустой → прямое `user@target`).                                                                                                              |
| Копирование на сервер (`scp`)            | `backend`, `frontend-v3`, `infra`, **`DB`**, `package.json`, `package-lock.json`, **`pgmrc.json`**, `.dockerignore`.                            | То же **плюс** **`db`** (как в bat-файле).                                                                                                                                                      |
| Доп. файл после основного `scp`          | При наличии локально: **`.env.production`** → в каталог деплоя.                                                                                | Нет отдельного шага: **`infra/demo/env.demo`** уже внутри копируемого **`infra`**.                                                                                                              |
| Что выполняется на сервере               | Одноразовый **bash** из строк, сгенерированных в **`remote_script.sh`**, по **SSH**.                                                           | Фиксированный **`infra/demo/remote_demo_deploy.sh`** (+ нормализация CRLF для `*.sh` и `env.demo*`).                                                                                            |
| Оркестрация контейнеров                  | Только **`docker build`** и **`docker run`** одного сервиса **API**.                                                                           | **`docker compose`** по **`infra/demo/docker-compose.yml`**: Postgres, опционально Draw.io, **ar-api**.                                                                                         |
| Postgres на том же хосте                 | **Нет** в скрипте: предполагается внешняя БД по переменным в **`.env.production`** контейнера.                                                 | **Да**: сервис **`postgres`** в compose, ожидание **`pg_isready`**.                                                                                                                             |
| Режимы работы с БД                       | Один сценарий: приложение подключается к уже существующей БД.                                                                                  | **`full`**: остановка API → **`DROP DATABASE archrep`** → импорт **`DB/schema/demo/dump-archrep.sql`** (только при **`ALLOW_DB_RESEED=true`**). **`api-only`**: дамп и DROP **не** выполняются. |
| Роль `postgres` в кластере               | Не затрагивается.                                                                                                                              | В **`full`**: при необходимости создаётся служебная роль **`postgres`** для совместимости с OWNER в дампе.                                                                                      |
| Сборка образа API                        | **`docker build -f infra/common/dockerfile -t ar-api-image .`** в каталоге деплоя.                                                             | **`docker compose … build ar-api`** (тот же контекст репо, путь к Dockerfile из compose).                                                                                                       |
| **Миграции `node-pg-migrate`**           | Файлы **`DB/migrations`** и **`pgmrc.json`** **копируются** (для сборки образа); **авто-шага `db:migrate` нет.**                                | **Есть:** после сборки **`compose run --rm ar-api`** с **`npm install --include=dev`**, сборкой **`DATABASE_URL`** из **`DB_*`** и **`npm run db:migrate`**.                                    |
| Запуск API                               | **`docker run`** одного контейнера **`ar-api-container`**, порт **3000**, сеть **`ar-network`**, опционально **`--env-file .env.production`**. | **`docker compose up -d ar-api`** после миграций.                                                                                                                                               |
| Draw.io                                  | Нет в prod-скрипте.                                                                                                                            | В **`full`**: **`drawio`** поднимается вместе с Postgres; в **`api-only`** — нет.                                                                                                               |
| Обслуживание образов                     | **`docker image prune -f`** после сборки.                                                                                                      | В demo-скрипте отдельного **`prune`** нет (может отличаться политика очистки).                                                                                                                  |
| Зависимости Node на сервере для миграций | Не требуются скриптом prod (миграций нет).                                                                                                     | Нужны на время **`compose run ar-api`** (`npm install --include=dev` внутри контейнера).                                                                                                        |

---

## Прочие заметимые различия (не про хосты/секреты)

1. **Источник правды по env**: prod ориентируется на **`.env.production`** на сервере; demo — на **`infra/demo/env.demo`** и **`--env-file`** в compose.
2. **Политика «опасных» операций с БД**: на demo **`full`** требует явного **`ALLOW_DB_RESEED=true`**; на prod скрипт **вообще не трогает** схему БД через compose/дамп.
3. **Jump-хост**: prod-сейчас **требует** непустой `DEPLOY_SSH_JUMP_HOST`; demo допускает прямое подключение.
4. **Путь к корню репозитория**: prod `LOCAL_DIR` = `infra\prod\..\..`; demo `LOCAL_DIR` = `infra\demo\..\..` — оба дают корень проекта; отличается только расположение bat-файла.

---

*Файл в каталоге `temp/` — рабочая заметка; при желании перенесите в `docs/` или в `infra/*/README`.*
