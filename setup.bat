@echo off
title ProxySwitch - 安装向导

echo.
echo ========================================
echo   ProxySwitch - 安装向导
echo ========================================
echo.
echo  内置 Clash.Meta + 2条线路，开箱即用
echo  支持 Chrome 和 Edge 浏览器
echo.

if not exist "%~dp0manifest.json" (
    echo [错误] 未找到 manifest.json
    pause
    exit /b 1
)
if not exist "%~dp0clash\clash.meta-windows-386.exe" (
    echo [错误] 未找到 clash 后端文件
    pause
    exit /b 1
)

echo [1/3] 启动代理后端
echo ----------------------------------------
echo 正在启动 Clash.Meta 助手（端口 7890 + API 9877）...
start "" wscript.exe //B "%~dp0start-proxy.vbs"
echo 代理后端已启动
echo.

echo [2/3] 开机自启
echo ----------------------------------------
set "startupDir=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "shortcutPath=%startupDir%\ProxySwitch.lnk"
if exist "%shortcutPath%" del /f /q "%shortcutPath%" >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell;$sc=$ws.CreateShortcut('%shortcutPath%');$sc.TargetPath='wscript.exe';$sc.Arguments='//B "%~dp0start-proxy.vbs"';$sc.WorkingDirectory='%~dp0';$sc.Save()"
if exist "%shortcutPath%" (
    echo 已创建开机自启快捷方式
    echo 以后开机自动启动，无需重复操作
) else (
    echo [警告] 快捷方式创建失败
)
echo.

echo [3/3] 加载浏览器扩展
echo ----------------------------------------
echo 请手动完成（仅需一次）：
echo.
echo Chrome：extensions page → 开发者模式 → 加载已解压的扩展 → 选择：%~dp0
echo Edge：  extensions page → 开发人员模式 → 加载解压缩的扩展 → 选择：%~dp0
echo.

echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 使用方法：
echo   1. 点击浏览器工具栏扩展图标
echo   2. 打开总开关，选择模式
echo   3. 如当前线路不可用，切换另一条
echo.
echo 线路说明（Clash 自动配置，端口固定 7890）：
echo   线路 1 - Hysteria2
echo   线路 2 - Hysteria
echo.
pause
