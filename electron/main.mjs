import { app, BrowserWindow, dialog, ipcMain, shell, clipboard, Menu, safeStorage, screen, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const APP_NAME = 'Skills Shelf';
const HOME = process.env.SKILLS_MANAGER_HOME || os.homedir();

/* ------------------------------------------------------------------ */
/*  Agent registry                                                     */
/*  relative dirs are resolved from HOME. Add alt paths for CN builds. */
/* ------------------------------------------------------------------ */
const AGENTS = [
  // 主流编程 Agent
  { key: 'claude_code', name: 'Claude Code', dir: '.claude/skills', group: 'main' },
  { key: 'codex', name: 'Codex', dir: '.codex/skills', group: 'main' },
  { key: 'cursor', name: 'Cursor', dir: '.cursor/skills', group: 'main' },
  { key: 'opencode', name: 'OpenCode', dir: '.config/opencode/skills', alt: ['.opencode/skills'], group: 'main' },
  { key: 'github_copilot', name: 'GitHub Copilot', dir: '.copilot/skills', group: 'main' },
  { key: 'gemini_cli', name: 'Gemini CLI', dir: '.gemini/skills', group: 'main' },
  { key: 'antigravity', name: 'Antigravity', dir: '.gemini/config/skills', group: 'main' },
  { key: 'windsurf', name: 'Windsurf', dir: '.codeium/windsurf/skills', group: 'main' },
  { key: 'cline', name: 'Cline', dir: '.agents/skills', group: 'main' },
  { key: 'warp', name: 'Warp', dir: '.agents/skills', group: 'main' },
  // 国内常用
  { key: 'codebuddy', name: 'CodeBuddy', dir: '.codebuddy/skills', group: 'main' },
  { key: 'workbuddy', name: 'WorkBuddy', dir: '.workbuddy/skills', group: 'main' },
  { key: 'workbuddy_ai', name: 'WorkBuddy AI', dir: '.workbuddy-ai/skills', group: 'main' },
  { key: 'qoder', name: 'Qoder', dir: '.qoder/skills', alt: ['.qoder-cn/skills'], group: 'main' },
  { key: 'trae', name: 'TRAE', dir: '.trae/skills', group: 'main' },
  { key: 'trae_cn', name: 'TRAE CN', dir: '.trae-cn/skills', group: 'main' },
  { key: 'kimi', name: 'Kimi Code CLI', dir: '.kimi-code/skills', group: 'main' },
  { key: 'qwen', name: 'Qwen Code', dir: '.qwen/skills', group: 'main' },
  { key: 'dsh', name: 'DeepSeek Harness', dir: '.dsh/skills', group: 'main' },
  { key: 'minimax', name: 'MiniMax Code', dir: '.minimax/skills', group: 'main' },
  { key: 'doubao', name: 'Doubao', dir: 'Doubao/skills', group: 'main' },
  // 更多工具
  { key: 'roo', name: 'Roo Code', dir: '.roo/skills', group: 'more' },
  { key: 'kilo', name: 'Kilo Code', dir: '.kilocode/skills', group: 'more' },
  { key: 'continue', name: 'Continue', dir: '.continue/skills', group: 'more' },
  { key: 'droid', name: 'Droid', dir: '.factory/skills', group: 'more' },
  { key: 'goose', name: 'Goose', dir: '.config/goose/skills', group: 'more' },
  { key: 'amp', name: 'Amp', dir: '.config/agents/skills', group: 'more' },
  { key: 'replit', name: 'Replit', dir: '.config/agents/skills', group: 'more' },
  { key: 'augment', name: 'Augment', dir: '.augment/skills', group: 'more' },
  { key: 'openclaw', name: 'OpenClaw', dir: '.openclaw/skills', group: 'more' },
  { key: 'omp', name: 'OMP Agent', dir: '.omp/agent/skills', group: 'more' },
  { key: 'grok', name: 'Grok', dir: '.grok/skills', group: 'more' },
  { key: 'deepagents', name: 'Deep Agents', dir: '.deepagents/agent/skills', group: 'more' },
  { key: 'firebender', name: 'Firebender', dir: '.firebender/skills', group: 'more' },
  { key: 'bob', name: 'IBM Bob', dir: '.bob/skills', group: 'more' },
  { key: 'commandcode', name: 'Command Code', dir: '.commandcode/skills', group: 'more' },
  { key: 'cortex', name: 'Cortex Code', dir: '.snowflake/cortex/skills', group: 'more' },
  { key: 'crush', name: 'Crush', dir: '.config/crush/skills', group: 'more' },
  { key: 'iflow', name: 'iFlow CLI', dir: '.iflow/skills', group: 'more' },
  { key: 'junie', name: 'Junie', dir: '.junie/skills', group: 'more' },
  { key: 'kiro', name: 'Kiro CLI', dir: '.kiro/skills', group: 'more' },
  { key: 'kode', name: 'Kode', dir: '.kode/skills', group: 'more' },
  { key: 'mcpjam', name: 'MCPJam', dir: '.mcpjam/skills', group: 'more' },
  { key: 'vibe', name: 'Mistral Vibe', dir: '.vibe/skills', group: 'more' },
  { key: 'mux', name: 'Mux', dir: '.mux/skills', group: 'more' },
  { key: 'neovate', name: 'Neovate', dir: '.neovate/skills', group: 'more' },
  { key: 'openhands', name: 'OpenHands', dir: '.openhands/skills', group: 'more' },
  { key: 'pi', name: 'Pi', dir: '.pi/agent/skills', group: 'more' },
  { key: 'pochi', name: 'Pochi', dir: '.pochi/skills', group: 'more' },
  { key: 'zencoder', name: 'Zencoder', dir: '.zencoder/skills', group: 'more' },
  { key: 'zcode', name: 'ZCode', dir: '.zcode/skills', group: 'more' },
  { key: 'adal', name: 'AdaL', dir: '.adal/skills', group: 'more' },
  { key: 'hermes', name: 'Hermes Agent', dir: '.hermes/skills', group: 'more' },
  { key: 'qclaw', name: 'QClaw', dir: '.qclaw/skills', group: 'more' },
  { key: 'easyclaw', name: 'EasyClaw', dir: '.easyclaw/skills', group: 'more' },
  { key: 'autoclaw', name: 'AutoClaw', dir: '.openclaw-autoclaw/skills', group: 'more' },
  { key: 'gitlab_duo', name: 'GitLab Duo', dir: '.gitlab/duo/skills', group: 'more' },
  // 中央技能库
  { key: 'central', name: '中央技能库', dir: '.skills-manager/skills', group: 'library' },
];

const CATEGORIES = [
  {
    id: 'code',
    name: '编程开发',
    emoji: '💻',
    keywords: ['code', 'coding', 'api', 'sdk', 'git', 'github', 'test', 'debug', 'refactor', 'react', 'vue', 'angular', 'node', 'python', 'rust', 'java', 'kotlin', 'swift', 'flutter', 'android', 'ios', 'macos', 'linux', 'windows', 'docker', 'sql', 'database', 'server', 'frontend', 'backend', 'cli', 'shell', 'bash', 'json', 'yaml', 'deploy', 'security', 'network', 'proxy', 'shader', 'webgl', 'canvas', 'site', 'webapp', 'html', 'css', 'javascript', 'typescript', 'mcp', 'plugin', 'toolbox', '代码', '开发', '编程', '接口', '调试', '重构', '前端', '后端', '脚本', '架构', '部署', '安全', '网络'],
  },
  {
    id: 'writing',
    name: '写作内容',
    emoji: '✍️',
    keywords: ['write', 'writing', 'article', 'blog', 'copywriting', 'newsletter', 'essay', 'content', 'post', 'translate', 'translation', 'humanize', 'summarize', 'summary', 'xiaohongshu', 'marketing', '文案', '写作', '文章', '小红书', '公众号', '标题', '内容', '翻译', '润色', '总结', '改写', '口播', '营销'],
  },
  {
    id: 'design',
    name: '设计创意',
    emoji: '🎨',
    keywords: ['design', 'image', 'svg', 'ui', 'ux', 'figma', 'poster', 'cover', 'illustration', 'logo', 'brand', 'palette', 'typography', 'diagram', 'sticker', 'gif', '3d', 'blender', 'infographic', 'motion', 'midjourney', 'comfyui', 'seedream', '设计', '配图', '封面', '插画', '配色', '视觉', '绘图', '海报', '排版', '字体', '建模', '信息图', '动效'],
  },
  {
    id: 'data',
    name: '数据金融',
    emoji: '📊',
    keywords: ['fin', 'finance', 'financial', 'excel', 'xlsx', 'csv', 'valuation', 'dcf', 'accounting', 'earnings', 'stock', '财报', '估值', '数据', '表格', '分析', '金融', '统计', '财务', '股票', '研报'],
  },
  {
    id: 'office',
    name: '办公效率',
    emoji: '🗂️',
    keywords: ['pdf', 'ppt', 'pptx', 'docx', 'word', 'office', 'email', 'calendar', 'notes', 'note', 'deck', 'slides', '文档', '演示', '幻灯片', '邮件', '日程', '办公', '效率', '笔记', '待办', '会议', '纪要'],
  },
  {
    id: 'research',
    name: '研究学习',
    emoji: '🔎',
    keywords: ['research', 'study', 'paper', 'tutor', 'academic', 'arxiv', 'course', 'learn', 'wiki', 'math', 'maths', '论文', '学习', '复习', '研究', '教学', '课程', '知识', '考试', '学术', '文献', '数学', '物理', '化学', '生物'],
  },
  {
    id: 'media',
    name: '视频音频',
    emoji: '🎬',
    keywords: ['video', 'audio', 'subtitle', 'transcript', 'transcribe', 'whisper', 'podcast', 'song', 'music', 'youtube', 'bilibili', 'cinematic', 'seedance', 'kling', 'sora', 'veo', 'runway', 'higgsfield', 'dreamina', '即梦', '可灵', '海螺', 'storyboard', 'shot', '视频', '音频', '字幕', '剪辑', '转写', '配音', '音乐', '播客', '短片'],
  },
  {
    id: 'automation',
    name: '自动化',
    emoji: '⚙️',
    keywords: ['automation', 'automate', 'workflow', 'browser', 'scrape', 'crawler', 'zapier', 'n8n', 'cron', '自动化', '工作流', '浏览器', '爬取', '定时', '批量'],
  },
  { id: 'other', name: '生活其他', emoji: '🧩', keywords: [] },
];

const CATEGORY_OVERRIDES = {
  'agent-reach': 'automation',
  'songsee': 'media',
  'impeccable': 'design',
  'baoyu-article-illustrator': 'design',
  'research-report-review': 'data',
};

let summaries = {};
let marketSummaries = {};
try {
  summaries = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../data/skill-summaries.json'), 'utf8'));
} catch {}
try {
  marketSummaries = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, '../data/market-summaries.json'), 'utf8')
  );
} catch {}

let cachedAgents = null;
let scanCache = null;

const AI_PRESETS = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  minimax: { label: 'MiniMax', baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-M2' },
  mimo: { label: '小米 MiMo', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2-flash' },
  glm: { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.5-flash' },
  kimi: { label: 'Moonshot Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  qwen: { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  siliconflow: { label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { label: '自定义（OpenAI 兼容）', baseUrl: '', model: '' },
};

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */
function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function sanitizePresets(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && typeof p.name === 'string' && p.name.trim())
    .slice(0, 60)
    .map((p) => ({
      id:
        typeof p.id === 'string' && /^[a-z0-9-]{4,40}$/i.test(p.id)
          ? p.id
          : crypto.randomBytes(6).toString('hex'),
      name: String(p.name).trim().slice(0, 40),
      skillIds: Array.isArray(p.skillIds)
        ? [...new Set(p.skillIds.filter((x) => typeof x === 'string'))].slice(0, 500)
        : [],
      createdAt: Number(p.createdAt) || Date.now(),
    }));
}

function sanitizeAi(next, current) {
  const provider = Object.prototype.hasOwnProperty.call(AI_PRESETS, next?.provider)
    ? next.provider
    : current?.provider || 'deepseek';
  const preset = AI_PRESETS[provider] || AI_PRESETS.deepseek;
  return {
    provider,
    baseUrl: String(next?.baseUrl ?? current?.baseUrl ?? preset.baseUrl).trim().slice(0, 300),
    model: String(next?.model ?? current?.model ?? preset.model).trim().slice(0, 120),
    enabled: next?.enabled === undefined ? !!current?.enabled : !!next.enabled,
    keyEnc: typeof next?.keyEnc === 'string' ? next.keyEnc : current?.keyEnc || '',
  };
}

function loadSettings() {
  try {
    const s = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    return {
      customDirs: Array.isArray(s.customDirs) ? s.customDirs.filter((x) => typeof x === 'string') : [],
      installMode: s.installMode === 'symlink' ? 'symlink' : 'copy',
      presets: sanitizePresets(s.presets),
      ai: sanitizeAi(s.ai, null),
    };
  } catch {
    return { customDirs: [], installMode: 'copy', presets: [], ai: sanitizeAi(null, null) };
  }
}
function saveSettings(next) {
  const current = loadSettings();
  const s = {
    customDirs: Array.isArray(next?.customDirs) ? next.customDirs.filter((x) => typeof x === 'string') : [],
    installMode: next?.installMode === 'symlink' ? 'symlink' : 'copy',
    presets: sanitizePresets(next?.presets),
    ai: sanitizeAi(next?.ai, current.ai),
  };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
  cachedAgents = null;
  scanCache = null;
  return s;
}

function publicSettings(s = loadSettings()) {
  return {
    customDirs: s.customDirs,
    installMode: s.installMode,
    presets: s.presets,
    ai: {
      provider: s.ai.provider,
      baseUrl: s.ai.baseUrl,
      model: s.ai.model,
      enabled: s.ai.enabled,
      hasKey: !!s.ai.keyEnc && !!getAiKey(s.ai),
      presets: AI_PRESETS,
    },
  };
}

function aiCachePath() {
  return path.join(app.getPath('userData'), 'ai-summaries.json');
}
function loadAiCache() {
  try {
    const data = JSON.parse(fs.readFileSync(aiCachePath(), 'utf8'));
    return { items: data.items && typeof data.items === 'object' ? data.items : {} };
  } catch {
    return { items: {} };
  }
}
function saveAiCache(cache) {
  try {
    fs.mkdirSync(path.dirname(aiCachePath()), { recursive: true });
    fs.writeFileSync(aiCachePath(), JSON.stringify(cache));
  } catch {}
}
function getAiKey(config) {
  try {
    if (config?.keyEnc && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(config.keyEnc, 'base64'));
    }
  } catch {}
  return '';
}
function aiConfigured(config) {
  return !!(config?.baseUrl && config?.model && config?.keyEnc);
}

/* ------------------------------------------------------------------ */
/*  Agent target resolution                                            */
/* ------------------------------------------------------------------ */
function resolveHome(p) {
  return path.isAbsolute(p) ? p : path.join(HOME, p);
}

function candidatePaths(rel) {
  const list = [resolveHome(rel)];
  if (process.platform === 'win32' && String(rel).startsWith('.config/')) {
    const appData = process.env.APPDATA || path.join(HOME, 'AppData/Roaming');
    const alt = path.join(appData, String(rel).slice('.config/'.length));
    if (!list.includes(alt)) list.push(alt);
  }
  return list;
}

function buildAgentTargets() {
  if (cachedAgents) return cachedAgents;
  const settings = loadSettings();
  const byPath = new Map();
  for (const agent of AGENTS) {
    const candidates = [agent.dir, ...(agent.alt || [])].flatMap((rel) => candidatePaths(rel));
    const existing = candidates.find((p) => fs.existsSync(p));
    const dir = existing || candidates[0];
    const key = path.resolve(dir);
    if (!byPath.has(key)) {
      byPath.set(key, {
        dir,
        keys: [],
        names: [],
        group: agent.group,
        detected: false,
        custom: false,
      });
    }
    const target = byPath.get(key);
    if (!target.keys.includes(agent.key)) {
      target.keys.push(agent.key);
      target.names.push(agent.name);
    }
    if (existing) target.detected = true;
  }
  for (const dir of settings.customDirs) {
    if (!dir || !path.isAbsolute(dir)) continue;
    const key = path.resolve(dir);
    if (!byPath.has(key)) {
      const base = path.basename(dir);
      const parent = path.basename(path.dirname(dir));
      const grand = path.basename(path.dirname(path.dirname(dir)));
      const label =
        base === 'skills' && parent.startsWith('.')
          ? `${grand}/${parent}/${base}`
          : base === 'skills' && parent
            ? `${parent}/${base}`
            : base || '自定义目录';
      byPath.set(key, {
        dir,
        keys: [`custom:${key}`],
        names: [label],
        group: 'custom',
        detected: fs.existsSync(dir),
        custom: true,
      });
    }
  }
  cachedAgents = [...byPath.values()].map((x, i) => ({
    ...x,
    id: `t${i}`,
    label: x.names.join(' / '),
    installed: x.detected,
  }));
  return cachedAgents;
}

function agentTargetsPublic() {
  return buildAgentTargets().map((t) => ({
    id: t.id,
    keys: t.keys,
    label: t.label,
    dir: t.dir,
    group: t.group,
    detected: t.detected,
    custom: t.custom,
    installed: t.installed,
  }));
}

/* ------------------------------------------------------------------ */
/*  Skill scanning                                                     */
/* ------------------------------------------------------------------ */
function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
function pathExists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.DS_Store', 'release', 'dist', 'build']);

function findSkillDirs(root, depth = 0, out = [], visited = new Set()) {
  if (depth > 3 || !isDir(root)) return out;
  let real = root;
  try {
    real = fs.realpathSync(root);
  } catch {}
  if (visited.has(real)) return out;
  visited.add(real);
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  const skillFile = entries.find(
    (e) => (e.name === 'SKILL.md' || e.name === 'skill.md') && isFile(path.join(root, e.name))
  );
  if (skillFile) {
    out.push({ dir: root, file: path.join(root, skillFile.name) });
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
    const full = path.join(root, e.name);
    if (!isDir(full)) continue;
    findSkillDirs(full, depth + 1, out, visited);
  }
  return out;
}

function parseFrontmatter(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  if (!text.startsWith('---')) return { meta: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: text };
  const block = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, '');
  const meta = {};
  let currentKey = '';
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      const value = m[2].replace(/^['"]|['"]$/g, '').trim();
      meta[currentKey] = value === '|' || value === '>' || value === '|-' || value === '>-' ? '' : value;
    } else if (currentKey && /^\s+/.test(line)) {
      const extra = line.trim();
      if (extra) meta[currentKey] = meta[currentKey] ? `${meta[currentKey]} ${extra}` : extra;
    }
  }
  return { meta, body };
}

function firstUsefulParagraph(body) {
  const lines = String(body || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('>'));
  const text = lines.slice(0, 3).join(' ').replace(/[*_`]/g, '').trim();
  return text.slice(0, 300);
}

function normalizeName(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
}

function escapeRe(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordHit(text, keyword) {
  const kw = String(keyword).toLowerCase();
  if (!kw) return false;
  if (/^[a-z0-9.+#-]+$/i.test(kw)) {
    const edge = '[^a-z0-9]';
    const tail = kw.length >= 3 ? 's?' : '';
    return new RegExp(`(^|${edge})${escapeRe(kw)}${tail}(${edge}|$)`, 'i').test(text);
  }
  return text.includes(kw);
}

function classify(name, description, body) {
  const override = CATEGORY_OVERRIDES[String(name || '').toLowerCase()];
  if (override) {
    const cat = CATEGORIES.find((c) => c.id === override);
    if (cat) return cat;
  }
  const nameText = String(name || '').toLowerCase();
  const descText = String(description || '').toLowerCase();
  const bodyText = String(body || '').slice(0, 2000).toLowerCase();
  let best = CATEGORIES[CATEGORIES.length - 1];
  let score = 0;
  for (const cat of CATEGORIES) {
    let level = 0;
    let hits = 0;
    for (const kw of cat.keywords) {
      let w = 0;
      if (keywordHit(nameText, kw)) w = 3;
      else if (keywordHit(descText, kw)) w = 2;
      else if (keywordHit(bodyText, kw)) w = 1;
      if (w) {
        hits += 1;
        if (w > level) level = w;
      }
    }
    const s = level * 100 + Math.min(hits, 20);
    if (s > score) {
      score = s;
      best = cat;
    }
  }
  return best;
}

function fallbackSummary(name, description, category) {
  const hasCjk = /[\u4e00-\u9fff]/.test(description || '');
  const what =
    hasCjk && description
      ? description
      : `面向${category.name}场景的中文技能「${name}」，把常用步骤、判断和脚本整理成可复用流程。`;
  return {
    what,
    when: `当任务需要${category.name}相关能力时`,
    pros: '减少从零摸索：把这类任务的常用步骤和判断固化成一套可重复执行的流程。',
    cons: '简介由程序自动生成；具体步骤和适用边界建议先看 SKILL.md',
  };
}

const GITHUB_RE = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/;

function repoFromGitConfig(dir) {
  let cur = dir;
  for (let i = 0; i < 3; i += 1) {
    try {
      const cfg = fs.readFileSync(path.join(cur, '.git', 'config'), 'utf8');
      const m = cfg.match(/url\s*=\s*(\S+)/);
      if (m) {
        const url = m[1].replace(/^git@github\.com:/, 'https://github.com/');
        const r = url.match(GITHUB_RE);
        if (r) return `${r[1]}/${r[2].replace(/\.git$/, '')}`;
      }
    } catch {}
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return '';
}

function repoFromFrontmatter(raw) {
  const text = String(raw || '');
  if (!text.startsWith('---')) return '';
  const end = text.indexOf('\n---', 3);
  if (end < 0) return '';
  const frontmatter = text.slice(3, end);
  // Only trust explicit repository fields; body links are often unrelated.
  const keyRe = /^\s*(homepage|repository|repo|source|url|website|git|github)\s*:\s*(.+)$/i;
  for (const line of frontmatter.split(/\r?\n/)) {
    const m = line.match(keyRe);
    if (!m) continue;
    const hit = m[2].match(GITHUB_RE);
    if (!hit) continue;
    const owner = hit[1].toLowerCase();
    if (['topics', 'features', 'marketplace', 'login', 'apps', 'sponsors'].includes(owner)) continue;
    return `${hit[1]}/${hit[2].replace(/\.git$/, '')}`;
  }
  return '';
}

function detectRepo(skillDir, raw) {
  return repoFromGitConfig(skillDir) || repoFromFrontmatter(raw);
}

function readSkill(skillDir, skillFile) {
  let raw = '';
  try {
    raw = fs.readFileSync(skillFile, 'utf8');
  } catch {
    return null;
  }
  const { meta, body } = parseFrontmatter(raw);
  const folder = path.basename(skillDir);
  const name = String(meta.name || folder).trim();
  const description = String(meta.description || firstUsefulParagraph(body) || '').trim();
  const category = classify(name, description, body);
  const found =
    summaries[name] ||
    summaries[name.toLowerCase()] ||
    summaries[folder] ||
    summaries[folder.toLowerCase()];
  const summary = !found
    ? fallbackSummary(name, description, category)
    : typeof found === 'string'
      ? {
          what: found,
          when: `当任务需要${category.name}相关能力时`,
          pros: '把这类任务的常用步骤和判断整理成可复用流程。',
          cons: '具体效果取决于技能内容和模型，使用前建议先看 SKILL.md',
        }
      : found;
  return {
    name,
    description,
    body: body.slice(0, 20000),
    raw: raw.slice(0, 20000),
    meta,
    category,
    summary,
    hash: crypto.createHash('sha1').update(raw).digest('hex'),
    mtime: (() => {
      try {
        return fs.statSync(skillFile).mtimeMs;
      } catch {
        return 0;
      }
    })(),
    file: skillFile,
    repo: detectRepo(skillDir, raw),
  };
}

function scanSkills(force = false) {
  if (!force && scanCache) return scanCache;
  if (force) cachedAgents = null;
  const targets = buildAgentTargets();
  const byName = new Map();
  for (const target of targets) {
    if (!isDir(target.dir)) continue;
    const dirs = findSkillDirs(target.dir);
    for (const item of dirs) {
      const skill = readSkill(item.dir, item.file);
      if (!skill) continue;
      const key = normalizeName(skill.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push({
        ...skill,
        path: item.dir,
        agentNames: target.names.slice(),
        agentKeys: target.keys.slice(),
        targetDir: target.dir,
      });
    }
  }
  const skills = [];
  for (const [key, occurrences] of byName) {
    occurrences.sort((a, b) => b.mtime - a.mtime);
    const primary = occurrences[0];
    const sourceAgents = [...new Set(occurrences.flatMap((o) => o.agentNames))];
    const sourcePaths = [...new Set(occurrences.map((o) => o.path))];
    const hashes = [...new Set(occurrences.map((o) => o.hash))];
    const id = crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
    skills.push({
      id,
      name: primary.name,
      description: primary.description,
      summary: primary.summary,
      category: primary.category.id,
      categoryName: primary.category.name,
      categoryEmoji: primary.category.emoji,
      path: primary.path,
      file: primary.file,
      mtime: primary.mtime,
      hash: primary.hash,
      sourceAgents,
      sourcePaths,
      multipleVersions: hashes.length > 1,
      targetDir: primary.targetDir,
      repo: primary.repo || occurrences.find((o) => o.repo)?.repo || '',
    });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const categories = CATEGORIES.map((c) => ({
    ...c,
    count: skills.filter((s) => s.category === c.id).length,
  }));
  scanCache = {
    skills,
    categories,
    agents: agentTargetsPublic(),
    stats: {
      total: skills.length,
      tools: targets
        .filter((t) => t.installed && !t.custom)
        .reduce((n, t) => n + t.names.length, 0),
      categories: categories.filter((c) => c.count > 0).length,
      occurrences: skills.reduce((n, s) => n + s.sourcePaths.length, 0),
    },
  };
  return scanCache;
}

function findSkill(id) {
  const scan = scanSkills();
  return scan.skills.find((s) => s.id === id) || null;
}

/* ------------------------------------------------------------------ */
/*  GitHub stars, local usage, skills.sh market                        */
/* ------------------------------------------------------------------ */
const HOT_STARS = 5000;
const STATS_TTL = 24 * 3600 * 1000;
const USAGE_TTL = 6 * 3600 * 1000;
const CATALOG_TTL = 24 * 3600 * 1000;
const HTTP_UA = 'skills-manager/0.3';

function statsPath() {
  return path.join(app.getPath('userData'), 'skill-stats.json');
}

function loadStats() {
  const empty = {
    version: 1,
    usage: {},
    usageFiles: {},
    usageAt: 0,
    matches: {},
    repos: {},
    catalog: {},
    catalogAt: 0,
    translations: {},
    abstracts: {},
    marketDesc: {},
    boards: {},
    githubBlockedAt: 0,
  };
  try {
    const parsed = JSON.parse(fs.readFileSync(statsPath(), 'utf8'));
    return {
      ...empty,
      ...parsed,
      usage: parsed.usage && typeof parsed.usage === 'object' ? parsed.usage : {},
      usageFiles: parsed.usageFiles && typeof parsed.usageFiles === 'object' ? parsed.usageFiles : {},
      matches: parsed.matches && typeof parsed.matches === 'object' ? parsed.matches : {},
      repos: parsed.repos && typeof parsed.repos === 'object' ? parsed.repos : {},
      catalog: parsed.catalog && typeof parsed.catalog === 'object' ? parsed.catalog : {},
      translations:
        parsed.translations && typeof parsed.translations === 'object' ? parsed.translations : {},
      marketDesc: parsed.marketDesc && typeof parsed.marketDesc === 'object' ? parsed.marketDesc : {},
      abstracts: parsed.abstracts && typeof parsed.abstracts === 'object' ? parsed.abstracts : {},
      boards: parsed.boards && typeof parsed.boards === 'object' ? parsed.boards : {},
    };
  } catch {
    return empty;
  }
}

function saveStats(cache) {
  try {
    fs.mkdirSync(path.dirname(statsPath()), { recursive: true });
    fs.writeFileSync(statsPath(), JSON.stringify(cache));
  } catch {}
}

async function fetchWithTimeout(url, { timeout = 15000, headers = {}, ...rest } = {}) {
  // Use Chromium's network stack so system proxies / Windows proxy settings apply.
  return net.fetch(url, {
    ...rest,
    headers: { 'User-Agent': HTTP_UA, ...headers },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
}

async function fetchHead(url, { timeout = 12000, maxBytes = 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await net.fetch(url, {
      headers: { 'User-Agent': HTTP_UA },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      if (buf.includes('</head>') || buf.length >= maxBytes) {
        try {
          await reader.cancel();
        } catch {}
        break;
      }
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetchWithTimeout(url, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* ---- local usage: Claude Code session logs (read-only) ---- */
function walkJsonl(dir, depth, out) {
  if (depth > 4) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkJsonl(full, depth + 1, out);
    else if (e.name.endsWith('.jsonl')) out.push(full);
  }
}

function normalizeUsageName(value) {
  return String(value || '')
    .replace(/^\/+/, '')
    .split(':')
    .pop()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function collectSkillUses(value, counts) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectSkillUses(item, counts);
    return;
  }
  if (value.type === 'tool_use' && String(value.name || '').toLowerCase() === 'skill') {
    const key = normalizeUsageName(value.input?.skill || value.input?.name || '');
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  for (const v of Object.values(value)) collectSkillUses(v, counts);
}

function countUsageInFile(file) {
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  const counts = {};
  if (text.includes('"name":"Skill"')) {
    for (const line of text.split('\n')) {
      if (!line.includes('"name":"Skill"')) continue;
      try {
        collectSkillUses(JSON.parse(line), counts);
      } catch {}
    }
  } else {
    const re = /<command-name>\/?([^<]+)<\/command-name>/g;
    let m;
    while ((m = re.exec(text))) {
      const key = normalizeUsageName(m[1]);
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

function scanLocalUsage(cache) {
  const root = path.join(HOME, '.claude', 'projects');
  const files = [];
  walkJsonl(root, 0, files);
  if (!files.length) return {};
  const cutoff = Date.now() - 120 * 864e5;
  const entries = [];
  for (const file of files) {
    try {
      const st = fs.statSync(file);
      if (st.mtimeMs < cutoff) continue;
      entries.push({ file, mtime: st.mtimeMs, size: st.size });
    } catch {}
  }
  entries.sort((a, b) => b.mtime - a.mtime);
  let budget = 80 * 1024 * 1024;
  const usage = {};
  const nextFiles = {};
  for (const entry of entries) {
    if (budget <= 0) break;
    const prev = cache.usageFiles?.[entry.file];
    let counts;
    if (prev && prev.mtime === entry.mtime && prev.size === entry.size && prev.counts) {
      counts = prev.counts;
    } else {
      if (entry.size > 40 * 1024 * 1024) continue;
      budget -= entry.size;
      counts = countUsageInFile(entry.file);
    }
    nextFiles[entry.file] = { mtime: entry.mtime, size: entry.size, counts };
    for (const [key, n] of Object.entries(counts)) usage[key] = (usage[key] || 0) + n;
  }
  cache.usageFiles = nextFiles;
  return usage;
}

async function scanOpenCodeUsage() {
  const db = path.join(HOME, '.local', 'share', 'opencode', 'opencode.db');
  if (!isFile(db)) return {};
  try {
    const { stdout } = await promisify(execFile)(
      'sqlite3',
      ['-readonly', db, 'select data from part where data like \'%"tool":"skill"%\''],
      { timeout: 20000, maxBuffer: 16 * 1024 * 1024 }
    );
    const counts = {};
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      try {
        const part = JSON.parse(line);
        const name = part?.state?.input?.name || part?.input?.name || '';
        const key = normalizeUsageName(name);
        if (key) counts[key] = (counts[key] || 0) + 1;
      } catch {}
    }
    return counts;
  } catch {
    return {};
  }
}

/* ---- skills.sh catalog + market ---- */
function parseMarketHtml(html) {
  const text = String(html || '').replace(/\\"/g, '"');
  const re = /"source":"([^"\\]+)"(?:(?!\{)[\s\S]){0,700}?"skillId":"([^"\\]+)"(?:(?!\{)[\s\S]){0,700}?"installs":(\d+)/g;
  const map = new Map();
  let m;
  while ((m = re.exec(text))) {
    const source = m[1];
    const skillId = m[2];
    const installs = Number(m[3]) || 0;
    if (!source.includes('/') || !skillId || skillId.length > 120) continue;
    const chunk = text.slice(m.index, m.index + m[0].length);
    const name = (chunk.match(/"name":"([^"]*)"/) || [])[1] || skillId;
    map.set(`${source}/${skillId}`, { source, skillId, name, installs });
  }
  return [...map.values()].sort((a, b) => b.installs - a.installs);
}

const boardCache = new Map();
const BOARD_TTL = 10 * 60 * 1000;

async function fetchBoardItems(board = 'all') {
  const cached = boardCache.get(board);
  if (cached && Date.now() - cached.at < BOARD_TTL) return cached.items;
  const stats = loadStats();
  const saved = stats.boards?.[board];
  if (saved && Array.isArray(saved.items) && saved.items.length && Date.now() - (saved.at || 0) < 6 * 3600 * 1000) {
    boardCache.set(board, { at: saved.at, items: saved.items });
    return saved.items;
  }
  const url =
    board === 'trending'
      ? 'https://skills.sh/trending'
      : board === 'hot'
        ? 'https://skills.sh/hot'
        : 'https://skills.sh/';
  const res = await fetchWithTimeout(url, { timeout: 10000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = parseMarketHtml(await res.text());
  boardCache.set(board, { at: Date.now(), items });
  stats.boards = stats.boards || {};
  stats.boards[board] = { at: Date.now(), items };
  saveStats(stats);
  return items;
}

async function refreshCatalog(cache) {
  const boards = await Promise.allSettled([
    fetchBoardItems('all'),
    fetchBoardItems('trending'),
    fetchBoardItems('hot'),
  ]);
  const catalog = {};
  for (const result of boards) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value.slice(0, 400)) {
      const key = item.skillId.toLowerCase();
      if (!catalog[key] || catalog[key].installs < item.installs) catalog[key] = item;
    }
  }
  if (Object.keys(catalog).length) {
    cache.catalog = catalog;
    cache.catalogAt = Date.now();
  }
}

/* ---- GitHub stars via repo page (no API quota) ---- */
async function fetchRepoMeta(repo) {
  const res = await fetchWithTimeout(`https://github.com/${repo}`, { timeout: 15000 });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const html = await res.text();
  const stars = Number((html.match(/"stargazerCount":(\d+)/) || [])[1]) || 0;
  const branch = (html.match(/"defaultBranch":"([^"]+)"/) || [])[1] || '';
  return { stars, branch };
}

async function ensureStars(repos, cache, limit = 40) {
  const now = Date.now();
  if (now - (cache.githubBlockedAt || 0) < 3600 * 1000) return;
  const todo = [...new Set(repos)]
    .filter((r) => r && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(r))
    .filter((r) => {
      const c = cache.repos[r];
      return !c || now - (c.at || 0) > STATS_TTL;
    })
    .slice(0, limit);
  let index = 0;
  let blocked = false;
  const worker = async () => {
    while (index < todo.length && !blocked) {
      const repo = todo[index];
      index += 1;
      try {
        const meta = await fetchRepoMeta(repo);
        const prev = cache.repos[repo] || {};
        cache.repos[repo] = {
          stars: meta.stars,
          branch: meta.branch || prev.branch || 'main',
          at: Date.now(),
        };
      } catch (e) {
        if (e.status === 403 || e.status === 429) {
          blocked = true;
          cache.githubBlockedAt = Date.now();
          return;
        }
        cache.repos[repo] = { ...(cache.repos[repo] || {}), stars: 0, at: Date.now() };
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

function statsForSkill(skill, cache) {
  const key = String(skill.name || '').toLowerCase();
  const base = String(path.basename(skill.path || '')).toLowerCase();
  const match = cache.matches[key] || cache.matches[base];
  const repo = skill.repo || match?.repo || '';
  const info = repo ? cache.repos[repo] : null;
  const usage =
    cache.usage[key] ||
    cache.usage[base] ||
    cache.usage[key.split(':').pop()] ||
    0;
  return {
    repo,
    stars: Number(info?.stars) || 0,
    installs: Number(match?.installs) || 0,
    usage,
    matchedFrom: skill.repo ? 'repo' : match ? 'skills.sh' : '',
  };
}

function attachStats(scan) {
  const cache = loadStats();
  const settings = loadSettings();
  const aiOn = settings.ai.enabled && aiConfigured(settings.ai);
  const aiCache = aiOn ? loadAiCache() : null;
  for (const skill of scan.skills) {
    skill.stats = statsForSkill(skill, cache);
    if (aiOn) {
      const ai = aiCache?.items[`local:${skill.id}`];
      if (ai?.what && (!ai.hash || ai.hash === skill.hash)) {
        skill.summary = { ...skill.summary, what: ai.what, when: ai.when || skill.summary?.when, ai: true };
        skill.aiSummary = true;
      }
    }
  }
  return scan;
}

let enriching = false;
let enrichEmitTimer = null;

function scheduleEnrichEmit() {
  clearTimeout(enrichEmitTimer);
  enrichEmitTimer = setTimeout(() => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('skills:enriched');
  }, 400);
}

async function refreshEnrichment(force = false) {
  if (enriching) return;
  enriching = true;
  try {
    const cache = loadStats();
    const now = Date.now();

    // 1) Local usage from Claude Code logs — fast, available immediately.
    if (force || now - (cache.usageAt || 0) > USAGE_TTL) {
      cache.usage = scanLocalUsage(cache);
      cache.usageAt = now;
      saveStats(cache);
      scheduleEnrichEmit();
      const opencode = await scanOpenCodeUsage();
      let merged = false;
      for (const [key, n] of Object.entries(opencode)) {
        cache.usage[key] = (cache.usage[key] || 0) + n;
        merged = true;
      }
      if (merged) {
        saveStats(cache);
        scheduleEnrichEmit();
      }
    }

    // 2) Stars for repos we can identify locally (.git / frontmatter).
    const scan = scanSkills();
    const directRepos = [...new Set(scan.skills.map((s) => s.repo).filter(Boolean))];
    await ensureStars(directRepos, cache, 30);
    saveStats(cache);
    scheduleEnrichEmit();

    // 3) Fill gaps via the skills.sh catalog, then fetch their stars.
    if (force || now - (cache.catalogAt || 0) > CATALOG_TTL) {
      try {
        await refreshCatalog(cache);
      } catch {}
      let changed = false;
      for (const skill of scan.skills) {
        const key = String(skill.name || '').toLowerCase();
        if (!skill.repo && !cache.matches[key] && cache.catalog[key]) {
          const item = cache.catalog[key];
          cache.matches[key] = {
            source: item.source,
            repo: item.source,
            skillId: item.skillId,
            installs: item.installs,
            at: now,
          };
          changed = true;
        }
      }
      saveStats(cache);
      const repoSet = [
        ...new Set(Object.values(cache.matches).map((m) => m?.repo).filter(Boolean)),
      ];
      if (changed) await ensureStars(repoSet, cache, 30);
      // Warm the market's top repos so the first visit shows stars immediately.
      const topRepos = Object.values(cache.catalog)
        .sort((a, b) => b.installs - a.installs)
        .slice(0, 12)
        .map((x) => x.source);
      await ensureStars(topRepos, cache, 12);
      saveStats(cache);
      if (changed) scheduleEnrichEmit();
    }
  } catch (e) {
    console.error('技能数据刷新失败', e);
  } finally {
    enriching = false;
  }
}

/* ---- Chinese descriptions for the market ---- */
function isCjkText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ''));
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function pruneByTime(obj, max) {
  const entries = Object.entries(obj || {}).sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0));
  return Object.fromEntries(entries.slice(0, max));
}

function splitEnDescription(en) {
  let text = String(en || '')
    .replace(/\s+/g, ' ')
    .trim();
  let when = '';
  const marker = text.match(
    /\b(?:use (?:this|it|the skill)?\s*(?:when|to|for|if)|used when|use when)\b[:\s-]*/i
  );
  if (marker) {
    when = text.slice(marker.index + marker[0].length).trim();
    text = text.slice(0, marker.index).trim();
  }
  text = text.replace(/^this skill\s+(?:helps|allows|lets|is used)[^.]*\.\s*/i, '');
  when = when.replace(/^[:：\s-]+/, '');
  return { main: text, when };
}

function shortenZh(text, limit) {
  let value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  value = value
    .replace(/^(该技能|此技能|这个技能|此功能|使用此技能|技能)\s*[：:，,]?\s*/, '')
    .replace(/^当用户(想要|希望|需要)?/, '当需要')
    .replace(/时使用[。.]?$/, '')
    .replace(/[。.]$/, '');
  if (/已弃用|弃用的兼容/.test(value) && value.length > 24) {
    return '已弃用的兼容别名，建议改用新名称';
  }
  const framed = value.match(/^适用于(.{4,})的(.{2,})$/);
  if (framed) {
    const scope = framed[1].replace(/明确选择的/g, '').replace(/工作流程/g, '工作流');
    const thing = framed[2];
    const rebuilt = `${thing}，适合${scope}`;
    if (rebuilt.length <= limit + 12) value = rebuilt;
  } else {
    value = value.replace(/^适用于现有/, '适用于');
  }
  if (value.length > limit) {
    const cut = Math.max(
      value.lastIndexOf('。', 0, limit),
      value.lastIndexOf('；', 0, limit),
      value.lastIndexOf('，', 0, limit),
      value.lastIndexOf('、', 0, limit)
    );
    value = cut > limit * 0.5 ? value.slice(0, cut) : value.slice(0, limit);
    value = value.replace(/[，,、；;：:\s]+$/, '');
  }
  value = value
    .replace(/^当?(用户|你)?(需要|想要|希望)?/, '')
    .replace(/（[^）]*）?$/, '')
    .replace(/["“”][^"“”]*$/, '')
    .replace(/(以及|并且|或者|和|或|的|地|得|以|在|对|把|将|为|与|及)+$/, '')
    .replace(/[…]+$/, '')
    .replace(/[，,、；;：:\s]+$/, '');
  return value;
}

async function summarizeDescription(en, cache) {
  const raw = String(en || '').trim();
  if (!raw) return { what: '', when: '' };
  const key = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 20);
  const hit = cache.abstracts?.[key];
  if (hit?.what && isCjkText(hit.what)) return { what: hit.what, when: hit.when || '' };

  if (/installable skill|可安装技能|AI 代理的可安装/i.test(raw)) return { what: '', when: '' };
  const split = splitEnDescription(raw);
  let main = split.main;
  let when = split.when;
  if (!main && when) {
    main = when;
    when = '';
  }
  const payload = main + (when ? `\n---\n${when}` : '');
  const zh = await translateText(payload, cache);
  if (!zh || !isCjkText(zh)) return { what: '', when: '' };
  const parts = zh
    .split(/\n?\s*-{2,}\s*\n?/)
    .map((part) => part.replace(/^[-\s]+/, '').trim())
    .filter(Boolean);
  const primary = parts[0] || zh.replace(/^[-\s]+/, '');
  const what = shortenZh(primary, 46);
  const whenZh = shortenZh(parts[1] || '', 24);
  if (what) cache.abstracts[key] = { what, when: whenZh, at: Date.now() };
  return { what, when: whenZh };
}

async function translateText(text, cache) {
  const clean = String(text || '').trim().slice(0, 1200);
  if (!clean) return '';
  if (isCjkText(clean)) return clean;
  const key = crypto.createHash('sha1').update(clean).digest('hex').slice(0, 20);
  const hit = cache.translations?.[key];
  if (hit?.zh) return hit.zh;

  try {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=' +
      encodeURIComponent(clean);
    const res = await fetchWithTimeout(url, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (res.ok) {
      const data = await res.json();
      const zh = (Array.isArray(data?.[0]) ? data[0] : [])
        .map((part) => (Array.isArray(part) ? part[0] : ''))
        .join('')
        .trim();
      if (zh && isCjkText(zh)) {
        cache.translations[key] = { zh, at: Date.now() };
        return zh;
      }
    }
  } catch {}

  try {
    const res = await fetchWithTimeout(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean.slice(0, 450))}&langpair=en|zh-CN`,
      { timeout: 10000 }
    );
    if (res.ok) {
      const data = await res.json();
      const zh = String(data?.responseData?.translatedText || '').trim();
      if (zh && isCjkText(zh) && !/MYMEMORY/i.test(zh)) {
        cache.translations[key] = { zh, at: Date.now() };
        return zh;
      }
    }
  } catch {}
  return '';
}

async function marketDescribe(items) {
  const cache = loadStats();
  const settings = loadSettings();
  const aiOn = settings.ai.enabled && aiConfigured(settings.ai);
  const aiKey = aiOn ? getAiKey(settings.ai) : '';
  const aiCache = aiOn ? loadAiCache() : null;
  let aiChanged = false;
  const list = (Array.isArray(items) ? items : [])
    .filter((x) => x && x.source && x.skillId)
    .slice(0, 18);
  const out = {};
  let changed = false;
  const chunks = [];
  for (let i = 0; i < list.length; i += 3) chunks.push(list.slice(i, i + 3));
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (item) => {
        const id = `${item.source}/${item.skillId}`;
        const bundled = marketSummaries[id];
        if (bundled?.what || bundled?.zh) {
          out[id] = { what: bundled.what || bundled.zh, when: bundled.when || '' };
          return;
        }
        const aiHit = aiCache?.items[`market:${id}`];
        if (aiHit?.what) {
          out[id] = { what: aiHit.what, when: aiHit.when || '' };
          return;
        }
        const prev = cache.marketDesc[id];
        const fresh = prev && Date.now() - (prev.at || 0) < 7 * 864e5;
        if (fresh && prev.what && isCjkText(prev.what) && prev.what.length <= 52) {
          out[id] = { what: prev.what, when: prev.when || '' };
          return;
        }
        if (fresh && prev.zh && isCjkText(prev.zh) && prev.zh.length <= 52) {
          out[id] = { what: prev.zh, when: '' };
          return;
        }
        try {
          const html = await fetchHead(`https://skills.sh/${item.source}/${item.skillId}`);
          const raw = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
          const desc = decodeEntities(raw).trim();
          if (!desc) return;
          if (aiOn && aiKey) {
            try {
              const text = await callAi({
                config: settings.ai,
                key: aiKey,
                messages: buildSummaryMessages({
                  name: item.name || item.skillId,
                  source: item.source,
                  description: desc,
                }),
                maxTokens: 300,
              });
              const parsed = parseAiSummary(text);
              if (parsed.what && isCjkText(parsed.what)) {
                const record = {
                  ...parsed,
                  at: Date.now(),
                  provider: settings.ai.provider,
                  model: settings.ai.model,
                };
                aiCache.items[`market:${id}`] = record;
                out[id] = { what: parsed.what, when: parsed.when };
                aiChanged = true;
                return;
              }
            } catch {}
          }
          const abstract = await summarizeDescription(desc, cache);
          if (abstract.what) {
            cache.marketDesc[id] = {
              what: abstract.what,
              when: abstract.when,
              en: desc.slice(0, 600),
              at: Date.now(),
            };
            out[id] = abstract;
            changed = true;
          }
        } catch {}
      })
    );
  }
  cache.translations = pruneByTime(cache.translations || {}, 800);
  cache.abstracts = pruneByTime(cache.abstracts || {}, 400);
  cache.marketDesc = pruneByTime(cache.marketDesc || {}, 400);
  if (changed) saveStats(cache);
  if (aiChanged) saveAiCache(aiCache);
  return out;
}

/* ---- market API ---- */
/* ---- optional AI summaries (user-provided key) ---- */
const AI_SUMMARY_SYSTEM = `你是技能目录编辑。请根据技能信息，用中文写一条精炼摘要，帮助用户判断它做什么、什么时候用、强在哪。

只输出 JSON，不要 Markdown 代码块：
{"what":"28-45个字，具体说明功能和独特价值，不要以‘该技能/此技能/本技能’开头，不要直译，不要营销腔","when":"10-22个字，最适合的使用场景"}

要求：
- 保留产品名、框架名、命令名原文。
- 不要重复技能名。
- 不要编造输入中没有的事实。`;

function aiChatUrl(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

async function callAi({ config, key, messages, maxTokens = 350, temperature = 0.2, timeout = 30000 }) {
  const res = await fetchWithTimeout(aiChatUrl(config.baseUrl), {
    method: 'POST',
    timeout,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('模型没有返回内容');
  return String(text);
}

async function aiTest(payload = {}) {
  const settings = loadSettings();
  const config = sanitizeAi(
    { ...settings.ai, ...payload, keyEnc: settings.ai.keyEnc },
    settings.ai
  );
  const key = String(payload.apiKey || '').trim() || getAiKey(settings.ai);
  if (!/^https?:\/\//.test(config.baseUrl)) return { ok: false, error: '接口地址需要以 http(s):// 开头' };
  if (!config.model) return { ok: false, error: '请填写模型名' };
  if (!key) return { ok: false, error: '请先输入 API Key' };
  try {
    const started = Date.now();
    const reply = await callAi({
      config,
      key,
      messages: [{ role: 'user', content: '只回复 OK' }],
      maxTokens: 32,
      temperature: 0,
      timeout: 20000,
    });
    return { ok: true, latency: Date.now() - started, reply: reply.slice(0, 30) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function aiSaveConfig(payload = {}) {
  const settings = loadSettings();
  const nextAi = sanitizeAi(
    { ...settings.ai, ...payload, keyEnc: settings.ai.keyEnc },
    settings.ai
  );
  if (!/^https?:\/\//.test(nextAi.baseUrl)) return { ok: false, error: '接口地址需要以 http(s):// 开头' };
  if (!nextAi.model) return { ok: false, error: '请填写模型名' };
  const key = String(payload.apiKey || '').trim();
  if (key) {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: '系统钥匙串不可用，无法安全保存 API Key' };
    }
    nextAi.keyEnc = safeStorage.encryptString(key).toString('base64');
  }
  if (!nextAi.keyEnc || !getAiKey(nextAi)) {
    return { ok: false, error: 'API Key 需要重新输入并保存' };
  }
  const saved = saveSettings({ ...settings, ai: nextAi });
  return { ok: true, ai: publicSettings(saved).ai };
}

async function aiClearConfig() {
  const settings = loadSettings();
  settings.ai.keyEnc = '';
  settings.ai.enabled = false;
  const saved = saveSettings(settings);
  return { ok: true, ai: publicSettings(saved).ai };
}

function buildSummaryMessages(entry) {
  const context = entry.context ? `\n正文节选：\n${String(entry.context).slice(0, 2200)}` : '';
  return [
    { role: 'system', content: AI_SUMMARY_SYSTEM },
    {
      role: 'user',
      content: `技能名：${entry.name}\n来源：${entry.source || '本机'}\n描述：${
        entry.description || '（无描述）'
      }${context}`,
    },
  ];
}

function parseAiSummary(text) {
  let value = String(text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const match = value.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      const what = String(obj.what || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const when = String(obj.when || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (what) return { what, when };
    } catch {}
  }
  const lines = value.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (lines.length) return { what: lines[0].slice(0, 80), when: (lines[1] || '').slice(0, 40) };
  return { what: '', when: '' };
}

function readSkillContext(skill) {
  try {
    return fs.readFileSync(skill.file, 'utf8').slice(0, 2400);
  } catch {
    return '';
  }
}

async function aiSummarizeBatch(entries, kind) {
  const settings = loadSettings();
  if (!aiConfigured(settings.ai)) {
    return { ok: false, error: '请先在设置中配置 AI 接口、模型和 API Key' };
  }
  const key = getAiKey(settings.ai);
  if (!key) return { ok: false, error: 'API Key 不可用，请重新保存' };
  const cache = loadAiCache();
  const queue = entries.slice();
  const total = queue.length;
  let done = 0;
  let savedTicker = 0;
  const errors = [];
  const summaries = {};
  const worker = async () => {
    while (queue.length) {
      const entry = queue.shift();
      try {
        const text = await callAi({
          config: settings.ai,
          key,
          messages: buildSummaryMessages(entry),
          maxTokens: 350,
          temperature: 0.2,
        });
        const parsed = parseAiSummary(text);
        if (!parsed.what || !isCjkText(parsed.what)) throw new Error('模型没有返回中文摘要');
        const record = {
          what: parsed.what,
          when: parsed.when,
          hash: entry.hash || '',
          at: Date.now(),
          provider: settings.ai.provider,
          model: settings.ai.model,
        };
        cache.items[entry.cacheKey] = record;
        summaries[entry.id] = record;
        savedTicker += 1;
        if (savedTicker % 5 === 0) saveAiCache(cache);
      } catch (e) {
        errors.push(`${entry.name}: ${String(e?.message || e)}`);
      }
      done += 1;
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('ai:progress', {
          kind,
          done,
          total,
          name: entry.name,
          error: errors[errors.length - 1] || '',
        });
      }
    }
  };
  await Promise.all([worker(), worker()]);
  saveAiCache(cache);
  return {
    ok: done > errors.length,
    done,
    total,
    errors: errors.slice(0, 8),
    error: done === 0 && errors.length ? errors[0] : '',
    summaries,
  };
}

async function aiSummarizeLocal({ force = false } = {}) {
  const scan = scanSkills();
  const cache = loadAiCache();
  const entries = scan.skills
    .filter((skill) => {
      const hit = cache.items[`local:${skill.id}`];
      return force || !hit || (hit.hash && hit.hash !== skill.hash);
    })
    .map((skill) => ({
      id: skill.id,
      cacheKey: `local:${skill.id}`,
      name: skill.name,
      source: (skill.sourceAgents || []).slice(0, 3).join(' / '),
      description: skill.description,
      context: readSkillContext(skill),
      hash: skill.hash,
    }));
  if (!entries.length) return { ok: true, done: 0, total: 0, message: '所有技能都已有 AI 摘要' };
  return aiSummarizeBatch(entries, 'local');
}

function parseAiRecommendation(text) {
  let value = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return { note: '', picks: [] };
  try {
    const obj = JSON.parse(match[0]);
    const picks = (Array.isArray(obj.picks) ? obj.picks : [])
      .map((p) => ({
        id: String(p?.id || '').trim(),
        reason: String(p?.reason || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      }))
      .filter((p) => p.id)
      .slice(0, 10);
    return { note: String(obj.note || '').slice(0, 40), picks };
  } catch {
    return { note: '', picks: [] };
  }
}

async function aiRecommend({ need, items } = {}) {
  const settings = loadSettings();
  if (!aiConfigured(settings.ai)) {
    return { ok: false, error: '请先在设置中配置 AI 接口和 Key' };
  }
  const key = getAiKey(settings.ai);
  if (!key) return { ok: false, error: 'API Key 不可用，请重新保存' };
  const text = String(need || '').trim().slice(0, 500);
  if (!text) return { ok: false, error: '先说说你想做什么' };
  const candidates = (Array.isArray(items) ? items : [])
    .filter((x) => x && x.source && x.skillId)
    .slice(0, 80)
    .map((x) => ({
      id: `${x.source}/${x.skillId}`,
      name: x.name || x.skillId,
      source: x.source,
      what: String(x.what || '').slice(0, 80),
      when: String(x.when || '').slice(0, 40),
    }));
  if (!candidates.length) return { ok: false, error: '市场里还没有可推荐的技能' };

  const system = `你是技能市场导购。用户会描述一个任务，你要从候选技能中挑选最合适的 3-8 个，宁缺毋滥。

只输出 JSON，不要 Markdown 代码块：
{"note":"一句话说明你的挑选思路，20字以内","picks":[{"id":"原样使用候选里的 id","reason":"15-30字，说明它为什么适合这个需求"}]}

要求：
- 只选真正能解决需求的技能；没有合适的就返回空 picks。
- 不要因为名字相似就选。
- 用中文写 reason。`;
  const user = `用户需求：${text}\n\n候选技能（JSON 数组）：\n${JSON.stringify(
    candidates
  )}\n\n请挑选最合适的技能。`;

  try {
    const out = await callAi({
      config: settings.ai,
      key,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: 900,
      temperature: 0.2,
      timeout: 45000,
    });
    const parsed = parseAiRecommendation(out);
    const ids = new Set(candidates.map((c) => c.id));
    return {
      ok: true,
      note: parsed.note,
      picks: parsed.picks.filter((p) => ids.has(p.id)),
      candidates: candidates.length,
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function aiSummarizeMarket(items) {
  const list = (Array.isArray(items) ? items : [])
    .filter((x) => x && x.source && x.skillId)
    .slice(0, 60);
  const cache = loadAiCache();
  const entries = [];
  const todo = list.filter((item) => !cache.items[`market:${item.source}/${item.skillId}`]);
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async (item) => {
        const id = `${item.source}/${item.skillId}`;
        let description = String(item.description || '').trim();
        if (!description) {
          try {
            const html = await fetchHead(`https://skills.sh/${id}`);
            description = decodeEntities(
              (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''
            ).trim();
          } catch {}
        }
        entries.push({
          id,
          cacheKey: `market:${id}`,
          name: item.name || item.skillId,
          source: item.source,
          description,
          context: '',
        });
      })
    );
  }
  if (!entries.length) {
    return { ok: true, done: 0, total: 0, message: '当前结果都已有 AI 摘要', summaries: {} };
  }
  return aiSummarizeBatch(entries, 'market');
}

async function marketList({ board = 'all', q = '' } = {}) {
  const query = String(q || '').trim();
  let items = [];
  if (query.length >= 2) {
    const res = await fetchWithTimeout(
      `https://skills.sh/api/search?q=${encodeURIComponent(query)}&limit=36`
    );
    if (!res.ok) throw new Error(`市场搜索失败（HTTP ${res.status}）`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : data.skills || [];
    items = arr
      .filter((x) => x && x.source && x.skillId && String(x.source).includes('/'))
      .map((x) => ({
        id: `${x.source}/${x.skillId}`,
        source: x.source,
        skillId: x.skillId,
        name: x.name || x.skillId,
        installs: Number(x.installs) || 0,
      }));
  } else {
    items = await fetchBoardItems(board);
  }
  const seen = new Set();
  items = items.filter((x) => {
    if (!x.id) x.id = `${x.source}/${x.skillId}`;
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
  const local = new Set();
  for (const s of scanSkills().skills) {
    local.add(normalizeName(s.name));
    local.add(normalizeName(path.basename(s.path)));
  }
  const cache = loadStats();
  const settings = loadSettings();
  const aiOn = settings.ai.enabled && aiConfigured(settings.ai);
  const aiCache = aiOn ? loadAiCache() : null;
  return {
    query,
    board,
    items: items.slice(0, 60).map((x) => {
      const id = `${x.source}/${x.skillId}`;
      const cached = cache.marketDesc[id];
      const bundled = marketSummaries[id];
      const aiHit = aiCache?.items[`market:${id}`];
      const cachedWhat =
        (cached?.what && isCjkText(cached.what) && cached.what.length <= 52 && cached.what) ||
        (cached?.zh && isCjkText(cached.zh) && cached.zh.length <= 52 && cached.zh) ||
        '';
      const what = aiHit?.what || bundled?.what || bundled?.zh || cachedWhat || '';
      const when = aiHit?.when || bundled?.when || cached?.when || '';
      const cat = classify(x.name, `${what} ${x.source}`, '');
      return {
        ...x,
        stars: cache.repos[x.source]?.stars ?? null,
        what,
        when,
        category: cat.id,
        categoryName: cat.name,
        ai: !!aiHit,
        installed: local.has(normalizeName(x.name)) || local.has(normalizeName(x.skillId)),
      };
    }),
  };
}

async function marketStars(repos) {
  const cache = loadStats();
  const list = [...new Set(Array.isArray(repos) ? repos : [])]
    .filter((r) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(r)))
    .slice(0, 16);
  await ensureStars(list, cache, 16);
  saveStats(cache);
  const out = {};
  for (const repo of list) out[repo] = cache.repos[repo]?.stars ?? null;
  return out;
}

function rawGithubUrl(source, branch, filePath) {
  return `https://raw.githubusercontent.com/${source}/${encodeURIComponent(branch)}/${filePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

async function marketInstall({ source, skillId } = {}) {
  source = String(source || '');
  skillId = String(skillId || '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source)) {
    return { ok: false, error: '仓库地址不合法' };
  }
  if (!skillId || skillId.length > 120) return { ok: false, error: '缺少技能标识' };

  const cache = loadStats();
  let meta = cache.repos[source];
  if (!meta || !meta.branch || Date.now() - (meta.at || 0) > STATS_TTL) {
    try {
      meta = { ...(await fetchRepoMeta(source)), at: Date.now() };
      cache.repos[source] = meta;
    } catch (e) {
      return {
        ok: false,
        error:
          e.status === 403
            ? 'GitHub 暂时限流，请稍后再试'
            : `读取仓库失败：${String(e.message || e)}`,
      };
    }
  }
  const branch = meta.branch || 'main';
  let tree;
  try {
    tree = await fetchJson(
      `https://api.github.com/repos/${source}/git/trees/${encodeURIComponent(branch)}?recursive=1`
    );
  } catch (e) {
    return { ok: false, error: `读取仓库目录失败：${String(e.message || e)}` };
  }
  const blobs = (tree.tree || []).filter((t) => t.type === 'blob');
  const skillFiles = blobs.filter((t) => /(^|\/)SKILL\.md$/i.test(t.path));
  if (!skillFiles.length) {
    return {
      ok: false,
      error: tree.truncated
        ? '仓库太大，目录被截断，暂不支持自动安装，请在 GitHub 上手动下载'
        : '这个仓库里没有 SKILL.md',
    };
  }

  const candidates = skillFiles.map((t) => {
    const dir = t.path.includes('/') ? t.path.slice(0, t.path.lastIndexOf('/')) : '';
    return { path: t.path, dir, base: path.basename(dir) };
  });
  const wanted = skillId.toLowerCase();
  let hit = candidates.find((c) => c.base.toLowerCase() === wanted);
  if (!hit) hit = candidates.find((c) => c.dir.toLowerCase().endsWith(`/${wanted}`));
  if (!hit) hit = candidates.find((c) => c.dir.toLowerCase().includes(wanted));
  if (!hit && candidates.length === 1) hit = candidates[0];
  if (!hit) {
    for (const candidate of candidates.slice(0, 8)) {
      try {
        const raw = await (
          await fetchWithTimeout(rawGithubUrl(source, branch, candidate.path))
        ).text();
        const name = (raw.match(/^---[\s\S]*?^name:\s*(.+)$/m) || [])[1] || '';
        if (name.trim().replace(/^['"]|['"]$/g, '').toLowerCase() === wanted) {
          hit = candidate;
          break;
        }
      } catch {}
    }
  }
  if (!hit) {
    return {
      ok: false,
      error: tree.truncated
        ? '仓库太大，没定位到技能目录，请在 GitHub 上手动下载'
        : '在这个仓库里没找到对应的技能目录',
    };
  }

  const dir = hit.dir;
  const baseName = dir ? path.basename(dir) : path.basename(source);
  const library = centralLibraryDir();
  const dest = path.join(library, baseName);
  if (pathExists(dest)) {
    return {
      ok: false,
      code: 'exists',
      error: '技能库里已经有同名技能',
      scan: attachStats(scanSkills(true)),
    };
  }
  const files = dir
    ? blobs.filter((b) => b.path === `${dir}/SKILL.md` || b.path.startsWith(`${dir}/`))
    : blobs.filter((b) => !b.path.startsWith('.github/'));
  if (!files.length) return { ok: false, error: '没有可下载的文件' };
  if (files.length > 250) return { ok: false, error: '这个技能的文件太多，建议手动安装' };
  const total = files.reduce((n, b) => n + (Number(b.size) || 0), 0);
  if (total > 40 * 1024 * 1024) {
    return { ok: false, error: '这个技能体积超过 40MB，建议手动安装' };
  }

  fs.mkdirSync(library, { recursive: true });
  const tmp = path.join(library, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    for (let i = 0; i < files.length; i += 6) {
      await Promise.all(
        files.slice(i, i + 6).map(async (blob) => {
          const rel = dir ? blob.path.slice(dir.length + 1) : blob.path;
          if (!rel || rel.startsWith('..')) return;
          const target = path.join(tmp, rel);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          const res = await fetchWithTimeout(rawGithubUrl(source, branch, blob.path), {
            timeout: 20000,
          });
          if (!res.ok) throw new Error(`下载 ${rel} 失败（HTTP ${res.status}）`);
          fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
        })
      );
    }
    if (!pathExists(path.join(tmp, 'SKILL.md')) && !pathExists(path.join(tmp, 'skill.md'))) {
      throw new Error('下载内容里没有 SKILL.md');
    }
    fs.renameSync(tmp, dest);
  } catch (e) {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
    return { ok: false, error: String(e?.message || e) };
  }

  cache.matches[String(skillId).toLowerCase()] = {
    source,
    repo: source,
    skillId,
    installs: 0,
    at: Date.now(),
  };
  saveStats(cache);
  scanCache = null;
  return { ok: true, name: baseName, path: dest, scan: attachStats(scanSkills(true)) };
}

function listFiles(dir, base = dir, depth = 0, out = []) {
  if (depth > 3) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules' || e.name === '__pycache__') continue;
    const full = path.join(dir, e.name);
    if (isDir(full)) listFiles(full, base, depth + 1, out);
    else if (isFile(full)) out.push(path.relative(base, full));
    if (out.length >= 60) break;
  }
  return out;
}

function isSubPath(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/* ------------------------------------------------------------------ */
/*  Install / remove                                                   */
/* ------------------------------------------------------------------ */
async function removePath(target) {
  try {
    if (fs.lstatSync(target).isSymbolicLink()) {
      fs.unlinkSync(target);
      return true;
    }
  } catch {}
  try {
    await shell.trashItem(target);
    return true;
  } catch {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, force: true, errorOnExist: false, dereference: true });
}

function makeLink(src, dest) {
  fs.symlinkSync(src, dest, process.platform === 'win32' ? 'junction' : 'dir');
}

async function installSkillInto(skill, targetIds, mode, overwrite) {
  const targets = buildAgentTargets().filter((t) => (targetIds || []).includes(t.id));
  if (!targets.length) return { results: [], error: '没有选择目标工具' };
  const results = [];
  for (const target of targets) {
    const dest = path.join(target.dir, path.basename(skill.path));
    if (path.resolve(dest) === path.resolve(skill.path)) {
      results.push({ target: target.label, ok: true, skipped: true, message: '源目录就是目标目录' });
      continue;
    }
    try {
      if (pathExists(dest)) {
        if (!overwrite) {
          results.push({ target: target.label, ok: false, message: '已存在同名技能' });
          continue;
        }
        await removePath(dest);
      }
      fs.mkdirSync(target.dir, { recursive: true });
      let used = mode === 'symlink' ? 'symlink' : 'copy';
      if (used === 'symlink') {
        try {
          makeLink(skill.path, dest);
        } catch {
          used = 'copy';
          copyDir(skill.path, dest);
        }
      } else {
        copyDir(skill.path, dest);
      }
      results.push({ target: target.label, ok: true, mode: used, message: '已添加' });
    } catch (e) {
      results.push({ target: target.label, ok: false, message: String(e?.message || e) });
    }
  }
  return { results, error: '' };
}

function summarizeInstall(results) {
  if (!results.length) return '添加失败';
  return results.map((r) => `${r.target}：${r.message}`).join('；');
}

async function installSkill({ id, targetIds, mode, overwrite }) {
  const skill = findSkill(id);
  if (!skill) return { ok: false, error: '技能不存在，请刷新后重试' };
  if (!isFile(skill.file)) return { ok: false, error: '源技能文件不存在' };
  const { results, error } = await installSkillInto(skill, targetIds, mode, overwrite);
  scanCache = null;
  const ok = results.some((r) => r.ok);
  return {
    ok,
    error: ok ? '' : error || summarizeInstall(results),
    results,
    scan: scanSkills(true),
  };
}

async function installMany({ ids, targetIds, mode, overwrite }) {
  const list = [...new Set(Array.isArray(ids) ? ids : [])]
    .map((id) => findSkill(id))
    .filter((s) => s && isFile(s.file));
  if (!list.length) return { ok: false, error: '没有可用的技能' };
  const perSkill = [];
  let applied = 0;
  for (const skill of list) {
    const { results, error } = await installSkillInto(skill, targetIds, mode, overwrite);
    const ok = results.some((r) => r.ok);
    if (ok) applied += 1;
    perSkill.push({
      id: skill.id,
      name: skill.name,
      ok,
      error: ok ? '' : error || summarizeInstall(results),
      results,
    });
  }
  scanCache = null;
  return {
    ok: applied > 0,
    applied,
    total: list.length,
    error: applied > 0 ? '' : perSkill.find((p) => p.error)?.error || '添加失败',
    results: perSkill,
    scan: scanSkills(true),
  };
}

async function removeSkill({ id, targetId }) {
  const skill = findSkill(id);
  if (!skill) return { ok: false, error: '技能不存在' };
  const target = buildAgentTargets().find((t) => t.id === targetId);
  if (!target) return { ok: false, error: '目标工具不存在' };
  const actual = (skill.sourcePaths || []).find((p) => isSubPath(target.dir, p));
  const dest = actual || path.join(target.dir, path.basename(skill.path));
  if (!isSubPath(target.dir, dest) || !pathExists(dest)) {
    return { ok: false, error: '这个工具里没有找到该技能' };
  }
  const ok = await removePath(dest);
  scanCache = null;
  return { ok, scan: scanSkills(true), error: ok ? '' : '删除失败' };
}

/* ------------------------------------------------------------------ */
/*  Import skill / project dirs / settings backup                      */
/* ------------------------------------------------------------------ */
function looksLikeSkillDir(dir) {
  return isFile(path.join(dir, 'SKILL.md')) || isFile(path.join(dir, 'skill.md'));
}

function centralLibraryDir() {
  const central = buildAgentTargets().find((t) => t.keys.includes('central'));
  return central?.dir || path.join(HOME, '.skills-manager', 'skills');
}

async function importSkills() {
  const pick = await dialog.showOpenDialog({
    title: '导入技能到中央技能库',
    message: '选择一个技能文件夹，或包含多个技能的上级文件夹',
    buttonLabel: '导入',
    properties: ['openDirectory'],
  });
  if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true };
  const src = pick.filePaths[0];
  const library = centralLibraryDir();

  const candidates = [
    ...new Set(
      looksLikeSkillDir(src)
        ? [src]
        : findSkillDirs(src, 0, [], new Set()).map((x) => x.dir)
    ),
  ].slice(0, 100);
  if (!candidates.length) {
    return { ok: false, error: '这个文件夹里没有找到 SKILL.md' };
  }

  fs.mkdirSync(library, { recursive: true });
  const results = [];
  for (const dir of candidates) {
    const name = path.basename(dir);
    const dest = path.join(library, name);
    if (path.resolve(dir) === path.resolve(dest)) {
      results.push({ name, ok: true, skipped: true, message: '已经在技能库里' });
      continue;
    }
    if (pathExists(dest)) {
      results.push({ name, ok: false, message: '技能库里已有同名技能' });
      continue;
    }
    try {
      copyDir(dir, dest);
      results.push({ name, ok: true, message: '已导入' });
    } catch (e) {
      results.push({ name, ok: false, message: String(e?.message || e) });
    }
  }
  scanCache = null;
  const imported = results.filter((r) => r.ok && !r.skipped).length;
  return {
    ok: imported > 0 || results.some((r) => r.skipped),
    imported,
    library,
    results,
    error: results.some((r) => !r.ok)
      ? results.filter((r) => !r.ok).map((r) => `${r.name}：${r.message}`).join('；')
      : '',
    scan: scanSkills(true),
  };
}

const PROJECT_SKILL_DIRS = [
  '.claude/skills',
  '.codex/skills',
  '.cursor/skills',
  '.gemini/skills',
  '.agents/skills',
  '.config/opencode/skills',
  '.opencode/skills',
  '.qoder/skills',
  '.trae/skills',
  '.kimi-code/skills',
  '.qwen/skills',
  '.dsh/skills',
  '.workbuddy/skills',
  '.minimax/skills',
  '.openclaw/skills',
  'skills',
  'agent-skills',
];

async function addProject() {
  const pick = await dialog.showOpenDialog({
    title: '关联一个项目的技能目录',
    message: '选择项目根目录，会自动识别 .claude/skills、.codex/skills、skills 等目录',
    buttonLabel: '关联项目',
    properties: ['openDirectory'],
  });
  if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true };
  const root = pick.filePaths[0];
  const found = new Set();

  if (looksLikeSkillDir(root)) found.add(path.dirname(root));
  for (const rel of PROJECT_SKILL_DIRS) {
    const dir = path.join(root, rel);
    if (isDir(dir) && findSkillDirs(dir, 0, [], new Set()).length) found.add(dir);
  }
  if (!found.size) {
    for (const item of findSkillDirs(root, 0, [], new Set())) {
      const parent = path.dirname(item.dir);
      if (path.resolve(parent) !== path.resolve(root)) found.add(parent);
    }
  }
  if (!found.size) {
    return {
      ok: false,
      error: '这个项目里还没有技能目录。可以先建一个 .claude/skills，再回来关联。',
    };
  }

  const settings = loadSettings();
  const before = new Set(settings.customDirs.map((d) => path.resolve(d)));
  const added = [...found].filter((d) => !before.has(path.resolve(d)));
  if (added.length) {
    saveSettings({ ...settings, customDirs: [...settings.customDirs, ...added] });
  }
  return {
    ok: true,
    root,
    added,
    labels: added.map((d) => path.relative(root, d) || path.basename(d)),
    already: found.size - added.length,
    settings: publicSettings(),
    scan: scanSkills(true),
  };
}

async function exportSettings() {
  const pick = await dialog.showSaveDialog({
    title: '导出技能图鉴配置',
    defaultPath: 'skills-manager-config.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (pick.canceled || !pick.filePath) return { ok: false, canceled: true };
  const data = {
    app: 'skill-atlas',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: publicSettings(),
  };
  fs.writeFileSync(pick.filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, path: pick.filePath };
}

async function importSettingsFile() {
  const pick = await dialog.showOpenDialog({
    title: '导入技能图鉴配置',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true };
  try {
    const parsed = JSON.parse(fs.readFileSync(pick.filePaths[0], 'utf8'));
    const source = parsed?.settings || parsed;
    const saved = saveSettings({
      customDirs: source?.customDirs,
      installMode: source?.installMode,
      presets: source?.presets,
      ai: loadSettings().ai,
    });
    return { ok: true, settings: publicSettings(saved), scan: scanSkills(true) };
  } catch (e) {
    return { ok: false, error: `配置文件读取失败：${String(e?.message || e)}` };
  }
}

/* ------------------------------------------------------------------ */
/*  IPC                                                                */
/* ------------------------------------------------------------------ */
function registerIpc() {
  ipcMain.handle('skills:scan', (_e, force) => attachStats(scanSkills(!!force)));
  ipcMain.handle('skills:detail', (_e, id) => {
    attachStats(scanSkills());
    const skill = findSkill(id);
    if (!skill) return null;
    return {
      ...skill,
      files: listFiles(skill.path),
      raw: (() => {
        try {
          return fs.readFileSync(skill.file, 'utf8').slice(0, 30000);
        } catch {
          return '';
        }
      })(),
      sources: skill.sourcePaths.map((p, i) => ({
        path: p,
        agents: skill.sourceAgents,
        primary: i === 0,
      })),
    };
  });
  const withStats = (res) => {
    if (res?.scan) attachStats(res.scan);
    return res;
  };
  ipcMain.handle('skills:install', async (_e, payload) => withStats(await installSkill(payload || {})));
  ipcMain.handle('skills:install-many', async (_e, payload) =>
    withStats(await installMany(payload || {}))
  );
  ipcMain.handle('skills:import', async () => withStats(await importSkills()));
  ipcMain.handle('skills:remove', async (_e, payload) => withStats(await removeSkill(payload || {})));
  ipcMain.handle('skills:enrich', () => refreshEnrichment(true));
  ipcMain.handle('market:list', (_e, payload) => marketList(payload || {}));
  ipcMain.handle('market:describe', (_e, items) => marketDescribe(items || []));
  ipcMain.handle('ai:test', (_e, payload) => aiTest(payload || {}));
  ipcMain.handle('ai:save', (_e, payload) => aiSaveConfig(payload || {}));
  ipcMain.handle('ai:clear', () => aiClearConfig());
  ipcMain.handle('ai:summarize-local', (_e, payload) => aiSummarizeLocal(payload || {}));
  ipcMain.handle('ai:summarize-market', (_e, items) => aiSummarizeMarket(items || []));
  ipcMain.handle('ai:recommend', (_e, payload) => aiRecommend(payload || {}));
  ipcMain.handle('ai:clear-summaries', () => {
    saveAiCache({ items: {} });
    scanCache = null;
    return { ok: true };
  });
  ipcMain.handle('market:stars', (_e, repos) => marketStars(repos || []));
  ipcMain.handle('market:install', async (_e, payload) => marketInstall(payload || {}));
  ipcMain.handle('open-url', (_e, url) => {
    if (/^https?:/i.test(String(url || ''))) shell.openExternal(String(url));
  });
  ipcMain.handle('skills:open-folder', (_e, p) => {
    try {
      shell.showItemInFolder(String(p));
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle('skills:reveal', (_e, p) => {
    try {
      shell.showItemInFolder(String(p));
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle('skills:open-file', async (_e, p) => {
    try {
      const err = await shell.openPath(String(p));
      return !err;
    } catch {
      return false;
    }
  });
  ipcMain.handle('skills:copy', (_e, text) => {
    clipboard.writeText(String(text || ''));
    return true;
  });
  ipcMain.handle('settings:get', () => publicSettings());
  ipcMain.handle('settings:save', (_e, s) => publicSettings(saveSettings(s)));
  ipcMain.handle('settings:export', () => exportSettings());
  ipcMain.handle('settings:import', () => importSettingsFile());
  ipcMain.handle('project:add', () => addProject());
  ipcMain.handle('settings:choose-dir', async () => {
    const r = await dialog.showOpenDialog({
      title: '选择技能目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    return r.canceled ? '' : r.filePaths[0] || '';
  });
  ipcMain.handle('agents:list', () => agentTargetsPublic());
}

/* ------------------------------------------------------------------ */
/*  Window                                                             */
/* ------------------------------------------------------------------ */
function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(1180, Math.max(960, area.width - 80)),
    height: Math.min(820, Math.max(640, area.height - 80)),
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f3f2ef',
    title: '技能架 · Skills Shelf',
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.once('ready-to-show', () => {
    win.show();
    setTimeout(() => refreshEnrichment(false), 1200);
  });
  win.loadFile(path.join(import.meta.dirname, '../renderer/index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about', label: `关于 ${APP_NAME}` },
              { type: 'separator' },
              { role: 'hide', label: `隐藏 ${APP_NAME}` },
              { role: 'hideOthers', label: '隐藏其他' },
              { role: 'unhide', label: '全部显示' },
              { type: 'separator' },
              { role: 'quit', label: `退出 ${APP_NAME}` },
            ],
          },
        ]
      : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        ...(isMac ? [{ role: 'zoom', label: '缩放' }, { role: 'front', label: '前置全部窗口' }] : []),
      ],
    },
    ...(isMac
      ? []
      : [
          {
            label: '帮助',
            submenu: [
              {
                label: `关于 ${APP_NAME}`,
                click: () => {
                  dialog.showMessageBox({
                    type: 'info',
                    title: `关于 ${APP_NAME}`,
                    message: '技能架',
                    detail: `Skills Shelf ${app.getVersion()}\n统一查看、搜索、添加本机所有 AI 技能，并浏览在线技能市场。`,
                    buttons: ['好'],
                  });
                },
              },
            ],
          },
        ]),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('com.skillsshelf.desktop');

function migrateOldUserData() {
  try {
    const appData = app.getPath('appData');
    const newDir = app.getPath('userData');
    fs.mkdirSync(newDir, { recursive: true });
    for (const oldName of ['SkillAtlas', 'Skills Manager']) {
      const oldDir = path.join(appData, oldName);
      if (path.resolve(oldDir) === path.resolve(newDir) || !fs.existsSync(oldDir)) continue;
      for (const name of ['settings.json', 'skill-stats.json', 'ai-summaries.json']) {
        const src = path.join(oldDir, name);
        const dest = path.join(newDir, name);
        if (fs.existsSync(src) && !fs.existsSync(dest)) fs.copyFileSync(src, dest);
      }
    }
  } catch {}
}
migrateOldUserData();

app.whenReady().then(() => {
  buildMenu();
  registerIpc();
  createWindow();
  setInterval(() => refreshEnrichment(false), 6 * 3600 * 1000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => app.quit());
