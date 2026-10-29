/* ============ التقارير: كل تقرير يعمل لليوم أو تاريخ محدد أو فترة، والأسماء روابط لتقارير تفصيلية ============ */
'use strict';
const tbl = (heads, rows, foot) => `<div class="tbl-wrap"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${heads.length}" class="empty">لا توجد بيانات في هذه الفترة</td></tr>`}</tbody>${foot ? `<tfoot><tr>${foot.map(c => `<td>${c}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
const kpiRow = items => `<div class="kpis">${items.map((k, i) => `<div class="glow kpi c-${k[2] || ALL_COLORS[i % 9]}" data-act="kpi" data-l="${esc(k[0])}" data-v="${esc(k[1])}"><small>${k[0]}</small><strong>${k[1]}</strong></div>`).join('')}</div>`;
/* حسب العيادة: سطر لكل (عيادة، طبيب) — الزيارات، كشف، متنوع، الإيرادات، الضريبة */
function clinicDocRows(arr) {
  const g = new Map(); arr.forEach(v => { const k = (v.clinic || '—') + '\u0001' + (v.doctor || '—'); (g.get(k) || g.set(k, []).get(k)).push(v); });
  const rows = [...g.entries()].map(([k, a]) => { const [c, d] = k.split('\u0001'); return {c, d, n: a.length, kosf: sum(a.filter(v => v.visitType !== 'متنوع'), val), mixed: sum(a.filter(v => v.visitType === 'متنوع'), val), rev: sum(a, val), tax: sum(a, v => v.tax)}; }).sort((x, y) => x.c.localeCompare(y.c, 'ar') || x.d.localeCompare(y.d, 'ar'));
  const T = k => sum(rows, r => r[k]);
  return tbl(['العيادة', 'الطبيب', 'عدد الزيارات', 'كشف', 'متنوع', 'الإيرادات', 'الضريبة'], rows.map(r => [L.clinic(r.c), r.d === '—' ? '—' : L.doctor(r.d), r.n, fmtN(r.kosf), fmtN(r.mixed), fmtN(r.rev), fmtN(r.tax)]), ['الإجمالي', '', T('n'), fmtN(T('kosf')), fmtN(T('mixed')), fmtN(T('rev')), fmtN(T('tax'))]);
}
const byClinicDoc = arr => '<h4>حسب العيادة</h4>' + clinicDocRows(arr);
const sect = t => `<div class="sect"><h2>${t}</h2></div>`;
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);
function groupBy(arr, kf) { const m = new Map(); arr.forEach(x => { const k = kf(x) || '—'; (m.get(k) || m.set(k, []).get(k)).push(x); }); return m; }
const val = v => +v.value || 0;
const expIn = (f, t) => S.data.expenses.filter(x => x.date >= f && x.date <= t);
const opsIn = (f, t) => S.data.operations.filter(x => x.date >= f && x.date <= t);
const opShare = o => opCalc(o).surgeon;
const visitRows = vs => vs.slice().sort((a, b) => (a.date + (a.serial || 0)).localeCompare(b.date + (b.serial || 0))).map(v => [v.serial, esc(v.date), L.patient(v.patient), L.clinic(v.clinic), L.doctor(v.doctor), esc(v.visitType), esc(v.service), fmtN(v.value), tagCat(v.category), L.company(v.company)]);
const visitHeads = ['م', 'التاريخ', 'المريض', 'العيادة', 'الطبيب', 'الزيارة', 'البيان', 'القيمة', 'النوع', 'الشركة'];
const visitFoot = vs => ['', '', '', '', '', '', `الإجمالي (${vs.length})`, fmtN(sum(vs, val)), '', ''];

function repScreen(key, title, icon, color, build, picker) {
  return async function (arg) {
    if (!can(key)) { $('#main').innerHTML = '<div class="panel">⛔ لا تملك صلاحية هذا التقرير</div>'; return; }
    const main = $('#main'); let cur = arg || '';
    const scopeKey = {rep_doctors: 'doctor', rep_clinics: 'clinic', rep_companies: 'company', rep_patients: 'patient'}[key];
    const draw = () => {
      S.scope = scopeKey && cur ? {[scopeKey]: cur} : {};
      main.innerHTML = `${pageHead(title + (cur ? ' — ' + cur : ''), icon, color)}${rangeBar()}<div class="bar noprint">${picker ? `<input type="text" id="pk" data-sg="${picker.sg}" placeholder="${esc(picker.ph)}" value="${esc(cur)}" autocomplete="off"><button class="btn c-${color}" data-act="pkgo">عرض</button>${cur ? '<button class="btn ghost" data-act="pkclear">عرض الكل</button>' : ''}` : ''}${window.exportButtons}</div><div id="rb">${build(cur)}</div>`;
      const pk = $('#pk'); if (pk) pk.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); Acts.pkgo(); } };
      hydrateImgs(main);
    };
    S.view = {refresh: draw, pick: v => { cur = v; draw(); }}; draw();
  };
}
Acts.pkgo = () => S.view && S.view.pick(($('#pk') || {}).value.trim());
Acts.pkclear = () => S.view && S.view.pick('');
Acts.lnk2 = el => Acts.lnk(el);

/* ---------- ملخص اليوم والإيرادات ---------- */
function bodyDaily() {
  const {from, to} = getRange(), vs = visitsIn(from, to), ex = expIn(from, to), acc = accounts(from, to);
  const rev = sum(vs, val) + opsRevenue(from, to), tax = sum(vs, v => v.tax), exp = sum(ex, x => x.amount), dues = sum(acc, r => r.right + r.ops), dayRev = rev, st = statementRows(from, to);
  const shares = sum(vs, patientShare), cash = sum(vs.filter(v => (v.category || 'cash') === 'cash'), val) + shares;
  const recv = sum(vs.filter(v => v.category === 'company'), coDue) + sum(vs.filter(v => v.category === 'insurance'), v => val(v) - discountAmt(v)) + sum(vs.filter(v => v.category === 'committee'), val);
  const byType = VTYPES.map(t => [t, vs.filter(v => v.visitType === t)]);
  const byCat = Object.keys(CAT).map(k => [k, vs.filter(v => (v.category || 'cash') === k)]);
  const byClinic = [...groupBy(vs, v => v.clinic)].sort((a, b) => sum(b[1], val) - sum(a[1], val));
  const days = [...new Set([...vs.map(v => v.date), ...ex.map(x => x.date)])].sort();
  return kpiRow([['عدد الزيارات', vs.length, 'teal'], ['إيراد الكشف', fmtN(st.kosf), 'blue'], ['إيراد متنوع', fmtN(st.mixed), 'cyan'], ['إيراد العمليات', fmtN(st.opsRev), 'red'], ['إجمالي إيراد اليوم', fmtN(st.dayRev), 'orange'], ['مستحق على الجهات', fmtN(recv), 'cyan'], ['حقوق الأطباء (المستحق)', fmtN(st.due), 'violet'], ['مدفوع للأطباء', fmtN(st.paid), 'lime'], ['المصروفات', fmtN(st.expO), 'gold'], ['الصافي', fmtN(st.net), 'teal'], ['الضريبة', fmtN(tax), 'pink']])
    + `<div class="charts"><div class="panel"><h3>حسب نوع الزيارة</h3>${donut(byCat.map(([k, a]) => ({l: CAT[k], v: sum(a, val), c: CATC[k]})))}</div><div class="panel"><h3>حسب العيادة</h3>${bars(byClinic.slice(0, 10).map(([n, a]) => ({l: n, v: sum(a, val)})), 'clinicrep')}</div></div>`
    + sect('ملخص الزيارات') + tbl(['الزيارة', 'العدد', 'القيمة'], byType.map(([t, a]) => [esc(t), a.length, fmtN(sum(a, val))]), ['الإجمالي', vs.length, fmtN(rev)])
    + sect('حسب نوع الزيارة (نقدي / شركة / لجنة / تأمين)') + tbl(['النوع', 'العدد', 'القيمة', 'تحمل المريض', 'الخصم'], byCat.map(([k, a]) => [tagCat(k), a.length, fmtN(sum(a, val)), fmtN(sum(a, patientShare)), fmtN(sum(a, discountAmt))]))
    + sect('حسب العيادة') + clinicDocRows(vs)
    + (from !== to ? sect('يوماً بيوم') + tbl(['التاريخ', 'الزيارات', 'الإيراد', 'الضريبة', 'المصروفات'], days.map(d => { const a = vs.filter(v => v.date === d); return [`${dayName(d)} ${d}`, a.length, fmtN(sum(a, val)), fmtN(sum(a, v => v.tax)), fmtN(sum(ex.filter(x => x.date === d), x => x.amount))]; })) : '');
}
SCREEN_RENDER.rep_daily = repScreen('rep_daily', 'ملخص اليوم والإيرادات', '📈', 'teal', bodyDaily);

/* ---------- حسابات الأطباء ---------- */
function bodyDoctors(name) {
  const {from, to} = getRange();
  if (!name) {
    const acc = accounts(from, to);
    return kpiRow([['الأطباء', acc.length, 'violet'], ['إجمالي الإيراد', fmtN(sum(acc, r => r.total)), 'orange'], ['الضريبة', fmtN(sum(acc, r => r.tax)), 'pink'], ['حقوق الأطباء', fmtN(sum(acc, r => r.right)), 'teal'], ['نصيب العمليات', fmtN(sum(acc, r => r.ops)), 'red']])
      + tbl(['العيادة', 'الطبيب', 'كشف', 'متنوع', 'لجنة', 'شركات', 'تأمين', 'الإجمالي (نقدي)', 'استشارة', 'إجمالي الإيراد', 'الضريبة', 'المستحق', 'الثابت', 'حق الطبيب', 'نسبة العمليات'],
        acc.map(r => [L.clinic(r.clinic), L.doctor(r.name), fmtN(r.kosf), fmtN(r.mixed), fmtN(r.committee), fmtN(r.company), fmtN(r.insurance), fmtN(r.cash), r.consult, fmtN(r.total), fmtN(r.tax), fmtN(r.due), fmtN(r.fixed), `<b>${fmtN(r.right)}</b>`, fmtN(r.ops)]),
        ['', 'الإجمالي', ...['kosf', 'mixed', 'committee', 'company', 'insurance', 'cash', 'consult', 'total', 'tax', 'due', 'fixed', 'right', 'ops'].map(k => fmtN(sum(acc, r => r[k])))]);
  }
  const docs = S.data.doctors.filter(d => d.name === name), acc = accounts(from, to).filter(r => r.name === name);
  const vs = visitsIn(from, to).filter(v => v.doctor === name), ops = opsIn(from, to).filter(o => o.doctor === name);
  const head = docs.length ? `<div class="panel accent c-violet" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">${docs.map(d => `${d.photo ? `<img class="mini-img" style="width:70px;height:70px" data-fid="${d.photo}" data-act="lightbox">` : ''}<div><b style="font-size:1.2rem">${esc(d.name)}</b><br>العيادة: ${L.clinic(d.clinic)} — كود ${d.code}<br>النسبة: ${fmtN(d.percent)}% — الثابت: ${fmtN(d.fixed)} — نسبة العمليات: ${fmtN(d.opPercent)}%<br>تاريخ التعيين: ${esc(d.hireDate) || '—'} ${d.phone ? '— ' + esc(d.phone) : ''}</div>`).join('<hr>')}</div>` : '';
  const dayRows = []; acc.forEach(r => [...r.dayMap.entries()].sort().forEach(([d, m]) => { const pct = r.doc ? +r.doc.percent || 0 : 0, fx = r.doc ? +r.doc.fixed || 0 : 0, due = (m.rev - m.tax) * pct / 100; dayRows.push([`${dayName(d)} ${d}`, L.clinic(r.clinic), fmtN(m.rev), fmtN(m.tax), fmtN(due), fmtN(fx), `<b>${fmtN(Math.max(fx, due))}</b>`]); }));
  const A = k => sum(acc, r => r[k]);
  return head + kpiRow([['الزيارات', vs.length, 'teal'], ['إجمالي الإيراد', fmtN(A('total')), 'orange'], ['الضريبة', fmtN(A('tax')), 'pink'], ['حق الطبيب من الكشوفات', fmtN(A('right')), 'violet'], ['نصيب العمليات', fmtN(A('ops')), 'red'], ['إجمالي المستحق', fmtN(A('right') + A('ops')), 'lime']])
    + sect('الحساب اليومي') + tbl(['اليوم', 'العيادة', 'الإيراد', 'الضريبة', 'المستحق بالنسبة', 'الثابت', 'حق الطبيب'], dayRows, ['الإجمالي', '', fmtN(A('total')), fmtN(A('tax')), fmtN(A('due')), fmtN(A('fixed')), fmtN(A('right'))])
    + sect('الزيارات') + tbl(visitHeads, visitRows(vs), visitFoot(vs))
    + (ops.length ? sect('العمليات') + tbl(['التاريخ', 'المريض', 'العملية', 'القيمة', 'نصيب الطبيب'], ops.map(o => [esc(o.date), L.patient(o.patient), esc(o.operation), fmtN(o.value), fmtN(opShare(o))]), ['', '', 'الإجمالي', fmtN(sum(ops, o => o.value)), fmtN(sum(ops, opShare))]) : '');
}
SCREEN_RENDER.rep_doctors = repScreen('rep_doctors', 'حسابات الأطباء', '👨‍⚕️', 'violet', bodyDoctors, {sg: 'doctors', ph: 'اكتب اسم الطبيب لعرض كشف حسابه…'});

/* ---------- العيادات: الإيرادات (سطر لكل عيادة/طبيب) ثم المصروفات مقابل الإيرادات ---------- */
function clinicsOverview(from, to, all) {
  const ops = opsIn(from, to), g = new Map();
  const slot = c => { c = c || '—'; if (!g.has(c)) g.set(c, {c, vs: [], ops: []}); return g.get(c); };
  all.forEach(v => slot(v.clinic).vs.push(v));
  ops.forEach(o => slot(o.clinic).ops.push(o));
  const rows = [...g.values()].map(x => {
    const kosf = sum(x.vs.filter(v => v.visitType !== 'متنوع'), val), mixed = sum(x.vs.filter(v => v.visitType === 'متنوع'), val) + sum(x.ops, o => o.value), total = kosf + mixed;
    const co = sum(x.vs.filter(v => v.category === 'company'), val), ins = sum(x.vs, discountAmt), com = sum(x.vs.filter(v => v.category === 'committee'), val), tax = sum(x.vs, v => v.tax);
    return Object.assign(x, {kosf, mixed, total, co, ins, com, tax, net: total - co - ins - com});
  }).sort((a, b) => a.c.localeCompare(b.c, 'ar'));
  const T = k => sum(rows, r => r[k]);
  const revTbl = tbl(['العيادة', 'كشف', 'متنوع', 'الإجمالي', 'شركات', 'تأمين', 'لجنة', 'ضرائب'],
    rows.map(r => [L.clinic(r.c), fmtN(r.kosf), fmtN(r.mixed), fmtN(r.total), fmtN(r.co), fmtN(r.ins), fmtN(r.com), fmtN(r.tax)]),
    ['الإجمالي', fmtN(T('kosf')), fmtN(T('mixed')), fmtN(T('total')), fmtN(T('co')), fmtN(T('ins')), fmtN(T('com')), fmtN(T('tax'))]);
  const paid = S.data.expenses.filter(e => e.doctor && payDay(e) >= from && payDay(e) <= to), other = S.data.expenses.filter(e => !e.doctor && e.date >= from && e.date <= to);
  const pg = new Map(); paid.forEach(e => { const k = e.doctor + '\u0001' + (e.category || 'مستحقات أطباء'); (pg.get(k) || pg.set(k, []).get(k)).push(e); });
  const exRows = [
    ...[...pg.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar')).map(([k, a]) => [L.doctor(k.split('\u0001')[0]), fmtN(sum(a, e => e.amount)), esc([k.split('\u0001')[1], ...new Set(a.map(e => e.notes).filter(Boolean))].join(' — '))]),
    ...other.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => [esc(e.notes || e.category || ''), fmtN(e.amount), esc(e.category || '')])];
  const exT = sum(paid, e => e.amount) + sum(other, e => e.amount), net = T('net') - exT;
  const netDay = net, noteRow = t => `<b>${t}</b>`;
  const stmt = tbl(['البيان', 'القيمة', 'ملاحظات'], [[noteRow('إجمالي الإيرادات (القيمة)'), noteRow(fmtN(T('net'))), 'بعد الشركات والتأمين واللجنة'], ...exRows, [noteRow('إجمالي المصروفات'), noteRow(fmtN(exT)), ''], [noteRow('صافي اليوم'), noteRow(fmtN(netDay)), 'الإيرادات − المصروفات'], [noteRow('الضريبة'), noteRow(fmtN(T('tax'))), 'غير مخصومة من الصافي']]);
  return kpiRow([['الإيرادات (القيمة)', fmtN(T('net')), 'orange'], ['المصروفات', fmtN(exT), 'red'], ['صافي اليوم', fmtN(net), net >= 0 ? 'lime' : 'pink']])
    + sect('الإيرادات') + revTbl
    + sect('المصروفات مقابل الإيرادات') + stmt
}
/* العيادات والأطباء بالتفصيل + مستحقات الأطباء (تُستخدم في تقرير الإجماليات) */
function detailSections(from, to) {
  const all = visitsIn(from, to), ops = opsIn(from, to);
  const g = new Map(), dayDue = new Map();
  const slot = (c, d, kind) => { const k = kind + '\u0001' + c + '\u0001' + d; if (!g.has(k)) g.set(k, {kind, c, d, vs: [], ops: [], due: 0}); return g.get(k); };
  all.forEach(v => slot(v.clinic || '—', v.doctor || '—', 'v').vs.push(v));
  [...g.values()].forEach(x => { const doc = x.vs[0] && findDoctor(x.vs[0]), pct = doc ? +doc.percent || 0 : 0; groupBy(x.vs, v => v.date).forEach((a, day) => { const due = (sum(a, val) - sum(a, v => v.tax)) * pct / 100; x.due += due; const k = (doc ? doc.id : '?' + x.d) + '|' + day; const e = dayDue.get(k) || {sum: 0, first: x, fx: doc ? +doc.fixed || 0 : 0}; e.sum += due; dayDue.set(k, e); }); });
  dayDue.forEach(e => { const top = Math.max(0, e.fx - e.sum); if (top > 0) e.first.due += top; });
  ops.forEach(o => { const oc = opCalc(o), x = slot('عمليات', o.doctor || '—', 'o'); x.ops.push(o); x.due += oc.surgeon; if (oc.anes > 0 && (o.anesthetist || o.anesthetistId)) { const an = slot('تخدير العمليات', o.anesthetist || '—', 'a'); an.ops.push(o); an.due += oc.anes; } });
  const order = {v: 0, o: 1, a: 2};
  const rows = [...g.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.c.localeCompare(b.c, 'ar') || a.d.localeCompare(b.d, 'ar')).map(x => {
    if (x.kind === 'v') { const kosf = sum(x.vs.filter(v => v.visitType !== 'متنوع'), val), mixed = sum(x.vs.filter(v => v.visitType === 'متنوع'), val); return Object.assign(x, {kosf, mixed, rev: kosf + mixed, co: sum(x.vs.filter(v => v.category === 'company'), val), ins: sum(x.vs, discountAmt), com: sum(x.vs.filter(v => v.category === 'committee'), val), tax: sum(x.vs, v => v.tax)}); }
    if (x.kind === 'o') { const t = sum(x.ops, o => o.value); return Object.assign(x, {kosf: 0, mixed: t, rev: t, co: 0, ins: 0, com: 0, tax: 0}); }
    return Object.assign(x, {kosf: 0, mixed: 0, rev: 0, co: 0, ins: 0, com: 0, tax: 0});
  });
  // المدفوع لكل طبيب (حسب يوم الاستحقاق) يوزَّع على سطوره بالترتيب
  const paidBy = new Map(); S.data.expenses.filter(e => e.doctor && payDay(e) >= from && payDay(e) <= to).forEach(e => paidBy.set(e.doctor, (paidBy.get(e.doctor) || 0) + (+e.amount || 0)));
  const left = new Map(paidBy), lastRow = new Map(); rows.forEach(r => lastRow.set(r.d, r));
  rows.forEach(r => { const rest = left.get(r.d) || 0; const pd = lastRow.get(r.d) === r ? rest : Math.min(r.due, rest); r.paid = pd; left.set(r.d, rest - pd); r.rest = r.due - r.paid; });
  paidBy.forEach((v, name) => { if (!rows.some(r => r.d === name)) rows.push({kind: 'p', c: '—', d: name, kosf: 0, mixed: 0, rev: 0, co: 0, ins: 0, com: 0, tax: 0, due: 0, paid: v, rest: -v}); });
  const T = k => sum(rows, r => r[k]), st = statementRows(from, to), b = t => `<b>${t}</b>`;
  const cl = r => r.kind === 'v' ? L.clinic(r.c) : esc(r.c), dn = r => r.d === '—' ? '—' : L.doctor(r.d);
  const detail = tbl(['العيادة', 'اسم الطبيب', 'كشف', 'متنوع', 'إيرادات', 'شركات', 'لجنة', 'تأمين', 'ضرائب'],
    [...rows.filter(r => r.kind !== 'p').map(r => [cl(r), dn(r), fmtN(r.kosf), fmtN(r.mixed), fmtN(r.rev), fmtN(r.co), fmtN(r.com), fmtN(r.ins), fmtN(r.tax)]),
     [b('الإجمالي'), '', b(fmtN(T('kosf'))), b(fmtN(T('mixed'))), b(fmtN(T('rev'))), b(fmtN(T('co'))), b(fmtN(T('com'))), b(fmtN(T('ins'))), b(fmtN(T('tax')))],
     [b('صافي اليوم'), '', '', '', b(fmtN(st.net)), '', '', '', ''],
     [b('الضريبة'), '', '', '', '', '', '', '', b(fmtN(T('tax')))]]);
  const tag = r => r.due <= 0 && r.paid <= 0 ? '' : r.rest <= 0.005 ? '<span class="tag c-lime">تم الصرف</span>' : r.paid > 0 ? '<span class="tag c-orange">صرف جزئي</span>' : '<span class="tag c-red">لم يُصرف</span>';
  const dues = tbl(['العيادة', 'اسم الطبيب', 'كشف', 'متنوع', 'إيرادات', 'الضرائب', 'المستحق', 'المدفوع', 'الباقي', 'الحالة'],
    [...rows.map(r => [cl(r), dn(r), fmtN(r.kosf), fmtN(r.mixed), fmtN(r.rev), fmtN(r.tax), b(fmtN(r.due)), fmtN(r.paid), b(fmtN(r.rest)), tag(r)]),
     [b('الإجمالي'), '', b(fmtN(T('kosf'))), b(fmtN(T('mixed'))), b(fmtN(T('rev'))), b(fmtN(T('tax'))), b(fmtN(T('due'))), b(fmtN(T('paid'))), b(fmtN(T('rest'))), ''],
     [b('إجمالي رصيد مستحق'), '', '', '', '', '', '', '', b(fmtN(T('rest'))), '']]);
  return {detail, dues, rows};
}

/* ---------- العيادات ---------- */
function bodyClinics(name) {
  const {from, to} = getRange(), all = visitsIn(from, to);
  if (!name) return clinicsOverview(from, to, all);
  const vs = all.filter(v => v.clinic === name), acc = accounts(from, to).filter(r => r.clinic === name), days = [...groupBy(vs, v => v.date)].sort();
  return kpiRow([['الزيارات', vs.length, 'teal'], ['الإيراد', fmtN(sum(vs, val)), 'orange'], ['الضريبة', fmtN(sum(vs, v => v.tax)), 'pink'], ['حقوق الأطباء', fmtN(sum(acc, r => r.right)), 'violet']])
    + sect('الأطباء') + tbl(['الطبيب', 'الزيارات', 'الإيراد', 'الضريبة', 'حق الطبيب'], acc.map(r => [L.doctor(r.name), r.visits, fmtN(r.total), fmtN(r.tax), fmtN(r.right)]), ['الإجمالي', sum(acc, r => r.visits), fmtN(sum(acc, r => r.total)), fmtN(sum(acc, r => r.tax)), fmtN(sum(acc, r => r.right))])
    + sect('يوماً بيوم') + tbl(['اليوم', 'الزيارات', 'الإيراد'], days.map(([d, a]) => [`${dayName(d)} ${d}`, a.length, fmtN(sum(a, val))]))
    + sect('الزيارات') + tbl(visitHeads, visitRows(vs), visitFoot(vs));
}
SCREEN_RENDER.rep_clinics = repScreen('rep_clinics', 'تقارير العيادات', '🏨', 'orange', bodyClinics, {sg: 'clinics', ph: 'اكتب اسم العيادة لعرض تفاصيلها…'});

/* ---------- شركات التأمين: التعامل بقيمة كشف الشركة (من شاشة شركات التأمين) ---------- */
function bodyCompanies(name) {
  const {from, to} = getRange(), vs = visitsIn(from, to).filter(v => v.category === 'company' && (!name || v.company === name));
  const kp = a => kpiRow([['الزيارات', a.length, 'teal'], ['قيمة الكشف بالشركة', fmtN(sum(a, coVal)), 'orange'], ['تحمل المرضى', fmtN(sum(a, coShare)), 'pink'], ['مستحق على الشركة', fmtN(sum(a, coDue)), 'cyan']]);
  if (!name) {
    const g = [...groupBy(vs, v => v.company)].sort((a, b) => sum(b[1], coDue) - sum(a[1], coDue));
    return kp(vs) + `<div class="panel"><h3>المستحق على كل شركة</h3>${bars(g.map(([n, a]) => ({l: n, v: sum(a, coDue)})), 'cmprep')}</div>`
      + tbl(['الشركة', 'قيمة كشف الشركة', 'الزيارات', 'إجمالي قيمة الشركة', 'تحمل المرضى', 'مستحق على الشركة'], g.map(([n, a]) => [L.company(n), fmtN(coFee(n)), a.length, fmtN(sum(a, coVal)), fmtN(sum(a, coShare)), `<b>${fmtN(sum(a, coDue))}</b>`]), ['الإجمالي', '', vs.length, fmtN(sum(vs, coVal)), fmtN(sum(vs, coShare)), fmtN(sum(vs, coDue))]);
  }
  return kp(vs) + `<div class="panel accent c-cyan"><b>${esc(name)}</b> — قيمة كشف الشركة: ${fmtN(coFee(name))}</div>`
    + tbl(['التاريخ', 'المريض', 'العيادة', 'الطبيب', 'الزيارة', 'رقم النموذج', 'صورة النموذج', 'رقم الكارنية', 'صورة الكارنية', 'قيمة الشركة', 'نسبة التحمل %', 'تحمل المريض', 'على الشركة'], vs.sort((a, b) => a.date.localeCompare(b.date)).map(v => [esc(v.date), L.patient(v.patient), L.clinic(v.clinic), L.doctor(v.doctor), esc(v.visitType), esc(v.formNo), thumb(v.formPhoto), esc(v.cardNo), thumb(v.cardPhoto), fmtN(coVal(v)), fmtN(v.patientPct), fmtN(coShare(v)), fmtN(coDue(v))]), ['', '', '', '', '', '', '', '', 'الإجمالي', fmtN(sum(vs, coVal)), '', fmtN(sum(vs, coShare)), fmtN(sum(vs, coDue))]);
}
Acts.cmprep = el => nav('rep_companies', el.dataset.v);
SCREEN_RENDER.rep_companies = repScreen('rep_companies', 'تقارير شركات التأمين', '🏢', 'cyan', bodyCompanies, {sg: 'companies', ph: 'اكتب اسم الشركة لعرض كشف حسابها…'});

/* ---------- المرضى ---------- */
function bodyPatients(name) {
  const {from, to} = getRange();
  if (!name) {
    const vs = visitsIn(from, to), g = [...groupBy(vs, v => v.patient)].sort((a, b) => b[1].length - a[1].length);
    return kpiRow([['مرضى الفترة', g.length, 'blue'], ['الزيارات', vs.length, 'teal'], ['الإيراد', fmtN(sum(vs, val)), 'orange']])
      + tbl(['المريض', 'الهاتف', 'الزيارات', 'الإجمالي', 'آخر زيارة', 'نوعها'], g.map(([n, a]) => { const l = a.slice().sort((x, y) => y.date.localeCompare(x.date))[0], p = S.data.patients.find(x => x.name === n); return [L.patient(n), esc(p ? p.phone : l.phone), a.length, fmtN(sum(a, val)), esc(l.date), esc(l.visitType)]; }));
  }
  const vs = visitsIn(from, to).filter(v => v.patient === name), ops = opsIn(from, to).filter(o => o.patient === name), p = S.data.patients.find(x => x.name === name);
  const lv = lastVisitOf(name, p && p.phone);
  return `<div class="panel accent c-blue"><b style="font-size:1.2rem">${esc(name)}</b> — الهاتف: ${esc(p ? p.phone : '') || '—'}${lv ? ` — آخر زيارة: ${lv.date} (${esc(lv.visitType)})` : ''}</div>`
    + kpiRow([['الزيارات', vs.length, 'teal'], ['إجمالي القيمة', fmtN(sum(vs, val)), 'orange'], ['المدفوع من المريض', fmtN(sum(vs.filter(v => (v.category || 'cash') === 'cash'), val) + sum(vs, patientShare)), 'lime'], ['العمليات', ops.length, 'red']])
    + sect('سجل الزيارات') + tbl(visitHeads, visitRows(vs), visitFoot(vs))
    + (ops.length ? sect('العمليات') + tbl(['التاريخ', 'العملية', 'الطبيب', 'القيمة'], ops.map(o => [esc(o.date), esc(o.operation), L.doctor(o.doctor), fmtN(o.value)]), ['', '', 'الإجمالي', fmtN(sum(ops, o => o.value))]) : '');
}
SCREEN_RENDER.rep_patients = repScreen('rep_patients', 'تقارير المرضى', '🧑‍🤝‍🧑', 'blue', bodyPatients, {sg: 'patients', ph: 'اكتب اسم المريض لعرض ملفه…'});

/* ---------- الخدمات ---------- */
function bodyServices() {
  const {from, to} = getRange(), vs = visitsIn(from, to);
  const byS = [...groupBy(vs, v => v.service || '(بدون بيان)')].sort((a, b) => sum(b[1], val) - sum(a[1], val));
  return kpiRow([['الزيارات', vs.length, 'teal'], ['الإيراد', fmtN(sum(vs, val)), 'orange']])
    + sect('حسب الزيارة') + tbl(['الزيارة', 'العدد', 'القيمة'], VTYPES.map(t => { const a = vs.filter(v => v.visitType === t); return [esc(t), a.length, fmtN(sum(a, val))]; }))
    + sect('حسب البيان / الخدمة') + tbl(['الخدمة', 'السعر المسجل', 'العدد', 'القيمة'], byS.map(([n, a]) => { const s = S.data.services.find(x => x.name === n); return [esc(n), s ? fmtN(s.price) : '—', a.length, fmtN(sum(a, val))]; }), ['الإجمالي', '', vs.length, fmtN(sum(vs, val))])
    + sect('قائمة الخدمات') + tbl(['النوع', 'الخدمة', 'القيمة', 'الضريبة'], S.data.services.slice().sort((a, b) => a.type.localeCompare(b.type)).map(s => [SVTYPE[s.type], esc(s.name), fmtN(s.price), fmtN(s.tax)]));
}
SCREEN_RENDER.rep_services = repScreen('rep_services', 'تقارير الخدمات', '💉', 'pink', bodyServices);

/* ---------- العمليات ---------- */
function bodyOps() {
  const {from, to} = getRange(), ops = opsIn(from, to), g = [...groupBy(ops, o => o.doctor)];
  return kpiRow([['عدد العمليات', ops.length, 'red'], ['إجمالي القيمة', fmtN(sum(ops, o => o.value)), 'orange'], ['نصيب الأطباء', fmtN(sum(ops, opShare)), 'violet']])
    + sect('حسب الطبيب') + tbl(['الطبيب', 'العمليات', 'القيمة', 'نصيب الطبيب'], g.map(([n, a]) => [L.doctor(n), a.length, fmtN(sum(a, o => o.value)), fmtN(sum(a, opShare))]))
    + sect('التفاصيل') + tbl(['التاريخ', 'المريض', 'العملية', 'الطبيب', 'القيمة', 'نصيب الطبيب'], ops.slice().sort((a, b) => a.date.localeCompare(b.date)).map(o => [esc(o.date), L.patient(o.patient), esc(o.operation), L.doctor(o.doctor), fmtN(o.value), fmtN(opShare(o))]), ['', '', '', 'الإجمالي', fmtN(sum(ops, o => o.value)), fmtN(sum(ops, opShare))]);
}
SCREEN_RENDER.rep_operations = repScreen('rep_operations', 'تقارير العمليات', '🏥', 'red', bodyOps);

/* ---------- المصروفات ---------- */
function bodyExp(cat) {
  const {from, to} = getRange(), ex = expIn(from, to).filter(x => !cat || x.category === cat), g = [...groupBy(ex, x => x.category)].sort((a, b) => sum(b[1], x => x.amount) - sum(a[1], x => x.amount));
  return kpiRow([['عدد البنود', ex.length, 'gold'], ['إجمالي المصروفات', fmtN(sum(ex, x => x.amount)), 'red']])
    + `<div class="panel"><h3>حسب البند</h3>${bars(g.slice(0, 10).map(([n, a]) => ({l: n, v: sum(a, x => x.amount)})), 'exprep')}</div>`
    + tbl(['البند', 'العدد', 'المبلغ'], g.map(([n, a]) => [`<span class="lnk" data-act="exprep" data-v="${esc(n)}">${esc(n)}</span>`, a.length, fmtN(sum(a, x => x.amount))]), ['الإجمالي', ex.length, fmtN(sum(ex, x => x.amount))])
    + sect('التفاصيل') + tbl(['التاريخ', 'البند', 'الطبيب', 'المبلغ', 'ملاحظات', 'سجّله'], ex.slice().sort((a, b) => a.date.localeCompare(b.date)).map(x => [esc(x.date), esc(x.category), L.doctor(x.doctor), fmtN(x.amount), esc(x.notes), esc(x.registeredBy)]));
}
Acts.exprep = el => S.view && S.view.pick && S.screen === 'rep_expenses' ? S.view.pick(el.dataset.v) : nav('rep_expenses', el.dataset.v);
SCREEN_RENDER.rep_expenses = repScreen('rep_expenses', 'تقارير المصروفات', '💸', 'gold', bodyExp, {sg: 'expcats', ph: 'اكتب بند المصروف…'});

/* ---------- نشاط مسئولي التسجيل ---------- */
function bodyStaff() {
  const {from, to} = getRange(), vs = visitsIn(from, to), ex = expIn(from, to), names = [...new Set([...vs.map(v => v.registeredBy), ...ex.map(x => x.registeredBy)].filter(Boolean))];
  return tbl(['المسئول', 'عدد الزيارات', 'إيراد الزيارات', 'عدد المصروفات', 'مبلغ المصروفات'], names.map(n => { const a = vs.filter(v => v.registeredBy === n), e = ex.filter(x => x.registeredBy === n); return [esc(n), a.length, fmtN(sum(a, val)), e.length, fmtN(sum(e, x => x.amount))]; }));
}
SCREEN_RENDER.rep_staff = repScreen('rep_staff', 'نشاط مسئولي التسجيل', '👥', 'lime', bodyStaff);
