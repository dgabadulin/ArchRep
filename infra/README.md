# infra — инфраструктура и деплой

- **`common/dockerfile`** — общая сборка `frontend-v3` (Vite), затем образ с backend и каталогом `frontend-v3-dist`; один контейнер отдаёт API и SPA с корня `/`.
- **`prod/docker-compose.yml`** — локальный/prod-образный запуск API (контекст из корня: `docker compose -f infra/prod/docker-compose.yml up --build -d`).
- **`prod/deploy.bat`** — деплой по SSH: копирует проект на удалённый сервер в `~/isar/` (или `DEPLOY_REMOTE_DIR`), собирает образ и перезапускает контейнер. Перед запуском задайте `DEPLOY_SSH_USER`, `DEPLOY_SSH_JUMP_HOST`, `DEPLOY_SSH_TARGET_HOST` (см. комментарии в начале `deploy.bat`). Запуск из корня: `infra\prod\deploy.bat` или `npm run deploy`.
- **`demo/docker-compose.yml`** — demo-стек (postgres + ar-api + drawio) с `env.demo`; быстрый запуск через `infra\demo\deploy_demo.bat`.
- **restart.bat** — пересборка и перезапуск контейнера локально (из корня).
- **`.env.example`** — указатель на шаблон переменных в корне: **`../.env.example`**.

На сервере для работы контейнера нужны сеть `ar-network` (`docker network create ar-network`) и переменные окружения БД (через `-e` в `docker run` или env-file). При необходимости передайте `.env.production` на сервер вручную — `infra/prod/deploy.bat` копирует его, если файл есть локально в корне репозитория.
