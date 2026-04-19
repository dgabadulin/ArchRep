# infra — инфраструктура и деплой

- **docker-compose.yml** — локальный запуск (контекст из корня, `docker compose -f infra/docker-compose.yml up --build -d`). У сервиса **`restart: always`**, чтобы после «Перезапустить API» в UI (`process.exit` в Node) контейнер снова поднимался Docker’ом — как на сервере после `deploy.bat` (`docker run --restart=always`).
- **dockerfile** — сборка `frontend-v3` (Vite), затем образ с backend и каталогом `frontend-v3-dist`; один контейнер отдаёт API и SPA с корня `/`.
- **deploy.bat** — деплой по SSH: копирует проект на удалённый сервер в `~/isar/` (или `DEPLOY_REMOTE_DIR`), собирает образ и перезапускает контейнер. Перед запуском задайте `DEPLOY_SSH_USER`, `DEPLOY_SSH_JUMP_HOST`, `DEPLOY_SSH_TARGET_HOST` (см. комментарии в начале `deploy.bat`). Запуск из корня: `infra\deploy.bat` или `npm run deploy`.
- **restart.bat** — пересборка и перезапуск контейнера локально (из корня).
- **`.env.example`** — указатель на шаблон переменных в корне: **`../.env.example`**.

На сервере для работы контейнера нужны сеть `ar-network` (`docker network create ar-network`) и переменные окружения БД (через `-e` в `docker run` или env-file). При необходимости передайте `.env.production` на сервер вручную — скрипт копирует его, если файл есть локально в корне репозитория.
