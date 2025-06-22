@echo off
REM File Service Test Script for Windows
REM This batch file tests basic file operations using the File Service API

echo OpenCode File Service Test Script
echo ==================================

REM Configuration
set API_HOST=http://localhost:4001
set API_GATEWAY=http://localhost:8080
set TEST_DIR=C:/opencode-test
set TEST_FILE=%TEST_DIR%/test-file.txt
set TOKEN=

REM Test 1: Check service health
echo Test 1: Checking Service Health
echo Calling: GET %API_HOST%/health
curl -s -X GET "%API_HOST%/health"
echo.

echo Calling: GET %API_GATEWAY%/health
curl -s -X GET "%API_GATEWAY%/health"
echo.

REM Test 2: Get login token (optional - comment out if not needed)
REM echo Test 2: Getting Authentication Token
REM echo Please enter credentials for login:
REM set /p email="Email: "
REM set /p password="Password: "
REM
REM curl -s -X POST -H "Content-Type: application/json" -d "{\"email\":\"%email%\",\"password\":\"%password%\"}" "%API_GATEWAY%/api/auth/login"
REM echo.
REM echo You will need to manually extract the token and set it in this script
REM pause

REM Uncomment and set your token here if you have it
REM set TOKEN=your_token_here

REM Create auth header if token is available
set AUTH_HEADER=
if not "%TOKEN%"=="" (
    set AUTH_HEADER=-H "Authorization: Bearer %TOKEN%"
)

REM Test 3: Create test directory
echo Test 3: Creating Test Directory
mkdir "%TEST_DIR%" 2>nul
echo Calling: POST %API_HOST%/api/files/directory
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% -d "{\"path\":\"%TEST_DIR%\",\"recursive\":true}" "%API_HOST%/api/files/directory"
echo.

echo Calling: POST %API_GATEWAY%/api/files/directory
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% -d "{\"path\":\"%TEST_DIR%\",\"recursive\":true}" "%API_GATEWAY%/api/files/directory"
echo.

REM Test 4: Write file
echo Test 4: Writing Test File
echo Calling: POST %API_HOST%/api/files/write
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% -d "{\"path\":\"%TEST_FILE%\",\"content\":\"This is a test file created by the File Service test script.\",\"createDirectory\":true}" "%API_HOST%/api/files/write"
echo.

echo Calling: POST %API_GATEWAY%/api/files/write
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% -d "{\"path\":\"%TEST_FILE%\",\"content\":\"This is a test file created by the File Service test script.\",\"createDirectory\":true}" "%API_GATEWAY%/api/files/write"
echo.

REM Test 5: List files
echo Test 5: Listing Files
echo Calling: GET %API_HOST%/api/files?path=%TEST_DIR%
curl -s -X GET %AUTH_HEADER% "%API_HOST%/api/files?path=%TEST_DIR%"
echo.

echo Calling: GET %API_GATEWAY%/api/files?path=%TEST_DIR%
curl -s -X GET %AUTH_HEADER% "%API_GATEWAY%/api/files?path=%TEST_DIR%"
echo.

REM Test 6: Read file
echo Test 6: Reading File
echo Calling: GET %API_HOST%/api/files/read?path=%TEST_FILE%
curl -s -X GET %AUTH_HEADER% "%API_HOST%/api/files/read?path=%TEST_FILE%"
echo.

echo Calling: GET %API_GATEWAY%/api/files/read?path=%TEST_FILE%
curl -s -X GET %AUTH_HEADER% "%API_GATEWAY%/api/files/read?path=%TEST_FILE%"
echo.

REM Test 7: Advanced search (Phase 3 feature)
echo Test 7: Testing Advanced Search (Phase 3)
echo Calling: POST %API_HOST%/api/search/advanced
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% -d "{\"query\":\"test\",\"path\":\"%TEST_DIR%\",\"options\":{\"includeContent\":true,\"contextLines\":2}}" "%API_HOST%/api/search/advanced"
echo.

echo Calling: POST %API_GATEWAY%/api/search/advanced
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% -d "{\"query\":\"test\",\"path\":\"%TEST_DIR%\",\"options\":{\"includeContent\":true,\"contextLines\":2}}" "%API_GATEWAY%/api/search/advanced"
echo.

REM Test 8: Create workspace (Phase 3 feature)
echo Test 8: Creating Workspace (Phase 3)
echo Calling: POST %API_HOST%/api/workspace
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% -d "{\"name\":\"Test Workspace\",\"basePath\":\"%TEST_DIR%\",\"settings\":{\"ignoredPatterns\":[\"node_modules\"],\"language\":\"typescript\"}}" "%API_HOST%/api/workspace"
echo.

echo Calling: POST %API_GATEWAY%/api/workspace
curl -s -X POST -H "Content-Type: application/json" %AUTH_HEADER% -d "{\"name\":\"Test Workspace\",\"basePath\":\"%TEST_DIR%\",\"settings\":{\"ignoredPatterns\":[\"node_modules\"],\"language\":\"typescript\"}}" "%API_GATEWAY%/api/workspace"
echo.

REM Test 9: Delete file
echo Test 9: Deleting Test File
echo Calling: DELETE %API_HOST%/api/files?path=%TEST_FILE%
curl -s -X DELETE %AUTH_HEADER% "%API_HOST%/api/files?path=%TEST_FILE%"
echo.

echo Calling: DELETE %API_GATEWAY%/api/files?path=%TEST_FILE%
curl -s -X DELETE %AUTH_HEADER% "%API_GATEWAY%/api/files?path=%TEST_FILE%"
echo.

echo ==================================
echo File Service Test Summary:
echo File operations were tested directly and through the API gateway.
echo Check the output above for details on each test.
echo For any failed tests, verify your API routes and service configuration.
echo.
echo Test file path: %TEST_FILE%
echo Test directory: %TEST_DIR%
echo ==================================

pause