// 浏览器验收：起静态服务 → headless Chromium 打开 demo → 截图 + 收集 console 错误。
// 用法：node test/render.mjs [--keep]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 8177;
const SHOTS = new URL('../shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/home/wxr/.cache/ms-playwright/chromium-snapshot/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const targets = [
  ['materials-gallery', '/demos/index.html', () => !!window.__gallery, 1700, 950],
  ['materials-cozy', '/demos/cozy.html', () => !!window.__cozy, 1600, 900],
  ['kit', '/demos/kit.html', () => !!window.__kit, 1600, 900],
  ['scene', '/demos/scene.html', () => !!window.__scene, 1600, 900],
  ['backdrop', '/demos/backdrop.html?cam=wide', () => !!window.__backdrop, 1500, 850],
  ['viewmodel-pac9', '/demos/viewmodel.html?w=pac9', () => !!window.__vm, 1200, 800],
  ['viewmodel-pac4', '/demos/viewmodel.html?w=pac4', () => !!window.__vm, 1200, 800],
  ['moon-industrial', '/demos/moon.html?mode=a', () => !!window.__moon, 1400, 800],
  ['moon', '/demos/moon.html?mode=b', () => !!window.__moon, 1400, 800],
  ['moon-real', '/demos/moon.html?mode=c', () => !!window.__moon, 1400, 800],
  ['cozy-scene', '/demos/cozy-scene.html', () => !!window.__cozyScene, 1500, 900],
  ['moon-scene', '/demos/moon-scene.html', () => !!window.__moonScene, 1400, 800],
];

let bad = 0;
for (const [name, path, probe, w, h] of targets) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'load' });
  await page.waitForTimeout(9000);
  const ok = await page.evaluate(probe);
  await page.screenshot({ path: `${SHOTS}${name}.png` });
  await page.close();
  const real = errs.filter((e) => !e.includes('favicon'));
  console.log(`${name.padEnd(18)} ready=${ok} errors=${real.length}${real.length ? ' → ' + real.slice(0, 3).join(' | ') : ''}`);
  if (!ok || real.length) bad++;
}
await browser.close();
server.kill();
process.exit(bad ? 1 : 0);
