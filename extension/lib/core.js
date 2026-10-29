/* Microcopy Lab – shared logic (content script, popup, options page, service worker) */
(function (root) {
  'use strict';

  const t = (...a) => (root.I18N ? root.I18N.t(...a) : a[0]);

  const SEP = '|~|'; // key separator "type|~|text"
  const TYPES = ['text', 'placeholder', 'tooltip', 'aria'];
  const TYPE_ATTR = { placeholder: 'placeholder', tooltip: 'title', aria: 'aria-label' };
  const TYPE_ALIASES = {
    '': 'text', text: 'text', label: 'text', titel: 'text', title: 'text',
    placeholder: 'placeholder', platzhalter: 'placeholder',
    tooltip: 'tooltip', hinweis: 'tooltip', hint: 'tooltip',
    aria: 'aria', 'aria-label': 'aria', screenreader: 'aria'
  };
  const COL_ALIASES = {
    page: ['page', 'screen', 'seite', 'pfad', 'path', 'route', 'url'],
    type: ['type', 'typ', 'art', 'kind'],
    original: ['original', 'originaltext', 'source', 'quelle'],
    note: ['note', 'notes', 'notiz', 'kommentar', 'comment', 'bemerkung']
  };
  // columns that are never treated as variants
  const META_COLS = ['found', 'gefunden', 'count', 'anzahl', 'status', 'id', 'key', 'schlüssel', 'nr', '#'];

  const DEFAULT_SITE = {
    enabled: true,
    variant: 'original',
    highlight: false,
    autoCollect: true,
    sheetUrl: '',
    autoRefresh: true,
    lastSheetFetch: 0,
    lastSheetError: ''
  };

  const KEYS = {
    sites: 'sites',
    table: origin => 'table:' + origin,
    seen: origin => 'seen:' + origin
  };

  /* ---------- sites ---------- */
  function isSupportedUrl(url) {
    return /^https?:\/\/[^/]+/i.test(String(url || ''));
  }
  function originOf(url) {
    try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : null; } catch (e) { return null; }
  }
  /** Chrome match pattern for an origin (patterns ignore ports) */
  function patternOf(origin) {
    const u = new URL(origin);
    return `${u.protocol}//${u.hostname}/*`;
  }
  function hostLabel(origin) {
    try { return new URL(origin).host; } catch (e) { return String(origin); }
  }
  function siteSettings(sites, origin) {
    return sites && sites[origin] ? Object.assign({}, DEFAULT_SITE, sites[origin]) : null;
  }

  function norm(s) {
    return String(s == null ? '' : s).replace(/[\s  ]+/g, ' ').trim();
  }
  function key(type, text) { return type + SEP + text; }
  function splitKey(k) { const i = k.indexOf(SEP); return [k.slice(0, i), k.slice(i + SEP.length)]; }

  /* ---------- pages (routes) ---------- */
  function isIdSegment(seg) {
    if (/^\d+$/.test(seg)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return true;
    if (seg.length >= 16 && /\d/.test(seg) && /^[A-Za-z0-9_-]+$/.test(seg)) return true;
    return false;
  }
  function pageKey(pathname) {
    let p = String(pathname || '/');
    p = p.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
    const segs = p.split('/').filter(Boolean).map(s => (s === '*' ? s : isIdSegment(s) ? ':id' : s));
    return '/' + segs.join('/');
  }
  function compilePage(page) {
    const s = norm(page);
    if (!s || s === '*') return { spec: 0, test: () => true };
    const k = pageKey(s);
    if (k.includes('*')) {
      const re = new RegExp('^' + k.split('*').map(escapeRe).join('.*') + '/?$');
      return { spec: 1 + k.replace(/\*/g, '').length, test: x => re.test(x) };
    }
    return { spec: 10000, test: x => x === k };
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function placeholders(s) {
    const out = [];
    String(s || '').replace(/\{(\w+)\}/g, (m, n) => { out.push(n); return m; });
    return out;
  }
  function templateRe(original) {
    return new RegExp('^' + original.split(/\{\w+\}/).map(escapeRe).join('(.+?)') + '$');
  }

  /* ---------- lookup ---------- */
  function compileTable(table) {
    const exact = new Map();
    const templates = [];
    if (table && Array.isArray(table.rows)) {
      for (const row of table.rows) {
        const original = norm(row.original);
        if (!original) continue;
        const type = row.type || 'text';
        const page = compilePage(row.page);
        const names = placeholders(original);
        if (names.length) {
          templates.push({ type, re: templateRe(original), names, page, row });
        } else {
          const k = key(type, original);
          if (!exact.has(k)) exact.set(k, []);
          exact.get(k).push({ page, row });
        }
      }
    }
    return { exact, templates };
  }

  /** null = unknown, {row, value:null} = known but variant empty, {row, value} = replacement */
  function lookup(compiled, text, type, page, variant) {
    const n = norm(text);
    if (!n) return null;
    const useVariant = variant && variant !== 'original';
    let best = null;
    const cands = compiled.exact.get(key(type, n));
    if (cands) {
      for (const c of cands) if (c.page.test(page) && (!best || c.page.spec > best.page.spec)) best = c;
    }
    if (best) {
      const v = useVariant ? best.row.values[variant] : '';
      return { row: best.row, value: v ? String(v) : null };
    }
    let tbest = null, tm = null;
    for (const tp of compiled.templates) {
      if (tp.type !== type || !tp.page.test(page)) continue;
      const m = tp.re.exec(n);
      if (m && (!tbest || tp.page.spec > tbest.page.spec)) { tbest = tp; tm = m; }
    }
    if (tbest) {
      const rawV = useVariant ? tbest.row.values[variant] : '';
      if (!rawV) return { row: tbest.row, value: null };
      const vals = {};
      tbest.names.forEach((name, i) => { vals[name] = tm[i + 1]; });
      return { row: tbest.row, value: String(rawV).replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m)) };
    }
    return null;
  }

  function knownInTable(compiled, text, type) {
    if (compiled.exact.has(key(type, text))) return true;
    return compiled.templates.some(tp => tp.type === type && tp.re.test(text));
  }

  /** keeps leading/trailing whitespace of the original node text */
  function applyValue(originalRaw, value) {
    const lead = originalRaw.match(/^\s*/)[0];
    const trail = originalRaw.match(/\s*$/)[0];
    return lead + value + trail;
  }

  function isCollectable(text) {
    const n = norm(text);
    if (!n || n.length < 2 || n.length > 300) return false;
    if (!/\p{L}/u.test(n)) return false;
    if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(n)) return false;
    return true;
  }

  /* ---------- reading files ---------- */
  function decodeBytes(buf) {
    let bytes = new Uint8Array(buf);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) { return new TextDecoder('windows-1252').decode(bytes); }
  }

  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const counts = { ';': 0, ',': 0, '\t': 0 };
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') q = !q;
      else if (!q && (ch === '\n' || ch === '\r')) break;
      else if (!q && ch in counts) counts[ch]++;
    }
    const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function toCSV(rows, delim) {
    delim = delim || ';';
    return '﻿' + rows.map(r => r.map(v => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@]/.test(s)) s = "'" + s; // prevent formula injection in spreadsheet apps
      return /[";\n\r,\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(delim)).join('\r\n');
  }

  /**
   * Matrix -> table + validation report.
   * knownTexts: Set of key(type,text) seen on pages so far
   */
  function buildTable(matrix, knownTexts) {
    const report = { errors: [], warnings: [], infos: [], rowCount: 0, skipped: 0, variants: [], unseen: 0, unseenExamples: [] };
    // undo the formula-injection guard added by toCSV ("'=..." -> "=...")
    const rowsIn = (matrix || []).map(r => (r || []).map(c => (c == null ? '' : String(c).replace(/^'(?=[=+\-@])/, ''))));
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rowsIn.length, 10); i++) {
      if (rowsIn[i].some(c => COL_ALIASES.original.includes(norm(c).toLowerCase()))) { headerIdx = i; break; }
    }
    if (headerIdx < 0) {
      report.errors.push(t('repNoOriginal'));
      return { table: null, report };
    }
    const header = rowsIn[headerIdx].map(h => norm(h));
    const col = { page: -1, type: -1, original: -1, note: -1 };
    const variantCols = [];
    header.forEach((h, i) => {
      const l = h.toLowerCase();
      if (!h) return;
      for (const k of Object.keys(COL_ALIASES)) {
        if (COL_ALIASES[k].includes(l)) {
          if (col[k] < 0) col[k] = i;
          return;
        }
      }
      if (META_COLS.includes(l)) return;
      if (variantCols.some(v => v.name.toLowerCase() === l)) {
        report.warnings.push(t('repDupColumn', h));
        return;
      }
      variantCols.push({ name: h, idx: i });
    });
    report.variants = variantCols.map(v => v.name);
    if (!variantCols.length) report.warnings.push(t('repNoVariants'));

    const rows = [];
    const dupKeys = new Map();
    for (let i = headerIdx + 1; i < rowsIn.length; i++) {
      const r = rowsIn[i];
      const line = i + 1;
      const original = norm(r[col.original]);
      if (!original) {
        if (r.some(c => norm(c))) report.skipped++;
        continue;
      }
      const pageRaw = col.page >= 0 ? norm(r[col.page]) : '';
      const page = !pageRaw || pageRaw === '*' ? '*' : pageKey(pageRaw);
      const typeRaw = col.type >= 0 ? norm(r[col.type]).toLowerCase() : '';
      let type = TYPE_ALIASES[typeRaw];
      if (!type) {
        report.warnings.push(t('repUnknownType', line, typeRaw));
        type = 'text';
      }
      const values = {};
      for (const v of variantCols) {
        const val = norm(r[v.idx]);
        if (val) values[v.name] = val;
      }
      const note = col.note >= 0 ? norm(r[col.note]) : '';
      const dupKey = page + SEP + type + SEP + original;
      if (dupKeys.has(dupKey)) {
        report.warnings.push(t('repDuplicate', line, original, type, page, dupKeys.get(dupKey)));
        continue;
      }
      dupKeys.set(dupKey, line);
      const ph = placeholders(original).sort().join(',');
      for (const v of variantCols) {
        if (values[v.name] && placeholders(values[v.name]).sort().join(',') !== ph) {
          report.warnings.push(t('repPlaceholder', line, v.name, original, values[v.name]));
        }
      }
      rows.push({ page, type, original, values, note });
    }
    report.rowCount = rows.length;
    if (report.skipped) report.infos.push(t('repSkipped', report.skipped));

    if (knownTexts && knownTexts.size) {
      const knownList = Array.from(knownTexts).map(splitKey);
      for (const row of rows) {
        let found;
        if (placeholders(row.original).length) {
          const re = templateRe(row.original);
          found = knownList.some(([ty, x]) => ty === row.type && re.test(x));
        } else found = knownTexts.has(key(row.type, row.original));
        if (!found) {
          report.unseen++;
          if (report.unseenExamples.length < 15) report.unseenExamples.push(row.original);
        }
      }
      if (report.unseen) report.infos.push(t('repUnseen', report.unseen));
    }
    const table = report.errors.length ? null : { variants: report.variants, rows, importedAt: Date.now() };
    return { table, report };
  }

  /* ---------- Google Sheets ---------- */
  function sheetCsvUrl(url) {
    const u = String(url || '').trim();
    const m = u.match(/docs\.google\.com\/spreadsheets\/d\/(e\/)?([A-Za-z0-9_-]+)/);
    if (!m) return u;
    const gid = (u.match(/[#&?]gid=(\d+)/) || [])[1];
    if (m[1]) {
      if (/output=csv/.test(u)) return u;
      return `https://docs.google.com/spreadsheets/d/e/${m[2]}/pub?output=csv${gid ? '&gid=' + gid : ''}`;
    }
    return `https://docs.google.com/spreadsheets/d/${m[2]}/export?format=csv&gid=${gid || '0'}`;
  }
  /** host permissions needed to download a table URL */
  function sheetPermissionOrigins(url) {
    const u = String(url || '').trim();
    if (/^https:\/\/docs\.google\.com\//i.test(u)) return ['https://docs.google.com/*', 'https://*.googleusercontent.com/*'];
    const o = originOf(u);
    return o ? [patternOf(o)] : [];
  }

  /* ---------- export ---------- */
  const EXPORT_HEAD = ['page', 'type', 'original'];
  function exportMatrix(table, seen) {
    const variants = table && table.variants && table.variants.length ? table.variants.slice() : ['A', 'B'];
    const out = [EXPORT_HEAD.concat(variants, ['note', 'found'])];
    const compiled = compileTable(table);
    const seenKeys = new Set(Object.keys(seen || {}));
    const seenList = Array.from(seenKeys).map(splitKey);
    if (table) {
      for (const r of table.rows) {
        let known;
        if (placeholders(r.original).length) {
          const re = templateRe(r.original);
          known = seenList.some(([ty, x]) => ty === r.type && re.test(x));
        } else known = seenKeys.has(key(r.type, r.original));
        out.push([r.page, r.type, r.original].concat(variants.map(v => r.values[v] || ''), [r.note || '', known ? t('foundYes') : t('foundNo')]));
      }
    }
    const fresh = [];
    for (const [k, info] of Object.entries(seen || {})) {
      const [type, text] = splitKey(k);
      if (knownInTable(compiled, text, type)) continue;
      const pages = (info && info.pages) || [];
      fresh.push([pages.length === 1 ? pages[0] : '*', type, text].concat(variants.map(() => ''), ['', t('foundNew')]));
    }
    fresh.sort((a, b) => (a[0] === b[0] ? 0 : a[0] === '*' ? -1 : b[0] === '*' ? 1 : a[0] < b[0] ? -1 : 1));
    return out.concat(fresh);
  }

  root.MCL = {
    SEP, TYPES, TYPE_ATTR, DEFAULT_SITE, KEYS,
    isSupportedUrl, originOf, patternOf, hostLabel, siteSettings,
    norm, key, splitKey, pageKey, compilePage, compileTable, lookup, knownInTable, applyValue, isCollectable, placeholders,
    decodeBytes, parseCSV, toCSV, buildTable, sheetCsvUrl, sheetPermissionOrigins, exportMatrix
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
