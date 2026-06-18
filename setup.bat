@echo off
title ProxySwitch Setup
echo.
echo ========================================
echo   ProxySwitch Setup
echo ========================================
echo.
echo   Clash.Meta + 2 lines, ready to use
echo.

if not exist "%~dp0manifest.json" (
    echo [ERR] manifest.json not found
    pause
    exit /b 1
)
if not exist "%~dp0clash\clash.meta-windows-386.exe" (
    echo [ERR] clash core not found
    pause
    exit /b 1
)

echo [1/3] Starting Clash core...
echo ----------------------------------------
wscript.exe //B "%~dp0start-proxy.vbs"
echo Waiting for clash to start...
REM 等 8 秒让 clash-helper 下载配置并启动
timeout /t 8 /nobreak >nul
REM 检查端口 7890 是否在监听
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$t=(New-Object System.Net.Sockets.TcpClient).ConnectAsync('127.0.0.1',7890);if($t.Wait(3000)){Write-Output 'OK'}else{Write-Output 'FAIL'}" > "%TEMP%\clash_check.txt" 2>&1
findstr /c:"OK" "%TEMP%\clash_check.txt" >nul 2>&1
if %errorlevel% equ 0 (
    echo Clash is running on port 7890.
) else (
    echo [WARN] Clash did not start!
    echo Try: Right-click setup.bat -^> Run as Administrator
    echo Or check if antivirus blocked clash.meta-windows-386.exe
)
del "%TEMP%\clash_check.txt" >nul 2>&1
echo.

echo [2/3] Creating startup shortcut...
echo ----------------------------------------
set "startupDir=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "shortcutPath=%startupDir%\ProxySwitch.lnk"
if exist "%shortcutPath%" del /f /q "%shortcutPath%" >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell;$sc=$ws.CreateShortcut('%shortcutPath%');$sc.TargetPath='wscript.exe';$sc.Arguments='//B ""%~dp0start-proxy.vbs""';$sc.WorkingDirectory='%~dp0';$sc.Save()"
if exist "%shortcutPath%" (
    echo Startup shortcut created.
) else (
    echo [WARN] Failed to create shortcut.
)
echo.

echo [3/3] Load Extension...
echo ----------------------------------------
echo Open: extensions page or extensions page
echo Enable Developer Mode
echo Load unpacked: %~dp0
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
pause
