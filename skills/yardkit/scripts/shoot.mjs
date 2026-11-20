#!/usr/bin/env node
// Fixed-camera screenshot for look-dev.
// Usage: node shoot.mjs <url> <out.png> [waitMs] [width] [height]
// Requires the page to start its own server; this script only drives Chromium.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url, out, waitArg, wArg, hArg] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node shoot.mjs <url> <out.png> [waitMs] [width] [height]');
  process.exit(2);
}

const wait = Number(waitArg) || 12000;
const width = Number(wArg) || 1600;
const height = Number(hArg) || 900;
mkdirSync(dirname(out), { recursive: true });

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
  } catch { /* playwright browsers not installed */ }
  return null;
}

const executablePath = findChrome();
if (!executablePath) {
  console.error('chromium not found: set CHROME_PATH or run npx playwright install chromium');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  const probe = await page.evaluate(() => (
    window.__starter || window.__theme || window.__scene || window.__showcase || window.__forge || null
  ));
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ screenshot: out, probe, errors }, null, 2));
} catch (e) {
  console.error('screenshot failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
process.exitCode = process.exitCode || (errors.length ? 1 : 0);
