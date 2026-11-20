// 浏览器验收：起静态服务 → headless Chromium 打开 demo → 截图 + 收集 console 错误。
// 用法：node test/render.mjs [--keep]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

const PORT = 8177;
const SHOTS = new URL('../shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

// 找 chromium：优先 CHROME_PATH，其次 playwright 缓存里任意一个 chromium-*/chrome-linux*/chrome。
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = `${process.env.HOME}/.cache/ms-playwright`;
  try {
    for (const dir of readdirSync(root)) {
      if (!dir.startsWith('chromium')) continue;
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const p = `${root}/${dir}/${sub}`;
        if (existsSync(p)) return p;
      }
    }
  } catch { /* 没装过 playwright 浏览器 */ }
  return null;
}
const executablePath = findChrome();
if (!executablePath) {
  console.error('找不到 chromium：设置 CHROME_PATH，或跑 npx playwright install chromium');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const targets = [
  ['showcase', '/demos/showcase.html', () => !!window.__showcase, 1600, 900],
  ['scene', '/demos/scene.html?q=high', () => !!window.__scene, 1600, 900],
  ['backdrop', '/demos/backdrop.html?cam=wide', () => !!window.__backdrop, 1500, 850],
  ['viewmodel-pac9', '/demos/viewmodel.html?w=pac9', () => !!window.__vm, 1200, 800],
  ['viewmodel-pac4', '/demos/viewmodel.html?w=pac4', () => !!window.__vm, 1200, 800],
];

async function capture(name, path, probe, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  let ok = false;
  try {
    await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'load' });
    await page.waitForTimeout(9000);
    ok = await page.evaluate(probe);
    await page.screenshot({ path: `${SHOTS}${name}.png` });
  } finally {
    await page.close();
  }
  return { ok, real: errs.filter((e) => !e.includes('favicon')) };
}

let bad = 0;
for (const [name, path, probe, w, h] of targets) {
  let { ok, real } = await capture(name, path, probe, w, h);
  // WSL 下 Chromium 偶尔报 ERR_NETWORK_CHANGED（本地静态服务器其实没事）；重试一次。
  if (!ok || real.some((e) => e.includes('ERR_NETWORK_CHANGED'))) {
    console.log(`${name.padEnd(18)} retry (network changed)`);
    ({ ok, real } = await capture(name, path, probe, w, h));
  }
  console.log(`${name.padEnd(18)} ready=${ok} errors=${real.length}${real.length ? ' → ' + real.slice(0, 3).join(' | ') : ''}`);
  if (!ok || real.length) bad++;
}
await browser.close();
server.kill();
process.exit(bad ? 1 : 0);
