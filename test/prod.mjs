import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const TMP = os.tmpdir();
// optional: point at an already-installed Chromium instead of Playwright's own download
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
const EXT = path.join(ROOT, 'extension');
const ctx = await chromium.launchPersistentContext(path.join(TMP, 'prod-') + Date.now(), { headless: true, channel: 'chromium', ...EXEC, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
const errs = [];
const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
await new Promise(r => setTimeout(r, 800));
for (const f of ['options.html', 'popup.html']) { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(f + ': ' + e.message)); p.on('console', c => { if (c.type() === 'error') errs.push(f + ': ' + c.text()); }); await p.goto(`chrome-extension://${id}/${f}`); await p.waitForTimeout(500); }
const info = await sw.evaluate(async () => ({ perms: await chrome.permissions.getAll(), reg: await chrome.scripting.getRegisteredContentScripts(), name: chrome.runtime.getManifest().name }));
console.log(JSON.stringify(info), errs.length ? errs : 'no page errors');
await ctx.close();
