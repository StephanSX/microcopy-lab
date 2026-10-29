import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..');
const TMP = os.tmpdir();
// optional: point at an already-installed Chromium instead of Playwright's own download
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};
import fs from 'fs';
const SRC = path.join(ROOT, 'extension'), EXT = path.join(TMP, 'mcl-test-ext');
fs.rmSync(EXT, { recursive: true, force: true }); fs.cpSync(SRC, EXT, { recursive: true });
// test build: pre-grant hosts so permission prompts resolve without UI
const man = JSON.parse(fs.readFileSync(EXT + '/manifest.json')); man.host_permissions = ['<all_urls>']; fs.writeFileSync(EXT + '/manifest.json', JSON.stringify(man));
const mock = fs.readFileSync(path.join(HERE, 'mock.html'), 'utf8');
const ctx = await chromium.launchPersistentContext(path.join(TMP, 'mclprof-') + Date.now(), {
  headless: true, channel: 'chromium', ...EXEC,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=en-US'], acceptDownloads: true, locale: 'en-US' });
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' → ' + extra : '')); if (!cond) fails++; };
await ctx.route(/https:\/\/(app\.demo-care|other\.example)\.test(:\d+)?\/.*/, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: mock }));
const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
const extId = sw.url().split('/')[2];
await new Promise(r => setTimeout(r, 800));
const welcome = ctx.pages().find(p => p.url().includes('options.html'));
check('Welcome page opens on install', !!welcome);
if (welcome) await welcome.close();

const o = await ctx.newPage(); o.on('pageerror', e => console.log('[options err]', e.message)); sw.on('console', c => console.log('[sw]', c.text()));
await o.goto(`chrome-extension://${extId}/options.html`);
check('Empty state', await o.isVisible('#empty'));
check('English UI', (await o.textContent('#empty h2')).includes('No website'), await o.textContent('#empty h2'));
await o.fill('#newSite', 'app.demo-care.test');
await o.click('#addSite');
await o.waitForSelector('#siteArea:not([hidden])');
const reg = await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
check('Content script registered for site', reg.length === 1 && reg[0].matches.includes('https://app.demo-care.test/*'), JSON.stringify(reg.map(r => r.matches)));
await o.setInputFiles('#file', path.join(HERE, 'import.xlsx'));
await o.waitForSelector('#reportCard:not([hidden])');
check('Report: 9 entries', (await o.textContent('#kpis')).includes('9'));
await o.click('#apply');
await o.evaluate(() => chrome.storage.local.get('sites').then(d => { d.sites['https://app.demo-care.test'].variant = 'A'; return chrome.storage.local.set(d); }));

const a = await ctx.newPage(); a.on('pageerror', e => console.log('[app err]', e.message));
await a.goto('https://app.demo-care.test/app'); await a.waitForSelector('#go'); await a.waitForTimeout(150);
let body = await a.evaluate(() => document.body.innerText);
check('Replaced welcome', body.includes('Hallo, Stephan Weibel!'), body.split('\n')[0]);
check('Page-specific rule', body.includes('Hinweise'));
check('Template', body.includes('2 Sensoren aktiv'));
check('Placeholder attr', await a.getAttribute('input', 'placeholder') === 'Zimmer suchen…');
check('Tooltip attr', await a.getAttribute('button[title]', 'title') === 'Konfiguration');
await a.evaluate(() => bump()); await a.waitForTimeout(50);
check('Dynamic update', (await a.textContent('#cnt')) === '3 Sensoren aktiv');
await a.click('#go'); await a.waitForTimeout(450);
body = await a.evaluate(() => document.body.innerText);
check('SPA navigation', body.includes('Alarme'), body.replace(/\n/g, ' | '));
await o.evaluate(() => chrome.storage.local.get('sites').then(d => { Object.assign(d.sites['https://app.demo-care.test'], { variant: 'B', highlight: true }); return chrome.storage.local.set(d); }));
await a.waitForTimeout(300);
body = await a.evaluate(() => document.body.innerText);
check('Live variant switch', body.includes('Ereignisse') && /^Matten$/m.test(body));
check('Highlight', await a.$('[data-mcl-hl="ok"]') !== null);
await o.evaluate(() => chrome.storage.local.get('sites').then(d => { d.sites['https://app.demo-care.test'].enabled = false; return chrome.storage.local.set(d); }));
await a.waitForTimeout(300);
body = await a.evaluate(() => document.body.innerText);
check('Off restores originals', body.includes('Meldungen') && /^Geräte$/m.test(body) && !(await a.$('[data-mcl-hl]')));
await a.goto('https://app.demo-care.test/app?_variant=b'); await a.waitForSelector('#go'); await a.waitForTimeout(150);
body = await a.evaluate(() => document.body.innerText);
check('?_variant=b', body.includes('Guten Tag,'), body.split('\n')[0]);

// other origins untouched
const b = await ctx.newPage();
await b.goto('https://other.example.test/app'); await b.waitForSelector('#go'); await b.waitForTimeout(150);
check('Other website untouched', (await b.evaluate(() => document.body.innerText)).includes('Willkommen zurück,'));
await b.goto('https://app.demo-care.test:8443/app'); await b.waitForSelector('#go'); await b.waitForTimeout(150);
check('Same host, other port untouched', (await b.evaluate(() => document.body.innerText)).includes('Willkommen zurück,'));

// collect + stats
const tabs = await sw.evaluate(async () => (await chrome.tabs.query({})).map(t => ({ id: t.id, url: t.url })));
const appTab = tabs.find(t => (t.url || '').startsWith('https://app.demo-care.test/app'));
const col = await sw.evaluate(id => chrome.tabs.sendMessage(id, { cmd: 'collect' }), appTab.id);
check('Collect', col.ok && col.total >= 8, JSON.stringify(col));
const seen = (await o.evaluate(() => chrome.storage.local.get('seen:https://app.demo-care.test')))['seen:https://app.demo-care.test'];
check('Collected originals only', Object.keys(seen).some(k => k.endsWith('Willkommen zurück,')) && !Object.keys(seen).some(k => k.endsWith('Guten Tag,')));

// export + reimport
await o.reload(); await o.waitForSelector('#siteArea:not([hidden])');
const [dl] = await Promise.all([o.waitForEvent('download'), o.click('#exportXlsx')]);
check('Export filename', /^microcopy-app\.demo-care\.test-\d{4}-\d\d-\d\d\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
await dl.saveAs(path.join(TMP, 'mcl-export.xlsx'));
await o.setInputFiles('#file', path.join(TMP, 'mcl-export.xlsx'));
await o.waitForSelector('#reportCard:not([hidden])');
check('Re-import export', /1[0-9]\s*entries/.test(await o.textContent('#kpis')), (await o.textContent('#kpis')).replace(/\s+/g, ' '));
await o.click('#discard');

// popup states (tabs.query patched to the app tab)
const pp = await ctx.newPage(); await pp.setViewportSize({ width: 340, height: 560 });
await pp.addInitScript(id => { const q = chrome.tabs.query.bind(chrome.tabs); chrome.tabs.query = async () => (await q({})).filter(t => t.id === id); }, appTab.id);
await pp.goto(`chrome-extension://${extId}/popup.html`); await pp.waitForTimeout(500);
check('Popup active state', await pp.isVisible('#stActive'));
check('Popup stats', /\d/.test(await pp.textContent('#sReplaced')), await pp.textContent('#sReplaced'));
const otherTab = tabs.find(t => (t.url || '').startsWith('https://app.demo-care.test:8443'));
const pp2 = await ctx.newPage(); await pp2.setViewportSize({ width: 340, height: 400 });
await pp2.addInitScript(id => { const q = chrome.tabs.query.bind(chrome.tabs); chrome.tabs.query = async () => (await q({})).filter(t => t.id === id); }, otherTab.id);
await pp2.goto(`chrome-extension://${extId}/popup.html`); await pp2.waitForTimeout(400);
check('Popup inactive state for other port', await pp2.isVisible('#stInactive'), await pp2.textContent('#enableSite'));
await pp2.click('#enableSite'); await pp2.waitForTimeout(600);
const sitesNow = (await o.evaluate(() => chrome.storage.local.get('sites'))).sites;
check('Enable from popup adds origin', !!sitesNow['https://app.demo-care.test:8443'], Object.keys(sitesNow).join(', '));

// remove site
await o.reload(); await o.waitForSelector('#siteArea:not([hidden])');
await o.selectOption('#siteSelect', 'https://app.demo-care.test');
o.once('dialog', d => d.accept());
await o.click('#removeSite'); await o.waitForTimeout(600);
const all = await o.evaluate(() => chrome.storage.local.get(null));
check('Remove site deletes data', !all.sites['https://app.demo-care.test'] && !all['table:https://app.demo-care.test'] && !all['seen:https://app.demo-care.test'], Object.keys(all).join(', '));
await a.waitForTimeout(300);
check('Open tab restored after removal', (await a.evaluate(() => document.body.innerText)).includes('Willkommen zurück,'));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
await ctx.close();
