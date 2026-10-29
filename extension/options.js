const M = globalThis.MCL;
const { t } = globalThis.I18N;
const $ = id => document.getElementById(id);
let sites = {}, origin = null, site = null, table = null, seen = {}, pending = null;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = ts => (ts ? new Date(ts).toLocaleString(I18N.locale(), { dateStyle: 'short', timeStyle: 'short' }) : '');

async function load() {
  const d = await chrome.storage.local.get(M.KEYS.sites);
  sites = d[M.KEYS.sites] || {};
  const list = Object.keys(sites).sort();
  const wanted = new URLSearchParams(location.search).get('site');
  if (!origin || !sites[origin]) origin = wanted && sites[wanted] ? wanted : list[0] || null;
  await loadSite();
}

async function loadSite() {
  site = origin ? M.siteSettings(sites, origin) : null;
  if (origin) {
    const d = await chrome.storage.local.get([M.KEYS.table(origin), M.KEYS.seen(origin)]);
    table = d[M.KEYS.table(origin)] || null;
    seen = d[M.KEYS.seen(origin)] || {};
  } else { table = null; seen = {}; }
  pending = null;
  $('reportCard').hidden = true;
  render();
}

async function saveSite(patch) {
  Object.assign(site, patch);
  sites[origin] = Object.assign({}, sites[origin], patch);
  await chrome.storage.local.set({ [M.KEYS.sites]: sites });
}

async function render() {
  const sel = $('siteSelect');
  const list = Object.keys(sites).sort();
  sel.innerHTML = list.map(o => `<option value="${esc(o)}"${o === origin ? ' selected' : ''}>${esc(M.hostLabel(o))}</option>`).join('');
  sel.disabled = !list.length;
  $('empty').hidden = !!origin;
  $('siteArea').hidden = !origin;
  if (!origin) return;
  const qs = '?site=' + encodeURIComponent(origin);
  if (location.search !== qs) history.replaceState(null, '', qs + location.hash);
  $('permWarn').hidden = await chrome.permissions.contains({ origins: [M.patternOf(origin)] });
  $('sheetUrl').value = site.sheetUrl || '';
  $('autoRefresh').checked = !!site.autoRefresh;
  $('autoCollect').checked = !!site.autoCollect;
  if (table) {
    const src = table.source ? (table.source.kind === 'sheet' ? 'Google Sheet' : t('optFromFile', table.source.name)) : '';
    const perVariant = table.variants.map(v => `${esc(v)}: ${table.rows.filter(r => r.values[v]).length}`).join(' · ');
    $('current').innerHTML = t('optCurrentSummary', `<b>${table.rows.length}</b>`, esc(src), esc(fmtDate(table.importedAt))) +
      `<br><span class="small">${esc(t('optVariantsCount'))} ${perVariant || '–'}</span>` +
      (site.sheetUrl && site.lastSheetError ? `<div class="msg err" style="margin-top:8px">${esc(site.lastSheetError)}</div>` : '');
  } else $('current').textContent = t('optNoTable');
  $('clearTable').disabled = !table;
  renderSeen();
}

function renderSeen() {
  const q = M.norm($('seenFilter').value).toLowerCase();
  const compiled = M.compileTable(table);
  const entries = Object.entries(seen).map(([k, v]) => {
    const [type, text] = M.splitKey(k);
    return { type, text, pages: v.pages || [], inTable: M.knownInTable(compiled, text, type) };
  });
  $('seenCount').textContent = entries.length;
  const rows = entries
    .filter(e => !q || e.text.toLowerCase().includes(q) || e.pages.join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.inTable - b.inTable || a.text.localeCompare(b.text))
    .slice(0, 300);
  $('seenTable').innerHTML = `<tr><th>${esc(t('colText'))}</th><th>${esc(t('colType'))}</th><th>${esc(t('colPages'))}</th><th>${esc(t('colTable'))}</th></tr>` +
    rows.map(e => `<tr><td title="${esc(e.text)}">${esc(e.text)}</td><td>${esc(e.type)}</td><td title="${esc(e.pages.join('\n'))}">${esc(e.pages.length > 1 ? t('optNPages', e.pages.length) : e.pages[0] || '')}</td><td>${e.inTable ? '✓' : `<span style="color:var(--warn)">${esc(t('foundNew'))}</span>`}</td></tr>`).join('');
}

/* ---------- sites ---------- */
function requestSite(target) {
  chrome.storage.local.set({ pendingSite: target });
  return chrome.permissions.request({ origins: [M.patternOf(target)] }).then(async granted => {
    if (!granted) { alert(t('permDenied')); return false; }
    await chrome.runtime.sendMessage({ cmd: 'addSite', origin: target });
    origin = target;
    await load();
    return true;
  });
}
$('addSite').onclick = () => {
  let v = $('newSite').value.trim();
  if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
  const target = M.originOf(v);
  if (!target) { alert(t('optInvalidUrl')); return; }
  requestSite(target).then(ok => { if (ok) $('newSite').value = ''; });
};
$('regrant').onclick = () => requestSite(origin);
$('siteSelect').onchange = e => { origin = e.target.value; loadSite(); };
$('removeSite').onclick = async () => {
  if (!confirm(t('optRemoveSiteConfirm', M.hostLabel(origin)))) return;
  await chrome.runtime.sendMessage({ cmd: 'removeSite', origin });
  origin = null;
  history.replaceState(null, '', location.pathname);
  await load();
};

/* ---------- import ---------- */
async function readFile(file) {
  if (/\.xls$/i.test(file.name)) throw new Error(t('errXls'));
  const buf = await file.arrayBuffer();
  const isZip = new Uint8Array(buf.slice(0, 2)).join() === '80,75';
  if (isZip) return XlsxMini.readXlsx(buf);
  return M.parseCSV(M.decodeBytes(buf));
}
async function handleFile(file) {
  try {
    const matrix = await readFile(file);
    const { table: tb, report } = M.buildTable(matrix, new Set(Object.keys(seen)));
    showReport(tb, report, { kind: 'file', name: file.name });
  } catch (e) {
    showReport(null, emptyReport(e.message || String(e)), { kind: 'file', name: file.name });
  }
}
const emptyReport = err => ({ errors: [err], warnings: [], infos: [], rowCount: 0, variants: [], unseen: 0, unseenExamples: [] });

function showReport(tb, report, source) {
  pending = tb ? Object.assign(tb, { source }) : null;
  $('reportCard').hidden = false;
  $('reportSource').textContent = source.kind === 'sheet' ? 'Google Sheet' : source.name;
  $('kpis').innerHTML = [
    [t('kpiRows'), report.rowCount], [t('kpiVariants'), report.variants.length ? report.variants.join(', ') : '–'],
    [t('kpiWarnings'), report.warnings.length], [t('kpiUnseen'), report.unseen]
  ].map(([l, v]) => `<div><b>${esc(v)}</b><span class="small muted">${esc(l)}</span></div>`).join('');
  const block = (items, kind, title) => items.length
    ? `<div class="msg ${kind}"><b>${esc(title)}</b><ul class="list">${items.slice(0, 100).map(x => `<li>${esc(x)}</li>`).join('')}${items.length > 100 ? `<li>${esc(t('repMore', items.length - 100))}</li>` : ''}</ul></div>` : '';
  const infos = report.infos.slice();
  if (report.unseenExamples && report.unseenExamples.length) infos.push(t('repUnseenExamples', report.unseenExamples.slice(0, 8).map(x => '«' + x + '»').join(', ')));
  $('reportMsgs').innerHTML =
    block(report.errors, 'err', t('repErrorsTitle')) +
    block(report.warnings, 'warn', t('repWarningsTitle')) +
    block(infos, 'info', t('repInfosTitle')) +
    (!report.errors.length && !report.warnings.length ? `<div class="msg ok">${esc(t('repAllGood'))}</div>` : '');
  if (tb) {
    const head = ['page', 'type', 'original'].concat(tb.variants);
    $('preview').innerHTML = '<tr>' + head.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>' +
      tb.rows.slice(0, 50).map(r => '<tr>' + [r.page, r.type, r.original].map(c => `<td title="${esc(c)}">${esc(c)}</td>`).join('') +
        tb.variants.map(v => (r.values[v] ? `<td title="${esc(r.values[v])}">${esc(r.values[v])}</td>` : `<td class="empty">${esc(t('eqOriginal'))}</td>`)).join('') + '</tr>').join('') +
      (tb.rows.length > 50 ? `<tr><td colspan="${head.length}" class="muted">${esc(t('repMoreRows', tb.rows.length - 50))}</td></tr>` : '');
  } else $('preview').innerHTML = '';
  $('apply').disabled = !tb;
  $('applyNote').hidden = !tb;
  $('reportCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('pick').onclick = () => $('file').click();
$('file').onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; };
const drop = $('drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

$('loadSheet').onclick = () => {
  const url = $('sheetUrl').value.trim();
  const perms = M.sheetPermissionOrigins(url);
  if (!url || !perms.length) { alert(t('optInvalidUrl')); return; }
  // permission request must happen directly in the click handler
  chrome.permissions.request({ origins: perms }).then(async granted => {
    if (!granted) { alert(t('permDenied')); return; }
    $('loadSheet').disabled = true;
    $('loadSheet').textContent = t('sheetLoading');
    const r = await chrome.runtime.sendMessage({ cmd: 'previewSheet', origin, url });
    $('loadSheet').disabled = false;
    $('loadSheet').textContent = t('optLoad');
    const source = { kind: 'sheet', name: 'Google Sheet', url };
    if (r && r.ok) showReport(r.table, r.report, source);
    else showReport(null, Object.assign(emptyReport((r && r.error) || '?'), r && r.report ? { warnings: r.report.warnings, infos: r.report.infos } : {}), source);
  });
};

$('apply').onclick = async () => {
  if (!pending) return;
  const patch = {};
  if (pending.source.kind === 'sheet') Object.assign(patch, { sheetUrl: pending.source.url, lastSheetFetch: Date.now(), lastSheetError: '' });
  else patch.sheetUrl = ''; // a file import replaces a linked sheet
  if (site.variant !== 'original' && !pending.variants.includes(site.variant)) patch.variant = 'original';
  Object.assign(site, patch);
  sites[origin] = Object.assign({}, sites[origin], patch);
  await chrome.storage.local.set({ [M.KEYS.table(origin)]: pending, [M.KEYS.sites]: sites });
  table = pending;
  pending = null;
  $('reportCard').hidden = true;
  render();
};
$('discard').onclick = () => { pending = null; $('reportCard').hidden = true; };
$('clearTable').onclick = async () => {
  if (!confirm(t('optClearTableConfirm'))) return;
  await chrome.storage.local.remove(M.KEYS.table(origin));
  await saveSite({ sheetUrl: '', variant: 'original' });
  table = null;
  render();
};
$('autoRefresh').onchange = e => saveSite({ autoRefresh: e.target.checked });
$('autoCollect').onchange = e => saveSite({ autoCollect: e.target.checked });
$('seenFilter').oninput = renderSeen;
$('clearSeen').onclick = async () => {
  if (!confirm(t('optClearSeenConfirm'))) return;
  await chrome.storage.local.remove(M.KEYS.seen(origin));
  seen = {};
  renderSeen();
};

/* ---------- export ---------- */
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const fileBase = () => 'microcopy-' + M.hostLabel(origin).replace(/[^a-z0-9.-]+/gi, '_') + '-' + new Date().toISOString().slice(0, 10);
$('exportXlsx').onclick = () => {
  const m = M.exportMatrix(table, seen);
  const widths = m[0].map(h => (h === 'page' ? 30 : h === 'type' ? 11 : h === 'found' ? 10 : h === 'note' ? 24 : 34));
  download(XlsxMini.writeXlsx(m, { widths, sheetName: 'Texts' }), fileBase() + '.xlsx');
};
$('exportCsv').onclick = () => {
  download(new Blob([M.toCSV(M.exportMatrix(table, seen), ';')], { type: 'text/csv;charset=utf-8' }), fileBase() + '.csv');
};

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  if (ch[M.KEYS.sites]) {
    sites = ch[M.KEYS.sites].newValue || {};
    if (origin && !sites[origin]) { origin = null; load(); return; }
    site = origin ? M.siteSettings(sites, origin) : null;
    render();
  }
  if (!origin) return;
  if (ch[M.KEYS.seen(origin)]) { seen = ch[M.KEYS.seen(origin)].newValue || {}; renderSeen(); }
  if (ch[M.KEYS.table(origin)] && !pending) { table = ch[M.KEYS.table(origin)].newValue || null; render(); }
});

I18N.apply();
if (location.hash === '#welcome') $('welcome').hidden = false;
$('version').textContent = 'Microcopy Lab ' + chrome.runtime.getManifest().version;
load();
