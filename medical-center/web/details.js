/* ============ نوافذ التفاصيل عند الضغط على الكروت + تقرير الإجماليات التفصيلي ============ */
'use strict';
const opsRevenue = (f, t) => sum(opsIn(f, t), o => o.value);
function scopedVisits() {
  const {from, to} = getRange(), sc = S.scope || {}; let vs = visitsIn(from, to);
  if (sc.doctor) vs = vs.filter(v => v.doctor === sc.doctor);
  if (sc.clinic) vs = vs.filter(v => v.clinic === sc.clinic);
  if (sc.company) vs = vs.filter(v => v.company === sc.company);
  if (sc.patient) vs = vs.filter(v => v.patient === sc.patient);
  return vs;
}
const byTable = (title, arr, kf, linker) => { const g = [...groupBy(arr, kf)].sort((a, b) => sum(b[1], val) - sum(a[1], val)); return `<h4>${title}</h4>` + tbl(['البيان', 'العدد', 'القيمة'], g.map(([n, a]) => [linker ? linker(n) : esc(n), a.length, fmtN(sum(a, val))]), ['الإجمالي', arr.length, fmtN(sum(arr, val))]); };
function statementRows(from, to) {
  const vs = visitsIn(from, to), acc = accounts(from, to), opsRev = opsRevenue(from, to);
  const kosf = sum(vs.filter(v => v.visitType !== 'متنوع'), val), mixed = sum(vs.filter(v => v.visitType === 'متنوع'), val), dayRev = kosf + mixed + opsRev;
  const co = sum(vs.filter(v => v.category === 'company'), val), ins = sum(vs, discountAmt), com = sum(vs.filter(v => v.category === 'committee'), val), tax = sum(vs, v => v.tax);
  const due = sum(acc, r => r.right + r.ops), paid = docPaid(from, to), expO = expOther(from, to), net = dayRev - co - ins - com - paid - expO;
  return {rows: [['إيراد الكشف', kosf], ['إيراد متنوع', mixed], ['إيراد العمليات', opsRev], ['إجمالي إيراد اليوم', dayRev], ['الشركات', -co], ['التأمين (قيمة نسبة الخصم فقط)', -ins], ['اللجنة', -com], ['المدفوع للأطباء فعلياً', -paid], ['المصروفات (بخلاف الأطباء)', -expO], ['الصافي', net], ['الضريبة', tax]],
    memo: [['مستحقات الأطباء (إجمالي المستحق)', due], ['المدفوع منها', paid], ['المتبقي بدون صرف (غير مخصوم من الصافي)', due - paid]], net, tax, dayRev, kosf, mixed, opsRev, due, paid, expO, gross: kosf + mixed};
}
function kpiDetail(label, value) {
  const {from, to} = getRange(), vs = scopedVisits(), sc = S.scope || {}, scoped = Object.keys(sc).some(k => sc[k]);
  const L_ = label;
  let body = '';
  if (/مدفوع/.test(L_)) { const p = S.data.expenses.filter(x => x.doctor && payDay(x) >= from && payDay(x) <= to); body = tbl(['عن يوم', 'الطبيب', 'المبلغ', 'ملاحظات'], p.map(x => [esc(payDay(x)), L.doctor(x.doctor), fmtN(x.amount), esc(x.notes)]), ['', 'الإجمالي', fmtN(sum(p, x => x.amount)), '']); }
  else if (/إيراد الكشف|إيراد متنوع/.test(L_)) { const mx = /متنوع/.test(L_); const a = vs.filter(v => mx ? v.visitType === 'متنوع' : v.visitType !== 'متنوع'); body = byClinicDoc(a) + byTable('حسب البيان', a, v => v.service || '(بدون بيان)'); }
  else if (/إيراد اليوم/.test(L_)) { const s = statementRows(from, to); body = tbl(['البند', 'القيمة'], s.rows.slice(0, 4).map(r => [r[0], fmtN(r[1])])) + byTable('حسب نوع الدفع', vs, v => CAT[v.category || 'cash']) + byClinicDoc(vs); }
  else if (/صافي/.test(L_)) { const s = statementRows(from, to); body = tbl(['البند', 'القيمة'], s.rows.map(r => [r[0], fmtN(r[1])])) + '<h4>مستحقات الأطباء</h4>' + tbl(['البند', 'القيمة'], s.memo.map(r => [r[0], fmtN(r[1])])); }
  else if (/مصروف|البنود/.test(L_)) { const ex = expIn(from, to).filter(x => !x.doctor); body = tbl(['البند', 'العدد', 'المبلغ'], [...groupBy(ex, x => x.category)].sort((a, b) => sum(b[1], x => x.amount) - sum(a[1], x => x.amount)).map(([n, a]) => [esc(n), a.length, fmtN(sum(a, x => x.amount))]), ['الإجمالي', ex.length, fmtN(sum(ex, x => x.amount))]); }
  else if (/ضريب/.test(L_)) body = tbl(['العيادة', 'الزيارات', 'الضريبة'], [...groupBy(vs, v => v.clinic)].map(([n, a]) => [L.clinic(n), a.length, fmtN(sum(a, v => v.tax))]), ['الإجمالي', vs.length, fmtN(sum(vs, v => v.tax))]);
  else if (/مستحق على|تحمل|الشركة|الخصم|شركات/.test(L_)) { const cv = vs.filter(v => v.category === 'company' || v.category === 'insurance'); body = tbl(['التاريخ', 'المريض', 'النوع', 'الشركة', 'القيمة', 'تحمل / خصم', 'على الجهة'], cv.map(v => [esc(v.date), L.patient(v.patient), tagCat(v.category), L.company(v.company), fmtN(v.category === 'company' ? coVal(v) : v.value), fmtN(v.category === 'company' ? coShare(v) : discountAmt(v)), fmtN(v.category === 'company' ? coDue(v) : val(v) - discountAmt(v))])); }
  else if (/حقوق|حق |نصيب|المستحق|الأطباء|متبقي/.test(L_)) { const acc = accounts(from, to).filter(r => !sc.clinic || r.clinic === sc.clinic).filter(r => !sc.doctor || r.name === sc.doctor); body = tbl(['الطبيب', 'العيادة', 'الزيارات', 'الإيراد', 'حق الطبيب', 'العمليات'], acc.map(r => [L.doctor(r.name), L.clinic(r.clinic), r.visits, fmtN(r.total), fmtN(r.right), fmtN(r.ops)]), ['الإجمالي', '', sum(acc, r => r.visits), fmtN(sum(acc, r => r.total)), fmtN(sum(acc, r => r.right)), fmtN(sum(acc, r => r.ops))]); }
  else if (/مرضى/.test(L_)) body = tbl(['المريض', 'الزيارات', 'القيمة'], [...groupBy(vs, v => v.patient)].sort((a, b) => b[1].length - a[1].length).slice(0, 15).map(([n, a]) => [L.patient(n), a.length, fmtN(sum(a, val))]));
  else if (/عمليات/.test(L_)) { const o = opsIn(from, to); body = tbl(['التاريخ', 'المريض', 'العملية', 'الطبيب', 'القيمة'], o.map(x => [esc(x.date), L.patient(x.patient), esc(x.operation), L.doctor(x.doctor), fmtN(x.value)]), ['', '', '', 'الإجمالي', fmtN(sum(o, x => x.value))]); }
  else if (/زيارات|الزيارات|عدد/.test(L_)) body = byTable('حسب نوع الزيارة', vs, v => v.visitType) + byClinicDoc(vs) + byTable('حسب نوع الدفع', vs, v => CAT[v.category || 'cash']);
  else if (/إيراد|قيمة|الإجمالي|الإيرادات|المدفوع|نقد|المحصّل|الدرج/.test(L_)) body = byTable('حسب نوع الزيارة (نقدي / شركة / لجنة / تأمين)', vs, v => CAT[v.category || 'cash']) + byClinicDoc(vs) + byTable('حسب الزيارة', vs, v => v.visitType);
  else body = '<p>لا توجد تفاصيل إضافية لهذا الكرت.</p>';
  return `<div style="min-width:min(520px,88vw)"><h3>${esc(L_)}: <b>${esc(value)}</b></h3><small>${esc(rangeLabel())}${scoped ? ' — ' + esc(Object.values(sc).filter(Boolean).join(' / ')) : ''}</small><div style="max-height:62vh;overflow:auto;margin-top:8px">${body}</div><div class="actions"><button class="btn c-teal" data-act="closemodal">إغلاق</button></div></div>`;
}
Acts.kpi = el => modal(kpiDetail(el.dataset.l, el.dataset.v || ''));
Acts.closemodal = el => { const m = el.closest('.modal'); if (m) m.remove(); };

/* نافذة كرت العيادة */
Acts.clinicrep = el => {
  const n = el.dataset.v, {from, to} = getRange(), vs = visitsIn(from, to).filter(v => v.clinic === n), acc = accounts(from, to).filter(r => r.clinic === n), c = clinicOf(n);
  const last = vs.slice().sort((a, b) => (b.date + (b.serial || 0)).localeCompare(a.date + (a.serial || 0))).slice(0, 8);
  modal(`<div style="min-width:min(540px,88vw)"><h3>🏨 ${esc(n)}</h3><small>${esc(rangeLabel())} — سعر الكشف: ${fmtN(c ? c.price : 0)}</small>
  ${kpiRow([['الزيارات', vs.length, 'teal'], ['الإيراد', fmtN(sum(vs, val)), 'orange'], ['الضريبة', fmtN(sum(vs, v => v.tax)), 'pink']]).replace(/data-act="kpi"/g, '')}
  <div style="max-height:46vh;overflow:auto">${acc.length ? '<h4>الأطباء</h4>' + tbl(['الطبيب', 'الزيارات', 'الإيراد', 'حق الطبيب'], acc.map(r => [L.doctor(r.name), r.visits, fmtN(r.total), fmtN(r.right)])) : ''}
  ${vs.length ? '<h4>حسب نوع الدفع</h4>' + tbl(['النوع', 'العدد', 'القيمة'], Object.keys(CAT).map(k => { const a = vs.filter(v => (v.category || 'cash') === k); return [tagCat(k), a.length, fmtN(sum(a, val))]; })) + '<h4>آخر الزيارات</h4>' + tbl(['التاريخ', 'المريض', 'الطبيب', 'الزيارة', 'القيمة'], last.map(v => [esc(v.date), L.patient(v.patient), L.doctor(v.doctor), esc(v.visitType), fmtN(v.value)])) : '<div class="empty">لا توجد زيارات في هذه الفترة</div>'}</div>
  <div class="actions">${can('rep_clinics') ? `<button class="btn c-violet" data-act="clinicfull" data-v="${esc(n)}">📋 التقرير الكامل</button>` : ''}<button class="btn ghost" data-act="closemodal">إغلاق</button></div></div>`);
};
Acts.clinicfull = el => { const m = el.closest('.modal'); if (m) m.remove(); nav('rep_clinics', el.dataset.v); };

/* ---------- تقرير الإجماليات بالتفصيل ---------- */
function bodyTotals() {
  const {from, to} = getRange(), vs = visitsIn(from, to), ex = expIn(from, to), ops = opsIn(from, to), acc = accounts(from, to), st = statementRows(from, to);
  const cats = Object.keys(CAT).map(k => [k, vs.filter(v => (v.category || 'cash') === k)]);
  const shares = sum(vs, patientShare), cash = sum(cats[0][1], val) + shares;
  const recv = sum(vs.filter(v => v.category === 'company'), coDue) + sum(vs.filter(v => v.category === 'insurance'), v => val(v) - discountAmt(v)) + sum(vs.filter(v => v.category === 'committee'), val);
  const clinicNamesUsed = [...new Set(vs.map(v => v.clinic || '—'))].sort((a, b) => sum(vs.filter(v => (v.clinic || '—') === b), val) - sum(vs.filter(v => (v.clinic || '—') === a), val));
  const clinicRows = [];
  clinicNamesUsed.forEach(n => {
    const a = vs.filter(v => (v.clinic || '—') === n);
    clinicRows.push([`<b>${L.clinic(n)}</b>`, '', a.length, fmtN(sum(a, val)), fmtN(sum(a, v => v.tax)), fmtN(sum(acc.filter(r => (r.clinic || '—') === n), r => r.right)), ...Object.keys(CAT).map(k => fmtN(sum(a.filter(v => (v.category || 'cash') === k), val)))]);
    acc.filter(r => (r.clinic || '—') === n).forEach(r => { const d = a.filter(v => (findDoctor(v) ? findDoctor(v).id : v.doctor) === (r.doc ? r.doc.id : r.name) || (!r.doc && v.doctor === r.name)); clinicRows.push(['', L.doctor(r.name), r.visits, fmtN(r.total), fmtN(r.tax), fmtN(r.right), ...Object.keys(CAT).map(k => fmtN(sum(d.filter(v => (v.category || 'cash') === k), val)))]); });
  });
  const ds = detailSections(from, to), days = [...new Set([...vs.map(v => v.date), ...ex.map(x => x.date), ...ops.map(o => o.date)])].sort();
  const cos = [...groupBy(vs.filter(v => v.category === 'company'), v => v.company)];
  const svc = [...groupBy(vs, v => v.service || '(بدون بيان)')].sort((a, b) => sum(b[1], val) - sum(a[1], val)).slice(0, 15);
  return kpiRow([['عدد الزيارات', vs.length, 'teal'], ['إيراد الكشف', fmtN(st.kosf), 'blue'], ['إيراد متنوع', fmtN(st.mixed), 'cyan'], ['إيراد العمليات', fmtN(st.opsRev), 'red'], ['إجمالي إيراد اليوم', fmtN(st.dayRev), 'orange'], ['مستحق على الجهات', fmtN(recv), 'cyan'], ['حقوق الأطباء (المستحق)', fmtN(st.due), 'violet'], ['مدفوع للأطباء', fmtN(st.paid), 'lime'], ['المصروفات', fmtN(st.expO), 'gold'], ['الصافي', fmtN(st.net), 'teal'], ['الضريبة', fmtN(sum(vs, v => v.tax)), 'pink']])
    + sect('قائمة الدخل') + tbl(['البند', 'القيمة'], st.rows.map(r => [r[0], fmtN(r[1])])) + sect('مستحقات الأطباء') + tbl(['البند', 'القيمة'], st.memo.map(r => [r[0], fmtN(r[1])]))
    + sect('حسب نوع الزيارة') + tbl(['الزيارة', 'العدد', 'القيمة'], VTYPES.map(t => { const a = vs.filter(v => v.visitType === t); return [esc(t), a.length, fmtN(sum(a, val))]; }), ['الإجمالي', vs.length, fmtN(sum(vs, val))])
    + sect('حسب نوع الدفع') + tbl(['النوع', 'العدد', 'القيمة', 'تحمل المريض', 'الخصم'], cats.map(([k, a]) => [tagCat(k), a.length, fmtN(sum(a, val)), fmtN(sum(a, patientShare)), fmtN(sum(a, discountAmt))]), ['الإجمالي', vs.length, fmtN(sum(vs, val)), fmtN(shares), fmtN(sum(vs, discountAmt))])
    + sect('العيادات والأطباء بالتفصيل') + ds.detail + sect('مستحقات الأطباء') + ds.dues
    + (cos.length ? sect('الشركات') + tbl(['الشركة', 'الزيارات', 'قيمة الشركة', 'تحمل المرضى', 'مستحق على الشركة'], cos.map(([n, a]) => [L.company(n), a.length, fmtN(sum(a, coVal)), fmtN(sum(a, coShare)), fmtN(sum(a, coDue))]), ['الإجمالي', cos.reduce((s, c) => s + c[1].length, 0), fmtN(sum(cos.flatMap(c => c[1]), coVal)), fmtN(sum(cos.flatMap(c => c[1]), coShare)), fmtN(sum(cos.flatMap(c => c[1]), coDue))]) : '')
    + sect('أكثر الخدمات / البيانات') + tbl(['البيان', 'العدد', 'القيمة'], svc.map(([n, a]) => [esc(n), a.length, fmtN(sum(a, val))]))
    + (ops.length ? sect('العمليات') + tbl(['الطبيب', 'العمليات', 'القيمة', 'نصيب الطبيب'], [...groupBy(ops, o => o.doctor)].map(([n, a]) => [L.doctor(n), a.length, fmtN(sum(a, o => o.value)), fmtN(sum(a, opShare))]), ['الإجمالي', ops.length, fmtN(sum(ops, o => o.value)), fmtN(sum(ops, opShare))]) : '')
    + (ex.length ? sect('المصروفات') + tbl(['البند', 'العدد', 'المبلغ'], [...groupBy(ex, x => x.category)].sort((a, b) => sum(b[1], x => x.amount) - sum(a[1], x => x.amount)).map(([n, a]) => [esc(n), a.length, fmtN(sum(a, x => x.amount))]), ['الإجمالي', ex.length, fmtN(sum(ex, x => x.amount))]) : '')
    + (from !== to ? sect('يوماً بيوم') + tbl(['التاريخ', 'الزيارات', 'إيراد الزيارات', 'العمليات', 'الضريبة', 'المصروفات'], days.map(d => { const a = vs.filter(v => v.date === d); return [`${dayName(d)} ${d}`, a.length, fmtN(sum(a, val)), fmtN(sum(ops.filter(o => o.date === d), o => o.value)), fmtN(sum(a, v => v.tax)), fmtN(sum(ex.filter(x => x.date === d), x => x.amount))]; }), ['الإجمالي', vs.length, fmtN(sum(vs, val)), fmtN(sum(ops, o => o.value)), fmtN(sum(vs, v => v.tax)), fmtN(sum(ex, x => x.amount))]) : '');
}
SCREEN_RENDER.rep_totals = repScreen('rep_totals', 'تقرير الإجماليات بالتفصيل', '🧮', 'gold', bodyTotals);
