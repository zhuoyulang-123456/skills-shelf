# SkillsShelf-RecordKit

给 Windows 剪辑 Agent 用的录制工具包。完整说明见仓库 `docs/WINDOWS-RECORDING.md`。

## 三条命令

```powershell
cd C:\Users\26503\Desktop\SkillsShelf-RecordKit
powershell -ExecutionPolicy Bypass -File .\make-demo.ps1
powershell -ExecutionPolicy Bypass -File .\launch-demo.ps1
node .\capture-all.mjs
```

## 文件

| 文件 | 作用 |
|---|---|
| `make-demo.ps1` | 在 `C:\Users\26503\skills-demo` 生成 8 个演示技能 × 5 个 Agent 目录 |
| `launch-demo.ps1` | 用演示数据在交互式桌面启动应用，开 CDP 9222；自动注册 `SkillsShelfRecord` 计划任务 |
| `capture-all.mjs` | 截 home / market / detail / settings 到 `Videos\SkillsShelf\shots` |
| `shot.mjs` | 截当前页面：`node shot.mjs <输出.png>` |
| `record-screen.ps1` | 提示 Game Bar 快捷键与录像目录 |

## 录屏

- Game Bar：`Win + Alt + R` 开始/停止，输出 `C:\Users\26503\Videos\Captures`。
- 先最大化窗口（`Win + Up`），关通知，鼠标放慢。
- AI 画面直接用仓库 `docs/screenshots/ai.png`，演示实例没有配置 Key。

## 收尾

```powershell
Get-Process -Name 'Skills Shelf' -ErrorAction SilentlyContinue | Stop-Process -Force
Unregister-ScheduledTask -TaskName 'SkillsShelfRecord' -Confirm:$false
Start-Process "$env:LOCALAPPDATA\Programs\Skills Shelf\Skills Shelf.exe"
```
