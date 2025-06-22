@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo OpenCode Microservices API Testing Suite
echo ==============================================
echo.

:: Set the base directory
set BASE_DIR=%~dp0

:: Function to run a test script
:run_test_script
set service=%~1
set script_path=%~2

echo ==============================================
echo Testing %service%
echo ==============================================

if exist "%script_path%" (
    :: Run the test script
    call %script_path%
    
    echo.
    echo Completed testing %service%
    echo.
) else (
    echo Test script for %service% not found at: %script_path%
    echo.
)
goto :EOF

:: Ask user which services to test
echo Which services would you like to test?
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
    :: Test all services
    call :run_test_script "API Gateway" "%BASE_DIR%\services\api-gateway\test-endpoints.bat"
    call :run_test_script "Auth Service" "%BASE_DIR%\services\auth-service\test-endpoints.bat"
    call :run_test_script "File Service" "%BASE_DIR%\services\file-service\test-endpoints.bat"
    call :run_test_script "LLM Service" "%BASE_DIR%\services\llm-service\test-endpoints.bat"
    call :run_test_script "Session Service" "%BASE_DIR%\services\session-service\test-endpoints.bat"
    call :run_test_script "Tools Service" "%BASE_DIR%\services\tools-service\test-endpoints.bat"
) else if "%choice%"=="2" (
    call :run_test_script "API Gateway" "%BASE_DIR%\services\api-gateway\test-endpoints.bat"
) else if "%choice%"=="3" (
    call :run_test_script "Auth Service" "%BASE_DIR%\services\auth-service\test-endpoints.bat"
) else if "%choice%"=="4" (
    call :run_test_script "File Service" "%BASE_DIR%\services\file-service\test-endpoints.bat"
) else if "%choice%"=="5" (
    call :run_test_script "LLM Service" "%BASE_DIR%\services\llm-service\test-endpoints.bat"
) else if "%choice%"=="6" (
    call :run_test_script "Session Service" "%BASE_DIR%\services\session-service\test-endpoints.bat"
) else if "%choice%"=="7" (
    call :run_test_script "Tools Service" "%BASE_DIR%\services\tools-service\test-endpoints.bat"
) else (
    echo Invalid choice. Exiting.
    goto end
)

echo ==============================================
echo All tests completed!
echo ==============================================
echo.
echo NOTE: Some tests may have failed if services weren't running or credentials weren't provided.
echo Please review the API documentation for each service in the services/^<service-name^>/API.md files.

:end
pause