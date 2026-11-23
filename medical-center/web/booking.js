/* ============ شاشة الحجوزات (العيادات والعمليات) ============ */
const BK_ST = {booked: 'محجوز', came: 'حضر', done: 'تم', cancel: 'ملغي'};
const BK_STC = {booked: 'blue', came: 'orange', done: 'lime', cancel: 'red'};
const bkRest = r => Math.max(0, (+r.value || 0) - (+r.bpaid || 0));
const bkTag = r => `<span class="tag c-${BK_STC[r.status] || 'blue'}">${esc(BK_ST[r.status] || 'محجوز')}</span>`;
const bkTurn = (date, docId, doc, ed) => S.data.bookings.filter(x => x.date === date && x.id !== ed && (docId ? x.doctorId === docId : x.doctor === doc) && x.status !== 'cancel').reduce((m, x) => Math.max(m, +x.turn || 0), 0) + 1;

SCREEN_RENDER.bookings = crud({k: 'bookings', ent: 'bookings', t: 'الحجوزات', i: '📅', c: 'teal', add: 'حجز جديد', dated: true,
  fields: [
    {k: 'kind', l: 'نوع الحجز', t: 'seg', opts: [{v: 'عيادة', l: '🩺 عيادة', c: 'teal'}, {v: 'عملية', l: '🏥 عملية', c: 'red'}]},
    {k: 'date', l: 'التاريخ', t: 'date', req: 1},
    {k: 'patient', l: 'اسم المريض', req: 1, sg: 'patients.name'}, {k: 'phone', l: 'رقم التليفون', num: 1},
    {k: 'clinic', l: 'العيادة / القسم', t: 'sel', opts: () => ['', ...clinicNames(), ...EXTRA_CLINICS].map(x => ({v: x, l: x || '— اختر —'}))},
    {k: '_doc', l: 'الطبيب', t: 'docpick', sg: 'clinicdocs'},
    {k: 'turn', l: 'الدور (تلقائي ويمكن تعديله)', t: 'num'},
    {k: 'value', l: 'القيمة', t: 'num'}, {k: 'bpaid', l: 'المدفوع', t: 'num'},
    {k: 'status', l: 'الحالة', t: 'sel', opts: () => Object.keys(BK_ST).map(k => ({v: k, l: BK_ST[k]}))},
    {k: 'notes', l: 'ملاحظات', t: 'area'}],
  cols: [
    {h: 'اليوم', f: r => esc(dayName(r.date))}, {h: 'التاريخ', f: r => esc(r.date)},
    {h: 'النوع', f: r => r.kind === 'عملية' ? '<span class="tag c-red">عملية</span>' : '<span class="tag c-teal">عيادة</span>'},
    {h: 'اسم المريض', f: r => `<b>${esc(r.patient)}</b>`}, {h: 'الطبيب', f: r => esc(r.doctor)},
    {h: 'الدور', f: r => `<b>${esc(r.turn || '')}</b>`},
    {h: 'القيمة', f: r => fmtN(r.value), sum: r => r.value}, {h: 'المدفوع', f: r => fmtN(r.bpaid), sum: r => r.bpaid},
    {h: 'المتبقي', f: r => fmtN(bkRest(r)), sum: bkRest}, {h: 'ملاحظات', f: r => esc(r.notes)}, {h: 'الحالة', f: bkTag},
    {h: 'إجراء', f: r => r.status === 'done' || r.status === 'cancel' ? '' : `<button type="button" class="btn sm c-orange" data-act="bkcame" data-id="${r.id}">✔ حضر</button> <button type="button" class="btn sm c-lime" data-act="bkvisit" data-id="${r.id}">🩺 تحويل لزيارة</button>`}],
  sort: (a, b) => a.date.localeCompare(b.date) || (+a.turn || 0) - (+b.turn || 0),
  before: docAutoReg,
  onChange: (n, f, ctx) => {
    if (n === '*' && !(ctx && ctx.reset)) return;
    if (!['kind', 'clinic', '*'].includes(n)) return;
    const kind = getv(f, 'kind'), c = clinicOf(getv(f, 'clinic'));
    if (kind === 'عيادة') { if (c && c.price != null && !(n === '*' && ctx && ctx.editing)) setv(f, 'value', c.price); }
    else if (n === 'kind' && !(ctx && ctx.editing && getv(f, 'value') !== '')) setv(f, 'value', '');
  },
  defaults: () => ({kind: 'عيادة', date: today(), status: 'booked', turn: bkTurn(today(), '', '')}),
  fill: r => Object.assign({}, r, {_doc: r.doctorId || (S.data.doctors.find(d => d.name === r.doctor) || {}).id || ''}),
  collect: raw => {
    const d = S.data.doctors.find(x => x.id === raw._doc); const o = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
    o.doctor = d ? d.name : ''; o.doctorId = d ? d.id : ''; o.value = +o.value || 0; o.bpaid = +o.bpaid || 0;
    if (!(+o.turn > 0)) o.turn = bkTurn(o.date, o.doctorId, o.doctor, raw.id);
    return o;
  },
  validate: r => (+r.bpaid > +r.value ? 'المدفوع أكبر من القيمة' : '')
});

/* حضر: يغيّر الحالة فقط */
Acts.bkcame = el => guard(el, async () => {
  const r = S.data.bookings.find(x => x.id === el.dataset.id); if (!r) return;
  const x = await API.call('save', {entity: 'bookings', record: Object.assign({}, r, {status: 'came'})}); upsertLocal('bookings', x.record); S.view && S.view.refresh && S.view.refresh(); toast('تم تسجيل الحضور');
});
/* تحويل الحجز إلى زيارة نقدية بنفس البيانات (عملية ← «عمليات جراحية» / عيادة ← «كشف») */
Acts.bkvisit = el => guard(el, async () => {
  const r = S.data.bookings.find(x => x.id === el.dataset.id); if (!r) return;
  if (!r.clinic) throw new Error('حدّد العيادة / القسم في الحجز أولاً (تعديل الحجز)');
  if (!confirm('تحويل حجز «' + r.patient + '» إلى زيارة؟')) return;
  const sg = r.kind === 'عملية';
  const rec = {date: r.date, patient: r.patient, phone: r.phone || '', clinic: r.clinic, doctor: r.doctor || '', doctorId: r.doctorId || '', visitType: sg ? 'عمليات جراحية' : 'كشف', value: +r.value || 0, category: 'cash', paid: +r.bpaid || 0, notes: r.notes || ''};
  if (sg) rec.operation = r.notes || 'عملية';
  const v = await API.call('save', {entity: 'visits', record: rec}); upsertLocal('visits', v.record);
  const x = await API.call('save', {entity: 'bookings', record: Object.assign({}, r, {status: 'done'})}); upsertLocal('bookings', x.record);
  S.view && S.view.refresh && S.view.refresh(); toast('تم إنشاء الزيارة رقم ' + (v.record.serial || '') + ' ✔');
});
