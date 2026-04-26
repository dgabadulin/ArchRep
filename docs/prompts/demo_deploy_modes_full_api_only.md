# Промпт: Режимы demo-деплоя full и api-only

## Контекст

- **Проект/репозиторий:** архитектурный репозиторий (backend Node.js, PostgreSQL `archrep`, Docker Compose в `infra/demo`).
- **Файлы/схемы:** `infra/demo/deploy.bat`, `infra/demo/remote_demo_deploy.sh`, корневые обёртки деплоя, `infra/demo/DEPLOYMENT.md`, `infra/demo/README.md`.
- **Ограничения:** сохранить возможность полного развёртывания с 0 (дамп), добавить быстрый сценарий только для `ar-api` без перезаливки БД; локальные обёртки не коммитить.

## Цель

Внедрить два режима demo-деплоя:
- `full` — полный цикл с импортом дампа;
- `api-only` — обновление только API без пересоздания БД.

Сделать вариант B с двумя локальными обёртками (`deploy_demo_full.bat`, `deploy_demo_api.bat`) и обновить документацию по режимам.

## Промпт для ИИ (скопировать в чат)

```
Реализуй режимы DEPLOY_MODE=full|api-only для demo-деплоя:
1) infra/demo/remote_demo_deploy.sh:
   - поддержка DEPLOY_MODE (default full), валидация значений;
   - full: текущий сценарий с импортом дампа;
   - api-only: без DROP/импорта БД, только проверка postgres и пересборка/перезапуск ar-api.
2) infra/demo/deploy.bat:
   - добавить DEPLOY_MODE (default full), валидацию, прокинуть в ssh-вызов.
3) Сделать вариант B:
   - добавить deploy_demo_full.bat и deploy_demo_api.bat (локальные, в .gitignore).
4) Обновить документацию:
   - infra/demo/DEPLOYMENT.md и infra/demo/README.md с описанием режимов и новых обёрток.
Сделай аккуратный diff без лишних изменений.
```

## Формат ответа

- Краткое описание внесённых изменений по файлам.
- Указание, как запускать `full` и `api-only`.
- Что осталось сделать вручную (если требуется).

## Критерии готовности

- `infra/demo/deploy.bat` принимает `DEPLOY_MODE` и валидирует его.
- `remote_demo_deploy.sh` корректно работает в режимах `full` и `api-only`.
- Есть две обёртки: `deploy_demo_full.bat` и `deploy_demo_api.bat`.
- `.gitignore` содержит локальные обёртки.
- Документация demo отражает новые режимы.

---
*Создано: 2026-04-24  Обновлено: 2026-04-24*
