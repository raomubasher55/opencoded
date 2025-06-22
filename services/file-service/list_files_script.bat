@echo off
setlocal enabledelayedexpansion

REM Script to list files in a directory using the File Service API
REM Created as part of the OpenCode project

set API_HOST=http://localhost:4001
set DEFAULT_DIR=%CD%

REM ANSI color codes (Windows 10+ supports these)
set RESET=[0m
set BLUE=[34m
set YELLOW=[33m
set RED=[31m
set GREEN=[32m
set MAGENTA=[35m
set GRAY=[90m
set BRIGHT=[1m

title OpenCode File Service - Directory Listing

REM Process command line argument or use current directory
if "%1"=="" (
  set TARGET_DIR=%DEFAULT_DIR%
) else (
  set TARGET_DIR=%~1
)

echo %BRIGHT%%BLUE%Listing files in: %RESET%%TARGET_DIR%
echo ------------------------------------------------------

REM Call the file service API
curl -s -X POST -H "Content-Type: application/json" ^
  "%API_HOST%/api/files/operation" ^
  -d "{\"operation\":\"list\",\"path\":\"%TARGET_DIR%\"}" > response.json

REM Parse the JSON response
findstr "success" response.json > nul
if errorlevel 1 (
  echo %RED%Error accessing the file service API.%RESET%
  echo Make sure the file service is running at %API_HOST%
  del response.json
  goto :EOF
)

findstr "\"success\":true" response.json > nul
if errorlevel 1 (
  echo %RED%Error: Unable to list files in the specified directory.%RESET%
  echo Details:
  type response.json
  del response.json
  goto :EOF
)

REM Check if data is empty
findstr "\"data\":\[\]" response.json > nul
if not errorlevel 1 (
  echo %YELLOW%No files found in this directory.%RESET%
  del response.json
  goto :EOF
)

REM Display the results in a nice format
echo %BRIGHT%%BLUE%Name                            Size        Type            Last Modified%RESET%
echo --------------------------------------------------------------------------------

set DIRECTORY_COUNT=0
set FILE_COUNT=0

for /F "tokens=1,2,3,4 delims=," %%a in ('type response.json ^| findstr "\"name\":\".*\",\"isDirectory\":[a-z]*,\"size\":[0-9]*,\"modifiedTime\"" ^| findstr /n "*"') do (
  set line=%%a
  set line=!line:~2!
  set name=!line!
  set name=!name:~8!
  set name=!name:~0,-1!

  set isDir=%%b
  set isDir=!isDir:~15!

  set size=%%c
  set size=!size:~7!

  set date=%%d
  set date=!date:~15!
  set date=!date:~0,-3!
  set date=!date:"=!
  
  set SIZE_DISPLAY=!size! B
  if !size! GTR 1024 (
    set /a "size_kb=!size! / 1024"
    set SIZE_DISPLAY=!size_kb! KB
    
    if !size_kb! GTR 1024 (
      set /a "size_mb=!size_kb! / 1024"
      set SIZE_DISPLAY=!size_mb! MB
    )
  )
  
  if !isDir! == true (
    set "LINE_PREFIX=%BLUE%!name!/                        "
    set /a DIRECTORY_COUNT=!DIRECTORY_COUNT!+1
    set SIZE_DISPLAY=--
    set FILE_TYPE=Directory
  ) else (
    set FILE_TYPE=File
    set /a FILE_COUNT=!FILE_COUNT!+1
    
    REM Determine file type and color
    set "LINE_PREFIX=%GRAY%!name!                          "
    
    echo !name! | findstr /i "\.js$" > nul
    if not errorlevel 1 set "LINE_PREFIX=%YELLOW%!name!                          "
    
    echo !name! | findstr /i "\.ts$" > nul
    if not errorlevel 1 set "LINE_PREFIX=%YELLOW%!name!                          "
    
    echo !name! | findstr /i "\.json$" > nul
    if not errorlevel 1 (
      set "LINE_PREFIX=%GREEN%!name!                          "
      set FILE_TYPE=JSON
    )
    
    echo !name! | findstr /i "\.md$" > nul
    if not errorlevel 1 (
      set "LINE_PREFIX=%RESET%!name!                          "
      set FILE_TYPE=Markdown
    )
    
    echo !name! | findstr /i "\.(jpg|png|gif)$" > nul
    if not errorlevel 1 (
      set "LINE_PREFIX=%MAGENTA%!name!                          "
      set FILE_TYPE=Image
    )
  )
  
  set LINE_PREFIX=!LINE_PREFIX:~0,30!
  echo !LINE_PREFIX!%RESET% %GRAY%!SIZE_DISPLAY:~0,10!   !FILE_TYPE:~0,14!  !date!%RESET%
)

echo.
echo %GRAY%!FILE_COUNT! file(s), !DIRECTORY_COUNT! director!if !DIRECTORY_COUNT! EQU 1 (echo y) else (echo ies)!%RESET%

REM Clean up
del response.json

endlocal