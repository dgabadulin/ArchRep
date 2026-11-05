@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

rem =============================================================================
rem Деплой по SSH: задайте переменные окружения перед запуском (cmd):
rem   set DEPLOY_SSH_USER=your_linux_user
rem   set DEPLOY_SSH_JUMP_HOST=your_jump_or_realm_host
rem   set DEPLOY_SSH_TARGET_HOST=your_app_server_hostname
rem Опционально:
rem   set DEPLOY_REMOTE_DIR=isar
rem Строка подключения: %DEPLOY_SSH_USER%@%DEPLOY_SSH_JUMP_HOST%@%DEPLOY_SSH_TARGET_HOST%
rem (формат OpenSSH ProxyJump/доменной схемы вашей организации — подставьте свои значения)
rem =============================================================================

if "%DEPLOY_SSH_USER%"=="" (
  echo [ERROR] Set DEPLOY_SSH_USER ^(remote Linux user^)
  exit /b 1
)
if "%DEPLOY_SSH_JUMP_HOST%"=="" (
  echo [ERROR] Set DEPLOY_SSH_JUMP_HOST ^(middle host / realm, e.g. corp gateway^)
  exit /b 1
)
if "%DEPLOY_SSH_TARGET_HOST%"=="" (
  echo [ERROR] Set DEPLOY_SSH_TARGET_HOST ^(target server hostname^)
  exit /b 1
)
if "%DEPLOY_REMOTE_DIR%"=="" set DEPLOY_REMOTE_DIR=isar

set REMOTE=%DEPLOY_SSH_USER%@%DEPLOY_SSH_JUMP_HOST%@%DEPLOY_SSH_TARGET_HOST%
set LOCAL_DIR=%~dp0..\..
set REMOTE_HOST_ECHO=%DEPLOY_SSH_TARGET_HOST%

rem Путь к ключу
set "SSH_KEY=!USERPROFILE!\.ssh\id_ed25519_isar"
if not exist "!USERPROFILE!\.ssh" mkdir "!USERPROFILE!\.ssh" 2>nul
if exist "!SSH_KEY!" (
  set "SSH_OPTS=-i "!SSH_KEY!""
  echo [SSH] Using key: !SSH_KEY!
) else (
  set "SSH_OPTS="
  echo [SSH] Key not found. Password will be asked. To disable: see infra\README-deploy-ssh.txt
  echo.
)

echo [1/3] Копирование проекта на сервер %DEPLOY_SSH_TARGET_HOST% ...
cd /d "%LOCAL_DIR%"

rem --- Преддеплойная проверка (issue #96): режим гейта -----------------------------
rem Приоритет: аргумент (strict|ahead|dirty) > env DEPLOY_GATE > strict.
rem deploy_local.bat == прод: строгий режим по умолчанию; ahead/dirty — осознанно.
set "GATE_ARG=%~1"
if "%GATE_ARG%"=="" set "GATE_ARG=%DEPLOY_GATE%"
if "%GATE_ARG%"=="" set "GATE_ARG=strict"
if /i "%GATE_ARG%"=="dirty" if not "%CONFIRM_DIRTY%"=="1" (
    echo [ERROR] dirty-деплой требует подтверждения: set CONFIRM_DIRTY=1
    exit /b 1
)
set "VER_FILE=%LOCAL_DIR%\deploy_version.env"
if exist "%VER_FILE%" del "%VER_FILE%" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%LOCAL_DIR%\infra\prod\deploy-precheck.ps1" -RepoRoot "%LOCAL_DIR%" -OutFile "%VER_FILE%" -Gate "%GATE_ARG%"
if errorlevel 1 (
    echo [ERROR] Преддеплойная проверка не пройдена — деплой отменён.
    exit /b 1
)
set "APP_VERSION="
set "APP_COMMIT="
set "APP_BUILD_TIME="
set "APP_TAG="
set "APP_BASE_TAG="
set "APP_DEPLOY_STATE=release"
set "APP_AHEAD_COMMITS=0"
set "APP_DIRTY_FILES=0"
set "APP_IMAGE_TAG="
set "APP_CHANNEL=stable"
for /f "usebackq tokens=1,* delims==" %%a in ("%VER_FILE%") do set "%%a=%%b"
del "%VER_FILE%" 2>nul
if "%APP_VERSION%"=="" (
    echo [ERROR] Не удалось определить версию для сборки.
    exit /b 1
)
rem Backward compatibility: старый precheck не писал APP_IMAGE_TAG/APP_DEPLOY_STATE.
if "%APP_IMAGE_TAG%"=="" set "APP_IMAGE_TAG=%APP_VERSION%"
if "%APP_BASE_TAG%"=="" set "APP_BASE_TAG=%APP_TAG%"
echo [version] %APP_TAG% ^(%APP_VERSION%^), commit %APP_COMMIT%, state %APP_DEPLOY_STATE%
if not "%APP_DEPLOY_STATE%"=="release" (
    echo [version] WARNING: deploy state=%APP_DEPLOY_STATE% ^(ahead=%APP_AHEAD_COMMITS%, dirty files=%APP_DIRTY_FILES%^) — /about покажет пометку
)

rem Упаковываем только исходники. Раньше здесь был `scp -r frontend-v3`: он тащил
rem frontend-v3\node_modules (~140 МБ, ~7000 файлов) через jump-host (деплой в 10 раз
rem дольше), а Windows-артефакты ломали сборку в образе
rem (node_modules/.bin/vite → «sh: vite: Permission denied», exit 126).
set "STAGE_ARCHIVE=%LOCAL_DIR%\deploy_stage.tar.gz"
if exist "%STAGE_ARCHIVE%" del "%STAGE_ARCHIVE%" 2>nul
rem ВНИМАНИЕ (регресс 2026-10-02). tar.exe в Windows — это bsdtar (libarchive),
rem и шаблон --exclude он сопоставляет с ПОСЛЕДНИМ компонентом пути. Шаблон без
rem слэша `--exclude=views` вырезал ЛЮБУЮ папку с таким именем на любой глубине:
rem из архива пропадали frontend-v3/src/views (весь код экранов, включая
rem AnalyticsView.vue) и backend/views. На сервере они оставались от прошлых
rem деплоев, образ собирался из СТАРОГО кода, а деплой «проходил успешно».
rem Исключаем только по полному относительному пути и только реально лишнее.
tar --exclude=frontend-v3/node_modules -czf "%STAGE_ARCHIVE%" backend frontend-v3 infra DB package.json package-lock.json pgmrc.json .dockerignore
if %ERRORLEVEL% neq 0 (
    echo Ошибка упаковки исходников ^(нужен tar.exe из Windows 10 1803+^).
    exit /b 1
)
rem Контроль архива: если обязательные исходники не попали в архив, образ
rem соберётся из старых файлов на сервере — падаем сразу, а не «успешно»
rem выкатываем старый фронт (см. комментарий у tar выше).
tar -tzf "%STAGE_ARCHIVE%" > "%LOCAL_DIR%\deploy_stage_list.txt"
set "MISSING="
for %%R in (frontend-v3/index.html frontend-v3/vite.config.js frontend-v3/package.json frontend-v3/src/App.vue frontend-v3/src/views/ frontend-v3/src/components/ frontend-v3/src/config/ backend/index.js infra/common/dockerfile) do (
    findstr /C:"%%R" "%LOCAL_DIR%\deploy_stage_list.txt" >nul || set "MISSING=!MISSING! %%R"
)
del "%LOCAL_DIR%\deploy_stage_list.txt" 2>nul
if not "!MISSING!"=="" (
    echo [ERROR] В архиве нет обязательных исходников:!MISSING!
    echo [ERROR] Проверьте флаги --exclude у tar ^(шаблон без слэша режет по имени папки^).
    exit /b 1
)
scp !SSH_OPTS! "%STAGE_ARCHIVE%" "%REMOTE%:%DEPLOY_REMOTE_DIR%/"
set "SCP_RC=%ERRORLEVEL%"
del "%STAGE_ARCHIVE%" 2>nul
if not "%SCP_RC%"=="0" (
    echo Ошибка копирования.
    exit /b 1
)
if exist "%LOCAL_DIR%\.env.production" (
    echo Копирование .env.production ...
    scp !SSH_OPTS! "%LOCAL_DIR%\.env.production" "%REMOTE%:%DEPLOY_REMOTE_DIR%/"
)

echo [2/3] Подготовка скрипта сборки и запуска...
(
    echo #!/bin/bash
    echo set -e
    echo cd ~/%DEPLOY_REMOTE_DIR%
    echo echo "Распаковка исходников на сервере..."
    echo tar -xzf deploy_stage.tar.gz
    echo rm -f deploy_stage.tar.gz
    echo echo "Очистка артефактов прошлых деплоев (node_modules с Windows)..."
    echo rm -rf frontend-v3/node_modules frontend-v3-dist

    echo echo "Остановка контейнера..."
    echo docker stop ar-api-container 2^>/dev/null ^|^| true
    echo docker rm ar-api-container 2^>/dev/null ^|^| true
    echo echo "Сборка образа ar-api-image:!APP_IMAGE_TAG! ..."
    echo docker build -f infra/common/dockerfile --build-arg APP_VERSION=!APP_VERSION! --build-arg APP_COMMIT=!APP_COMMIT! --build-arg "APP_BUILD_TIME=!APP_BUILD_TIME!" --build-arg APP_CHANNEL=!APP_CHANNEL! --build-arg APP_DEPLOY_STATE=!APP_DEPLOY_STATE! --build-arg "APP_BASE_TAG=!APP_BASE_TAG!" --build-arg APP_AHEAD_COMMITS=!APP_AHEAD_COMMITS! --build-arg APP_DIRTY_FILES=!APP_DIRTY_FILES! -t ar-api-image:!APP_IMAGE_TAG! -t ar-api-image:latest .
    echo echo "Удаление отвязанных образов..."
    echo docker image prune -f
    echo echo "Запуск контейнера..."
    echo ENV_EXTRA=""
    echo [ -f .env.production ] ^&^& ENV_EXTRA="--env-file .env.production"
    echo docker run -d --restart=always -e NODE_ENV=production $ENV_EXTRA -e SERVER_PORT=3000 -p 3000:3000 --name ar-api-container --network ar-network ar-api-image:!APP_IMAGE_TAG!
    echo echo "Ожидание /api/health..."
    echo for i in 1 2 3 4 5 6 7 8 9 10; do
    echo   if curl -sf http://127.0.0.1:3000/api/health ^>^/dev/null; then
    echo     echo "OK: API отвечает на :3000"
    echo     curl -s http://127.0.0.1:3000/api/version
    echo     exit 0
    echo   fi
    echo   sleep 2
    echo done
    echo echo "[ERROR] API не ответил за 20 с. Статус контейнера и логи:"
    echo docker ps -a --filter name=ar-api-container
    echo docker logs ar-api-container --tail 80 2^>^&1 ^|^| true
    echo exit 1
) > "%LOCAL_DIR%\remote_script.sh"

scp !SSH_OPTS! "%LOCAL_DIR%\remote_script.sh" "%REMOTE%:~/tmp/remote_script.sh"
if %ERRORLEVEL% neq 0 (
    echo Ошибка передачи скрипта.
    exit /b 1
)

echo [3/3] Сборка и запуск на сервере...
ssh !SSH_OPTS! "%REMOTE%" "sed -i 's/\r$//' ~/tmp/remote_script.sh && bash ~/tmp/remote_script.sh"
if %ERRORLEVEL% neq 0 (
    echo Ошибка на сервере.
    del "%LOCAL_DIR%\remote_script.sh" 2>nul
    exit /b 1
)

del "%LOCAL_DIR%\remote_script.sh" 2>nul
echo.
echo Деплой завершён. Открой: http://%DEPLOY_SSH_TARGET_HOST%:3000
echo Проверка API: http://%DEPLOY_SSH_TARGET_HOST%:3000/api/health  (доступность БД: /api/health/db)
