# 创建演示技能目录：不改动真实的 Agent 技能，只在 %USERPROFILE%\skills-demo 下生成
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:USERPROFILE 'skills-demo'
$skills = @(
  @{ name = 'baoyu-slide-deck';  desc = 'Generate a full slide deck from an outline with a consistent visual style.' },
  @{ name = 'baoyu-xhs-images';  desc = 'Turn an article into 1-10 cartoon-style image cards for social media.' },
  @{ name = 'baoyu-cover-image'; desc = 'Create article cover images with palette, style and title text.' },
  @{ name = 'baoyu-diagram';     desc = 'Draw architecture, flow and sequence diagrams as dark-themed SVG.' },
  @{ name = 'fin-dcf-model';     desc = 'Build and review a DCF model with sensitivity analysis.' },
  @{ name = 'agent-reach';       desc = 'Read content from Xiaohongshu, Bilibili, X, Reddit, YouTube and more.' },
  @{ name = 'baoyu-translate';   desc = 'Translate articles between Chinese and English with a glossary.' },
  @{ name = 'cinematic-director';desc = 'Turn a script into a shot list with camera direction and coverage.' }
)

$agents = @(
  '.claude\skills',
  '.codex\skills',
  '.gemini\config\skills',
  '.agents\skills',
  '.codebuddy\skills'
)

foreach ($agent in $agents) {
  $base = Join-Path $root $agent
  New-Item -ItemType Directory -Force -Path $base | Out-Null
  foreach ($s in $skills) {
    $dir = Join-Path $base $s.name
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $body = "---`nname: $($s.name)`ndescription: $($s.desc)`n---`n`n# $($s.name)`n`n$($s.desc)`n"
    Set-Content -Path (Join-Path $dir 'SKILL.md') -Value $body -Encoding UTF8
  }
}

Write-Output "demo home: $root"
Write-Output ("skills: " + $skills.Count + " x " + $agents.Count + " agent dirs")
Get-ChildItem (Join-Path $root '.claude\skills') | Select-Object -ExpandProperty Name
