@echo off
setlocal
echo ========================================
echo   Open Nexus - Setup & Installation
echo ========================================
echo.
echo This script will install all dependencies and build the project.
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Installing Node.js dependencies (npm install)...
call npm install

echo.
echo [2/2] Building the project (npm run build)...
call npm run build

echo.
echo ========================================
echo   Installation Successful!
echo ========================================
echo.
echo To start the Desktop App:
echo   npm start
echo.
echo To start Terminal Mode:
echo   npm run cli
echo.
echo To enable the global 'nexus' command:
echo   npm install -g .
echo.
pause
