import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const TMP = os.tmpdir();
// optional: point at an already-installed Chromium instead of Playwright's own download
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
import fs from 'fs';
const EXT = path.join(TMP, 'mcl-rev-ext'); fs.rmSync(EXT, { recursive: true, force: true }); fs.cpSync(path.join(ROOT, 'extension'), EXT, { recursive: true });
const man = JSON.parse(fs.readFileSync(EXT + '/manifest.json')); man.host_permissions = ['<all_urls>']; fs.writeFileSync(EXT + '/manifest.json', JSON.stringify(man));
const ctx = await chromium.launchPersistentContext(path.join(TMP, 'rev-') + Date.now(), { headless: true, channel: 'chromium', ...EXEC, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`], ignoreHTTPSErrors: true, ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}) });
const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
const o = await ctx.newPage(); await o.goto(`chrome-extension://${id}/options.html`);
await o.evaluate(() => chrome.runtime.sendMessage({ cmd: 'addSite', origin: 'https://example.com' }));
await o.reload(); await o.waitForSelector('#siteArea:not([hidden])');
await o.setInputFiles('#file', path.join(ROOT, 'store', 'reviewer-sample-example-com.csv')); await o.waitForSelector('#reportCard:not([hidden])'); await o.click('#apply');
await o.evaluate(() => chrome.storage.local.get('sites').then(d => { d.sites['https://example.com'].variant = 'A'; return chrome.storage.local.set(d); }));
const a = await ctx.newPage();
try { await a.goto('https://example.com', { timeout: 20000 }); await a.waitForTimeout(300); console.log('example.com h1:', await a.textContent('h1'), '| links:', await a.evaluate(() => [...document.links].map(l => l.textContent).join(','))); }
catch (e) { console.log('network not available:', e.message.split('\n')[0]); }
await ctx.close();
