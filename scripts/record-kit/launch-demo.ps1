# 在交互式桌面（Session 1）启动演示实例，并开启 CDP 9222。
# 直接通过 SSH 运行时会自动注册一个 Interactive 计划任务，避免落到 Session 0。
param([switch]$Run)

$ErrorActionPreference = 'Stop'
$exe = Join-Path $env:LOCALAPPDATA 'Programs\Skills Shelf\Skills Shelf.exe'
if (-not (Test-Path $exe)) { throw "找不到安装版：$exe" }
$demo = Join-Path $env:USERPROFILE 'skills-demo'

if (-not $Run) {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Run')
  $principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$env:USERNAME" -LogonType Interactive
  Register-ScheduledTask -TaskName 'SkillsShelfRecord' -Action $action -Principal $principal -Force | Out-Null
  Start-ScheduledTask -TaskName 'SkillsShelfRecord'
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Seconds 1
    $listening = Get-NetTCPConnection -LocalPort 9222 -State Listen -ErrorAction SilentlyContinue
    if ($listening) { break }
  }
  Get-Process | Where-Object { $_.ProcessName -like '*Skills*' } | Select-Object Id,SessionId,ProcessName | Format-Table -Auto
  Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue | Select-Object State,OwningProcess | Format-Table -Auto
  if (-not $listening) { throw 'CDP 9222 未启动：检查任务 SkillsShelfRecord 的运行结果' }
  exit 0
}

Get-Process -Name 'Skills Shelf' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$env:SKILLS_MANAGER_HOME = $demo
# 直接调用并保持父进程存活，避免计划任务结束后把子进程一起结束
& $exe --remote-debugging-port=9222
