# 用 Windows 自带 Game Bar 录屏的提示脚本（不强制安装任何软件）
# 开始/停止快捷键：Win + Alt + R
# 录像默认保存：%USERPROFILE%\Videos\Captures
Write-Output "录像目录: $(Join-Path $env:USERPROFILE 'Videos\Captures')"
Write-Output "开始/停止: Win + Alt + R（先点一下技能架窗口，让它在前台）"
Write-Output "Game Bar: Win + G"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Output "未安装 ffmpeg。如需命令行录屏: winget install --id Gyan.FFmpeg -e"
}
