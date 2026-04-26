@echo off

setlocal EnableDelayedExpansion

chcp 65001 >nul



rem =============================================================================

rem Деплой demo-стека по SSH (Windows, OpenSSH).

rem Перед запуском задайте переменные (или используйте корневой deploy_demo.bat):

rem   set DEPLOY_SSH_USER=linux_user

rem   set DEPLOY_SSH_TARGET_HOST=host_or_ip

rem   set DEPLOY_SSH_JUMP_HOST=   (необязательно; если пусто — ssh user@target)

rem   set DEPLOY_REMOTE_DIR=isar  (опционально, каталог в домашней папке пользователя)
rem   set DEPLOY_MODE=full|api-only (по умолчанию full)
rem   set ALLOW_DB_RESEED=true|false (по умолчанию false; для full обязательно true)

rem =============================================================================



if "%DEPLOY_SSH_USER%"=="" (

  echo [ERROR] Укажите DEPLOY_SSH_USER

  exit /b 1

)

if "%DEPLOY_SSH_TARGET_HOST%"=="" (

  echo [ERROR] Укажите DEPLOY_SSH_TARGET_HOST

  exit /b 1

)

if "%DEPLOY_REMOTE_DIR%"=="" set DEPLOY_REMOTE_DIR=isar
if "%DEPLOY_MODE%"=="" set DEPLOY_MODE=full
if "%ALLOW_DB_RESEED%"=="" set ALLOW_DB_RESEED=false
if /I not "%DEPLOY_MODE%"=="full" if /I not "%DEPLOY_MODE%"=="api-only" (
  echo [ERROR] DEPLOY_MODE должен быть full или api-only. Сейчас: %DEPLOY_MODE%
  exit /b 1
)
if /I not "%ALLOW_DB_RESEED%"=="true" if /I not "%ALLOW_DB_RESEED%"=="false" (
  echo [ERROR] ALLOW_DB_RESEED должен быть true или false. Сейчас: %ALLOW_DB_RESEED%
  exit /b 1
)
if /I "%DEPLOY_MODE%"=="full" if /I not "%ALLOW_DB_RESEED%"=="true" (
  echo [ERROR] Для DEPLOY_MODE=full нужно ALLOW_DB_RESEED=true ^(защита от случайного DROP DATABASE^).
  exit /b 1
)



if not "%DEPLOY_SSH_JUMP_HOST%"=="" (

  set "REMOTE=%DEPLOY_SSH_USER%@%DEPLOY_SSH_JUMP_HOST%@%DEPLOY_SSH_TARGET_HOST%"

  echo [SSH] Подключение: user @ jump @ target

) else (

  set "REMOTE=%DEPLOY_SSH_USER%@%DEPLOY_SSH_TARGET_HOST%"

  echo [SSH] Подключение: user @ target ^(без jump^)

)



set "LOCAL_DIR=%~dp0..\.."

set "REMOTE_HOST_ECHO=%DEPLOY_SSH_TARGET_HOST%"



set "SSH_KEY=!USERPROFILE!\.ssh\id_ed25519_isar"

if not exist "!USERPROFILE!\.ssh" mkdir "!USERPROFILE!\.ssh" 2>nul

if exist "!SSH_KEY!" (

  set "SSH_OPTS=-i "!SSH_KEY!""

  echo [SSH] Ключ: !SSH_KEY!

) else (

  set "SSH_OPTS="

  echo [SSH] Ключ не найден — возможен запрос пароля.

)



echo [1/3] Копирование проекта на %DEPLOY_SSH_TARGET_HOST% ...

cd /d "%LOCAL_DIR%"

scp !SSH_OPTS! -r backend frontend-v3 infra db package.json package-lock.json .dockerignore DB pgmrc.json "%REMOTE%:%DEPLOY_REMOTE_DIR%/"

if %ERRORLEVEL% neq 0 (

  echo Ошибка scp.

  exit /b 1

)



echo [2/3] Нормализация LF ^(CRLF с Windows^) и запуск удалённого скрипта demo ^(%DEPLOY_MODE%, reseed=%ALLOW_DB_RESEED%^)...

ssh !SSH_OPTS! "%REMOTE%" "sed -i 's/\r$//' ~/%DEPLOY_REMOTE_DIR%/infra/demo/remote_demo_deploy.sh ~/%DEPLOY_REMOTE_DIR%/infra/demo/env.demo ~/%DEPLOY_REMOTE_DIR%/infra/demo/env.demo.example && ISAR_REMOTE_DIR=%DEPLOY_REMOTE_DIR% DEPLOY_MODE=%DEPLOY_MODE% ALLOW_DB_RESEED=%ALLOW_DB_RESEED% bash ~/%DEPLOY_REMOTE_DIR%/infra/demo/remote_demo_deploy.sh"

if %ERRORLEVEL% neq 0 (

  echo Ошибка на удалённом хосте.

  exit /b 1

)



echo.

echo [3/3] Готово. См. вывод выше. Точки входа: http://%REMOTE_HOST_ECHO%:3000 и :8080

exit /b 0

