/* ============ التصدير: Excel (xlsx حقيقي بدون مكتبات) و PDF (عبر نافذة الطباعة: حفظ كـ PDF) ============ */
'use strict';
(function () {
  const enc = new TextEncoder();
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) { // تخزين بدون ضغط
    const parts = [], cen = []; let off = 0;
    for (const [name, text] of files) {
      const nb = enc.encode(name), d = enc.encode(text), c = crc32(d);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint32(14, c, true); lh.setUint32(18, d.length, true); lh.setUint32(22, d.length, true); lh.setUint16(26, nb.length, true);
      parts.push(new Uint8Array(lh.buffer), nb, d);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint32(16, c, true); ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      cen.push(new Uint8Array(ch.buffer), nb); off += 30 + nb.length + d.length;
    }
    const csz = cen.reduce((s, x) => s + x.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cen, new Uint8Array(end.buffer)], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  const xe = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const toNum = t => { if (typeof t === 'number') return t; if (!/^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(t)) return null; if (!/[.,]/.test(t) && (t[0] === '0' && t.length > 1 || t.length > 9)) return null; return parseFloat(t.replace(/,/g, '')); };

  function sheetXML(rows, headRows) {
    const widths = []; rows.forEach(r => r.forEach((c, i) => { widths[i] = Math.min(45, Math.max(widths[i] || 8, String(c).length * 1.5 + 3)); }));
    let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="${headRows}" topLeftCell="A${headRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>`;
    rows.forEach((r, ri) => {
      x += `<row r="${ri + 1}">`;
      r.forEach((c, ci) => {
        const ref = colName(ci) + (ri + 1), head = ri < headRows, n = head ? null : toNum(c);
        if (n !== null) x += `<c r="${ref}" s="2"><v>${n}</v></c>`; else x += `<c r="${ref}" s="${head ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${xe(c)}</t></is></c>`;
      });
      x += '</row>';
    });
    return x + '</sheetData></worksheet>';
  }
  function xlsx(sheets) { // sheets: [{name, rows:[[...]], headRows}]
    const used = new Set(), names = sheets.map((s, i) => { let n = String(s.name || 'ورقة' + (i + 1)).replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 28) || 'ورقة' + (i + 1); let m = n, k = 2; while (used.has(m)) m = n.slice(0, 25) + ' ' + k++; used.add(m); return m; });
    const files = [
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xe(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="12"/><name val="Times New Roman"/></font><font><b/><sz val="12"/><name val="Times New Roman"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFBFEFE8"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf></cellXfs></styleSheet>`]
    ];
    sheets.forEach((s, i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXML(s.rows, s.headRows || 1)]));
    return zip(files);
  }

  /* ---------- قراءة الجداول الظاهرة على الشاشة ---------- */
  function domSheets(root, title) {
    const out = [];
    $$('table', root).forEach((t, i) => {
      const heads = $$('thead th', t).map(th => th.textContent.replace(/\s+/g, ' ').trim()), keep = heads.map(h => h !== '');
      const pick = cells => cells.filter((_, j) => keep[j]);
      const rows = [pick(heads)];
      $$('tbody tr', t).forEach(tr => { const tds = $$('td', tr); if (tds.length === 1 && tds[0].classList.contains('empty')) return; rows.push(pick(tds.map(td => { const tx = td.textContent.replace(/\s+/g, ' ').trim(); return !tx && td.querySelector('img,[data-fid]') ? 'مرفق' : tx; }))); });
      $$('tfoot tr', t).forEach(tr => rows.push(pick($$('td', tr).map(td => td.textContent.replace(/\s+/g, ' ').trim()))));
      if (rows.length < 2 && !$('tfoot', t)) return;
      let nm = title, p = t.closest('.tbl-wrap') || t, prev = p.previousElementSibling;
      while (prev && !prev.classList.contains('sect')) prev = prev.previousElementSibling;
      if (prev) nm = prev.textContent.trim(); else if (i > 0) nm = title + ' ' + (i + 1);
      out.push({name: nm, rows});
    });
    return out;
  }
  const pageTitle = () => (($('#main h1') || {}).textContent || 'تقرير').replace(/\s+/g, ' ').trim();
  const stamp = () => today().replace(/\//g, '-');

  function saveBlob(blob, name) {
    if (window.AndroidBridge && window.AndroidBridge.saveFile) {
      const fr = new FileReader(); fr.onload = () => window.AndroidBridge.saveFile(name, blob.type, String(fr.result).split(',')[1]); fr.readAsDataURL(blob); return;
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  window.saveBlob = saveBlob;
  Acts.xlsx = () => {
    const title = pageTitle().replace(/^[^؀-ۿA-Za-z0-9]+/, '');
    let sheets = S.view && S.view.exportData ? S.view.exportData() : domSheets($('#main'), title.slice(0, 24));
    if (!sheets.length) return toast('لا توجد بيانات للتصدير', true);
    const meta = [[CENTER], ...(CPHONE ? [['هاتف: ' + CPHONE]] : []), [title], [S.view && S.view.noRange ? '' : rangeLabel()], ['تاريخ التصدير: ' + today() + ' — ' + (S.user ? S.user.username : '')], []];
    sheets = sheets.map(s => ({name: s.name, rows: [...meta.map(r => r.slice()), ...s.rows], headRows: meta.length + 1}));
    saveBlob(xlsx(sheets), `${title.replace(/[\\/:*?"<>|]/g, ' ').trim()}-${stamp()}.xlsx`); toast('تم تجهيز ملف Excel');
  };
  /* ---- الطباعة: بنود وتقارير فقط على A4 (ليست صفحات البرنامج) ---- */
  const PRINT_CSS = (land) => `@page{size:A4 ${land ? 'landscape' : 'portrait'};margin:10mm}*{box-sizing:border-box;font-family:"Times New Roman",Times,serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;background:#fff;direction:rtl;font-size:12px}.hd{text-align:center;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:8px}.hd h2{margin:0;font-size:18px}.hd h3{margin:2px 0;font-size:14px}.hd div{font-size:11px}
table{width:100%;border-collapse:collapse;margin:6px 0;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #000;padding:3px 5px;text-align:center;font-size:11px;vertical-align:middle}th{background:#e9e9e9}tfoot td{font-weight:bold;background:#f3f3f3}
.sect h2,h2.s{font-size:14px;margin:10px 0 2px;border-right:4px solid #000;padding-right:6px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:6px 0}.kpi{border:1px solid #000;padding:4px;text-align:center;border-radius:4px}.kpi *{font-size:11px}
img{max-height:28px}svg{max-width:100%;height:auto}.slip td:first-child{width:32%;font-weight:bold;background:#f3f3f3}.slip td{text-align:right;font-size:13px;padding:5px 8px}.sign{display:flex;justify-content:space-between;margin-top:34px;font-size:12px}`;
  function printDoc(title, sub, bodyHTML, land) {
    const doc = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS(land)}</style></head><body><div class="hd"><h2>${esc(CENTER)}</h2>${CPHONE ? `<div>☎ ${esc(CPHONE)}</div>` : ''}<h3>${esc(title)}</h3><div>${esc(sub)}</div></div>${bodyHTML}</body></html>`;
    if (window.AndroidBridge) { // الأندرويد يطبع الـ WebView: نستبدل المحتوى مؤقتاً
      const root = $('#app'), keep = root.innerHTML, st = document.createElement('style'); st.textContent = PRINT_CSS(land).replace(/\*\{[^}]*\}/, ''); document.head.appendChild(st);
      root.innerHTML = `<div class="hd"><h2>${esc(CENTER)}</h2>${CPHONE ? `<div>☎ ${esc(CPHONE)}</div>` : ''}<h3>${esc(title)}</h3><div>${esc(sub)}</div></div>${bodyHTML}`;
      let done = false; const back = () => { if (done) return; done = true; st.remove(); root.innerHTML = keep; render(); };
      window.AndroidBridge.print(); setTimeout(back, 4000); return;
    }
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(fr);
    const d = fr.contentDocument; d.open(); d.write(doc); d.close();
    const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast('تعذرت الطباعة', true); } setTimeout(() => fr.remove(), 60000); };
    setTimeout(go, 350);
  }
  function cleanContent() {
    const m = $('#main').cloneNode(true);
    m.querySelectorAll('.pagehead,form,.bar,.noprint,.cards,.modal,input,select,textarea,script,.imgfld,[data-rangebar]').forEach(n => n.remove());
    m.querySelectorAll('.printhead').forEach(n => n.remove());
    m.querySelectorAll('button').forEach(bt => { if (bt.classList.contains('btn') || bt.dataset.act === 'kpi') bt.remove(); else bt.replaceWith(document.createTextNode(bt.textContent)); });
    m.querySelectorAll('table').forEach(t => { // حذف عمود الأزرار (رأس فارغ)
      const ths = [...t.querySelectorAll('thead th')]; ths.forEach((th, i) => { if (!th.textContent.trim()) { t.querySelectorAll('tr').forEach(r => { const c = r.children[i]; if (c && (c.tagName === 'TH' || !c.textContent.trim() || r.closest('tfoot'))) c.remove(); }); } });
    });
    m.querySelectorAll('.tbl-wrap').forEach(w => { w.style.overflow = 'visible'; });
    const land = [...m.querySelectorAll('table')].some(t => (t.querySelector('tr') || {children: []}).children.length > 7);
    return {html: m.innerHTML, land};
  }
  Acts.pdf = () => {
    const {html, land} = cleanContent(), title = pageTitle().replace(/^[^؀-ۿA-Za-z0-9]+/, '');
    printDoc(title, `${S.view && S.view.noRange ? '' : rangeLabel()} — طُبع في ${today()} بواسطة ${S.user ? S.user.username : ''}`, html, land);
  };
  /* طباعة بند واحد (إيصال/بطاقة) من أي شاشة إدخال */
  Acts.prow = el => {
    const cfg = (window.CRUDS || {})[el.dataset.e], r = cfg && S.data[cfg.ent].find(x => x.id === el.dataset.id); if (!r) return;
    const rows = cfg.fields.filter(f => f.l && !['html', 'img'].includes(f.t) && !f.k.startsWith('_') || f.k === '_doc').map(f => {
      let v = f.k === '_doc' ? r.doctor : r[f.k]; if (v == null || v === '') return ''; if (f.t === 'chk') v = v ? 'نعم' : 'لا'; if (f.t === 'seg') { const o = f.opts.find(x => x.v === v); v = o ? o.l : v; }
      return `<tr><td>${esc(f.l)}</td><td>${esc(v)}</td></tr>`;
    }).join('');
    const extra = r.registeredBy ? `<tr><td>سجّله</td><td>${esc(r.registeredBy)}</td></tr>` : '';
    printDoc(cfg.t.replace(/\s*\(.*\)/, '') + (r.serial ? ` — رقم ${r.serial}` : ''), `طُبع في ${today()} بواسطة ${S.user ? S.user.username : ''}`, `<table class="slip"><tbody>${rows}${extra}</tbody></table><div class="sign"><span>توقيع المسؤول: ........................</span><span>توقيع المستلم: ........................</span></div>`, false);
  };
  Acts.print = Acts.pdf;
  window.exportButtons = '<button class="btn sm c-lime" data-act="xlsx">📗 Excel</button><button class="btn sm c-red" data-act="pdf">📄 PDF</button><button class="btn sm c-gold" data-act="pdf" title="الطباعة أو الحفظ كـ PDF">🖨️ طباعة</button>';
})();
