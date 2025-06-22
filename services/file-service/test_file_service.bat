@echo off
REM Test script for file service on Windows

echo OpenCode File Service Test Script
echo ==================================

REM Configuration
set TARGET_DIR=D:/clientsocket
set API_HOST=http://localhost:4001
set API_GATEWAY=http://localhost:8080

REM Test various possible API endpoints
echo Testing with direct service (multiple path formats)...
echo.
echo Endpoint: %API_HOST%/api/files?path=%TARGET_DIR%
curl -s "%API_HOST%/api/files?path=%TARGET_DIR%"
echo.
echo.

echo Endpoint: %API_HOST%/api/files?path=D:/clientsocket
curl -s "%API_HOST%/api/files?path=D:/clientsocket"
echo.
echo.

echo Endpoint: %API_HOST%/files?path=%TARGET_DIR%
curl -s "%API_HOST%/files?path=%TARGET_DIR%"
echo.
echo.

echo Testing with API gateway (multiple path formats)...
echo.
echo Endpoint: %API_GATEWAY%/api/files?path=%TARGET_DIR%
curl -s "%API_GATEWAY%/api/files?path=%TARGET_DIR%"
echo.
echo.

echo Endpoint: %API_GATEWAY%/api/files?path=D:/clientsocket
curl -s "%API_GATEWAY%/api/files?path=D:/clientsocket"
echo.
echo.

echo Endpoint: %API_GATEWAY%/files?path=%TARGET_DIR%
curl -s "%API_GATEWAY%/files?path=%TARGET_DIR%"
echo.
echo.

REM Try reading a specific file
echo Testing file read operations...
echo.
echo Endpoint: %API_HOST%/api/files/read?path=%TARGET_DIR%/Remember.md
curl -s "%API_HOST%/api/files/read?path=%TARGET_DIR%/Remember.md"
echo.
echo.

echo Endpoint: %API_GATEWAY%/api/files/read?path=%TARGET_DIR%/Remember.md
curl -s "%API_GATEWAY%/api/files/read?path=%TARGET_DIR%/Remember.md"
echo.
echo.

echo ==================================
echo Listing files in directory using command:
dir "%TARGET_DIR%"
echo ==================================

echo Testing health endpoints...
echo.
echo %API_HOST%/health
curl -s "%API_HOST%/health"
echo.
echo.

echo %API_GATEWAY%/health
curl -s "%API_GATEWAY%/health"
echo.
echo.

echo Test completed. Check the responses above to identify which endpoints work.
pause