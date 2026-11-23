@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20 or newer is needed. Get it at https://nodejs.org & pause & exit /b 1)
node setup.mjs
pause
