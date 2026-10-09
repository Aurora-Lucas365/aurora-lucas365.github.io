@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo [1/3] 正在同步 Obsidian 里勾了 publish 的笔记...
node scripts\sync-notes.mjs
if errorlevel 1 goto end
echo [2/3] 检查有没有变化...
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo 没有新的变化，不用推送。
  goto end
)
git commit -m "更新笔记"
echo [3/3] 推送到 GitHub...
git push
if errorlevel 1 (
  echo 推送失败：检查网络，或者按提示登录 GitHub 后再双击一次。
  goto end
)
echo 完成。
:end
echo.
pause
