# Подключаемые модули (drop-in каталог)

Сюда можно положить пакет модуля без публикации в npm:

```
modules/
  drawio-pro/
    module.json      # или legacy manifest.json (ядро применит адаптер)
    index.js         # backend-вход: register({ app, ctx }) / handlers
    frontend/        # Vue-компоненты (build-time)
    lib/
```

## Установка модуля DrawIO Pro

**Вариант 1 — npm-пакет (штатный, docs/modules-contract.md §4.1):**

```bash
npm i @isar/drawio-pro@0.1.0
```

(приватный registry: `.npmrc` с токеном — только как секрет сборки/CI)

**Вариант 2 — zip/каталог:**

```powershell
# распаковать артефакт в modules/drawio-pro (этот каталог)
```

## Включение

```env
ENABLED_MODULES=drawio-pro
SYS_MODULE_drawio_pro_LICENSE=<payload>.<signature>
SYS_MODULE_LICENSE_PUBKEYS={"isar-2026-01":"<base64 PEM>"}
SYS_INSTANCE_ID=<uuid инсталляции>
# только для тестовых стендов, без проверки подписи:
# SYS_MODULE_LICENSE_ALLOW_UNVERIFIED=true
```

## Сборка и проверка

```bash
npm run db:migrate        # таблица isar_modules + параметры группы «Модули»
npm run build:v3          # фронт модуля попадает в общий бандл (vite alias)
npm start                 # в логе: [modules] версия ядра …; [modules][drawio-pro] …
npm run modules:status    # диагностика: пакет, манифест, совместимость, лицензия, RBAC
npm run test:modules      # тесты загрузчика/лицензии/RBAC/payload
npm run check:routes      # маршруты и права из манифестов модулей
```

Полная процедура для администратора: **`docs/modules-admin-guide.md`**.
Короткий чеклист (11 пунктов): **`docs/modules-connect-checklist.md`**.
Формат ключа лицензии (v1) и правила проверки: **`docs/module-license-key.md`**.

Если пакет не установлен, сборка фронта не падает: `vite.config.js` подставляет
`frontend-v3/src/modules/stubs/drawio-pro`, а точка расширения скрыта (нет статуса в `/api/config`).
