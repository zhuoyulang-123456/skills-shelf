# Windows 录屏 / 截图指南（给剪辑 Agent）

> 目标机器：Windows 11 x64，用户 `26503`，主机名 `ZHUOYULANG`。
> 本文所有路径都已在这台机器上核实。需要更细的卖点和脚本，见 `docs/PROMO.md`。

## 1. 软件与路径（直接可复制）

### 应用

| 用途 | 路径 |
|---|---|
| **安装版主程序（推荐）** | `C:\Users\26503\AppData\Local\Programs\Skills Shelf\Skills Shelf.exe` |
| 桌面快捷方式 | `C:\Users\26503\Desktop\Skills Shelf.lnk` |
| 开始菜单快捷方式 | `C:\Users\26503\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Skills Shelf.lnk` |
| 免安装版 | `C:\Users\26503\Desktop\Skills-Shelf-Portable-0.5.4-x64.exe` |
| 安装包 | `C:\Users\26503\Desktop\Skills-Shelf-Setup-0.5.4-x64.exe` |

版本：**0.5.4**。安装版和免安装版都已实测可启动。

### 数据目录

| 内容 | 路径 |
|---|---|
| 应用配置 | `C:\Users\26503\AppData\Roaming\Skills Shelf\settings.json` |
| 星标/调用缓存 | `C:\Users\26503\AppData\Roaming\Skills Shelf\skill-stats.json` |
| 中央技能库 | `C:\Users\26503\.skills-manager\skills` |
| **演示用 HOME（不要动真实目录）** | `C:\Users\26503\skills-demo` |
| 演示技能（Claude 示例） | `C:\Users\26503\skills-demo\.claude\skills` |

### 录制与输出

| 内容 | 路径 |
|---|---|
| 录屏工具包 | `C:\Users\26503\Desktop\SkillsShelf-RecordKit` |
| Game Bar 录像默认目录 | `C:\Users\26503\Videos\Captures` |
| 截图输出（已生成过一套） | `C:\Users\26503\Videos\SkillsShelf\shots` |
| 建议原始素材目录 | `C:\Users\26503\Videos\SkillsShelf\raw` |
| 建议成片目录 | `C:\Users\26503\Videos\SkillsShelf\final` |

### 工具

| 工具 | 路径 / 版本 |
|---|---|
| Node.js | `C:\Program Files\nodejs\node.exe`（v24.14.0，自带 WebSocket，无需 npm 安装） |
| Git | `C:\Program Files\Git\cmd\git.exe` |
| ffmpeg | **未安装**；需要命令行录屏时 `winget install --id Gyan.FFmpeg -e` |
| 显示器 | 2560 × 1600，系统缩放 150% |

## 2. 最快流程（3 条命令）

```powershell
cd C:\Users\26503\Desktop\SkillsShelf-RecordKit
powershell -ExecutionPolicy Bypass -File .\make-demo.ps1      # 生成 8 个演示技能 × 5 个 Agent 目录
powershell -ExecutionPolicy Bypass -File .\launch-demo.ps1    # 用演示数据启动，并开 CDP 9222
node .\capture-all.mjs                                        # 截 home / market / detail / settings
```

`launch-demo.ps1` 会：

1. 关掉当前正在运行的 Skills Shelf；
2. 通过 **Interactive 计划任务** 在 Session 1 启动（避免 SSH 落到 Session 0）；
3. 设置 `SKILLS_MANAGER_HOME=C:\Users\26503\skills-demo`；
4. 开启 `--remote-debugging-port=9222`；
5. 等到 9222 开始监听才返回。

启动后首页应显示：**8 个技能 / 6 个已检测工具 / 40 处安装位置**。
如果不是这组数字，说明演示目录没生成完整，重新跑 `make-demo.ps1`。

## 3. 截屏（已实测通过）

```powershell
cd C:\Users\26503\Desktop\SkillsShelf-RecordKit
node .\capture-all.mjs
```

输出（2880 × 1800，2x Retina 级）：

```
C:\Users\26503\Videos\SkillsShelf\shots\home.png
C:\Users\26503\Videos\SkillsShelf\shots\market.png
C:\Users\26503\Videos\SkillsShelf\shots\detail.png
C:\Users\26503\Videos\SkillsShelf\shots\settings.png
```

只截当前页面：

```powershell
node .\shot.mjs "C:\Users\26503\Videos\SkillsShelf\shots\custom.png"
```

说明：

- 截图通过 CDP 强制 1440 × 900 视口、2x 像素密度，不受窗口实际大小影响。
- 市场页会等卡片和星标加载后再截；网络慢时最多等 45 秒。
- AI 截图不要在这台机器上重录：演示实例没有 Key，直接用仓库里的 `docs/screenshots/ai.png`（真实 DeepSeek 结果）。

## 4. 录屏

### 方式 A：Windows Game Bar（推荐，零安装）

1. 点一下技能架窗口，让它在前台。
2. 按 **Win + Alt + R** 开始/停止录制。
3. 录像自动保存到 `C:\Users\26503\Videos\Captures`。
4. 按 **Win + G** 可以打开 Game Bar 面板，切换“录制窗口/全屏”。

建议：

- 录制前按 **Win + Up** 最大化窗口。
- 打开“专注助手/勿扰”，关掉微信、QQ、系统通知。
- 鼠标移动放慢，点击后停 0.5 秒再切下一步。
- 市场加载慢的片段，后期 2–4 倍速。

### 方式 B：ffmpeg 全屏录制（需要先安装）

```powershell
winget install --id Gyan.FFmpeg -e
mkdir C:\Users\26503\Videos\SkillsShelf\raw -Force

ffmpeg -f gdigrab -framerate 60 -i desktop -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p "C:\Users\26503\Videos\SkillsShelf\raw\full.mp4"
```

按 `q` 停止。录完在剪辑软件里裁到 16:9。

### 画面比例建议

- 显示器是 2560×1600（16:10），应用默认窗口 1180×820（约 1.44:1），最大化后左右留白。
- 成片统一 1920×1080：录全屏后裁掉上下各 80px，或把应用窗口居中放在 16:9 画布上，背景用 `#F3F2EF`。
- 系统缩放 150% 下 UI 偏大，手机上看更清楚，建议保持。

## 5. 按脚本录哪些镜头

对应 `docs/PROMO.md` 的 30 秒 / 60 秒脚本：

| 脚本段落 | 要录的画面 | 操作 |
|---|---|---|
| 痛点 | 不需要录软件 | 找几个 `.claude` / `.codex` 文件夹做空镜，或用截图 |
| 书架 | 首页统计、卡片、来源徽标 | 首页停留 3 秒，慢速上下滚 |
| 中文说明 | 卡片简介、详情四段 | 点开 `baoyu-slide-deck` 详情 |
| 搜索 | 输入「pdf」「小红书」 | 点搜索框输入，等结果收敛再清空 |
| 分类 | 切「设计创意」再回「全部」 | 点分类胶囊 |
| 安装 | 勾选 Claude / Codex / Cursor → Toast | 卡片「添加」→ 勾 3 个 → 确认 |
| 移除 | 详情里逐行「移除」 | 只录画面，演示数据可以重跑恢复 |
| 市场 | 热门 / 趋势 / 飙升、分类、下载 | 市场页切换 + 点「获取」 |
| AI | 推荐结果和理由 | 用 `docs/screenshots/ai.png`，不要录 Key |
| 设置 | 安装方式、AI 面板、备份 | 打开设置，慢慢滚 |
| 落版 | Logo + 标题 | 用 `build/icon.png` 或截图 |

需要补拍的 UI 状态，可以在应用里手动操作，再用 `node shot.mjs <路径>` 截静态图。

## 6. 常用选择器（自动化/调试用）

| 元素 | 选择器 |
|---|---|
| 搜索框 | `#searchInput` |
| 刷新 | `#refreshBtn` |
| 市场按钮 / 返回 | `#marketBtn` / `#marketBack` |
| 市场搜索 | `#marketQuery` |
| 设置 | `#settingsBtn` |
| 详情关闭 | `#drawerClose` |
| 弹窗取消 | `#modalCancel` |
| 首页卡片 | `.card[data-id]` |
| 卡片添加按钮 | `[data-action=add]` |
| 市场卡片 | `[data-market-id]` |
| 市场获取按钮 | `[data-get]` |

## 7. 收尾：恢复真实环境

录制完成后：

```powershell
# 关闭演示实例（同时结束计划任务里的父进程）
Get-Process -Name 'Skills Shelf' -ErrorAction SilentlyContinue | Stop-Process -Force

# 删除演示数据（可选，保留则下次还能用）
Remove-Item -Recurse -Force "$env:USERPROFILE\skills-demo"

# 删除计划任务
Unregister-ScheduledTask -TaskName 'SkillsShelfRecord' -Confirm:$false

# 重新打开正常实例（仅限交互式 PowerShell；SSH 里直接 Start-Process 会落到 Session 0）
Start-Process "$env:LOCALAPPDATA\Programs\Skills Shelf\Skills Shelf.exe"
```

演示数据与真实数据完全隔离在 `C:\Users\26503\skills-demo`，不会动你真实的 `.claude`、`.codex` 等目录。

## 8. 注意

- **不要通过 SSH 直接 `Start-Process` 启动 GUI**：会落到 Session 0，GPU 初始化失败、窗口不可见；必须用 `launch-demo.ps1` 的 Interactive 计划任务。录屏和手动操作要在 Windows 桌面上进行。
- 如果是在 Windows 桌面的 PowerShell 里运行，`launch-demo.ps1` 同样可用；它只是多了一层计划任务，不影响录制。
- 计划任务在应用运行期间会保持“正在运行”状态，这是正常的（父进程需要活着，子进程才不会被结束）。
- 应用未签名；如果系统弹 SmartScreen，选择「更多信息 → 仍要运行」。
- 不要录制或展示 `settings.json` 里的 Key、真实用户名路径、真实技能列表。
