@echo off
setlocal
cd /d "%~dp0\.."

echo Остановка контейнера ar-api-container...
docker stop ar-api-container >nul 2>&1

echo Удаление контейнера ar-api-container...
docker rm ar-api-container >nul 2>&1

echo Удаление старого образа ar-api-image...
docker rmi ar-api-image >nul 2>&1 || exit /b 0

echo Сборка нового образа (infra/dockerfile)...
docker build -f infra/dockerfile -t ar-api-image .
if %ERRORLEVEL% neq 0 (
    echo Ошибка при сборке образа.
    exit /b 1
)

echo Запуск контейнера ar-api-container...
docker run -d --restart=always -e NODE_ENV=development -e SERVER_PORT=3000 -p 3000:3000 --name ar-api-container --network ar-network ar-api-image
if %ERRORLEVEL% neq 0 (
    echo Ошибка при запуске контейнера.
    exit /b 1
)
echo Контейнер ar-api-container успешно запущен.
