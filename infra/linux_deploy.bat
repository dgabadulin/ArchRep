@echo off
setlocal

rem =============================================================================
rem Задайте те же переменные, что и для deploy.bat:
rem   DEPLOY_SSH_USER, DEPLOY_SSH_JUMP_HOST, DEPLOY_SSH_TARGET_HOST
rem Опционально: DEPLOY_REMOTE_DIR (по умолчанию ./isar)
rem =============================================================================

if "%DEPLOY_SSH_USER%"=="" (
  echo [ERROR] Set DEPLOY_SSH_USER
  exit /b 1
)
if "%DEPLOY_SSH_JUMP_HOST%"=="" (
  echo [ERROR] Set DEPLOY_SSH_JUMP_HOST
  exit /b 1
)
if "%DEPLOY_SSH_TARGET_HOST%"=="" (
  echo [ERROR] Set DEPLOY_SSH_TARGET_HOST
  exit /b 1
)
if "%DEPLOY_REMOTE_DIR%"=="" set DEPLOY_REMOTE_DIR=./isar

set REMOTE=%DEPLOY_SSH_USER%@%DEPLOY_SSH_JUMP_HOST%@%DEPLOY_SSH_TARGET_HOST%
set LOCAL_DIR=%~dp0..

echo Копирование исходных файлов и создание скрипта деплоя...

(
    echo #!/bin/bash
    echo cd %DEPLOY_REMOTE_DIR%
    echo echo "Остановка контейнера ar-api-container..."
    echo docker stop ar-api-container ^> /dev/null 2^>^&1 ^|^| true
    echo echo "Удаление контейнера ar-api-container..."
    echo docker rm ar-api-container ^> /dev/null 2^>^&1 ^|^| true
    echo echo "Удаление старого образа ar-api-image..."
    echo docker rmi ar-api-image ^> /dev/null 2^>^&1 ^|^| true
    echo echo "Сборка нового образа..."
    echo docker build -f infra/dockerfile -t ar-api-image .
    echo if [ $? -ne 0 ]; then echo "Ошибка при сборке образа."; exit 1; fi
    echo echo "Запуск контейнера ar-api-container..."
    echo docker run -d -e NODE_ENV=production -e SERVER_PORT=3000 -p 3000:3000 --name ar-api-container --network ar-network ar-api-image
    echo if [ $? -ne 0 ]; then echo "Ошибка при запуске контейнера."; exit 1; fi
    echo echo "Контейнер успешно запущен."
) > "%LOCAL_DIR%\remote_script.sh"

scp "%LOCAL_DIR%\remote_script.sh" %REMOTE%:~/tmp/remote_script.sh
if %ERRORLEVEL% neq 0 (
    echo Ошибка при передаче скрипта на сервер.
    exit /b 1
)

ssh %REMOTE% "bash ~/tmp/remote_script.sh"
if %ERRORLEVEL% neq 0 (
    echo Ошибка при выполнении скрипта на сервере.
    exit /b 1
)

del "%LOCAL_DIR%\remote_script.sh"
echo Деплой завершён.
