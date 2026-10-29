/* Microcopy Lab – service worker: site registration, permissions, table download */
importScripts('lib/i18n.js', 'lib/core.js');
const M = self.MCL;
const t = self.I18N.t;
const SCRIPT_ID = 'mcl-sites';
const CONTENT_FILES = ['lib/i18n.js', 'lib/core.js', 'content.js'];

async function getSites() {
  const d = await chrome.storage.local.get(M.KEYS.sites);
  return d[M.KEYS.sites] || {};
}

/** Registers the content script for every site that still has host permission */
async function syncRegistrations() {
  const sites = await getSites();
  const patterns = [...new Set(Object.keys(sites).map(M.patternOf))];
  const granted = [];
  for (const p of patterns) {
    if (await chrome.permissions.contains({ origins: [p] })) granted.push(p);
  }
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (granted.length) {
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ID,
      matches: granted,
      js: CONTENT_FILES,
      runAt: 'document_start',
      allFrames: false,
      persistAcrossSessions: true
    }]);
  }
  return granted;
}

async function injectIntoOpenTabs(origin) {
  const tabs = await chrome.tabs.query({ url: M.patternOf(origin) });
  for (const tab of tabs) {
    if (M.originOf(tab.url) !== origin) continue;
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES }); } catch (e) { /* tab not ready */ }
  }
}

async function addSite(origin) {
  origin = M.originOf(origin);
  if (!origin) return { ok: false };
  if (!(await chrome.permissions.contains({ origins: [M.patternOf(origin)] }))) return { ok: false, error: 'permission' };
  const sites = await getSites();
  if (!sites[origin]) {
    sites[origin] = Object.assign({}, M.DEFAULT_SITE, { addedAt: Date.now() });
    await chrome.storage.local.set({ [M.KEYS.sites]: sites });
  }
  const { pendingSite } = await chrome.storage.local.get('pendingSite');
  if (pendingSite === origin) await chrome.storage.local.remove('pendingSite');
  await syncRegistrations();
  await injectIntoOpenTabs(origin);
  return { ok: true, origin };
}

async function removeSite(origin) {
  const sites = await getSites();
  delete sites[origin];
  await chrome.storage.local.set({ [M.KEYS.sites]: sites });
  await chrome.storage.local.remove([M.KEYS.table(origin), M.KEYS.seen(origin)]);
  const pattern = M.patternOf(origin);
  const stillUsed = Object.keys(sites).some(o => M.patternOf(o) === pattern);
  if (!stillUsed) { try { await chrome.permissions.remove({ origins: [pattern] }); } catch (e) { /* ignore */ } }
  await syncRegistrations();
  return { ok: true };
}

/* ---------- table download (Google Sheet / CSV URL) ---------- */
async function fetchTable({ origin, url, apply, maxAgeMs }) {
  const sites = await getSites();
  const site = M.siteSettings(sites, origin);
  const src = url || (site && site.sheetUrl);
  if (!src) return { ok: false, error: t('errNoSheetUrl') };
  if (site && maxAgeMs && Date.now() - (site.lastSheetFetch || 0) < maxAgeMs) return { ok: true, skipped: true };
  let result;
  try {
    const perms = M.sheetPermissionOrigins(src);
    if (!perms.length || !(await chrome.permissions.contains({ origins: perms }))) throw new Error(t('errSheetPermission'));
    const res = await fetch(M.sheetCsvUrl(src), { cache: 'no-store', credentials: 'omit', redirect: 'follow' });
    if (!res.ok) throw new Error(t('errSheetStatus', res.status));
    const type = res.headers.get('content-type') || '';
    const text = M.decodeBytes(await res.arrayBuffer());
    if (/text\/html/i.test(type) || /^\s*<!doctype html/i.test(text)) throw new Error(t('errSheetHtml'));
    const seenData = origin ? (await chrome.storage.local.get(M.KEYS.seen(origin)))[M.KEYS.seen(origin)] : null;
    const { table, report } = M.buildTable(M.parseCSV(text), new Set(Object.keys(seenData || {})));
    result = { ok: !!table, table, report };
    if (!table) result.error = report.errors.join(' ');
  } catch (e) {
    result = { ok: false, error: e.message || String(e) };
  }
  if (site && (apply || !url)) {
    const fresh = await getSites();
    if (fresh[origin]) {
      fresh[origin].lastSheetFetch = Date.now();
      fresh[origin].lastSheetError = result.ok ? '' : result.error;
      const store = { [M.KEYS.sites]: fresh };
      if (apply && result.ok) {
        result.table.source = { kind: 'sheet', url: src };
        store[M.KEYS.table(origin)] = result.table;
      }
      await chrome.storage.local.set(store);
    }
  }
  return result;
}

/* ---------- messages ---------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  // content scripts run on web pages; extension pages (popup/options) have an extension URL
  const fromContent = !(sender.url || '').startsWith(chrome.runtime.getURL(''));
  const run = p => { p.then(sendResponse, e => sendResponse({ ok: false, error: String(e && e.message || e) })); return true; };
  switch (msg.cmd) {
    case 'refreshSheet': {
      const origin = fromContent ? M.originOf(sender.tab && sender.tab.url) : msg.origin;
      return run(fetchTable({ origin, apply: true, maxAgeMs: msg.maxAgeMs || 0 }));
    }
    case 'previewSheet':
      if (fromContent) return;
      return run(fetchTable({ origin: msg.origin, url: msg.url, apply: false }));
    case 'addSite':
      if (fromContent) return;
      return run(addSite(msg.origin));
    case 'removeSite':
      if (fromContent) return;
      return run(removeSite(msg.origin));
  }
});

/* The permission prompt can close the popup before it gets the answer – finish the job here. */
chrome.permissions.onAdded.addListener(async ({ origins }) => {
  if (!origins || !origins.length) return;
  const { pendingSite } = await chrome.storage.local.get('pendingSite');
  if (pendingSite && origins.includes(M.patternOf(pendingSite))) {
    await chrome.storage.local.remove('pendingSite');
    await addSite(pendingSite);
  } else {
    await syncRegistrations();
  }
});
chrome.permissions.onRemoved.addListener(() => { syncRegistrations(); });

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const d = await chrome.storage.local.get(M.KEYS.sites);
  if (!d[M.KEYS.sites]) await chrome.storage.local.set({ [M.KEYS.sites]: {} });
  await syncRegistrations();
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('options.html#welcome') });
});
chrome.runtime.onStartup.addListener(() => { syncRegistrations(); });
