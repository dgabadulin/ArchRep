@echo off

setlocal EnableDelayedExpansion

chcp 65001 >nul

rem Локальный подъём demo-стека (Docker Desktop) из корня репозитория + импорт дампа.

cd /d "%~dp0..\.."



set "COMPOSE=docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo"

set "DUMP=DB\schema\demo\dump-archrep.sql"



if not exist "%DUMP%" (

  echo [ERROR] Нет файла дампа: %DUMP%

  exit /b 1

)



echo [1/5] Postgres + drawio...

%COMPOSE% up -d postgres drawio

if %ERRORLEVEL% neq 0 exit /b 1



echo [2/5] Ожидание Postgres...

:wait_pg

%COMPOSE% exec -T postgres pg_isready -U isar -d postgres >nul 2>&1

if %ERRORLEVEL% neq 0 (

  timeout /t 2 /nobreak >nul

  goto wait_pg

)



echo [2b/5] Служебная роль postgres для совместимости с дампом ^(OWNER TO postgres^)...

%COMPOSE% exec -T postgres psql -U isar -d postgres -v ON_ERROR_STOP=1 -c "DO $bd$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN CREATE ROLE postgres WITH SUPERUSER NOLOGIN; END IF; END $bd$;"

if %ERRORLEVEL% neq 0 exit /b 1



echo [3/5] Остановка API и пересоздание БД archrep...

%COMPOSE% stop ar-api 2>nul

%COMPOSE% exec -T postgres psql -U isar -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS archrep WITH (FORCE);"

if %ERRORLEVEL% neq 0 exit /b 1



echo [4/5] Импорт дампа...

%COMPOSE% exec -T postgres psql -U isar -d postgres -v ON_ERROR_STOP=1 < "%DUMP%"

if %ERRORLEVEL% neq 0 exit /b 1



echo [5/5] Сборка и запуск API...

%COMPOSE% up -d --build ar-api

if %ERRORLEVEL% neq 0 exit /b 1



echo Готово. API http://localhost:3000  Draw.io http://localhost:8080

exit /b 0

