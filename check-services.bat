@echo off
setlocal enabledelayedexpansion

echo OpenCode Services Health Check
echo ===========================
echo.

REM Check if curl is available
where curl >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: curl is not available. Please install curl to run this script.
    exit /b 1
)

echo Checking MongoDB...
where mongosh >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    mongosh --eval "db.serverStatus()" --quiet >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [PASS] MongoDB is running
    ) else (
        echo [FAIL] MongoDB is not running
        echo   Try starting MongoDB with: mongod --dbpath=C:\data\db
    )
) else (
    echo [SKIP] MongoDB client (mongosh) not found, skipping check
)
echo.

REM Function to check service health
call :check_service "API Gateway" "http://localhost:8080"
call :check_service "Auth Service" "http://localhost:3003"
call :check_service "File Service" "http://localhost:4001"
call :check_service "LLM Service" "http://localhost:4002"
call :check_service "Tools Service" "http://localhost:4003"
call :check_service "Session Service" "http://localhost:4004"

echo Testing Proxy Routes
echo ====================
echo.

REM Function to test proxy route
call :test_proxy "Auth Service" "http://localhost:8080/api/auth/health"
call :test_proxy "File Service" "http://localhost:8080/api/files/health"
call :test_proxy "LLM Service" "http://localhost:8080/api/llm/health"
call :test_proxy "Tools Service" "http://localhost:8080/api/tools/health"
call :test_proxy "Session Service" "http://localhost:8080/api/sessions/health"

echo DNS Resolution Test
echo ===================
echo.

echo Testing DNS resolution for service hosts...
for %%h in (localhost auth-service file-service llm-service tools-service session-service) do (
    echo Resolving %%h:
    ping -n 1 -w 1000 %%h >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        echo [PASS] Resolvable
        ping -n 1 %%h | findstr "Reply"
    ) else (
        echo [FAIL] Not resolvable
    )
)

echo.
echo Test completed. Check results above.
pause
exit /b 0

:check_service
echo Checking %~1...
curl -s --connect-timeout 2 %~2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [PASS] %~1 is reachable at %~2
    for /f "tokens=2 delims=:," %%a in ('curl -s %~2/health ^| findstr "status"') do (
        set status=%%a
        set status=!status:"=!
        echo   Health status: !status!
    )
) else (
    echo [FAIL] %~1 is not reachable at %~2
    for /f "tokens=2 delims=:" %%a in ('echo %~2') do (
        set port=%%a
        echo   Checking port !port!...
        netstat -an | findstr "LISTENING" | findstr "!port!" >nul
        if !ERRORLEVEL! EQU 0 (
            echo   [PASS] Port !port! is open
        ) else (
            echo   [FAIL] Port !port! is closed or service is not running
        )
    )
)
echo.
exit /b 0

:test_proxy
echo Testing %~1 proxy...
curl -s --connect-timeout 2 %~2 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [PASS] Proxy route %~2 is working
    curl -s %~2 | findstr /C:"status" >nul
    if !ERRORLEVEL! EQU 0 (
        echo   Response contains status information
    ) else (
        echo   Response does not contain status information
    )
) else (
    echo [FAIL] Proxy route %~2 is not working
)
echo.
exit /b 0