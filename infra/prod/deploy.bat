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
scp !SSH_OPTS! -r backend frontend-v3 infra DB package.json package-lock.json pgmrc.json .dockerignore "%REMOTE%:%DEPLOY_REMOTE_DIR%/"
if %ERRORLEVEL% neq 0 (
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
    echo echo "Остановка контейнера..."
    echo docker stop ar-api-container 2^>/dev/null ^|^| true
    echo docker rm ar-api-container 2^>/dev/null ^|^| true
    echo echo "Сборка образа ar-api-image..."
    echo docker build -f infra/common/dockerfile -t ar-api-image .
    echo echo "Удаление отвязанных образов..."
    echo docker image prune -f
    echo echo "Запуск контейнера..."
    echo ENV_EXTRA=""
    echo [ -f .env.production ] ^&^& ENV_EXTRA="--env-file .env.production"
    echo docker run -d --restart=always -e NODE_ENV=production $ENV_EXTRA -e SERVER_PORT=3000 -p 3000:3000 --name ar-api-container --network ar-network ar-api-image
    echo echo "Готово. Приложение: http://%REMOTE_HOST_ECHO%:3000"
    echo echo "Проверка API: http://%REMOTE_HOST_ECHO%:3000/api/health  (БД: /api/health/db)"
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
