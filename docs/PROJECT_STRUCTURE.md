# Структура проекта «Архитектурный репозиторий»

## Текущее состояние (после переноса)

```
projects/
├── .env.example              # шаблон переменных (копия → .env.development / .env.production локально, не коммитить секреты)
├── .gitignore
├── README.md
├── package.json              # "start": "node backend/index.js"
├── package-lock.json
├── backend/                  # BFF / REST API
│   ├── index.js
│   ├── queries.js
│   ├── views/
│   │   └── graph.ejs
│   └── public/               # статика (при необходимости скопировать echarts.min.js из корня)
├── frontend-v3/              # Vue 3 SPA; build → frontend-v3-dist/
├── db/
│   ├── schema/
│   │   └── archrep_test.sql
│   └── README.md
├── infra/
│   ├── common/
│   │   └── dockerfile
│   ├── demo/
│   │   ├── docker-compose.yml
│   │   ├── env.demo
│   │   └── deploy_demo.bat
│   ├── prod/
│   │   ├── deploy.bat
│   │   ├── linux_deploy.bat
│   │   └── docker-compose.yml
│   ├── .env.example
│   └── restart.bat
├── DB/                       # прежнее место DDL (дубликат в db/schema), дампы в .gitignore
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   └── prompts/
└── public/                   # legacy: echarts.min.js (при необходимости — в backend/public)
```

**Запуск:** из корня `npm start` или `docker compose -f infra/prod/docker-compose.yml up --build -d`.

---

## Целевая структура (к чему идём)

```
projects/
├── README.md
├── .gitignore
├── package.json              # корневой: скрипты запуска backend, линтеры, позже workspace
│
├── backend/                  # BFF / REST API (Node.js + Express)
│   ├── package.json          # (опционально: свои зависимости backend)
│   ├── index.js              # точка входа сервера
│   ├── config/               # подключение к БД, env
│   ├── routes/               # маршруты по доменам (systems, refs, ...)
│   ├── services/             # бизнес-логика
│   ├── db/                   # слой доступа к БД (queries, репозитории)
│   ├── views/                # EJS-шаблоны (если остаются на backend)
│   └── public/               # статика, отдаваемая backend
│
├── frontend/                 # Веб-интерфейс для архитекторов (пока пусто)
│   ├── package.json
│   └── src/
│
├── db/                       # Всё, что связано с БД (схема, миграции, скрипты)
│   ├── schema/               # DDL (текущее содержимое DB/ — перенести сюда)
│   │   └── archrep_test.sql
│   ├── migrations/           # версионированные миграции (по мере появления)
│   └── scripts/              # разовые скрипты (очистка, выгрузка, отчёты)
│
├── infra/                    # Инфраструктура: Docker, деплой, окружения
│   ├── docker-compose.yml
│   ├── dockerfile
│   ├── .env.example          # шаблон переменных (без секретов)
│   ├── restart.bat
│   ├── linux_deploy.bat
│   └── remote_script.sh
│
└── docs/                     # Документация
    ├── PROJECT_STRUCTURE.md  # этот файл
    ├── architecture/         # описание архитектуры решения, диаграммы
    └── prompts/             # промпты для ИИ
```

**Принципы:**

| Папка      | Назначение |
|-----------|------------|
| `backend/` | Вся логика API: маршруты, сервисы, запросы к БД, шаблоны и статика, которые отдаёт API. |
| `frontend/` | SPA или low-code приложение для архитекторов (позже). |
| `db/`       | Единственное место для DDL, миграций и скриптов по БД. Текущий `DB/` логично превратить в `db/schema/` (+ при желании `db/scripts/`). |
| `infra/`    | Всё, что нужно для запуска и деплоя: Docker, скрипты, примеры env. |
| `docs/`     | Вся документация: структура проекта, архитектура, промпты. |

---

## Этапы перехода (без поломки текущего запуска)

1. **Создать папки и описание**  
   Добавить `backend/`, `frontend/`, `db/`, `infra/`, положить в них краткие README. Обновить этот файл и корневой README. Код пока не переносить.

2. **Перенести инфраструктуру в `infra/`**  
   Разделить `infra` на `common/`, `demo/`, `prod/`; общий Dockerfile хранить в `infra/common/dockerfile`. Для compose в подпапках использовать `build.context: ../..` и `dockerfile: infra/common/dockerfile`. После переноса проверить `docker compose -f infra/prod/docker-compose.yml up --build`.

3. **Перенести БД-артефакты в `db/`**  
   Создать `db/schema/`, перенести туда `DB/archrep_test.sql` и при необходимости другие DDL. Большие дампы оставить в `.gitignore`. При желании завести `db/scripts/` для скриптов очистки/выгрузки.

4. **Выделить backend**  
   Перенести `index.js`, `queries.js`, `views/`, `public/` в `backend/`. Разбить `index.js` на `config`, `routes`, при необходимости `services`. Корневой `package.json` оставить точкой входа: `"start": "node backend/index.js"` и т.п. Обновить Dockerfile/infra так, чтобы образ собирался из корня, а рабочим каталогом был backend или корень с запуском `node backend/index.js`.

5. **Фронтенд**  
   Инициализировать `frontend/` (Vite/React, Vue или low-code), настроить обращение к API backend. Детали — в отдельном плане по фронту.

---

## Где что искать после перехода

| Сейчас (в корне / DB) | После перехода |
|------------------------|----------------|
| `index.js`, `queries.js` | `backend/` (плюс разбивка на routes, config, db) |
| `views/`, `public/` | `backend/views/`, `backend/public/` |
| `DB/*.sql` | `db/schema/`, дампы по-прежнему не в git |
| `docker-compose.yml`, `dockerfile`, `*.bat`, `*.sh` | `infra/` |
| Описание структуры | `docs/PROJECT_STRUCTURE.md` (этот файл) |

Корень остаётся местом для README, общего `package.json` и точки входа в backend (и позже в frontend через скрипты).
