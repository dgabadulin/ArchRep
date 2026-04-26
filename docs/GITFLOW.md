# GitFlow и деплой

## Ветки

| Ветка | Назначение |
|-------|------------|
| `main` | Прод: только стабильный код, сюда мержим после теста. |
| `develop` | Разработка: интеграция фич, сюда мержим из feature. |
| `feature/*` | Новая функциональность: отвод от `develop`, после готовности — MR в `develop`. |
| `hotfix/*` | Срочные правки прод: отвод от `main`, мерж в `main` и в `develop`. |

## Цикл работы

1. Задача в GitLab (issue) → создаёшь ветку от `develop`:  
   `git checkout develop && git pull && git checkout -b feature/краткое-имя`
2. Пишешь код, коммиты, пушишь.
3. Merge Request в `develop` → ревью → мерж.
4. Когда `develop` готов к релизу → MR `develop` → `main`, тег (например `v1.0.0`).
5. Деплой на сервер — из ветки `main` (или по тегу) одной командой (см. ниже).

## Одна команда: сборка и деплой по SSH

Из **корня репозитория** (после коммитов, с обновлённым кодом в текущей ветке).

**1.** Задай переменные окружения для SSH (в **cmd**), подставив свои хосты и пользователя:

```cmd
set DEPLOY_SSH_USER=your_linux_user
set DEPLOY_SSH_JUMP_HOST=your_jump_or_realm_host
set DEPLOY_SSH_TARGET_HOST=your_app_server_hostname
```

Опционально: `set DEPLOY_REMOTE_DIR=isar` (каталог на сервере под домашним каталогом, по умолчанию `isar`).

Строка подключения имеет вид `USER@JUMP@TARGET` (см. `infra/README-deploy-ssh.txt`).

**2.** Запуск:

```cmd
infra\prod\deploy.bat
```

или, если в PATH есть `npm`:

```cmd
npm run deploy
```

**Что делает скрипт:**

1. Копирует на сервер в `~/%DEPLOY_REMOTE_DIR%/` (по умолчанию `~/isar/`): `backend`, `frontend-v3`, `infra`, `package.json`, `package-lock.json`, `.dockerignore`.
2. При наличии локального `.env.production` в корне — копирует его на сервер (файл не должен попадать в Git).
3. По SSH запускает на сервере:  
   `docker build -f infra/common/dockerfile -t ar-api-image .`  
   затем останавливает и удаляет старый контейнер и запускает новый с образом `ar-api-image` (порт 3000, сеть `ar-network`).

**Требования:**

- На сервере: Docker, сеть `ar-network` (создаётся отдельно: `docker network create ar-network`), переменные окружения для БД — через `.env.production` на сервере или `-e` в `docker run`.
- На вашем ПК: доступ по SSH по схеме выше и возможность копировать файлы (`scp`). Ключ и проверка — в `infra/README-deploy-ssh.txt`.

**Переменные окружения на сервере:**  
Контейнер запускается с `NODE_ENV=production`. Параметры БД (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`) нужно передать в `docker run` (например `-e DB_HOST=...`) или положить на сервере `.env.production` и использовать `--env-file` (как в сгенерированном скрипте на сервере).

## Что в контейнере

Один образ `ar-api-image`:

- **Backend** (Node.js): API на порту 3000.
- **Frontend** (Vue): собранная статика отдаётся тем же сервером; запросы к `/api` уходят в backend, остальные — в `index.html` (SPA).

После деплоя приложение доступно по адресу `http://<YOUR_TARGET_HOST>:3000` (или по IP сервера).
