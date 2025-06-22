@echo off
setlocal enabledelayedexpansion

REM Script to test file service API endpoints for listing files in D:\clientsocket
REM Created as part of the OpenCode project

set API_HOST=http://localhost:4001
set API_GATEWAY=http://localhost:8080
set TARGET_DIR=D:/clientsocket
set TARGET_DIR_UNIX=/mnt/d/clientsocket
REM Authentication is bypassed in code for testing
set TOKEN=

echo [TEST] Listing files in: %TARGET_DIR%
echo [TEST] ================================

REM Build auth header if token is available
set AUTH_HEADER=
if not "%TOKEN%"=="" (
    set AUTH_HEADER=-H "Authorization: Bearer %TOKEN%"
)

REM Check if the file service is running
echo [TEST] Checking if file service is running...
curl -s -X GET "%API_HOST%/health" > health_response.tmp
set /p HEALTH_RESPONSE=<health_response.tmp
del health_response.tmp

echo %HEALTH_RESPONSE%

if "%HEALTH_RESPONSE%"=="" (
    echo [TEST] File service is not running. Please start it manually.
    exit /b 1
) else (
    echo [TEST] File service is running.
)

REM Test endpoint 1: /api/files/operation (POST)
echo [TEST] Testing operation endpoint: POST %API_HOST%/api/files/operation
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% ^
  "%API_HOST%/api/files/operation" ^
  -d "{\"operation\":\"list\",\"path\":\"%TARGET_DIR_UNIX%\"}" > operation_result.tmp

type operation_result.tmp | findstr "success\":true" > nul
if not errorlevel 1 (
    echo [TEST] Operation endpoint successful.
    echo [TEST] Files found:
    for /F "tokens=2 delims=:}" %%a in ('type operation_result.tmp ^| findstr "name"') do (
        set file=%%a
        set file=!file:"=!
        set file=!file:,=!
        echo   - !file!
    )
) else (
    echo [TEST] Operation endpoint failed.
    type operation_result.tmp
)
del operation_result.tmp

REM Test endpoint 2: /api/files/list/:path (GET) - with double slash
echo [TEST] Testing list endpoint with double slash: GET %API_HOST%/api/files/list//%TARGET_DIR_UNIX%
curl -s -X GET %AUTH_HEADER% "%API_HOST%/api/files/list//%TARGET_DIR_UNIX%" > list_result.tmp

type list_result.tmp | findstr "success\":true" > nul
if not errorlevel 1 (
    echo [TEST] List endpoint with double slash successful.
    echo [TEST] Files found:
    for /F "tokens=2 delims=:}" %%a in ('type list_result.tmp ^| findstr "name"') do (
        set file=%%a
        set file=!file:"=!
        set file=!file:,=!
        echo   - !file!
    )
) else (
    echo [TEST] List endpoint failed.
    type list_result.tmp
)
del list_result.tmp

REM Test reading a file
echo [TEST] Testing reading a file: %API_HOST%/api/files/operation (read)
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% ^
  "%API_HOST%/api/files/operation" ^
  -d "{\"operation\":\"read\",\"path\":\"%TARGET_DIR_UNIX%/Remember.md\"}" > read_result.tmp

type read_result.tmp | findstr "success\":true" > nul
if not errorlevel 1 (
    echo [TEST] Read operation successful.
    echo [TEST] File content preview (first few lines):
    for /F "usebackq skip=1 tokens=1,* delims=:" %%a in (`type read_result.tmp ^| findstr "data"`) do (
        echo %%b | findstr /v /c:"}" | more /E +1
        goto :break_loop
    )
    :break_loop
) else (
    echo [TEST] Read operation failed.
    type read_result.tmp
)
del read_result.tmp

echo [TEST] Testing complete!
endlocal