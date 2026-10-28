/* ============ شاشة مستحقات الأطباء: المستحق / المدفوع / المتبقي حسب زيارات الفترة (اليوم افتراضياً) ============ */
'use strict';
function duesRows(from, to) {
  const m = new Map();
  accounts(from, to).forEach(r => { let x = m.get(r.name); if (!x) m.set(r.name, x = {name: r.name, clinics: new Set(), visits: 0, total: 0, tax: 0, right: 0, ops: 0, paid: 0}); if (r.clinic) x.clinics.add(r.clinic); x.visits += r.visits; x.total += r.total; x.tax += r.tax; x.right += r.right; x.ops += r.ops; });
  S.data.expenses.filter(e => e.doctor && e.date >= from && e.date <= to).forEach(e => { let x = m.get(e.doctor); if (!x) m.set(e.doctor, x = {name: e.doctor, clinics: new Set(), visits: 0, total: 0, tax: 0, right: 0, ops: 0, paid: 0}); x.paid += +e.amount || 0; });
  return [...m.values()].map(x => Object.assign(x, {due: x.right + x.ops, rest: x.right + x.ops - x.paid})).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}
SCREEN_RENDER.dues = async function () {
  if (!can('dues')) { $('#main').innerHTML = '<div class="panel">⛔ لا تملك صلاحية فتح هذه الشاشة</div>'; return; }
  const main = $('#main');
  const draw = () => {
    const {from, to} = getRange(), rows = duesRows(from, to), pays = S.data.expenses.filter(e => e.doctor && e.date >= from && e.date <= to).sort((a, b) => b.date.localeCompare(a.date));
    const T = k => sum(rows, r => r[k]);
    const tag = r => r.due <= 0 && r.paid <= 0 ? '' : r.rest <= 0.005 ? '<span class="tag c-lime">تم الصرف</span>' : r.paid > 0 ? '<span class="tag c-orange">صرف جزئي</span>' : '<span class="tag c-red">لم يُصرف</span>';
    main.innerHTML = `${pageHead('مستحقات الأطباء', '💵', 'lime')}${rangeBar()}<div class="bar noprint">${window.exportButtons}</div>
    ${kpiRow([['إجمالي المستحق', fmtN(T('due')), 'violet'], ['المدفوع', fmtN(T('paid')), 'lime'], ['المتبقي', fmtN(T('rest')), 'red']])}
    ${tbl(['الطبيب', 'العيادات', 'الزيارات', 'إيراد الزيارات', 'الضريبة', 'مستحق الكشوفات', 'نصيب العمليات', 'إجمالي المستحق', 'المدفوع', 'المتبقي', 'الحالة', ''],
      rows.map(r => [L.doctor(r.name), esc([...r.clinics].join('، ')), r.visits, fmtN(r.total), fmtN(r.tax), fmtN(r.right), fmtN(r.ops), `<b>${fmtN(r.due)}</b>`, fmtN(r.paid), `<b>${fmtN(r.rest)}</b>`, tag(r), r.rest > 0.005 ? `<button class="btn sm c-lime" data-act="paydoc" data-v="${esc(r.name)}" data-r="${r.rest}">💵 صرف</button>` : '']),
      ['الإجمالي', '', T('visits'), fmtN(T('total')), fmtN(T('tax')), fmtN(T('right')), fmtN(T('ops')), fmtN(T('due')), fmtN(T('paid')), fmtN(T('rest')), '', ''])}
    ${sect('سجل المدفوعات')}${tbl(['التاريخ', 'الطبيب', 'المبلغ', 'ملاحظات', 'سجّله', ''], pays.map(e => [esc(e.date), L.doctor(e.doctor), fmtN(e.amount), esc(e.notes), esc(e.registeredBy), `<button class="btn sm c-red noprint" data-act="delpay" data-id="${e.id}">🗑️</button>`]), ['', 'الإجمالي', fmtN(sum(pays, e => e.amount)), '', '', ''])}`;
  };
  S.view = {refresh: draw}; draw();
};
Acts.paydoc = el => {
  const name = el.dataset.v, rest = Math.max(0, Math.round((+el.dataset.r || 0) * 100) / 100), {from, to} = getRange();
  const def = from === to && validDate(from) ? from : today();
  const m = modal(`<form id="pf" style="min-width:min(420px,86vw)"><h3>💵 صرف مستحقات — ${esc(name)}</h3><small>${esc(rangeLabel())} — المتبقي: ${fmtN(rest)}</small>
    <div class="grid" style="margin-top:10px"><div class="fld"><label>تاريخ الصرف</label>${dateFld('date', def)}</div><div class="fld"><label>المبلغ</label><input name="amount" type="number" step="any" value="${rest}"></div><div class="fld full"><label>ملاحظات</label><input name="notes"></div></div>
    <div class="actions"><button class="btn c-lime" type="submit">حفظ الصرف</button><button class="btn ghost" type="button" data-act="closemodal">إلغاء</button></div></form>`);
  $('#pf', m).onsubmit = ev => { ev.preventDefault(); guard($('button[type=submit]', m), async () => {
    const v = readForm($('#pf', m)); if (!validDate(v.date)) throw new Error('التاريخ يجب أن يكون yyyy/mm/dd'); if (!(+v.amount > 0)) throw new Error('أدخل مبلغاً أكبر من صفر');
    await API.call('save', {entity: 'expenses', record: {date: v.date, category: 'مستحقات أطباء', doctor: name, amount: +v.amount, notes: v.notes}});
    await loadAll(['expenses']); m.remove(); toast('تم تسجيل الصرف ✔'); refreshView();
  }); };
};
Acts.delpay = async el => { if (!await confirmBox('حذف هذا الصرف؟ سيعود المبلغ إلى المتبقي.')) return; await guard(null, async () => { await API.call('delete', {entity: 'expenses', id: el.dataset.id}); await loadAll(['expenses']); toast('تم الحذف'); refreshView(); }); };
