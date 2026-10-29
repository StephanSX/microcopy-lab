/* Microcopy Lab – content script: replaces texts live on sites the user has enabled */
(function () {
  'use strict';
  if (window.__mclLoaded) return;
  window.__mclLoaded = true;

  const M = globalThis.MCL;
  const ORIGIN = location.origin;
  const K_TABLE = M.KEYS.table(ORIGIN);
  const K_SEEN = M.KEYS.seen(ORIGIN);
  const ATTRS = Object.entries(M.TYPE_ATTR); // [type, attribute]
  const ATTR_TO_TYPE = Object.fromEntries(ATTRS.map(([ty, a]) => [a, ty]));
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'svg', 'SVG', 'TEMPLATE', 'IFRAME', 'OBJECT']);
  const HL_RANK = { unknown: 1, empty: 2, ok: 3 };
  const URL_PARAM = '_variant';

  let site = null;        // settings for this origin (null = not enabled here)
  let compiled = M.compileTable(null);
  let variants = [];
  let page = M.pageKey(location.pathname);
  let ready = false;
  let observing = false;

  const textInfo = new WeakMap();  // Text node -> {orig, applied}
  const attrInfo = new WeakMap();  // Element -> {attr: {orig, applied}}

  /* ---------- hide the page briefly until settings are loaded (prevents flashing originals) ---------- */
  const hideStyle = document.createElement('style');
  hideStyle.textContent = 'html{visibility:hidden !important}';
  (document.head || document.documentElement).appendChild(hideStyle);
  const unhide = () => hideStyle.remove();
  setTimeout(unhide, 800); // safety net

  const hlStyle = document.createElement('style');
  hlStyle.textContent =
    '[data-mcl-hl="ok"]{outline:2px solid rgba(22,163,74,.85)!important;outline-offset:1px}' +
    '[data-mcl-hl="empty"]{outline:2px dashed rgba(37,99,235,.85)!important;outline-offset:1px}' +
    '[data-mcl-hl="unknown"]{outline:1px dashed rgba(234,179,8,.9)!important;outline-offset:1px}';

  /* ---------- collecting ---------- */
  let seenBuffer = new Map(); // key -> Set(pages)
  let flushTimer = null;
  function record(type, text, force) {
    if (!site || (!force && !site.autoCollect)) return;
    const n = M.norm(text);
    if (!M.isCollectable(n)) return;
    const k = M.key(type, n);
    if (!seenBuffer.has(k)) seenBuffer.set(k, new Set());
    seenBuffer.get(k).add(page);
    if (!flushTimer) flushTimer = setTimeout(flushSeen, 2500);
  }
  async function flushSeen() {
    clearTimeout(flushTimer);
    flushTimer = null;
    if (!seenBuffer.size) return 0;
    const buf = seenBuffer;
    seenBuffer = new Map();
    let added = 0;
    try {
      const data = await chrome.storage.local.get(K_SEEN);
      const seen = data[K_SEEN] || {};
      const now = Date.now();
      let size = Object.keys(seen).length;
      for (const [k, pages] of buf) {
        let e = seen[k];
        if (!e) {
          if (size >= 10000) continue;
          e = seen[k] = { pages: [], count: 0, first: now };
          size++;
          added++;
        }
        for (const p of pages) if (!e.pages.includes(p) && e.pages.length < 20) e.pages.push(p);
        e.count++;
        e.last = now;
      }
      await chrome.storage.local.set({ [K_SEEN]: seen });
    } catch (e) { /* extension reloaded – ignore */ }
    return added;
  }

  /* ---------- replacing ---------- */
  function active() { return site && site.enabled && site.variant && site.variant !== 'original'; }

  function translate(orig, type, stats) {
    const res = M.lookup(compiled, orig, type, page, active() ? site.variant : 'original');
    if (!res) { if (stats) stats.unknown++; return { target: orig, hl: 'unknown' }; }
    if (!res.value) { if (stats) stats.empty++; return { target: orig, hl: 'empty' }; }
    if (stats) stats.replaced++;
    return { target: M.applyValue(orig, res.value), hl: 'ok' };
  }

  function skipElement(el) {
    for (let e = el; e; e = e.parentElement) {
      if (SKIP_TAGS.has(e.tagName) || e.isContentEditable) return true;
    }
    return false;
  }

  function highlightOn() { return site && site.enabled && site.highlight; }

  function markHl(el, hl, rankMap) {
    if (!el || !el.setAttribute) return;
    if (!highlightOn()) {
      if (el.hasAttribute('data-mcl-hl')) el.removeAttribute('data-mcl-hl');
      return;
    }
    if (rankMap) {
      const prev = rankMap.get(el);
      if (prev && HL_RANK[prev] <= HL_RANK[hl]) return; // weakest state wins so unknown texts stay visible
      rankMap.set(el, hl);
    }
    if (el.getAttribute('data-mcl-hl') !== hl) el.setAttribute('data-mcl-hl', hl);
  }

  function processText(node, ctx) {
    const cur = node.nodeValue;
    const info = textInfo.get(node);
    const orig = info && cur === info.applied ? info.orig : cur;
    if (!M.norm(orig) || !/\p{L}/u.test(orig)) return;
    if (ctx && ctx.collect) ctx.collect('text', orig);
    record('text', orig);
    const { target, hl } = translate(orig, 'text', ctx && ctx.stats);
    markHl(node.parentElement, hl, ctx && ctx.rank);
    if (target !== cur) node.nodeValue = target;
    if (target !== orig) textInfo.set(node, { orig, applied: target });
    else if (info) textInfo.delete(node);
  }

  function processAttr(el, attr, ctx) {
    if (!el.hasAttribute(attr)) return;
    const type = ATTR_TO_TYPE[attr];
    const cur = el.getAttribute(attr);
    const map = attrInfo.get(el);
    const info = map && map[attr];
    const orig = info && cur === info.applied ? info.orig : cur;
    if (!M.norm(orig)) return;
    if (ctx && ctx.collect) ctx.collect(type, orig);
    record(type, orig);
    const { target } = translate(orig, type, ctx && ctx.stats);
    if (target !== cur) el.setAttribute(attr, target);
    if (target !== orig) {
      const m = map || {};
      if (!map) attrInfo.set(el, m);
      m[attr] = { orig, applied: target };
    } else if (info) delete map[attr];
  }

  function walk(root, ctx) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      if (!skipElement(root.parentElement)) processText(root, ctx);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || skipElement(root)) return;
    for (const [, a] of ATTRS) if (root.hasAttribute(a)) processAttr(root, a, ctx);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE && (SKIP_TAGS.has(n.tagName) || n.isContentEditable)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) processText(n, ctx);
      else for (const [, a] of ATTRS) if (n.hasAttribute(a)) processAttr(n, a, ctx);
    }
  }

  function fullPass(ctx) {
    ctx = ctx || {};
    if (!document.body) return ctx;
    ctx.rank = new Map();
    walk(document.body, ctx);
    if (!highlightOn()) document.querySelectorAll('[data-mcl-hl]').forEach(el => el.removeAttribute('data-mcl-hl'));
    return ctx;
  }

  const observer = new MutationObserver(muts => {
    if (!ready || !site) return;
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(n => walk(n));
      else if (m.type === 'characterData') {
        if (!skipElement(m.target.parentElement)) processText(m.target);
      } else if (m.type === 'attributes' && m.target.nodeType === 1 && !skipElement(m.target)) {
        processAttr(m.target, m.attributeName);
      }
    }
  });
  function observe(on) {
    if (on && !observing) {
      observer.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATTRS.map(([, a]) => a)
      });
      observing = true;
    } else if (!on && observing) {
      observer.disconnect();
      observing = false;
    }
  }

  function applyHlStyle() {
    if (highlightOn()) {
      if (!hlStyle.isConnected) (document.head || document.documentElement).appendChild(hlStyle);
    } else hlStyle.remove();
  }

  function setTable(table) {
    compiled = M.compileTable(table);
    variants = table && Array.isArray(table.variants) ? table.variants : [];
  }

  /* ---------- test links: ?_variant=B / ?_variant=original / ?_variant=off ---------- */
  async function applyUrlParam(sites) {
    let v;
    try { v = new URLSearchParams(location.search).get(URL_PARAM); } catch (e) { v = null; }
    if (!v || !site) return;
    v = v.trim();
    const patch = {};
    if (/^(off|aus)$/i.test(v)) patch.enabled = false;
    else if (/^original$/i.test(v)) { patch.enabled = true; patch.variant = 'original'; }
    else {
      const match = variants.find(x => x.toLowerCase() === v.toLowerCase());
      if (match) { patch.enabled = true; patch.variant = match; }
    }
    if (Object.keys(patch).length) {
      Object.assign(site, patch);
      sites[ORIGIN] = Object.assign({}, sites[ORIGIN], patch);
      await chrome.storage.local.set({ [M.KEYS.sites]: sites });
    }
  }

  /* ---------- start ---------- */
  async function init() {
    const data = await chrome.storage.local.get([M.KEYS.sites, K_TABLE]);
    const sites = data[M.KEYS.sites] || {};
    site = M.siteSettings(sites, ORIGIN);
    if (!site) { unhide(); return; } // not enabled for this origin (e.g. other port)
    setTable(data[K_TABLE] || null);
    await applyUrlParam(sites);
    ready = true;
    applyHlStyle();
    observe(true);
    const start = () => { fullPass(); unhide(); };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
    if (site.sheetUrl && site.autoRefresh) {
      chrome.runtime.sendMessage({ cmd: 'refreshSheet', origin: ORIGIN, maxAgeMs: 60000 }).catch(() => {});
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let dirty = false;
    if (changes[M.KEYS.sites]) {
      const prev = site;
      site = M.siteSettings(changes[M.KEYS.sites].newValue, ORIGIN);
      if (!prev && site) { init(); return; }
      if (prev && !site) { // site removed: restore originals
        site = Object.assign({}, M.DEFAULT_SITE, { enabled: false });
        applyHlStyle();
        fullPass();
        site = null;
        observe(false);
        return;
      }
      dirty = site && ['enabled', 'variant', 'highlight'].some(k => prev[k] !== site[k]);
    }
    if (changes[K_TABLE]) {
      setTable(changes[K_TABLE].newValue || null);
      dirty = true;
    }
    if (dirty && ready && site) { applyHlStyle(); fullPass(); }
  });

  // detect in-app navigation (single-page apps)
  setInterval(() => {
    const k = M.pageKey(location.pathname);
    if (k !== page) {
      page = k;
      if (ready && site) fullPass();
    }
  }, 300);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.cmd === 'ping') { sendResponse({ ok: true, active: !!site, page }); return; }
    if (!ready || !site) { sendResponse({ ok: false }); return; }
    if (msg.cmd === 'stats') {
      const ctx = fullPass({ stats: { replaced: 0, empty: 0, unknown: 0 } });
      sendResponse({ ok: true, page, stats: ctx.stats });
    } else if (msg.cmd === 'collect') {
      const found = new Set();
      fullPass({
        collect: (type, text) => {
          if (M.isCollectable(text)) { found.add(M.key(type, M.norm(text))); record(type, text, true); }
        }
      });
      flushSeen().then(added => sendResponse({ ok: true, page, total: found.size, added }));
      return true;
    }
  });

  init().catch(err => { console.warn('[Microcopy Lab]', err); unhide(); });
})();
