/* ============ شاشات الإدخال: محرك عام + الزيارات + المستخدمين ============ */
'use strict';
window.SCREEN_RENDER = window.SCREEN_RENDER || {};
const stripTags = h => String(h).replace(/<[^>]+>/g, ' ');

function crud(cfg) {
  (window.CRUDS = window.CRUDS || {})[cfg.ent] = cfg;
  return async function () {
    if (!can(cfg.k)) { $('#main').innerHTML = '<div class="panel">⛔ لا تملك صلاحية فتح هذه الشاشة</div>'; return; }
    const main = $('#main'); let editing = null, q = '';
    const fields = cfg.fields, plain = fields.filter(f => !f.grp), grps = cfg.groups || {};
    const defaults = () => Object.assign({}, cfg.defaults ? cfg.defaults() : {});
    const frmHTML = () => `<form id="frm" class="panel accent c-${cfg.c}" autocomplete="off"><h3 id="ftitle">➕ ${esc(cfg.add || 'إضافة جديد')}</h3><div class="grid">${plain.map(f => f.t === 'html' ? f.html() : fieldHTML(f, '')).join('')}</div>${Object.keys(grps).map(g => `<div class="sub hidden" data-grp="${g}"><h4>${esc(grps[g].title)}</h4><div class="grid">${fields.filter(f => f.grp === g).map(f => fieldHTML(f, '')).join('')}</div></div>`).join('')}<div class="actions"><button type="submit" class="btn c-${cfg.c}">💾 حفظ</button><button type="button" class="btn ghost c-${cfg.c}" data-act="frmnew">➕ جديد</button></div></form>`;
    const rows = () => {
      let list = S.data[cfg.ent].slice();
      if (cfg.dated) { const {from, to} = getRange(); list = list.filter(r => r.date >= from && r.date <= to); }
      if (q) list = list.filter(r => JSON.stringify(r).toLowerCase().includes(q));
      return (cfg.sort ? list.sort(cfg.sort) : list.reverse());
    };
    const listHTML = () => {
      const list = rows(); const cols = cfg.cols;
      const body = list.map((r, ri) => `<tr>${cols.map(c => `<td>${c.f(r, ri)}</td>`).join('')}<td>${cfg.ent === 'visits' ? `<button class="btn sm c-lime" data-act="receipt" data-id="${r.id}" title="إيصال كاشير">🧾</button> ` : ''}<button class="btn sm c-teal" data-act="prow" data-e="${cfg.ent}" data-id="${r.id}" title="طباعة البند">🖨️</button> <button class="btn sm c-blue" data-act="edit" data-id="${r.id}">✏️</button> <button class="btn sm c-red" data-act="del" data-id="${r.id}">🗑️</button></td></tr>`).join('');
      const foot = cols.some(c => c.sum) ? `<tfoot><tr>${cols.map((c, i) => `<td>${c.sum ? fmtN(list.reduce((s, r) => s + (+c.sum(r) || 0), 0)) : (i === 0 ? `الإجمالي (${list.length})` : '')}</td>`).join('')}<td></td></tr></tfoot>` : '';
      return `<div class="tbl-wrap"><table><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join('')}<th></th></tr></thead><tbody>${body || `<tr><td colspan="${cols.length + 1}" class="empty">لا توجد بيانات${cfg.dated ? ' في هذه الفترة' : ''}</td></tr>`}</tbody>${foot}</table></div>`;
    };
    const frm = () => $('#frm', main);
    const reset = () => {
      editing = null; const f = frm(); f.reset(); $('#ftitle', f).textContent = `➕ ${cfg.add || 'إضافة جديد'}`;
      const vals = defaults(); fields.forEach(x => { if (!(x.k in vals) && x.t !== 'html') vals[x.k] = (x.t === 'seg' ? x.opts[0].v : (x.t === 'chk' ? false : '')); });
      setForm(f, vals); showGroups(); cfg.onChange && cfg.onChange('*', f, {editing, reset: true});
    };
    const showGroups = () => { const v = readForm(frm()); Object.keys(grps).forEach(g => $(`[data-grp="${g}"]`, frm()).classList.toggle('hidden', !grps[g].show(v))); };
    const draw = () => {
      main.innerHTML = `${pageHead(cfg.t, cfg.i, cfg.c)}${cfg.dated ? rangeBar() : ''}${frmHTML()}<div class="bar noprint"><input type="text" id="srch" placeholder="🔎 بحث…" value="${esc(q)}">${window.exportButtons}${cfg.tools ? cfg.tools() : ''}</div><div id="lst">${listHTML()}</div>`;
      reset(); hydrateImgs(main);
      $('#srch').oninput = e => { q = e.target.value.trim().toLowerCase(); $('#lst').innerHTML = listHTML(); hydrateImgs($('#lst')); };
      frm().addEventListener('change', ev => { showGroups(); cfg.onChange && cfg.onChange(ev.target.name, frm(), {editing}); });
      frm().addEventListener('input', ev => { if (ev.target.matches('[data-sg],input[type=number],[data-dt]')) cfg.onChange && cfg.onChange(ev.target.name, frm(), {editing, typing: true}); });
      frm().onsubmit = ev => { ev.preventDefault(); guard($('button[type=submit]', frm()), async () => {
        const raw = readForm(frm()); let rec = cfg.collect ? cfg.collect(raw) : Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
        for (const f of fields) if (f.req && !String(rec[f.k] == null ? raw[f.k] : rec[f.k]).trim()) throw new Error(`حقل "${f.l}" مطلوب`);
        for (const f of fields) if (f.t === 'date' && rec[f.k] && !validDate(rec[f.k])) throw new Error(`"${f.l}": الصيغة yyyy/mm/dd`);
        if (cfg.validate) { const m = cfg.validate(rec, editing); if (m) throw new Error(m); }
        if (editing) rec.id = editing;
        const r = await API.call('save', {entity: cfg.ent, record: rec});
        if (cfg.after) await cfg.after(r.record, rec);
        await loadAll([cfg.ent]); toast('تم الحفظ ✔'); $('#lst').innerHTML = listHTML(); hydrateImgs($('#lst')); reset();
      }); };
    };
    S.view = {refresh: draw,
      edit: id => { const r = S.data[cfg.ent].find(x => x.id === id); if (!r) return; editing = id; const f = frm(); $('#ftitle', f).textContent = '✏️ تعديل'; setForm(f, cfg.fill ? cfg.fill(r) : r); showGroups(); cfg.onChange && cfg.onChange('*', f, {editing, loaded: true}); f.scrollIntoView({behavior: 'smooth', block: 'start'}); },
      del: async id => { if (!await confirmBox('هل تريد حذف هذا السجل نهائياً؟')) return; await guard(null, async () => { await API.call('delete', {entity: cfg.ent, id}); await loadAll([cfg.ent]); toast('تم الحذف'); $('#lst').innerHTML = listHTML(); if (editing === id) reset(); }); },
      reset};
    draw();
  };
}
Acts.edit = el => S.view && S.view.edit(el.dataset.id);
Acts.del = el => S.view && S.view.del(el.dataset.id);
Acts.frmnew = () => S.view && S.view.reset();
const setv = (frm, n, v) => { const el = $(`[name="${n}"]`, frm); if (el) el.value = v == null ? '' : v; };
const getv = (frm, n) => { const el = $(`[name="${n}"]`, frm); return el ? el.value.trim() : ''; };
const tagCat = c => `<span class="tag c-${CATC[c || 'cash']}">${CAT[c || 'cash']}</span>`;
const thumb = id => id ? `<img class="mini-img" data-fid="${esc(id)}" data-act="lightbox" alt="">` : '';
const docOpts = clinic => [{v: '', l: '— اختر الطبيب —'}, ...S.data.doctors.filter(d => !clinic || d.clinic === clinic).map(d => ({v: d.id, l: clinic ? d.name : `${d.name} — ${d.clinic}`}))];
const docSelectHTML = (clinic, cur) => docOpts(clinic).map(o => `<option value="${esc(o.v)}" ${o.v === cur ? 'selected' : ''}>${esc(o.l)}</option>`).join('');

/* ---------- العاملين ---------- */
SCREEN_RENDER.staff = crud({k: 'staff', ent: 'staff', t: 'العاملين', i: '👥', c: 'lime', add: 'موظف جديد',
  fields: [{k: 'code', l: 'كود الموظف (تلقائي)', t: 'ro'}, {k: 'name', l: 'الاسم', req: 1, sg: 'staff.name'}, {k: 'nationalId', l: 'الرقم القومي', num: 1, sg: 'staff.nationalId'}, {k: 'idPhoto', l: 'صورة الرقم القومي', t: 'img'}, {k: 'photo', l: 'الصورة الشخصية', t: 'img'}],
  cols: [{h: 'الكود', f: r => r.code}, {h: 'الاسم', f: r => esc(r.name)}, {h: 'الرقم القومي', f: r => esc(r.nationalId)}, {h: 'صورة الرقم القومي', f: r => thumb(r.idPhoto)}, {h: 'الصورة', f: r => thumb(r.photo)}],
  sort: (a, b) => (a.code || 0) - (b.code || 0),
  defaults: () => ({code: S.data.staff.reduce((m, x) => Math.max(m, x.code || 0), 0) + 1})
});

/* ---------- الأطباء ---------- */
SCREEN_RENDER.doctors = crud({k: 'doctors', ent: 'doctors', t: 'الأطباء', i: '👨‍⚕️', c: 'violet', add: 'طبيب جديد',
  fields: [{k: 'code', l: 'كود الطبيب (تلقائي)', t: 'ro'}, {k: 'name', l: 'اسم الطبيب', req: 1, sg: 'doctors.name'}, {k: 'clinic', l: 'العيادة', t: 'sel', req: 1, opts: () => ['', ...clinicNames()]}, {k: 'phone', l: 'رقم التليفون', num: 1}, {k: 'nationalId', l: 'رقم البطاقة', num: 1}, {k: 'idPhoto', l: 'صورة البطاقة', t: 'img'}, {k: 'syndicatePhoto', l: 'صورة الكارنية', t: 'img'}, {k: 'photo', l: 'الصورة الشخصية', t: 'img'}, {k: 'hireDate', l: 'تاريخ التعيين', t: 'date'}, {k: 'percent', l: 'نسبة الطبيب %', t: 'num'}, {k: 'fixed', l: 'الثابت (الفكسيد) يومياً', t: 'num'}, {k: 'opPercent', l: 'نسبة العمليات %', t: 'num'}],
  cols: [{h: 'الكود', f: r => r.code}, {h: 'الطبيب', f: r => L.doctor(r.name)}, {h: 'العيادة', f: r => L.clinic(r.clinic)}, {h: 'تاريخ التعيين', f: r => esc(r.hireDate)}, {h: 'النسبة %', f: r => fmtN(r.percent)}, {h: 'الثابت', f: r => fmtN(r.fixed)}, {h: 'آخر أجر مستحق (تلقائي)', f: r => { const d = lastDue(r); return d ? `<b>${fmtN(d.amount)}</b> <small>(${d.date})</small>` : '—'; }}, {h: 'البطاقة', f: r => thumb(r.idPhoto)}, {h: 'الكارنية', f: r => thumb(r.syndicatePhoto)}, {h: 'الصورة', f: r => thumb(r.photo)}],
  sort: (a, b) => (a.code || 0) - (b.code || 0),
  defaults: () => ({code: S.data.doctors.reduce((m, x) => Math.max(m, x.code || 0), 0) + 1, hireDate: today()}),
  validate: (r, ed) => S.data.doctors.some(d => d.id !== ed && d.name === r.name && d.clinic === r.clinic) ? 'هذا الطبيب مسجل في نفس العيادة' : ''
});

/* ---------- الخدمات ---------- */
SCREEN_RENDER.services = crud({k: 'services', ent: 'services', t: 'الخدمات (عيادات – عمليات – أشعة – تحاليل – خدمات)', i: '💉', c: 'orange', add: 'خدمة جديدة',
  fields: [{k: 'type', l: 'النوع', t: 'seg', opts: Object.keys(SVTYPE).map(v => ({v, l: SVTYPE[v], c: SVCOLOR[v]}))}, {k: 'name', l: 'اسم الخدمة', req: 1, sg: 'services.name'}, {k: 'price', l: 'القيمة', t: 'num', req: 1}, {k: 'tax', l: 'الضريبة (لكل زيارة)', t: 'num'}],
  cols: [{h: 'النوع', f: r => `<span class="tag c-${SVCOLOR[r.type] || 'teal'}">${SVTYPE[r.type] || ''}</span>`}, {h: 'الخدمة', f: r => r.type === 'clinic' ? L.clinic(r.name) : esc(r.name)}, {h: 'القيمة', f: r => fmtN(r.price)}, {h: 'الضريبة', f: r => fmtN(r.tax)}],
  sort: (a, b) => Object.keys(SVTYPE).indexOf(a.type) - Object.keys(SVTYPE).indexOf(b.type) || a.name.localeCompare(b.name, 'ar'),
  validate: (r, ed) => S.data.services.some(s => s.id !== ed && s.type === r.type && s.name === r.name) ? 'الخدمة مسجلة من قبل' : '',
  tools: () => can('services') ? '<button class="btn sm c-gold" data-act="importseed" title="يضيف الناقص فقط من بيانات الإكسيل ولا يعدّل ما عدّلته">📥 استيراد من الإكسيل</button>' : ''
});
Acts.importseed = async el => {
  const SD = window.SEED; if (!SD) return toast('لا توجد بيانات للاستيراد');
  if (!await confirmBox('سيتم إضافة العيادات والعمليات والأشعة والتحاليل والخدمات والأطباء والشركات غير الموجودة فقط من ملف الإكسيل، دون تغيير ما عدّلته. متابعة؟')) return;
  await guard(el, async () => {
    const jobs = [];
    (SD.services || []).forEach(x => { if (!S.data.services.some(s => s.type === x.type && s.name === x.name)) jobs.push(['services', x]); });
    if (can('doctors')) (SD.doctors || []).forEach(x => { if (!S.data.doctors.some(d => d.name === x.name && d.clinic === x.clinic)) jobs.push(['doctors', x]); });
    if (can('companies')) (SD.companies || []).forEach(x => { if (!S.data.companies.some(c => c.name === x.name)) jobs.push(['companies', x]); });
    if (!jobs.length) return toast('كل البيانات موجودة بالفعل');
    for (let i = 0; i < jobs.length; i += 5) await Promise.all(jobs.slice(i, i + 5).map(([entity, record]) => API.call('save', {entity, record})));
    await loadAll(['services', 'doctors', 'companies']); toast(`تمت إضافة ${jobs.length} سجل ✔`); refreshView();
  });
};

/* ---------- المرضى ---------- */
SCREEN_RENDER.patients = crud({k: 'patients', ent: 'patients', t: 'المرضى', i: '🧑‍🤝‍🧑', c: 'blue', add: 'مريض جديد',
  fields: [{k: 'name', l: 'اسم المريض', req: 1, sg: 'patients'}, {k: 'phone', l: 'رقم الهاتف', num: 1}],
  cols: [{h: 'الاسم', f: r => L.patient(r.name)}, {h: 'الهاتف', f: r => esc(r.phone)}, {h: 'عدد الزيارات', f: r => S.data.visits.filter(v => v.patient === r.name).length}, {h: 'آخر زيارة', f: r => { const v = lastVisitOf(r.name, r.phone); return v ? `${v.date} — ${esc(v.visitType)}` : '—'; }}],
  validate: (r, ed) => S.data.patients.some(p => p.id !== ed && p.name === r.name && (p.phone || '') === (r.phone || '')) ? 'المريض مسجل من قبل بنفس الهاتف' : ''
});

/* ---------- شركات التأمين ---------- */
SCREEN_RENDER.companies = crud({k: 'companies', ent: 'companies', t: 'شركات التأمين', i: '🏢', c: 'cyan', add: 'شركة جديدة',
  fields: [{k: 'name', l: 'اسم الشركة', req: 1, sg: 'companies'}, {k: 'fee', l: 'قيمة الكشف', t: 'num', req: 1}, {k: 'contact', l: 'مسئول التعاقد', sg: 'companies.contact'}],
  cols: [{h: 'الشركة', f: r => L.company(r.name)}, {h: 'قيمة الكشف', f: r => fmtN(r.fee)}, {h: 'مسئول التعاقد', f: r => esc(r.contact)}, {h: 'عدد الزيارات', f: r => S.data.visits.filter(v => v.company === r.name).length}],
  validate: (r, ed) => S.data.companies.some(c => c.id !== ed && c.name === r.name) ? 'الشركة مسجلة من قبل' : ''
});

/* ---------- المصروفات ---------- */
SCREEN_RENDER.expenses = crud({k: 'expenses', ent: 'expenses', t: 'المصروفات', i: '💸', c: 'gold', add: 'مصروف جديد', dated: true,
  fields: [{k: 'date', l: 'التاريخ', t: 'date', req: 1}, {k: 'category', l: 'بند المصروف', sg: 'expcats'}, {k: 'doctor', l: 'مستحق طبيب (اسم الطبيب)', sg: 'doctors', ph: 'اتركه فارغاً إن لم يكن صرفاً لطبيب'}, {k: 'dueDate', l: 'عن يوم (استحقاق الطبيب)', t: 'date'}, {k: 'amount', l: 'المبلغ', t: 'num', req: 1}, {k: 'docNo', l: 'رقم المستند'}, {k: 'notes', l: 'البيان / ملاحظات', t: 'area'}],
  cols: [{h: 'التاريخ', f: r => esc(r.date)}, {h: 'رقم المستند', f: r => esc(r.docNo)}, {h: 'البند', f: r => esc(r.category)}, {h: 'مستحق طبيب', f: r => r.doctor ? L.doctor(r.doctor) : ''}, {h: 'عن يوم', f: r => r.doctor ? esc(r.dueDate || r.date) : ''}, {h: 'المبلغ', f: r => fmtN(r.amount), sum: r => r.amount}, {h: 'ملاحظات', f: r => esc(r.notes)}, {h: 'سجّله', f: r => esc(r.registeredBy)}],
  sort: (a, b) => b.date.localeCompare(a.date),
  defaults: () => ({date: getRange().from === getRange().to && validDate(getRange().from) ? getRange().from : today()}),
  collect: raw => { const o = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_'))); if (o.doctor && !o.category) o.category = 'مستحقات أطباء'; if (!o.doctor) o.dueDate = ''; else if (!o.dueDate) o.dueDate = o.date; return o; },
  validate: r => !r.category && !r.doctor ? 'اختر بند المصروف أو اسم الطبيب' : (r.doctor && !S.data.doctors.some(d => d.name === r.doctor) ? 'اسم الطبيب غير مسجل في شاشة الأطباء' : '')
});

/* ---------- العهد والسلف ---------- */
SCREEN_RENDER.custody = crud({k: 'custody', ent: 'custody', t: 'العهد والسلف', i: '💼', c: 'blue', add: 'حركة جديدة', dated: true,
  fields: [{k: 'date', l: 'التاريخ', t: 'date', req: 1}, {k: 'person', l: 'اسم صاحب العهدة / السلفة', req: 1, sg: 'custperson'}, {k: 'kind', l: 'النوع', t: 'seg', opts: [{v: 'عهدة', l: 'عهدة', c: 'blue'}, {v: 'سلفة', l: 'سلفة', c: 'orange'}]}, {k: 'dir', l: 'الحركة', t: 'seg', opts: [{v: 'out', l: 'صرف (مدين)', c: 'red'}, {v: 'in', l: 'رد / تسوية (دائن)', c: 'lime'}]}, {k: 'amount', l: 'المبلغ', t: 'num', req: 1}, {k: 'docNo', l: 'رقم المستند'}, {k: 'notes', l: 'ملاحظات', t: 'area'}],
  cols: [{h: 'التاريخ', f: r => esc(r.date)}, {h: 'الاسم', f: r => esc(r.person)}, {h: 'النوع', f: r => esc(r.kind)}, {h: 'مدين (صرف)', f: r => r.dir === 'out' ? fmtN(r.amount) : '', sum: r => r.dir === 'out' ? r.amount : 0}, {h: 'دائن (رد)', f: r => r.dir === 'in' ? fmtN(r.amount) : '', sum: r => r.dir === 'in' ? r.amount : 0}, {h: 'رقم المستند', f: r => esc(r.docNo)}, {h: 'ملاحظات', f: r => esc(r.notes)}],
  sort: (a, b) => b.date.localeCompare(a.date),
  defaults: () => ({date: today(), kind: 'عهدة', dir: 'out'})
});

/* ---------- العمليات ---------- */
const opsShare = f => { const c = opCalc({value: getv(f, 'value'), doctorPercent: getv(f, 'doctorPercent'), anesthesia: getv(f, 'anesthesia'), deductAnes: ($('[name=deductAnes]', f) || {}).checked}); setv(f, '_share', fmtN(c.surgeon)); };
SCREEN_RENDER.operations = crud({k: 'operations', ent: 'operations', t: 'العمليات', i: '🏥', c: 'red', add: 'عملية جديدة', dated: true,
  fields: [{k: 'date', l: 'التاريخ', t: 'date', req: 1}, {k: 'patient', l: 'اسم المريض', req: 1, sg: 'patients'}, {k: 'operation', l: 'العملية', req: 1, sg: 'opnames'}, {k: '_doc', l: 'الطبيب', t: 'sel', opts: () => docOpts('')}, {k: 'value', l: 'قيمة العملية', t: 'num', req: 1}, {k: '_anes', l: 'تخدير — اسم الطبيب', t: 'sel', opts: () => docOpts('')}, {k: 'anesthesia', l: 'تخدير — القيمة', t: 'num'}, {k: 'deductAnes', l: 'خصم التخدير من أجر العملية', t: 'chk', l2: 'احسب حساب الطبيب بعد خصم قيمة التخدير'}, {k: 'doctorPercent', l: 'نسبة الطبيب %', t: 'num'}, {k: '_share', l: 'نصيب الطبيب', t: 'ro'}, {k: 'notes', l: 'ملاحظات', t: 'area'}],
  cols: [{h: 'التاريخ', f: r => esc(r.date)}, {h: 'المريض', f: r => L.patient(r.patient)}, {h: 'العملية', f: r => esc(r.operation)}, {h: 'الطبيب', f: r => L.doctor(r.doctor)}, {h: 'القيمة', f: r => fmtN(r.value), sum: r => r.value}, {h: 'تخدير', f: r => r.anesthesia ? `${esc(r.anesthetist || '')} ${fmtN(r.anesthesia)}${isOn(r.deductAnes) ? ' (مخصوم)' : ''}` : ''}, {h: 'نصيب الطبيب', f: r => fmtN(opCalc(r).surgeon), sum: r => opCalc(r).surgeon}, {h: 'ملاحظات', f: r => esc(r.notes)}],
  sort: (a, b) => b.date.localeCompare(a.date),
  defaults: () => ({date: today()}),
  collect: raw => { const d = S.data.doctors.find(x => x.id === raw._doc); const o = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_'))); o.doctorId = d ? d.id : ''; o.doctor = d ? d.name : ''; o.clinic = d ? d.clinic : ''; const a = S.data.doctors.find(x => x.id === raw._anes); o.anesthetistId = a ? a.id : ''; o.anesthetist = a ? a.name : ''; o.deductAnes = raw.deductAnes ? '1' : ''; return o; },
  fill: r => Object.assign({}, r, {deductAnes: isOn(r.deductAnes), _anes: r.anesthetistId || (S.data.doctors.find(d => d.name === r.anesthetist) || {}).id || '', _doc: r.doctorId || (S.data.doctors.find(d => d.name === r.doctor) || {}).id || ''}),
  onChange: (n, f) => { if (n === 'operation') { const sv = S.data.services.find(x => x.type === 'operation' && x.name === getv(f, 'operation')); if (sv && sv.price && !getv(f, 'value')) setv(f, 'value', sv.price); } if (n === '_doc') { const d = S.data.doctors.find(x => x.id === getv(f, '_doc')); if (d) setv(f, 'doctorPercent', d.opPercent || 0); } if (['_doc', 'value', 'doctorPercent', 'anesthesia', 'deductAnes', '*'].includes(n)) opsShare(f); }
});

/* ---------- الزيارات ---------- */
function visitAuto(f, why) {
  const clinic = getv(f, 'clinic'), vt = getv(f, 'visitType'), cat = getv(f, 'category'), svc = getv(f, 'service');
  const c = clinicOf(clinic), sv = S.data.services.find(s => s.name === svc && s.type !== 'clinic');
  if (why === 'clinic') { setv(f, 'tax', c ? c.tax || 0 : 0); }
  if (['clinic', 'visitType', 'category', 'company', 'service'].includes(why)) {
    let val = null;
    if (sv && why === 'service') val = sv.price;
    else if ((vt === 'كشف' || vt === 'استشارة') && c) val = c.price;
    if (val != null && (why !== 'service' || sv)) setv(f, 'value', val);
  }
  const co = S.data.companies.find(x => x.name === getv(f, 'company')), fee = co && co.fee > 0 && vt === 'كشف' ? co.fee : (+getv(f, 'value') || 0);
  setv(f, '_cofee', fmtN(fee)); setv(f, '_req', fmtN(cat === 'company' ? fee * (+getv(f, 'patientPct') || 0) / 100 : 0));
  const dsc = (+getv(f, 'value') || 0) * (+getv(f, 'discount') || 0) / 100; setv(f, '_net', fmtN((+getv(f, 'value') || 0) - dsc));
}
function visitLast(f, ctx) {
  const lv = lastVisitOf(getv(f, 'patient'), getv(f, 'phone'), ctx.editing, getv(f, 'date'));
  setv(f, '_lastDate', lv ? lv.date : ''); setv(f, '_lastType', lv ? `${lv.visitType}${lv.service ? ' — ' + lv.service : ''} (${lv.clinic || ''})` : '');
}
SCREEN_RENDER.visits = crud({k: 'visits', ent: 'visits', t: 'الزيارات', i: '🩺', c: 'teal', add: 'زيارة جديدة', dated: true,
  groups: {co: {title: '🏢 بيانات الشركة', show: v => v.category === 'company'}, ins: {title: '🛡️ بيانات التأمين', show: v => v.category === 'insurance'}},
  fields: [
    {k: 'serial', l: 'المسلسل (تلقائي)', t: 'ro'}, {k: '_day', l: 'اليوم', t: 'ro'}, {k: 'date', l: 'تاريخ الزيارة', t: 'date', req: 1},
    {k: 'patient', l: 'اسم المريض', req: 1, sg: 'patients'}, {k: 'phone', l: 'رقم التليفون', num: 1},
    {k: 'clinic', l: 'العيادة / القسم', t: 'sel', req: 1, opts: () => ['', ...clinicNames(), ...EXTRA_CLINICS]},
    {k: '_doc', l: 'الطبيب المعالج', t: 'sel', opts: () => docOpts('')},
    {k: 'visitType', l: 'الزيارة', t: 'sel', opts: VTYPES}, {k: 'service', l: 'البيان / الخدمة', sg: 'bayan'},
    {k: 'value', l: 'القيمة', t: 'num', req: 1}, {k: 'tax', l: 'الضريبة', t: 'ro'},
    {k: 'category', l: 'نوع الزيارة', t: 'seg', w: 'full', opts: Object.keys(CAT).map(k => ({v: k, l: CAT[k], c: CATC[k]}))},
    {k: 'payMethod', l: 'طريقة الدفع', t: 'seg', w: 'full', opts: [{v: 'cash', l: '💵 نقدي', c: 'lime'}, {v: 'visa', l: '💳 فيزا', c: 'blue'}, {v: 'master', l: '💳 ماستر كارد', c: 'orange'}]}, {k: 'payRef', l: 'رقم مرجع عملية POS / آخر 4 أرقام'},
    {k: 'notes', l: 'ملاحظات', t: 'area'}, {k: '_by', l: 'مسئول التسجيل', t: 'ro'},
    {k: 'discount', l: 'نسبة الخصم %', t: 'num', grp: 'ins'}, {k: '_net', l: 'الصافي بعد الخصم', t: 'ro', grp: 'ins'},
    {k: 'company', l: 'اسم الشركة', sg: 'companies', grp: 'co'}, {k: 'formNo', l: 'رقم النموذج', grp: 'co', sg: 'visits.formNo'}, {k: 'formPhoto', l: 'صورة النموذج', t: 'img', grp: 'co'},
    {k: 'birthDate', l: 'تاريخ الميلاد', t: 'date', grp: 'co'}, {k: 'cardNo', l: 'رقم الكارنية', grp: 'co', sg: 'visits.cardNo'}, {k: 'cardPhoto', l: 'صورة الكارنية', t: 'img', grp: 'co'}, {k: 'nationalId', l: 'الرقم القومي', num: 1, grp: 'co'},
    {k: '_cofee', l: 'قيمة كشف الشركة (أساس الحساب)', t: 'ro', grp: 'co'}, {k: 'patientPct', l: 'نسبة تحمل المريض %', t: 'num', grp: 'co'}, {k: '_req', l: 'المبلغ المطلوب من المريض', t: 'ro', grp: 'co'},
    {k: '_lastDate', l: 'آخر تاريخ زيارة (تلقائي)', t: 'ro', grp: 'co'}, {k: '_lastType', l: 'نوع آخر زيارة (تلقائي)', t: 'ro', grp: 'co'}
  ],
  cols: [{h: 'م', f: r => r.serial}, {h: 'التاريخ', f: r => esc(r.date)}, {h: 'المريض', f: r => L.patient(r.patient)}, {h: 'العيادة', f: r => L.clinic(r.clinic)}, {h: 'الطبيب', f: r => L.doctor(r.doctor)}, {h: 'الزيارة', f: r => esc(r.visitType)}, {h: 'البيان', f: r => esc(r.service)}, {h: 'الدفع', f: r => r.payMethod === 'visa' ? '💳 فيزا' : r.payMethod === 'master' ? '💳 ماستر' : 'نقدي'}, {h: 'القيمة', f: r => fmtN(r.value), sum: r => r.value}, {h: 'النوع', f: r => tagCat(r.category)}, {h: 'الشركة', f: r => L.company(r.company)}, {h: 'رقم النموذج', f: r => esc(r.formNo)}, {h: 'صورة النموذج', f: r => thumb(r.formPhoto)}, {h: 'الكارنية', f: r => esc(r.cardNo)}, {h: 'صورة الكارنية', f: r => thumb(r.cardPhoto)}, {h: 'تحمل المريض', f: r => r.category === 'company' ? fmtN(patientShare(r)) : '', sum: patientShare}, {h: 'الخصم', f: r => r.category === 'insurance' ? fmtN(discountAmt(r)) + ' (' + fmtN(r.discount) + '%)' : '', sum: discountAmt}, {h: 'الضريبة', f: r => fmtN(r.tax), sum: r => r.tax}, {h: 'سجّلها', f: r => esc(r.registeredBy)}],
  sort: (a, b) => (b.date + String(1e6 + (b.serial || 0))).localeCompare(a.date + String(1e6 + (a.serial || 0))),
  defaults: () => { const {from, to} = getRange(); const d = from === to && validDate(from) ? from : today(); return {serial: S.data.visits.reduce((m, x) => Math.max(m, x.serial || 0), 0) + 1, date: d, _day: dayName(d), visitType: 'كشف', category: 'cash', payMethod: 'cash', _by: S.user.username, tax: 0, patientPct: 0, discount: 0}; },
  collect: raw => {
    const d = S.data.doctors.find(x => x.id === raw._doc); const o = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
    o.doctorId = d ? d.id : ''; o.doctor = d ? d.name : '';
    if (o.category !== 'company') { ['company', 'formNo', 'formPhoto', 'cardNo', 'cardPhoto', 'nationalId', 'birthDate'].forEach(k => o[k] = ''); o.patientPct = 0; }
    if (o.category !== 'insurance') o.discount = 0;
    return o;
  },
  fill: r => Object.assign({}, r, {_doc: r.doctorId || (S.data.doctors.find(d => d.name === r.doctor && d.clinic === r.clinic) || S.data.doctors.find(d => d.name === r.doctor) || {}).id || '', _day: dayName(r.date), _by: r.registeredBy || S.user.username}),
  validate: r => /\d{12,}/.test(String(r.payRef || '').replace(/[\s-]/g, '')) ? 'لا تُدخل رقم البطاقة كاملاً — اكتب آخر 4 أرقام أو رقم مرجع العملية فقط' : (r.category === 'company' && !r.company ? 'اختر اسم الشركة' : ''),
  after: async (rec, sent) => {
    const p = S.data.patients.find(x => x.name === sent.patient);
    try { if (!p) await API.call('save', {entity: 'patients', record: {name: sent.patient, phone: sent.phone}}); else if (sent.phone && p.phone !== sent.phone) await API.call('save', {entity: 'patients', record: Object.assign({}, p, {phone: sent.phone})}); await loadAll(['patients']); } catch (e) {}
  },
  onChange: (n, f, ctx) => {
    if (n === '*') { if (ctx.reset) $('[name=_doc]', f).innerHTML = docSelectHTML('', ''); else { const cur = getv(f, '_doc'); $('[name=_doc]', f).innerHTML = docSelectHTML(getv(f, 'clinic'), cur); setv(f, '_doc', cur); } visitLast(f, ctx); visitAuto(f, '*'); return; }
    if (n === 'date') { setv(f, '_day', dayName(getv(f, 'date'))); visitLast(f, ctx); }
    if (n === 'patient') { const p = S.data.patients.find(x => x.name === getv(f, 'patient')); if (p && p.phone && !ctx.typing) setv(f, 'phone', p.phone); visitLast(f, ctx); }
    if (n === 'phone') visitLast(f, ctx);
    if (n === 'clinic') { const cur = getv(f, '_doc'); $('[name=_doc]', f).innerHTML = docSelectHTML(getv(f, 'clinic'), cur); const only = S.data.doctors.filter(d => d.clinic === getv(f, 'clinic')); setv(f, '_doc', only.some(d => d.id === cur) ? cur : (only.length === 1 ? only[0].id : '')); }
    if (['clinic', 'visitType', 'category', 'company', 'service', 'value', 'patientPct', 'discount'].includes(n) && !ctx.typing) visitAuto(f, n);
    if (n === 'value' || n === 'patientPct' || n === 'discount') visitAuto(f, n);
  }
});

/* ---------- المستخدمين والصلاحيات ---------- */
const PERM_ITEMS = [...SCREENS.filter(s => s.k !== 'admin').map(s => ({k: s.k, l: s.t})), {k: 'dashboard', l: 'الشاشة الرئيسية (الإحصائيات)'}, ...REPS.map(r => ({k: r.k, l: 'تقرير: ' + r.t}))];
SCREEN_RENDER.users = crud({k: 'users', ent: 'users', t: 'المستخدمين والصلاحيات', i: '🔐', c: 'pink', add: 'مستخدم جديد',
  fields: [{k: 'username', l: 'اسم المستخدم', req: 1}, {k: 'password', l: 'كلمة السر (اتركها فارغة للإبقاء)', pw: 1}, {k: 'nationalId', l: 'الرقم القومي', num: 1}, {k: 'birthDate', l: 'تاريخ الميلاد', t: 'date'}, {k: 'isAdmin', l: 'مدير النظام (كل الصلاحيات)', t: 'chk', l2: 'مدير'}, {k: 'active', l: 'الحساب', t: 'chk', l2: 'مفعّل'},
    {k: '_perms', t: 'html', html: () => `<div class="fld full"><label>الصلاحيات — الشاشات والتقارير المسموح فتحها</label><div class="actions" style="margin:0 0 6px"><button type="button" class="btn sm c-lime" data-act="permall" data-v="1">تحديد الكل</button><button type="button" class="btn sm ghost" data-act="permall" data-v="0">إلغاء الكل</button></div><div class="perm-grid">${PERM_ITEMS.map(p => `<label><input type="checkbox" name="p_${p.k}"> ${esc(p.l)}</label>`).join('')}</div></div>`}],
  cols: [{h: 'المستخدم', f: r => esc(r.username)}, {h: 'الرقم القومي', f: r => esc(r.nationalId)}, {h: 'تاريخ الميلاد', f: r => esc(r.birthDate)}, {h: 'الدور', f: r => r.isAdmin ? '<span class="tag c-gold">مدير</span>' : '<span class="tag c-blue">مستخدم</span>'}, {h: 'الحالة', f: r => r.active ? '<span class="tag c-lime">مفعّل</span>' : '<span class="tag c-red">بانتظار الموافقة</span>'}, {h: 'متصل الآن', f: r => { const p = (S.pres || {})[r.id]; return p && Date.now() - p.at < 40000 ? '<span class="tag c-lime">🟢 متصل</span>' : '<span class="tag c-red">⚪ غير متصل</span>'; }}, {h: 'الصفحة الحالية', f: r => { const p = (S.pres || {})[r.id]; return p && Date.now() - p.at < 40000 ? esc(p.page) : ''; }}, {h: 'الدخول من', f: r => esc(((S.pres || {})[r.id] || {}).client || r.lastClient || '')}, {h: 'آخر تسجيل دخول', f: r => r.lastLogin ? esc(fmtDT(r.lastLogin)) : ''},
    {h: 'الصلاحيات', f: r => r.isAdmin ? 'الكل' : (r.perms || []).filter(p => p !== '*').map(p => (PERM_ITEMS.find(x => x.k === p) || {l: p}).l).join('، ')}],
  sort: (a, b) => a.username.localeCompare(b.username),
  defaults: () => ({active: true}),
  collect: raw => { const o = {username: raw.username, password: raw.password, nationalId: raw.nationalId, birthDate: raw.birthDate, isAdmin: raw.isAdmin, active: raw.active || raw.isAdmin}; o.perms = PERM_ITEMS.filter(p => raw['p_' + p.k]).map(p => p.k); return o; },
  fill: r => { const o = Object.assign({}, r, {password: ''}); (r.perms || []).forEach(p => o['p_' + p] = true); PERM_ITEMS.forEach(p => { if (!(('p_' + p.k) in o)) o['p_' + p.k] = false; }); return o; },
  validate: (r, ed) => !ed && (r.password || '').length < 4 ? 'كلمة السر 4 أحرف على الأقل' : ''
});
Acts.permall = el => $$('.perm-grid input').forEach(c => c.checked = el.dataset.v === '1');

/* ---------- مركز التقارير ---------- */
SCREEN_RENDER.reports = () => {
  $('#main').innerHTML = `${pageHead('التقارير', '📊', 'violet')}<div class="cards">${REPS.filter(r => can(r.k)).map(r => `<button class="glow tile c-${r.c}" data-act="go" data-s="${r.k}"><span class="ic">${r.i}</span><b>${r.t}</b></button>`).join('') || '<div class="panel">لا توجد تقارير مصرح بها</div>'}</div>`;
};

/* ---------- تنفيذ الشركات ---------- */
SCREEN_RENDER.execs = crud({k: 'execs', ent: 'execs', t: 'تنفيذ الشركات', i: '📋', c: 'cyan', add: 'سجل جديد', dated: true,
  fields: [{k: 'date', l: 'تاريخ الكشف', t: 'date', req: 1}, {k: 'patient', l: 'اسم المريض', req: 1, sg: 'patients'}, {k: 'cardNo', l: 'رقم الكارنية'}, {k: 'approvalNo', l: 'رقم الموافقة'},
    {k: 'company', l: 'شركة التأمين', req: 1, sg: 'companies'}, {k: 'approvalProc', l: 'إجراء الموافقة'}, {k: 'required', l: 'الإجراء المطلوب تنفيذه'}, {k: 'done', l: 'ما تم تنفيذه'},
    {k: 'execDate', l: 'تاريخ التنفيذ', t: 'date'}, {k: 'clinic', l: 'العيادة', sg: 'clinics'}, {k: 'doctor', l: 'اسم الطبيب', sg: 'doctors'}],
  cols: [{h: 'م', f: (r, i) => i + 1}, {h: 'تاريخ الكشف', f: r => esc(r.date)}, {h: 'اسم المريض', f: r => esc(r.patient)}, {h: 'رقم الكارنية', f: r => esc(r.cardNo)}, {h: 'رقم الموافقة', f: r => esc(r.approvalNo)},
    {h: 'شركة التأمين', f: r => esc(r.company)}, {h: 'إجراء الموافقة', f: r => esc(r.approvalProc)}, {h: 'الإجراء المطلوب تنفيذه', f: r => esc(r.required)}, {h: 'ما تم تنفيذه', f: r => esc(r.done)},
    {h: 'تاريخ التنفيذ', f: r => esc(r.execDate)}, {h: 'العيادة', f: r => esc(r.clinic)}, {h: 'اسم الطبيب', f: r => esc(r.doctor)}],
  sort: (a, b) => b.date.localeCompare(a.date),
  defaults: () => ({date: today()})
});
