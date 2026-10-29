/* Microcopy Lab – minimal XLSX reader/writer without external libraries (first sheet, values only) */
(function (root) {
  'use strict';
  const tr = k => (root.I18N ? root.I18N.t(k) : k);

  /* ---------- ZIP lesen ---------- */
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error(tr('errXlsxInvalid'));
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error(tr('errXlsxCorrupt'));
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      files[name] = { method, csize, localOff };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return {
      has: name => name in files,
      async text(name) {
        const f = files[name];
        if (!f) return null;
        const lo = f.localOff;
        const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
        const data = u8.subarray(start, start + f.csize);
        const raw = f.method === 0 ? data : f.method === 8 ? await inflateRaw(data) : null;
        if (!raw) throw new Error(tr('errXlsxCompression'));
        return dec.decode(raw);
      }
    };
  }

  function xml(str) {
    const doc = new DOMParser().parseFromString(str, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error(tr('errXlsxXml'));
    return doc;
  }
  const byTag = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));
  function textOf(node) { // alle <t> innerhalb (Rich Text), ohne phonetische Angaben
    return byTag(node, 't').filter(t => !t.parentNode || t.parentNode.localName !== 'rPh').map(t => t.textContent).join('');
  }
  function colIndex(ref) {
    const letters = (String(ref).match(/^[A-Z]+/i) || ['A'])[0].toUpperCase();
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  async function readXlsx(buf) {
    const zip = await readZip(buf);
    let sheetPath = 'xl/worksheets/sheet1.xml';
    const wbXml = await zip.text('xl/workbook.xml');
    const relXml = await zip.text('xl/_rels/workbook.xml.rels');
    if (wbXml && relXml) {
      const firstSheet = byTag(xml(wbXml), 'sheet')[0];
      if (firstSheet) {
        const rid = firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || firstSheet.getAttribute('r:id');
        const rel = byTag(xml(relXml), 'Relationship').find(r => r.getAttribute('Id') === rid);
        if (rel) {
          let t = rel.getAttribute('Target');
          sheetPath = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
        }
      }
    }
    const shared = [];
    const ssXml = await zip.text('xl/sharedStrings.xml');
    if (ssXml) for (const si of byTag(xml(ssXml), 'si')) shared.push(textOf(si));
    const sheetXml = await zip.text(sheetPath);
    if (!sheetXml) throw new Error(tr('errXlsxSheet'));
    const rows = [];
    for (const r of byTag(xml(sheetXml), 'row')) {
      const rIdx = r.getAttribute('r') ? parseInt(r.getAttribute('r'), 10) - 1 : rows.length;
      const row = [];
      let next = 0;
      for (const c of byTag(r, 'c')) {
        const ci = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : next;
        next = ci + 1;
        const t = c.getAttribute('t');
        const vEl = byTag(c, 'v')[0];
        const v = vEl ? vEl.textContent : '';
        let val;
        if (t === 's') val = shared[parseInt(v, 10)] || '';
        else if (t === 'inlineStr') val = textOf(c);
        else if (t === 'b') val = v === '1' ? 'WAHR' : 'FALSCH';
        else val = v;
        row[ci] = val;
      }
      rows[rIdx] = Array.from(row, x => (x == null ? '' : x));
    }
    return Array.from(rows, x => x || []);
  }

  /* ---------- XLSX schreiben (unkomprimiertes ZIP) ---------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zipStore(entries) {
    const enc = new TextEncoder();
    const locals = [], centrals = [];
    let offset = 0;
    for (const e of entries) {
      const name = enc.encode(e.name);
      const data = enc.encode(e.data);
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      locals.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      centrals.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = centrals.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  function colName(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  function writeXlsx(matrix, opts) {
    opts = opts || {};
    const widths = opts.widths || [];
    const sheetName = esc(opts.sheetName || 'Texts');
    const rowsXml = matrix.map((row, ri) => {
      const cells = row.map((v, ci) => {
        const s = ri === 0 ? ' s="1"' : '';
        return `<c r="${colName(ci)}${ri + 1}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(v == null ? '' : v)}</t></is></c>`;
      }).join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    }).join('');
    const ncols = Math.max(1, ...matrix.map(r => r.length));
    const cols = Array.from({ length: ncols }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${widths[i] || 28}" customWidth="1"/>`).join('');
    const lastRef = colName(ncols - 1) + Math.max(1, matrix.length);
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols><sheetData>${rowsXml}</sheetData><autoFilter ref="A1:${lastRef}"/></worksheet>`;
    return zipStore([
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${sheetName}'!$A$1:$${colName(ncols - 1)}$${Math.max(1, matrix.length)}</definedName></definedNames></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
      { name: 'xl/worksheets/sheet1.xml', data: sheet }
    ]);
  }

  root.XlsxMini = { readXlsx, writeXlsx };
})(typeof globalThis !== 'undefined' ? globalThis : self);
