// 一次截好 README/视频要用的四张图：home / market / detail / settings
// 用法：node capture-all.mjs [输出目录]
// 默认输出到 %USERPROFILE%\Videos\SkillsShelf\shots
const path = await import('node:path');
const fs = await import('node:fs');
const os = await import('node:os');
const outDir = process.argv[2] || path.join(os.homedir(), 'Videos', 'SkillsShelf', 'shots');
const port = process.env.CDP_PORT || 9222;
fs.mkdirSync(outDir, { recursive: true });

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = list.find((t) => t.type === 'page');
if (!target) { console.error('no page target; 先运行 launch-demo.ps1'); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params }));
});
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return r?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (expression, timeout = 40000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await evalJs(expression);
    if (value) return true;
    await sleep(500);
  }
  return false;
};
const shoot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  console.log(file);
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Page.bringToFront');
await sleep(800);

await evalJs(`document.querySelector('#marketBack')?.click(); document.querySelector('#drawerClose')?.click(); document.querySelector('#modalCancel')?.click(); 'home'`);
await sleep(600);
await evalJs(`document.querySelector('#refreshBtn')?.click(); 'refresh'`);
await waitFor(`document.querySelectorAll('.card[data-id]').length > 0`, 20000);
await sleep(1200);
await shoot('home');

await evalJs(`document.querySelector('#marketBtn').click(); 'market'`);
const marketReady = await waitFor(`document.querySelectorAll('[data-market-id]').length > 0`, 45000);
if (!marketReady) console.warn('市场加载超时：截图可能是骨架屏');
await waitFor(`[...document.querySelectorAll('.m-metrics .star')].filter(x => /[1-9]/.test(x.textContent)).length >= 3`, 25000);
await sleep(1200);
await shoot('market');

await evalJs(`document.querySelector('#marketBack')?.click(); 'back'`);
await sleep(800);
await evalJs(`(()=>{const c=[...document.querySelectorAll('.card[data-id]')].find(x=>x.querySelector('h2')?.textContent==='baoyu-slide-deck') || document.querySelector('.card[data-id]'); if(!c) return 'no card'; c.click(); return 'detail';})()`);
await waitFor(`!document.querySelector('#detailDrawer')?.hidden`, 8000);
await sleep(1000);
await shoot('detail');

await evalJs(`document.querySelector('#drawerClose')?.click(); document.querySelector('#settingsBtn').click(); 'settings'`);
await waitFor(`!document.querySelector('#modal')?.hidden`, 8000);
await sleep(1000);
await shoot('settings');

await evalJs(`document.querySelector('#modalCancel')?.click(); 'done'`);
console.log('done:', outDir);
ws.close();
