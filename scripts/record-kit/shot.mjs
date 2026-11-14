// 用 CDP 截取当前页面：node shot.mjs <输出文件>
// 依赖 Node 22+（内置 WebSocket），不需要安装任何 npm 包。
const out = process.argv[2];
if (!out) { console.error('usage: node shot.mjs <out.png>'); process.exit(1); }
const port = process.env.CDP_PORT || 9222;
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = list.find((t) => t.type === 'page');
if (!target) { console.error('no page target'); process.exit(1); }
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
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Page.bringToFront');
await new Promise((r) => setTimeout(r, 800));
const shot = await send('Page.captureScreenshot', { format: 'png' });
const fs = await import('node:fs');
fs.mkdirSync((await import('node:path')).dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(out);
ws.close();
