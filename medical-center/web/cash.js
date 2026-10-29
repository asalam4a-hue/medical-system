/* ============ حركة الخزينة: دفتر يومي (إيرادات العيادات / الشركات / المصروفات / حساب الأطباء) ============ */
'use strict';
function cashLedger(from, to) {
  const days = [...new Set([
    ...visitsIn(from, to).map(v => v.date), ...opsIn(from, to).map(o => o.date),
    ...S.data.expenses.filter(e => !e.doctor && e.date >= from && e.date <= to).map(e => e.date),
    ...S.data.expenses.filter(e => e.doctor && payDay(e) >= from && payDay(e) <= to).map(e => payDay(e))])].sort();
  const lines = []; // {kind:'rev'|'exp'|'day'|'tot', cells:[...], nums:{}}
  const NK = ['kosf', 'mixed', 'rev', 'co', 'com', 'tax', 'ins', 'amount', 'due', 'fixed', 'paid'];
  const zero = () => Object.fromEntries(NK.map(k => [k, 0]));
  const grand = zero();
  const add = (acc, o) => NK.forEach(k => { acc[k] += +o[k] || 0; });
  days.forEach(d => {
    const dsum = zero(), dn = dayName(d);
    detailSections(d, d).rows.forEach(r => {
      const doc = r.kind === 'v' ? (r.vs[0] && findDoctor(r.vs[0])) : (S.data.doctors.find(x => x.name === r.d) || null);
      const pct = doc ? (r.kind === 'v' ? +doc.percent || 0 : (r.kind === 'o' ? +doc.opPercent || 0 : '')) : '';
      const cov = r.kind === 'v' ? r.vs.filter(v => v.category === 'company') : [];
      const o = {kosf: r.kosf, mixed: r.mixed, rev: r.rev, co: r.co, com: r.com, tax: r.tax, ins: r.ins, amount: 0, due: r.due, fixed: r.kind === 'v' && doc ? +doc.fixed || 0 : 0, paid: r.paid};
      add(dsum, o);
      lines.push({kind: 'rev', o, cells: {day: dn, date: d, spec: r.c, doctor: r.d === '—' ? '' : r.d, doc1: [...new Set(cov.map(v => v.formNo).filter(Boolean))].join('، '), co: [...new Set(cov.map(v => v.company).filter(Boolean))].join('، '), pct}});
    });
    S.data.expenses.filter(e => !e.doctor && e.date === d).forEach(e => {
      const o = Object.assign(zero(), {amount: +e.amount || 0}); add(dsum, o);
      lines.push({kind: 'exp', o, cells: {day: dn, date: d, bayan: e.notes || e.category || '', doc2: e.docNo || '', notes: e.category || ''}});
    });
    add(grand, dsum); lines.push({kind: 'day', o: dsum, cells: {date: d}});
  });
  return {lines, grand, days};
}
SCREEN_RENDER.rep_cash = async function () {
  if (!can('rep_cash')) { $('#main').innerHTML = '<div class="panel">⛔ لا تملك صلاحية هذا التقرير</div>'; return; }
  const main = $('#main');
  const draw = () => {
    const {from, to} = getRange(), {lines, grand} = cashLedger(from, to), st = statementRows(from, to), n = x => x ? fmtN(x) : '';
    const bold = t => `<b>${t}</b>`;
    const row = (l) => {
      const c = l.cells, o = l.o;
      if (l.kind === 'rev') return [esc(c.day), esc(c.date), L.clinic(c.spec), n(o.kosf), n(o.mixed), n(o.rev), n(o.co), n(o.com), n(o.tax), n(o.ins), c.doctor ? L.doctor(c.doctor) : '', esc(c.doc1), esc(c.co), '', '', '', '', c.pct === '' ? '' : fmtN(c.pct) + '%', n(o.due), n(o.fixed), n(o.paid)];
      if (l.kind === 'exp') return [esc(c.day), esc(c.date), '', '', '', '', '', '', '', '', '', '', '', n(o.amount), esc(c.bayan), esc(c.doc2), esc(c.notes), '', '', '', ''];
      return [bold('إجمالي اليوم'), bold(esc(c.date)), '', bold(n(o.kosf)), bold(n(o.mixed)), bold(n(o.rev)), bold(n(o.co)), bold(n(o.com)), bold(n(o.tax)), bold(n(o.ins)), '', '', '', bold(n(o.amount)), '', '', '', '', bold(n(o.due)), '', bold(n(o.paid))];
    };
    const g = grand, tot = [bold('الإجمالي'), '', '', bold(fmtN(g.kosf)), bold(fmtN(g.mixed)), bold(fmtN(g.rev)), bold(fmtN(g.co)), bold(fmtN(g.com)), bold(fmtN(g.tax)), bold(fmtN(g.ins)), '', '', '', bold(fmtN(g.amount)), '', '', '', '', bold(fmtN(g.due)), '', bold(fmtN(g.paid))];
    const head = `<thead><tr><th rowspan="2">اليوم</th><th rowspan="2">التاريخ</th><th rowspan="2">التخصص</th><th colspan="8">العيادات</th><th rowspan="2">رقم المستند</th><th rowspan="2">شركات</th><th colspan="3">المصروفات</th><th rowspan="2">ملاحظات</th><th rowspan="2">نسبة الدكتور</th><th rowspan="2">ح الدكتور</th><th rowspan="2">الثابت</th><th rowspan="2">المدفوع</th></tr>
      <tr><th>كشف</th><th>متنوع</th><th>كشف ومتنوع</th><th>شركات</th><th>لجنة</th><th>ضرائب مرتبات</th><th>تأمين صحي</th><th>اسم الدكتور</th><th>المبلغ</th><th>البيان</th><th>رقم المستند</th></tr></thead>`;
    main.innerHTML = `${pageHead('حركة الخزينة', '🏦', 'lime')}${rangeBar()}<div class="bar noprint">${window.exportButtons}</div>
    ${kpiRow([['إجمالي إيراد اليوم', fmtN(st.dayRev), 'orange'], ['المصروفات (بخلاف الأطباء)', fmtN(st.expO), 'gold'], ['المدفوع للأطباء', fmtN(st.paid), 'lime'], ['الصافي', fmtN(st.net), 'teal'], ['الضريبة', fmtN(st.tax), 'pink']])}
    <div class="tbl-wrap"><table>${head}<tbody>${lines.length ? lines.map(l => `<tr${l.kind === 'day' ? ' class="daytot"' : ''}>${row(l).map(x => `<td>${x}</td>`).join('')}</tr>`).join('') : '<tr><td colspan="21" class="empty">لا توجد حركة في هذه الفترة</td></tr>'}</tbody>${lines.length ? `<tfoot><tr>${tot.map(x => `<td>${x}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  };
  S.view = {refresh: draw, exportData: () => {
    const {from, to} = getRange(), {lines, grand} = cashLedger(from, to), N = x => x ? +x.toFixed(2) : '';
    const rows = [['', '', '', 'العيادات', '', '', '', '', '', '', '', '', '', 'المصروفات', '', '', '', '', '', '', ''],
      ['اليوم', 'التاريخ', 'التخصص', 'كشف', 'متنوع', 'كشف ومتنوع', 'شركات', 'لجنة', 'ضرائب مرتبات', 'تأمين صحي', 'اسم الدكتور', 'رقم المستند', 'شركات', 'المبلغ', 'البيان', 'رقم المستند', 'ملاحظات', 'نسبة الدكتور', 'ح الدكتور', 'الثابت', 'المدفوع']];
    lines.forEach(l => { const c = l.cells, o = l.o;
      if (l.kind === 'rev') rows.push([c.day, c.date, c.spec, N(o.kosf), N(o.mixed), N(o.rev), N(o.co), N(o.com), N(o.tax), N(o.ins), c.doctor, c.doc1, c.co, '', '', '', '', c.pct, N(o.due), N(o.fixed), N(o.paid)]);
      else if (l.kind === 'exp') rows.push([c.day, c.date, '', '', '', '', '', '', '', '', '', '', '', N(o.amount), c.bayan, c.doc2, c.notes, '', '', '', '']);
      else rows.push(['إجمالي اليوم', c.date, '', N(o.kosf), N(o.mixed), N(o.rev), N(o.co), N(o.com), N(o.tax), N(o.ins), '', '', '', N(o.amount), '', '', '', '', N(o.due), '', N(o.paid)]); });
    rows.push(['الإجمالي', '', '', N(grand.kosf), N(grand.mixed), N(grand.rev), N(grand.co), N(grand.com), N(grand.tax), N(grand.ins), '', '', '', N(grand.amount), '', '', '', '', N(grand.due), '', N(grand.paid)]);
    return [{name: 'حركة الخزينة', rows}]; }};
  draw();
};
