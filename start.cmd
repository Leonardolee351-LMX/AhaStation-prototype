@echo off
chcp 936 >nul
setlocal
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs\;C:\Program Files (x86)\nodejs\"

where node >nul 2>&1
if errorlevel 1 goto :nonode
where npm >nul 2>&1
if errorlevel 1 goto :nonode

node "start.mjs"
if errorlevel 1 goto :fail
exit /b 0

:nonode
echo 未检测到 Node.js / npm。请先安装 Node.js（https://nodejs.org），然后重新运行。
pause
exit /b 1

:fail
echo.
echo 启动失败。
pause
exit /b 1
