@echo off
title 代理开关 - 卸载向导

echo.
echo ========================================
echo   代理开关 ProxyToggle - 卸载向导
echo ========================================
echo.

echo [1/3] 移除开机自启
echo ----------------------------------------
set "shortcutPath=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ProxyStart.lnk"
if exist "%shortcutPath%" (
    del /f /q "%shortcutPath%" >nul 2>&1
    echo 已移除开机自启快捷方式
) else (
    echo 未找到开机自启项
)
echo.

echo [2/3] 停止后台服务
echo ----------------------------------------
taskkill /f /im powershell.exe /fi "WINDOWTITLE eq Clash*" >nul 2>&1
taskkill /f /im clash.meta-windows-386.exe >nul 2>&1
echo Clash 进程已停止
echo.

echo [3/3] 从浏览器移除扩展
echo ----------------------------------------
echo Chrome：chrome://extensions → 找到「代理开关」→ 点击「移除」
echo Edge：  edge://extensions → 找到「代理开关」→ 点击「删除」
echo.

echo [可选] 删除所有文件
echo ----------------------------------------
set /p del=是否删除整个 ProxyToggle 目录？(y/n): 
if /i "%del%"=="y" (
    echo 正在删除...
    cd /d "%~dp0.."
    rmdir /s /q "%~dp0" 2>nul
    echo 文件已删除。
) else (
    echo 跳过。可手动删除目录：%~dp0
)

echo.
echo ========================================
echo 卸载完成
echo ========================================
echo.
pause
