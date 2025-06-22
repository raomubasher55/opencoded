@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo OpenCode Microservices Startup Script
echo ==============================================
echo.

:: Set the base directory
set BASE_DIR=%~dp0

:: Check if MongoDB is running
echo Checking if MongoDB is running...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo MongoDB is already running
) else (
    echo Starting MongoDB...
    if exist "C:\data\db" (
        start "" mongod --dbpath=C:\data\db
        timeout /t 5
    ) else (
        echo MongoDB data directory not found. Please create C:\data\db or specify a different path.
        echo Continuing without MongoDB, some services may fail.
    )
)
echo.

:: Function to start a service
:start_service
set service_name=%~1
set service_dir=%~2
set env_vars=%~3

echo Starting %service_name%...
if exist "%service_dir%" (
    cd /d "%service_dir%"
    :: Check if dist directory exists
    if not exist "dist" (
        echo Building %service_name%...
        call npm run build
    )
    
    :: Start the service with environment variables
    if not "%env_vars%"=="" (
        echo %service_name% is starting with custom environment variables
        start "%service_name%" cmd /c "%env_vars% && npm start"
    ) else (
        echo %service_name% is starting
        start "%service_name%" cmd /c "npm start"
    )
    
    cd /d "%BASE_DIR%"
) else (
    echo %service_name% directory not found: %service_dir%
)
echo.
goto :EOF

:: Ask user which services to start
echo Which services would you like to start?
echo 1) All services
echo 2) API Gateway
echo 3) Auth Service
echo 4) File Service
echo 5) LLM Service
echo 6) Session Service
echo 7) Tools Service
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" (
    :: Start all services
    call :start_service "auth-service" "%BASE_DIR%\services\auth-service" "set MONGODB_URI=mongodb://localhost:27017/opencode&& set PORT=3003"
    call :start_service "file-service" "%BASE_DIR%\services\file-service" "set PORT=4001"
    call :start_service "llm-service" "%BASE_DIR%\services\llm-service" "set PORT=4002"
    call :start_service "session-service" "%BASE_DIR%\services\session-service" "set MONGODB_URI=mongodb://localhost:27017/opencode&& set PORT=4004"
    call :start_service "tools-service" "%BASE_DIR%\services\tools-service" "set PORT=4003"
    
    :: Wait for services to start
    echo Waiting for services to start...
    timeout /t 5
    
    :: Start API Gateway last to ensure services are available
    call :start_service "api-gateway" "%BASE_DIR%\services\api-gateway" "set AUTH_SERVICE_URL=http://localhost:3003&& set FILE_SERVICE_URL=http://localhost:4001&& set LLM_SERVICE_URL=http://localhost:4002&& set SESSION_SERVICE_URL=http://localhost:4004&& set TOOLS_SERVICE_URL=http://localhost:4003&& set PORT=8080"
) else if "%choice%"=="2" (
    call :start_service "api-gateway" "%BASE_DIR%\services\api-gateway" "set AUTH_SERVICE_URL=http://localhost:3003&& set FILE_SERVICE_URL=http://localhost:4001&& set LLM_SERVICE_URL=http://localhost:4002&& set SESSION_SERVICE_URL=http://localhost:4004&& set TOOLS_SERVICE_URL=http://localhost:4003&& set PORT=8080"
) else if "%choice%"=="3" (
    call :start_service "auth-service" "%BASE_DIR%\services\auth-service" "set MONGODB_URI=mongodb://localhost:27017/opencode&& set PORT=3003"
) else if "%choice%"=="4" (
    call :start_service "file-service" "%BASE_DIR%\services\file-service" "set PORT=4001"
) else if "%choice%"=="5" (
    call :start_service "llm-service" "%BASE_DIR%\services\llm-service" "set PORT=4002"
) else if "%choice%"=="6" (
    call :start_service "session-service" "%BASE_DIR%\services\session-service" "set MONGODB_URI=mongodb://localhost:27017/opencode&& set PORT=4004"
) else if "%choice%"=="7" (
    call :start_service "tools-service" "%BASE_DIR%\services\tools-service" "set PORT=4003"
) else (
    echo Invalid choice. Exiting.
    goto end
)

echo ==============================================
echo Services have been started!
echo ==============================================
echo.
echo To stop all services, close the service windows or use Task Manager
echo.
echo To test the API:
echo test-all-endpoints.bat

:end
pause