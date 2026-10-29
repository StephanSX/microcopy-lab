const M = globalThis.MCL;
const { t } = globalThis.I18N;
const $ = id => document.getElementById(id);
let tab = null, origin = null, sites = {}, site = null, table = null;

function show(text, kind) {
  const m = $('msg');
  m.textContent = text || '';
  m.className = 'msg ' + (kind || 'info');
  m.hidden = !text;
}
const fmtDate = ts => (ts ? new Date(ts).toLocaleString(I18N.locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

async function loadState() {
  const d = await chrome.storage.local.get([M.KEYS.sites, origin ? M.KEYS.table(origin) : '_']);
  sites = d[M.KEYS.sites] || {};
  site = origin ? M.siteSettings(sites, origin) : null;
  table = origin ? d[M.KEYS.table(origin)] || null : null;
}

async function saveSite(patch) {
  Object.assign(site, patch);
  sites[origin] = Object.assign({}, sites[origin], patch);
  await chrome.storage.local.set({ [M.KEYS.sites]: sites });
  render();
  setTimeout(loadStats, 150);
}

async function render() {
  $('stUnsupported').hidden = $('stInactive').hidden = $('stActive').hidden = true;
  $('enabledWrap').hidden = true;
  $('tableInfo').textContent = '';
  if (!origin) { $('host').textContent = ''; $('stUnsupported').hidden = false; return; }
  $('host').textContent = M.hostLabel(origin);
  const granted = await chrome.permissions.contains({ origins: [M.patternOf(origin)] });
  if (!site || !granted) {
    $('stInactive').hidden = false;
    $('enableSite').textContent = t('popupEnableOn', M.hostLabel(origin));
    return;
  }
  $('stActive').hidden = false;
  $('enabledWrap').hidden = false;
  $('enabled').checked = site.enabled;
  $('highlight').checked = site.highlight;
  $('tableInfo').textContent = table ? '· ' + t('popupTableInfo', table.rows.length, table.variants.length, fmtDate(table.importedAt)) : '';
  const names = ['original'].concat(table ? table.variants : []);
  const seg = $('variants');
  seg.innerHTML = '';
  for (const v of names) {
    const b = document.createElement('button');
    b.textContent = v === 'original' ? t('variantOriginal') : v;
    b.setAttribute('aria-pressed', String((names.includes(site.variant) ? site.variant : 'original') === v));
    b.disabled = !site.enabled;
    b.onclick = () => saveSite({ variant: v });
    seg.appendChild(b);
  }
  $('noTable').hidden = !!table;
  $('refresh').hidden = !site.sheetUrl;
  if (site.sheetUrl && site.lastSheetError) show(t('sheetErrorPrefix', site.lastSheetError), 'err');
}

async function loadStats() {
  if (!site || !tab) return;
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { cmd: 'stats' });
    if (!r || !r.ok) return;
    $('page').textContent = r.page;
    $('sReplaced').textContent = r.stats.replaced;
    $('sEmpty').textContent = r.stats.empty;
    $('sUnknown').textContent = r.stats.unknown;
  } catch (e) {
    show(t('popupReloadPage'), 'warn');
  }
}

$('enableSite').onclick = () => {
  const target = origin;
  // must be called directly from the click (user gesture)
  chrome.storage.local.set({ pendingSite: target });
  chrome.permissions.request({ origins: [M.patternOf(target)] }).then(async granted => {
    if (!granted) { show(t('permDenied'), 'warn'); return; }
    await chrome.runtime.sendMessage({ cmd: 'addSite', origin: target });
    await loadState();
    await render();
    setTimeout(loadStats, 400);
  });
};
$('enabled').onchange = e => saveSite({ enabled: e.target.checked });
$('highlight').onchange = e => saveSite({ highlight: e.target.checked });
$('manage').onclick = () => {
  const url = chrome.runtime.getURL('options.html') + (site ? '?site=' + encodeURIComponent(origin) : '');
  chrome.tabs.create({ url });
  window.close();
};
$('collect').onclick = async () => {
  $('collect').disabled = true;
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { cmd: 'collect' });
    if (r && r.ok) show(t('popupCollected', r.total, r.page, r.added), 'ok');
    else show(t('popupReloadPage'), 'warn');
  } catch (e) {
    show(t('popupReloadPage'), 'warn');
  }
  $('collect').disabled = false;
};
$('refresh').onclick = async () => {
  $('refresh').disabled = true;
  show(t('sheetLoading'), 'info');
  const r = await chrome.runtime.sendMessage({ cmd: 'refreshSheet', origin });
  await loadState();
  await render();
  if (r && r.ok) {
    const w = r.report.warnings.length;
    show(w ? t('sheetUpdatedWarn', r.report.rowCount, w) : t('sheetUpdated', r.report.rowCount), w ? 'warn' : 'ok');
  } else show(t('sheetErrorPrefix', (r && r.error) || '?'), 'err');
  $('refresh').disabled = false;
  setTimeout(loadStats, 150);
};

(async function init() {
  I18N.apply();
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  origin = tab && M.isSupportedUrl(tab.url) ? M.originOf(tab.url) : null;
  await loadState();
  await render();
  loadStats();
})();
