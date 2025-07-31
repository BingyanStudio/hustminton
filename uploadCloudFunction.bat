@echo off
setlocal enabledelayedexpansion

:: 配置区域 - 请根据实际情况修改以下参数
:: 1. 环境ID已设置为云开发控制台中的实际环境ID
:: 2. 确保已通过 `tcb login` 命令完成登录认证

set "installPath=tcb"
set "envId=cloud1-7guleuaib5fb4758"
set "projectPath=%cd%"

:: 从命令行参数获取云函数名称，如果没有提供则使用默认值
if "%1" neq "" (
    set "functionName=%1"
) else (
    set "functionName=quickstartFunctions"
)

:: 检查依赖是否安装
where %installPath% >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 未找到云开发CLI工具，请先安装或配置正确的installPath
    pause
    exit /b 1
)

:: 执行云函数部署
echo 开始部署云函数 %functionName%...
%installPath% fn deploy %functionName% ^
    --env %envId% ^
    --overwrite

:: 检查部署结果
if %errorlevel% equ 0 (
    echo 云函数部署成功!
) else (
    echo 云函数部署失败，请检查错误信息
    pause
    exit /b 1
)

endlocal