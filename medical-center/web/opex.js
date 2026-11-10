/* ============ المصروفات التشغيلية: إدارة البيانات / السجل / الاعتماد والسداد / بنود الصرف / التقارير / الإعدادات / الدليل ============ */
'use strict';
const OPX_ST = {draft: 'مسودة', wait: 'بانتظار الاعتماد', ok: 'معتمد', no: 'مرفوض'};
const OPX_KIND = {
  resp: {t: 'المسؤولون', xl: 'الإدارة / الوظيفة', p: 'RSP-', i: '👤'},
  dept: {t: 'الإدارات', xl: 'ملاحظات', p: 'DPT-', i: '🏛️'},
  center: {t: 'مراكز التكلفة', xl: 'الإدارة', p: 'CC-', i: '🧮'},
  method: {t: 'طرق السداد', xl: 'ملاحظات', p: 'PM-', i: '💳'},
  item: {t: 'بنود الصرف', xl: 'التصنيف', p: 'BND-', i: '🏷️'}
};
const OPX_DEF = {
  dept: [['الإدارة المالية', ''], ['الإدارة الطبية', ''], ['الإدارة العامة', '']],
  center: [['مركز التكلفة الرئيسي', 'الإدارة المالية']],
  method: [['نقدي', ''], ['تحويل بنكي', ''], ['شيك', ''], ['محفظة إلكترونية', '']],
  item: [['مستلزمات مكتبية', 'مكتبية'], ['صيانة', 'تشغيلية'], ['خدمات', 'تشغيلية']]
};
const opset = k => S.data.opset.filter(x => x.kind === k && !(x.active === false || x.active === 'false' || x.active === '0'));
const opsetNames = k => opset(k).map(x => x.name);
const opxPays = r => { try { const a = JSON.parse(r.pays || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const opxPaid = r => opxPays(r).reduce((t, p) => t + (+p.amount || 0), 0);
const opxAppr = r => r.status === 'ok' ? (+r.amount || 0) : 0;
const opxRest = r => r.status === 'ok' ? Math.max(0, (+r.amount || 0) - opxPaid(r)) : 0;
const opxLate = r => r.status === 'ok' && r.dueDate && validDate(r.dueDate) && r.dueDate < today() && opxRest(r) > 0.005;
const opxStTag = r => `<span class="tag c-${{draft: 'blue', wait: 'cyan', ok: 'lime', no: 'red'}[r.status] || 'blue'}">${OPX_ST[r.status] || OPX_ST.wait}</span>`;
const opxPayTag = r => { if (r.status !== 'ok') return '<span class="muted">—</span>'; const p = opxPaid(r), rest = opxRest(r); return rest <= 0.005 ? '<span class="tag c-lime">مدفوع كلياً</span>' : (p > 0 ? '<span class="tag c-orange">مدفوع جزئياً</span>' : '<span class="tag c-red">غير مدفوع</span>') + (opxLate(r) ? ' <span class="tag c-pink">متأخر</span>' : ''); };
const opxCfg = (name, d) => { const x = S.data.opset.find(r => r.kind === 'cfg' && r.code === name); return x ? x.name : d; };
const opxPrefix = () => opxCfg('prefix', 'EX-');
const opxNext = () => { const p = opxPrefix(); let m = 0; S.data.opx.forEach(r => { const mt = String(r.no || '').match(/(\d+)$/); if (mt) m = Math.max(m, +mt[1]); }); return p + String(m + 1).padStart(4, '0'); };
const opxF = () => (S.opf = S.opf || {st: '', dept: '', item: '', pay: '', q: ''});
const opxList = () => {
  const {from, to} = getRange(), f = opxF(), q = f.q.trim().toLowerCase();
  return S.data.opx.filter(r => r.date >= from && r.date <= to && (!f.st || r.status === f.st) && (!f.dept || r.dept === f.dept) && (!f.item || r.item === f.item)
    && (!f.pay || (f.pay === 'late' ? opxLate(r) : f.pay === 'paid' ? r.status === 'ok' && opxRest(r) <= 0.005 : f.pay === 'part' ? r.status === 'ok' && opxPaid(r) > 0 && opxRest(r) > 0.005 : r.status === 'ok' && opxPaid(r) === 0))
    && (!q || JSON.stringify(r).toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date) || String(b.no).localeCompare(String(a.no)));
};
const opxTot = rs => ({appr: sum(rs, opxAppr), paid: sum(rs.filter(r => r.status === 'ok'), opxPaid), rest: sum(rs, opxRest), wait: rs.filter(r => r.status === 'wait').length, late: rs.filter(opxLate).length, total: sum(rs, r => +r.amount || 0)});
const opxRing = t => { const p = t.appr > 0 ? Math.round(t.paid / t.appr * 100) : 0; return `<div class="ringbox"><div class="ring" style="--p:${Math.min(100, p)}"><b>${p}%</b></div><div><b>نسبة السداد</b><br><small>${fmtN(t.paid)} من ${fmtN(t.appr)}</small></div></div>`; };
const opxKpis = (t, extra) => kpiRow([['المعتمد', fmtN(t.appr), 'orange'], ['المدفوع', fmtN(t.paid), 'lime'], ['المتبقي', fmtN(t.rest), 'red'], ['بانتظار الاعتماد', t.wait, 'cyan'], ['متأخرة في السداد', t.late, 'pink']].concat(extra || []));
const opxDeny = () => { $('#main').innerHTML = '<div class="panel">⛔ لا تملك صلاحية فتح هذه الشاشة</div>'; };

/* القوائم الافتراضية (تُنشأ مرة واحدة عند أول فتح) */
async function opxSeed() {
  if (S.opxSeeded || S.data.opset.length || !(S.user && (S.user.isAdmin || can('opx_set')))) return; S.opxSeeded = true;
  try {
    for (const k of Object.keys(OPX_DEF)) { let n = 0; for (const [name, extra] of OPX_DEF[k]) await API.call('save', {entity: 'opset', record: {kind: k, code: OPX_KIND[k].p + String(++n).padStart(3, '0'), name, extra, active: true}}); }
    await API.call('save', {entity: 'opset', record: {kind: 'cfg', code: 'prefix', name: 'EX-', extra: '', active: true}});
    await loadAll(['opset']);
  } catch (e) {}
}

/* ---------- إدارة البيانات (إدخال/تعديل المصروف) ---------- */
SCREEN_RENDER.opx_data = async function (a) { await opxSeed(); return _opxData(a); };
const _opxData = crud({k: 'opx_data', ent: 'opx', t: 'إدارة المصروفات التشغيلية', i: '💳', c: 'orange', add: 'مصروف جديد', dated: true,
  fields: [
    {k: 'no', l: 'رقم المصروف (تلقائي)', t: 'ro'}, {k: 'date', l: 'تاريخ المصروف', t: 'date', req: 1},
    {k: 'dept', l: 'الإدارة', t: 'sel', req: 1, opts: () => ['', ...opsetNames('dept')].map(x => ({v: x, l: x || '— اختر الإدارة —'}))},
    {k: 'item', l: 'بند الصرف', t: 'sel', req: 1, opts: () => ['', ...opsetNames('item')].map(x => ({v: x, l: x || '— اختر البند —'}))},
    {k: 'center', l: 'مركز التكلفة', t: 'sel', opts: () => ['', ...opsetNames('center')].map(x => ({v: x, l: x || '— اختر —'}))},
    {k: 'vendor', l: 'المورد / المستفيد'}, {k: 'invoiceNo', l: 'مرجع الفاتورة'}, {k: 'dueDate', l: 'تاريخ الاستحقاق', t: 'date'},
    {k: 'amount', l: 'المبلغ', t: 'num', req: 1}, {k: 'status', l: 'حالة الاعتماد', t: 'sel', opts: () => Object.keys(OPX_ST).map(k => ({v: k, l: OPX_ST[k]}))},
    {k: 'desc', l: 'البيان', t: 'area'}, {k: 'attach', l: 'المرفق (فاتورة / مستند)', t: 'img'},
    {k: '_h', t: 'html', html: () => '<input type="hidden" name="pays"><input type="hidden" name="approvedBy"><input type="hidden" name="approvedAt">'}],
  cols: [{h: 'رقم المصروف', f: r => `<b>${esc(r.no)}</b>`}, {h: 'التاريخ', f: r => esc(r.date)}, {h: 'البند', f: r => esc(r.item)}, {h: 'الإدارة', f: r => esc(r.dept)}, {h: 'المورد', f: r => esc(r.vendor)}, {h: 'المبلغ', f: r => fmtN(r.amount), sum: r => r.amount}, {h: 'الاعتماد', f: opxStTag}, {h: 'السداد', f: opxPayTag}, {h: 'المدفوع', f: r => fmtN(opxPaid(r)), sum: opxPaid}, {h: 'المتبقي', f: r => fmtN(opxRest(r)), sum: opxRest}, {h: 'المرفق', f: r => thumb(r.attach)}],
  sort: (a, b) => b.date.localeCompare(a.date) || String(b.no).localeCompare(String(a.no)),
  defaults: () => ({no: opxNext(), date: today(), status: 'wait'}),
  collect: raw => { const o = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_'))); o.no = raw.no || opxNext(); if (o.status === 'ok' && !o.approvedBy) { o.approvedBy = S.user.username; o.approvedAt = today(); } return o; },
  validate: (r, ed) => { const old = ed ? S.data.opx.find(x => x.id === ed) : null; if (old && +r.amount < opxPaid(old)) return 'المبلغ أقل من المدفوع فعلياً (' + fmtN(opxPaid(old)) + ')'; if (!(+r.amount > 0)) return 'اكتب مبلغاً صحيحاً'; return ''; }
});

/* ---------- عرض بطاقة المصروف + الاعتماد + السداد ---------- */
async function opxSave(r, patch) { await API.call('save', {entity: 'opx', record: Object.assign({}, r, patch)}); await loadAll(['opx']); S.view && S.view.refresh && await S.view.refresh(); }
Acts.opxview = el => {
  const r = S.data.opx.find(x => x.id === el.dataset.id); if (!r) return;
  const ps = opxPays(r), t = opxTot([r]);
  const m = modal(`<h3>🧾 مصروف ${esc(r.no)} — ${esc(r.item)} ${opxStTag(r)}</h3>
    ${kpiRow([['قيمة المصروف', fmtN(r.amount), 'orange'], ['المدفوع', fmtN(opxPaid(r)), 'lime'], ['المتبقي', fmtN(opxRest(r)), 'red']])}
    <table><tbody><tr><th>التاريخ</th><td>${esc(r.date)}</td><th>الاستحقاق</th><td>${esc(r.dueDate) || '—'}</td></tr><tr><th>الإدارة</th><td>${esc(r.dept)}</td><th>مركز التكلفة</th><td>${esc(r.center) || '—'}</td></tr><tr><th>المورد</th><td>${esc(r.vendor) || '—'}</td><th>مرجع الفاتورة</th><td>${esc(r.invoiceNo) || '—'}</td></tr><tr><th>البيان</th><td colspan="3">${esc(r.desc) || '—'}</td></tr><tr><th>السداد</th><td>${opxPayTag(r)}</td><th>الاعتماد</th><td>${r.approvedBy ? esc(r.approvedBy) + ' — ' + esc(r.approvedAt) : '—'}</td></tr></tbody></table>
    ${r.attach ? `<div class="imgfld" style="margin:8px 0">${thumb(r.attach)}</div>` : ''}
    <h4>جدول الدفعات</h4><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>بواسطة</th></tr></thead><tbody>${ps.map(p => `<tr><td>${esc(p.date)}</td><td>${fmtN(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.ref)}</td><td>${esc(p.by)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد دفعات</td></tr>'}</tbody></table>
    <h4>مسار الإجراء</h4><div class="steps3"><span class="on">① تسجيل المصروف<br><small>${esc(r.date)}</small></span><span class="${r.status === 'ok' ? 'on' : ''}">② اعتماد المصروف<br><small>${r.status === 'ok' ? esc(r.approvedAt) : OPX_ST[r.status] || ''}</small></span><span class="${ps.length ? 'on' : ''}">③ تسجيل السداد<br><small>${ps.length ? fmtN(opxPaid(r)) : '—'}</small></span></div>
    <div class="actions">${r.status === 'wait' && can('opx_apr') ? `<button class="btn c-lime" data-act="opxappr" data-v="ok" data-id="${r.id}">✅ اعتماد</button><button class="btn c-red" data-act="opxappr" data-v="no" data-id="${r.id}">❌ رفض</button>` : ''}${r.status === 'ok' && opxRest(r) > 0 && can('opx_apr') ? `<button class="btn c-orange" data-act="opxpay" data-id="${r.id}">💰 تسجيل سداد</button>` : ''}<button class="btn c-teal" data-act="opxprint" data-id="${r.id}">🖨️ طباعة البطاقة</button><button class="btn ghost" id="mc">إغلاق</button></div>`);
  $('#mc', m).onclick = () => m.remove(); hydrateImgs(m);
};
Acts.opxappr = el => guard(el, async () => {
  const r = S.data.opx.find(x => x.id === el.dataset.id); if (!r) return; const ok = el.dataset.v === 'ok';
  if (!ok && !await confirmBox('رفض هذا المصروف؟')) return;
  await opxSave(r, {status: ok ? 'ok' : 'no', approvedBy: S.user.username, approvedAt: today()}); document.querySelectorAll('.modal').forEach(x => x.remove()); toast(ok ? 'تم اعتماد المصروف ✔' : 'تم رفض المصروف');
});
Acts.opxpay = el => {
  const r = S.data.opx.find(x => x.id === el.dataset.id); if (!r) return; const rest = opxRest(r);
  document.querySelectorAll('.modal').forEach(x => x.remove());
  const m = modal(`<h3>💰 تسجيل سداد — ${esc(r.no)} (${esc(r.item)})</h3><p class="muted">المتبقي: <b>${fmtN(rest)}</b></p><div class="grid">${fieldHTML({k: 'pamt', l: 'المبلغ المسدد', t: 'num'}, rest)}${fieldHTML({k: 'pdate', l: 'تاريخ السداد', t: 'date'}, today())}${fieldHTML({k: 'pmeth', l: 'طريقة السداد', t: 'sel', opts: () => opsetNames('method').map(x => ({v: x, l: x}))}, '')}${fieldHTML({k: 'pref', l: 'مرجع السند / الإيصال'}, '')}</div><div class="actions"><button class="btn c-lime" id="pok">✅ تسجيل</button><button class="btn ghost" id="pcl">إلغاء</button></div>`);
  $('#pcl', m).onclick = () => m.remove();
  $('#pok', m).onclick = e => guard(e.target, async () => {
    const v = readForm(m), amt = +v.pamt || 0; if (amt <= 0) throw new Error('اكتب مبلغاً صحيحاً'); if (amt > rest + 0.005) throw new Error('المبلغ أكبر من المتبقي (' + fmtN(rest) + ')'); if (!validDate(v.pdate)) throw new Error('التاريخ yyyy/mm/dd');
    const ps = opxPays(r).concat([{id: Date.now().toString(36), date: v.pdate, amount: amt, method: v.pmeth || '', ref: v.pref || '', by: S.user.username}]);
    await opxSave(r, {pays: JSON.stringify(ps)}); m.remove(); toast('تم تسجيل السداد ✔');
  });
};
Acts.opxprint = el => {
  const r = S.data.opx.find(x => x.id === el.dataset.id); if (!r) return;
  printDoc('بطاقة مصروف ' + r.no, r.item, `<table><tbody><tr><th>الرقم</th><td>${esc(r.no)}</td><th>التاريخ</th><td>${esc(r.date)}</td></tr><tr><th>البند</th><td>${esc(r.item)}</td><th>الإدارة</th><td>${esc(r.dept)}</td></tr><tr><th>المورد</th><td>${esc(r.vendor)}</td><th>مرجع الفاتورة</th><td>${esc(r.invoiceNo)}</td></tr><tr><th>قيمة المصروف</th><td>${fmtN(r.amount)}</td><th>الاعتماد</th><td>${esc(OPX_ST[r.status])}</td></tr><tr><th>المدفوع</th><td>${fmtN(opxPaid(r))}</td><th>المتبقي</th><td>${fmtN(opxRest(r))}</td></tr><tr><th>البيان</th><td colspan="3">${esc(r.desc)}</td></tr></tbody></table><h4>الدفعات</h4><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th></tr></thead><tbody>${opxPays(r).map(p => `<tr><td>${esc(p.date)}</td><td>${fmtN(p.amount)}</td><td>${esc(p.method)}</td><td>${esc(p.ref)}</td></tr>`).join('')}</tbody></table>`, false);
};
document.addEventListener('change', e => { const k = e.target && e.target.dataset && e.target.dataset.opf; if (k) { opxF()[k] = e.target.value; S.view && S.view.refresh && S.view.refresh(); } });
Acts.opxclr = () => { S.opf = null; S.view && S.view.refresh(); };

/* ---------- سجل المصروفات ---------- */
SCREEN_RENDER.opx_reg = async function () {
  if (!can('opx_reg')) return opxDeny(); await opxSeed();
  const main = $('#main');
  const draw = () => {
    const rs = opxList(), t = opxTot(rs), f = opxF(), sel = (k, label, opts) => `<select data-opf="${k}" title="${label}"><option value="">${label}: الكل</option>${opts.map(o => `<option value="${esc(o.v)}" ${f[k] === o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
    main.innerHTML = `${pageHead('سجل المصروفات التشغيلية', '📒', 'orange')}${rangeBar()}${opxKpis(t)}<div class="panel">${opxRing(t)}</div>
    <div class="bar noprint">${sel('st', 'الاعتماد', Object.keys(OPX_ST).map(k => ({v: k, l: OPX_ST[k]})))}${sel('pay', 'السداد', [{v: 'unpaid', l: 'غير مدفوع'}, {v: 'part', l: 'مدفوع جزئياً'}, {v: 'paid', l: 'مدفوع كلياً'}, {v: 'late', l: 'متأخر'}])}${sel('dept', 'الإدارة', opsetNames('dept').map(x => ({v: x, l: x})))}${sel('item', 'البند', opsetNames('item').map(x => ({v: x, l: x})))}<input type="text" data-opf="q" placeholder="🔎 بحث برقم المصروف أو المورد…" value="${esc(f.q)}"><button class="btn sm ghost" data-act="opxclr">مسح الفلتر</button>${window.exportButtons}<button class="btn sm c-orange" data-act="go" data-s="opx_data">➕ مصروف جديد</button></div>
    ${tbl(['رقم المصروف', 'التاريخ', 'البند', 'الإدارة', 'المبلغ', 'الاعتماد', 'السداد', 'المدفوع', 'المتبقي', 'عرض'], rs.map(r => [`<b>${esc(r.no)}</b>`, esc(r.date), esc(r.item), esc(r.dept), fmtN(r.amount), opxStTag(r), opxPayTag(r), fmtN(opxPaid(r)), fmtN(opxRest(r)), `<button class="btn sm c-blue" data-act="opxview" data-id="${r.id}">👁</button>`]), ['الإجمالي (' + rs.length + ')', '', '', '', fmtN(t.total), '', '', fmtN(t.paid), fmtN(t.rest), ''])}`;
  };
  S.view = {refresh: draw, exportData: () => [{name: 'المصروفات التشغيلية', rows: [['الرقم', 'التاريخ', 'البند', 'الإدارة', 'المبلغ', 'الاعتماد', 'المدفوع', 'المتبقي'], ...opxList().map(r => [r.no, r.date, r.item, r.dept, +r.amount || 0, OPX_ST[r.status], opxPaid(r), opxRest(r)])]}]}; draw();
};

/* ---------- الاعتماد والسداد ---------- */
SCREEN_RENDER.opx_apr = async function () {
  if (!can('opx_apr')) return opxDeny(); await opxSeed();
  const main = $('#main');
  const draw = () => {
    const {from, to} = getRange(), all = S.data.opx.filter(r => r.date >= from && r.date <= to), t = opxTot(all), tab = S.opxTab || 'appr';
    const tabs = `<div class="seg"><button class="c-orange ${tab === 'appr' ? 'on' : ''}" data-act="opxtab2" data-v="appr">✅ الاعتمادات (${t.wait})</button><button class="c-lime ${tab === 'pay' ? 'on' : ''}" data-act="opxtab2" data-v="pay">💰 الدفعات</button></div>`;
    let body;
    if (tab === 'appr') {
      const w = all.filter(r => r.status === 'wait'), ok = all.filter(r => r.status === 'ok');
      body = sect('بانتظار الاعتماد') + tbl(['رقم المصروف', 'التاريخ', 'البند', 'الإدارة', 'المبلغ', 'إجراء'], w.map(r => [`<b>${esc(r.no)}</b>`, esc(r.date), esc(r.item), esc(r.dept), fmtN(r.amount), `<button class="btn sm c-lime" data-act="opxappr" data-v="ok" data-id="${r.id}">✅ اعتماد</button> <button class="btn sm c-red" data-act="opxappr" data-v="no" data-id="${r.id}">❌ رفض</button> <button class="btn sm c-blue" data-act="opxview" data-id="${r.id}">👁</button>`]))
        + sect('قائمة متابعة السداد') + tbl(['المصروف', 'المعتمد', 'المدفوع', 'المتبقي', 'الاستحقاق', 'حالة السداد', 'إجراء'], ok.map(r => [`<b>${esc(r.no)}</b> — ${esc(r.item)}`, fmtN(opxAppr(r)), fmtN(opxPaid(r)), fmtN(opxRest(r)), esc(r.dueDate), opxPayTag(r), (opxRest(r) > 0 ? `<button class="btn sm c-orange" data-act="opxpay" data-id="${r.id}">💰 سداد</button> ` : '') + `<button class="btn sm c-blue" data-act="opxview" data-id="${r.id}">👁</button>`]), ['الإجمالي', fmtN(t.appr), fmtN(t.paid), fmtN(t.rest), '', '', '']);
    } else {
      const ps = []; all.forEach(r => opxPays(r).forEach(p => ps.push({r, p}))); ps.sort((a, b) => b.p.date.localeCompare(a.p.date));
      body = tbl(['التاريخ', 'المصروف', 'البند', 'المبلغ', 'الطريقة', 'المرجع', 'بواسطة'], ps.map(({r, p}) => [esc(p.date), esc(r.no), esc(r.item), fmtN(p.amount), esc(p.method), esc(p.ref), esc(p.by)]), ['الإجمالي', '', '', fmtN(sum(ps, x => x.p.amount)), '', '', '']);
    }
    main.innerHTML = `${pageHead('الاعتماد والسداد', '✅', 'lime')}${rangeBar()}${opxKpis(t)}<div class="panel">${opxRing(t)}</div><div class="bar noprint">${tabs}</div>${body}<div class="panel accent c-cyan"><b>قاعدة العمل:</b> الاعتماد لا يعني السداد. لا يمكن تسجيل دفعة إلا بعد اعتماد المصروف، ولا يمكن أن تزيد الدفعات عن قيمته.</div>`;
  };
  S.view = {refresh: draw}; draw();
};
Acts.opxtab2 = el => { S.opxTab = el.dataset.v; S.view.refresh(); };

/* ---------- القوائم (بنود الصرف / الإدارات / مراكز التكلفة / طرق السداد / المسؤولون) ---------- */
function opSetEdit(kind, id, after) {
  const K = OPX_KIND[kind], r = id ? S.data.opset.find(x => x.id === id) : null;
  let code = r ? r.code : ''; if (!code) { let m = 0; S.data.opset.filter(x => x.kind === kind).forEach(x => { const mt = String(x.code || '').match(/(\d+)$/); if (mt) m = Math.max(m, +mt[1]); }); code = K.p + String(m + 1).padStart(3, '0'); }
  const m = modal(`<h3>${r ? '✏️ تعديل' : '➕ إضافة'} — ${esc(K.t)}</h3><div class="grid">${fieldHTML({k: 'code', l: 'الرمز'}, code)}${fieldHTML({k: 'name', l: 'الاسم', req: 1}, r ? r.name : '')}${fieldHTML({k: 'extra', l: K.xl}, r ? r.extra : '')}${fieldHTML({k: 'active', l: 'الحالة', t: 'chk', l2: 'نشط'}, r ? !(r.active === false || r.active === 'false' || r.active === '0') : true)}</div><div class="actions"><button class="btn c-lime" id="sok">💾 حفظ</button><button class="btn ghost" id="scl">إلغاء</button></div>`);
  $('#scl', m).onclick = () => m.remove();
  $('#sok', m).onclick = e => guard(e.target, async () => {
    const v = readForm(m); if (!String(v.name || '').trim()) throw new Error('الاسم مطلوب');
    await API.call('save', {entity: 'opset', record: Object.assign(r ? {id: r.id} : {}, {kind, code: v.code, name: String(v.name).trim(), extra: v.extra || '', active: !!v.active})});
    await loadAll(['opset']); m.remove(); toast('تم الحفظ ✔'); after && after();
  });
}
function opSetMgr(kind) {
  const K = OPX_KIND[kind], rows = () => S.data.opset.filter(x => x.kind === kind);
  const m = modal(`<h3>${K.i} إدارة ${esc(K.t)}</h3><div id="sml"></div><div class="actions"><button class="btn c-orange" id="sad">➕ إضافة</button><button class="btn ghost" id="scl">إغلاق</button></div>`);
  const draw = () => { $('#sml', m).innerHTML = `<table><thead><tr><th>الرمز</th><th>الاسم</th><th>${esc(K.xl)}</th><th>الحالة</th><th></th></tr></thead><tbody>${rows().map(r => `<tr><td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.extra)}</td><td>${r.active === false || r.active === 'false' || r.active === '0' ? '<span class="tag c-red">موقوف</span>' : '<span class="tag c-lime">نشط</span>'}</td><td><button class="btn sm c-blue" data-e="${r.id}">✏️</button> <button class="btn sm c-red" data-d="${r.id}">🗑️</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد بيانات</td></tr>'}</tbody></table>`; };
  draw();
  m.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.e) opSetEdit(kind, b.dataset.e, () => { draw(); S.view && S.view.refresh && S.view.refresh(); });
    if (b.dataset.d && await confirmBox('حذف هذا العنصر؟')) await guard(null, async () => { await API.call('delete', {entity: 'opset', id: b.dataset.d}); await loadAll(['opset']); draw(); S.view && S.view.refresh && S.view.refresh(); });
  });
  $('#scl', m).onclick = () => m.remove(); $('#sad', m).onclick = () => opSetEdit(kind, null, () => { draw(); S.view && S.view.refresh && S.view.refresh(); });
}
Acts.opsetmgr = el => opSetMgr(el.dataset.v);
Acts.opsetadd = el => opSetEdit(el.dataset.v, null, () => S.view && S.view.refresh && S.view.refresh());
Acts.opsetedit = el => opSetEdit(el.dataset.v, el.dataset.id, () => S.view && S.view.refresh && S.view.refresh());
Acts.opsetdel = async el => { if (!await confirmBox('حذف هذا العنصر؟')) return; await guard(null, async () => { await API.call('delete', {entity: 'opset', id: el.dataset.id}); await loadAll(['opset']); S.view.refresh(); }); };
Acts.opxitemrep = el => { S.opf = {st: '', dept: '', item: el.dataset.v, pay: '', q: ''}; S.rng.mode = 'all'; nav('opx_reg'); };

SCREEN_RENDER.opx_items = async function () {
  if (!can('opx_items')) return opxDeny(); await opxSeed();
  const main = $('#main');
  const draw = () => {
    const items = S.data.opset.filter(x => x.kind === 'item');
    main.innerHTML = `${pageHead('بنود الصرف', '🏷️', 'blue')}<div class="bar noprint"><button class="btn c-orange" data-act="opsetadd" data-v="item">➕ إضافة بند</button></div>
    ${tbl(['رمز البند', 'اسم البند', 'التصنيف', 'الحالة', 'المعتمد', 'المدفوع', 'المتبقي', 'إجراء'], items.map(x => { const t = opxTot(S.data.opx.filter(r => r.item === x.name)); return [esc(x.code), `<b>${esc(x.name)}</b>`, esc(x.extra), x.active === false || x.active === 'false' || x.active === '0' ? '<span class="tag c-red">موقوف</span>' : '<span class="tag c-lime">نشط</span>', fmtN(t.appr), fmtN(t.paid), fmtN(t.rest), `<button class="btn sm c-teal" data-act="opxitemrep" data-v="${esc(x.name)}" title="عرض مصروفات البند">📄</button> <button class="btn sm c-blue" data-act="opsetedit" data-v="item" data-id="${x.id}">✏️</button> <button class="btn sm c-red" data-act="opsetdel" data-id="${x.id}">🗑️</button>`]; }))}
    <div class="panel accent c-cyan">إيقاف البند يمنع استخدامه في المصروفات الجديدة ويحافظ على السجلات السابقة. جميع التعديلات تُحفظ في Google Sheets.</div>`;
  };
  S.view = {refresh: draw}; draw();
};

/* ---------- الإعدادات ---------- */
SCREEN_RENDER.opx_set = async function () {
  if (!can('opx_set')) return opxDeny(); await opxSeed();
  const main = $('#main');
  const draw = () => {
    const card = k => { const K = OPX_KIND[k], a = S.data.opset.filter(x => x.kind === k); return `<div class="panel accent c-${{resp: 'teal', dept: 'violet', center: 'blue', method: 'orange'}[k]}"><h3>${K.i} ${esc(K.t)} <span class="tag c-blue">${a.length}</span></h3><div class="chips">${a.slice(0, 6).map(x => `<span class="chip">${esc(x.name)}</span>`).join('') || '<span class="muted">لا توجد بيانات</span>'}</div><div class="actions"><button class="btn sm c-orange" data-act="opsetmgr" data-v="${k}">⚙️ إدارة ${esc(K.t)}</button></div></div>`; };
    main.innerHTML = `${pageHead('إعدادات المصروفات التشغيلية', '⚙️', 'violet')}<div class="grid2">${card('resp')}${card('dept')}${card('center')}${card('method')}
    <div class="panel accent c-gold"><h3>🔧 إعدادات النظام</h3><div class="grid">${fieldHTML({k: 'pfx', l: 'بادئة رقم المصروف'}, opxPrefix())}<div class="fld"><label>الرقم التالي</label><input type="text" readonly value="${esc(opxNext())}"></div></div><div class="actions"><button class="btn sm c-lime" data-act="opxpfx">💾 حفظ البادئة</button></div><small class="muted">لا يُعتمد المصروف تلقائياً؛ يلزم اعتماد قبل تسجيل أي سداد.</small></div></div>`;
  };
  S.view = {refresh: draw}; draw();
};
Acts.opxpfx = el => guard(el, async () => {
  const v = (($('[name=pfx]') || {}).value || '').trim() || 'EX-', old = S.data.opset.find(r => r.kind === 'cfg' && r.code === 'prefix');
  await API.call('save', {entity: 'opset', record: Object.assign(old ? {id: old.id} : {}, {kind: 'cfg', code: 'prefix', name: v, extra: '', active: true})}); await loadAll(['opset']); toast('تم الحفظ ✔'); S.view.refresh();
});

/* ---------- التقارير ---------- */
SCREEN_RENDER.opx_rep = repScreen('opx_rep', 'تقارير المصروفات التشغيلية', '📊', 'orange', () => {
  const {from, to} = getRange(), all = S.data.opx.filter(r => r.date >= from && r.date <= to), tab = S.opxRep || 'item', t = opxTot(all);
  const tabs = `<div class="seg noprint">${[['item', 'حسب البند', 'orange'], ['dept', 'حسب الإدارة', 'blue'], ['unpaid', 'غير المدفوع', 'red'], ['wait', 'بانتظار الاعتماد', 'cyan']].map(([k, l, c]) => `<button class="c-${c} ${tab === k ? 'on' : ''}" data-act="opxrtab" data-v="${k}">${l}</button>`).join('')}</div>`;
  const grp = key => { const g = [...groupBy(all.filter(r => r.status === 'ok'), r => r[key] || '—')].sort((a, b) => a[0].localeCompare(b[0], 'ar')); const tt = opxTot(all.filter(r => r.status === 'ok')); return tbl([key === 'item' ? 'البند' : 'الإدارة', 'المعتمد', 'المدفوع', 'المتبقي'], g.map(([n, a]) => { const x = opxTot(a); return [esc(n), fmtN(x.appr), fmtN(x.paid), fmtN(x.rest)]; }), ['الإجمالي', fmtN(tt.appr), fmtN(tt.paid), fmtN(tt.rest)]); };
  let body;
  if (tab === 'item' || tab === 'dept') body = sect(tab === 'item' ? 'تقرير المصروفات حسب البند' : 'تقرير المصروفات حسب الإدارة') + grp(tab);
  else if (tab === 'unpaid') { const u = all.filter(r => r.status === 'ok' && opxRest(r) > 0.005); body = sect('المعتمد غير المدفوع / المدفوع جزئياً') + tbl(['المصروف', 'البند', 'الاستحقاق', 'المعتمد', 'المدفوع', 'المتبقي', 'الحالة'], u.map(r => [esc(r.no), esc(r.item), esc(r.dueDate), fmtN(opxAppr(r)), fmtN(opxPaid(r)), fmtN(opxRest(r)), opxPayTag(r)]), ['الإجمالي', '', '', fmtN(sum(u, opxAppr)), fmtN(sum(u, opxPaid)), fmtN(sum(u, opxRest)), '']); }
  else { const w = all.filter(r => r.status === 'wait'); body = sect('بانتظار الاعتماد') + tbl(['المصروف', 'التاريخ', 'البند', 'الإدارة', 'المبلغ'], w.map(r => [esc(r.no), esc(r.date), esc(r.item), esc(r.dept), fmtN(r.amount)]), ['الإجمالي', '', '', '', fmtN(sum(w, r => +r.amount || 0))]); }
  return opxKpis(t) + `<div class="panel">${opxRing(t)}<small class="muted">نطاق التقرير: المصروفات المعتمدة فقط في الجداول الأولى.</small></div>` + tabs + body;
});
Acts.opxrtab = el => { S.opxRep = el.dataset.v; S.view.refresh(); };

/* ---------- دليل الاستخدام + هيكل العمل ---------- */
SCREEN_RENDER.guide = () => {
  const st = [['1', 'تهيئة القوائم', 'من الإعدادات أضف الإدارات ومراكز التكلفة وطرق السداد والمسؤولين، ومن بنود الصرف أضف البنود.', 'opx_set', '⚙️ إعدادات المصروفات', 'violet'],
    ['2', 'تسجيل المصروف', 'من إدارة المصروفات اختر الإدارة والبند وأدخل المبلغ والمورد وأرفق الفاتورة ثم احفظ.', 'opx_data', '💳 مصروف جديد', 'orange'],
    ['3', 'مراجعة المستندات', 'راجع الفاتورة والمرفقات في سجل المصروفات قبل الاعتماد.', 'opx_reg', '📒 سجل المصروفات', 'gold'],
    ['4', 'توثيق الاعتماد', 'من الاعتماد والسداد اعتمد المصروف أو ارفضه — يُسجَّل المعتمِد والتاريخ.', 'opx_apr', '✅ الاعتماد والسداد', 'lime'],
    ['5', 'تسجيل الدفعات', 'سجّل الدفعات الفعلية (كلية أو جزئية) بطريقة السداد ومرجع السند.', 'opx_apr', '💰 تسجيل الدفعات', 'teal'],
    ['6', 'متابعة التقارير', 'استخدم التقارير حسب البند والإدارة وغير المدفوع وبانتظار الاعتماد.', 'opx_rep', '📊 التقارير', 'pink']];
  $('#main').innerHTML = `${pageHead('دليل الاستخدام وهيكل العمل', '📖', 'blue')}<div class="panel accent c-orange"><b>هيكل العمل:</b> الإدارة ← مركز التكلفة ← بند الصرف ← المصروف ← الاعتماد ← السداد ← التقارير</div>
  <div class="grid3">${st.map(s => `<div class="panel accent c-${s[5]}"><h3><span class="num">${s[0]}</span> ${s[1]}</h3><p>${s[2]}</p>${can(s[3]) || s[3] === 'opx_rep' && can('opx_rep') ? `<button class="btn sm c-${s[5]}" data-act="go" data-s="${s[3]}">${s[4]}</button>` : ''}</div>`).join('')}</div>
  <div class="panel accent c-cyan"><b>قاعدة العمل:</b> الاعتماد لا يعني السداد. كل عملية منفصلة، وكل إضافة أو تعديل أو حذف يُحفظ فوراً في Google Sheets ويظهر لكل المستخدمين.</div>
  <div class="sect"><h2>الوحدات الأخرى للبرنامج</h2></div><div class="grid2"><div class="panel"><b>🩺 الزيارات والعمليات:</b> كل عملية جراحية تُسجَّل كزيارة (مسلسل وباركود وإيصال)، وتظهر في تقارير العيادات والأطباء.</div><div class="panel"><b>🏦 التقارير المالية:</b> حركة الخزينة، حسابات الأطباء، الإجماليات بالتفصيل، تقرير اللجنة وتحليل الإيرادات.</div></div>`;
};
Acts.go = Acts.go || (el => nav(el.dataset.s));
