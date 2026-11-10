/* ============ شاشات الإدخال: محرك عام + الزيارات + المستخدمين ============ */
'use strict';
window.SCREEN_RENDER = window.SCREEN_RENDER || {};
const stripTags = h => String(h).replace(/<[^>]+>/g, ' ');

function crud(cfg) {
  (window.CRUDS = window.CRUDS || {})[cfg.ent] = cfg;
  return async function () {
    if (!can(cfg.k) && !(S.surgOnly && can('operations'))) { $('#main').innerHTML = '<div class="panel">⛔ لا تملك صلاحية فتح هذه الشاشة</div>'; return; }
    const main = $('#main'); let editing = null, q = '';
    const fields = cfg.fields, plain = fields.filter(f => !f.grp), grps = cfg.groups || {};
    const defaults = () => Object.assign({}, cfg.defaults ? cfg.defaults() : {});
    const frmHTML = () => `<form id="frm" class="panel accent c-${cfg.c}" autocomplete="off"><h3 id="ftitle">➕ ${esc(cfg.add || 'إضافة جديد')}</h3><div class="grid">${plain.map(f => f.t === 'html' ? f.html() : fieldHTML(f, '')).join('')}</div>${Object.keys(grps).map(g => `<div class="sub hidden" data-grp="${g}"><h4>${esc(grps[g].title)}</h4><div class="grid">${fields.filter(f => f.grp === g).map(f => fieldHTML(f, '')).join('')}</div></div>`).join('')}<div class="actions"><button type="submit" class="btn c-${cfg.c}">💾 حفظ</button>${cfg.keep ? `<button type="submit" class="btn c-gold" data-more="1" title="يحفظ هذه الزيارة ويفتح زيارة جديدة لنفس المريض">💾➕ حفظ وزيارة أخرى لنفس المريض</button>` : ''}<button type="button" class="btn ghost c-${cfg.c}" data-act="frmnew">➕ جديد</button></div></form>`;
    const rows = () => {
      let list = S.data[cfg.ent].slice();
      if (cfg.dated) { const {from, to} = getRange(); list = list.filter(r => r.date >= from && r.date <= to); }
      if (cfg.filter) list = list.filter(cfg.filter);
      if (cfg.extraRows) list = list.concat(cfg.extraRows());
      if (q) list = list.filter(r => JSON.stringify(r).toLowerCase().includes(q));
      return (cfg.sort ? list.sort(cfg.sort) : list.reverse());
    };
    const listHTML = () => {
      const list = rows(); const cols = cfg.cols;
      const body = list.map((r, ri) => `<tr>${cols.map(c => `<td>${c.f(r, ri)}</td>`).join('')}<td>${r._op ? `<button type="button" class="btn sm c-red" data-act="opconv" data-id="${r.id}">🔄 تحويل لزيارة</button>` : `<input type="checkbox" class="rowsel" data-id="${r.id}"> ${cfg.ent === 'visits' ? `<button class="btn sm c-lime" data-act="receipt" data-id="${r.id}" title="إيصال كاشير">🧾</button> ` : ''}<button class="btn sm c-teal" data-act="prow" data-e="${cfg.ent}" data-id="${r.id}" title="طباعة البند">🖨️</button> <button class="btn sm c-blue" data-act="edit" data-id="${r.id}">✏️</button> <button class="btn sm c-red" data-act="del" data-id="${r.id}">🗑️</button>`}</td></tr>`).join('');
      const foot = cols.some(c => c.sum) ? `<tfoot><tr>${cols.map((c, i) => `<td>${c.sum ? fmtN(list.reduce((s, r) => s + (+c.sum(r) || 0), 0)) : (i === 0 ? `الإجمالي (${list.length})` : '')}</td>`).join('')}<td></td></tr></tfoot>` : '';
      return `<div class="tbl-wrap"><table><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join('')}<th><input type="checkbox" class="selall" title="تحديد الكل"></th></tr></thead><tbody>${body || `<tr><td colspan="${cols.length + 1}" class="empty">لا توجد بيانات${cfg.dated ? ' في هذه الفترة' : ''}</td></tr>`}</tbody>${foot}</table></div>`;
    };
    const frm = () => $('#frm', main);
    const reset = () => {
      editing = null; const f = frm(); f.reset(); $('#ftitle', f).textContent = `➕ ${cfg.add || 'إضافة جديد'}`;
      const vals = defaults(); fields.forEach(x => { if (!(x.k in vals) && x.t !== 'html') vals[x.k] = (x.t === 'seg' ? x.opts[0].v : (x.t === 'chk' ? false : '')); });
      setForm(f, vals); showGroups(); cfg.onChange && cfg.onChange('*', f, {editing, reset: true});
    };
    const showGroups = () => { const v = readForm(frm()); Object.keys(grps).forEach(g => $(`[data-grp="${g}"]`, frm()).classList.toggle('hidden', !grps[g].show(v))); };
    const draw = () => {
      main.innerHTML = `${pageHead(cfg.ent === 'visits' && S.surgOnly ? 'العمليات الجراحية' : cfg.t, cfg.i, cfg.c)}${cfg.dated ? rangeBar() : ''}${frmHTML()}<div class="bar noprint"><input type="text" id="srch" placeholder="🔎 بحث…" value="${esc(q)}">${window.exportButtons}${cfg.tools ? cfg.tools() : ''}<button type="button" class="btn sm c-red" data-act="delsel">🗑️ حذف المحدد</button><button type="button" class="btn sm c-red" data-act="delall">🗑️ حذف الكل</button></div><div id="lst">${listHTML()}</div>`;
      reset(); hydrateImgs(main);
      $('#srch').oninput = e => { q = e.target.value.trim().toLowerCase(); $('#lst').innerHTML = listHTML(); hydrateImgs($('#lst')); };
      frm().addEventListener('change', ev => { showGroups(); cfg.onChange && cfg.onChange(ev.target.name, frm(), {editing}); });
      frm().addEventListener('input', ev => { if (ev.target.matches('[data-sg],input[type=number],[data-dt]')) cfg.onChange && cfg.onChange(ev.target.name, frm(), {editing, typing: true}); });
      frm().onsubmit = ev => { ev.preventDefault(); const more = !!(ev.submitter && ev.submitter.dataset.more); guard(ev.submitter || $('button[type=submit]', frm()), async () => {
        const raw = readForm(frm()); let rec = cfg.collect ? cfg.collect(raw) : Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
        for (const f of fields) if (f.req && !String(rec[f.k] == null ? raw[f.k] : rec[f.k]).trim()) throw new Error(`حقل "${f.l}" مطلوب`);
        for (const f of fields) if (f.t === 'date' && rec[f.k] && !validDate(rec[f.k])) throw new Error(`"${f.l}": الصيغة yyyy/mm/dd`);
        if (cfg.validate) { const m = cfg.validate(rec, editing); if (m) throw new Error(m); }
        if (editing) rec.id = editing;
        const r = cfg.saveFn ? await cfg.saveFn(rec, editing) : await API.call('save', {entity: cfg.ent, record: rec});
        if (cfg.after) await cfg.after(r.record, rec);
        await loadAll([cfg.ent]); toast('تم الحفظ ✔'); $('#lst').innerHTML = listHTML(); hydrateImgs($('#lst')); reset(); if (more && cfg.keep) { setForm(frm(), Object.fromEntries(cfg.keep.filter(k => raw[k] !== undefined).map(k => [k, raw[k]]))); showGroups(); cfg.onChange && cfg.onChange('*', frm(), {editing: null}); cfg.onChange && cfg.onChange('patient', frm(), {editing: null}); }
      }); };
    };
    const refreshList = () => { const rb = $('[data-rangebar]'); if (rb) rb.outerHTML = rangeBar(); const l = $('#lst'); if (l) { l.innerHTML = listHTML(); hydrateImgs(l); } };
    S.view = {refresh: refreshList, total: () => { const c = cfg.cols.find(x => x.sum); if (!c) return ''; const l = rows(); return fmtN(l.reduce((t, r) => t + (+c.sum(r) || 0), 0)); },
      edit: id => { const r = S.data[cfg.ent].find(x => x.id === id); if (!r) return; editing = id; const f = frm(); $('#ftitle', f).textContent = '✏️ تعديل'; setForm(f, cfg.fill ? cfg.fill(r) : r); showGroups(); cfg.onChange && cfg.onChange('*', f, {editing, loaded: true}); f.scrollIntoView({behavior: 'smooth', block: 'start'}); },
      del: async id => { if (!await confirmBox('هل تريد حذف هذا السجل نهائياً؟')) return; await guard(null, async () => { await API.call('delete', {entity: cfg.ent, id}); await loadAll([cfg.ent]); toast('تم الحذف'); $('#lst').innerHTML = listHTML(); if (editing === id) reset(); }); },
      reset, ids: () => rows().filter(r => !r._op).map(r => r.id), ent: cfg.ent};
    draw();
  };
}
async function delMany(ids, what) {
  if (!ids.length) return toast('لا توجد سجلات', true);
  if (!await confirmBox(`سيتم حذف ${what} (${ids.length} سجل) نهائياً. هل أنت متأكد؟`)) return;
  await guard(null, async () => {
    const ent = S.view.ent; let ok = 0, bad = 0;
    for (const id of ids) { try { await API.call('delete', {entity: ent, id}); ok++; } catch (e) { bad++; } }
    await loadAll([ent]); toast(`تم حذف ${ok}${bad ? ` — تعذر حذف ${bad}` : ''}`, !!bad && !ok); S.view.refresh();
  });
}
document.addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('selall')) document.querySelectorAll('#lst .rowsel').forEach(c => { c.checked = e.target.checked; }); });
Acts.delsel = () => S.view && S.view.ids && delMany([...document.querySelectorAll('#lst .rowsel:checked')].map(c => c.dataset.id), 'السجلات المحددة');
Acts.delall = async () => {
  if (!S.view || !S.view.ids) return;
  if (S.view.ent === 'visits' && !S.surgOnly && S.user && S.user.isAdmin) {
    if (!await confirmBox('سيتم حذف كل الزيارات (كل الفترات) نهائياً ويبدأ المسلسل من 1 تلقائياً. هل أنت متأكد؟')) return;
    return guard(null, async () => { await API.call('resetvisits', {}); await loadAll(['visits', 'operations']); toast('تم حذف كل الزيارات — المسلسل يبدأ من 1'); S.view.refresh(); S.view.reset && S.view.reset(); });
  }
  return delMany(S.view.ids(), 'كل السجلات المعروضة' + (S.view.ent === 'visits' ? ' في الفترة المحددة' : ''));
};
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
  fields: [{k: 'code', l: 'كود الطبيب (تلقائي)', t: 'ro'}, {k: 'name', l: 'اسم الطبيب', req: 1, sg: 'doctors.name'}, {k: 'clinic', l: 'العيادة', t: 'combo', sg: 'clinics', req: 1}, {k: 'phone', l: 'رقم التليفون', num: 1}, {k: 'nationalId', l: 'رقم البطاقة', num: 1}, {k: 'idPhoto', l: 'صورة البطاقة', t: 'img'}, {k: 'syndicatePhoto', l: 'صورة الكارنية', t: 'img'}, {k: 'photo', l: 'الصورة الشخصية', t: 'img'}, {k: 'hireDate', l: 'تاريخ التعيين', t: 'date'}, {k: 'percent', l: 'نسبة الطبيب %', t: 'num'}, {k: 'fixed', l: 'الثابت (الفكسيد) يومياً', t: 'num'}, {k: 'opPercent', l: 'نسبة العمليات %', t: 'num'}],
  cols: [{h: 'الكود', f: r => r.code}, {h: 'الطبيب', f: r => L.doctor(r.name)}, {h: 'العيادة', f: r => L.clinic(r.clinic)}, {h: 'تاريخ التعيين', f: r => esc(r.hireDate)}, {h: 'النسبة %', f: r => fmtN(r.percent)}, {h: 'الثابت', f: r => fmtN(r.fixed)}, {h: 'آخر أجر مستحق (تلقائي)', f: r => { const d = lastDue(r); return d ? `<b>${fmtN(d.amount)}</b> <small>(${d.date})</small>` : '—'; }}, {h: 'البطاقة', f: r => thumb(r.idPhoto)}, {h: 'الكارنية', f: r => thumb(r.syndicatePhoto)}, {h: 'الصورة', f: r => thumb(r.photo)}],
  sort: (a, b) => (a.code || 0) - (b.code || 0),
  defaults: () => ({code: S.data.doctors.reduce((m, x) => Math.max(m, x.code || 0), 0) + 1, hireDate: today()}),
  validate: (r, ed) => !clinicNames().includes(r.clinic) ? 'العيادة غير موجودة — اختر من القائمة المقترحة' : (S.data.doctors.some(d => d.id !== ed && d.name === r.name && d.clinic === r.clinic) ? 'هذا الطبيب مسجل في نفس العيادة' : '')
});

/* ---------- الخدمات ---------- */
SCREEN_RENDER.services = crud({k: 'services', ent: 'services', t: 'الخدمات (عيادات – عمليات – أشعة – تحاليل – خدمات)', i: '💉', c: 'orange', add: 'خدمة جديدة',
  fields: [{k: 'type', l: 'النوع', t: 'seg', opts: Object.keys(SVTYPE).map(v => ({v, l: SVTYPE[v], c: SVCOLOR[v]}))}, {k: 'name', l: 'اسم الخدمة', req: 1, sg: 'services.name'}, {k: 'abbr', l: 'الاختصار (مثل CBC)'}, {k: 'price', l: 'القيمة', t: 'num', req: 1}, {k: 'tax', l: 'الضريبة (لكل زيارة)', t: 'num'}],
  cols: [{h: 'النوع', f: r => `<span class="tag c-${SVCOLOR[r.type] || 'teal'}">${SVTYPE[r.type] || ''}</span>`}, {h: 'الخدمة', f: r => r.type === 'clinic' ? L.clinic(r.name) : esc(r.name)}, {h: 'الاختصار', f: r => esc(r.abbr)}, {h: 'القيمة', f: r => fmtN(r.price)}, {h: 'الضريبة', f: r => fmtN(r.tax)}],
  sort: (a, b) => Object.keys(SVTYPE).indexOf(a.type) - Object.keys(SVTYPE).indexOf(b.type) || a.name.localeCompare(b.name, 'ar'),
  validate: (r, ed) => S.data.services.some(s => s.id !== ed && s.type === r.type && s.name === r.name) ? 'الخدمة مسجلة من قبل' : '',
  tools: () => can('services') ? '<button class="btn sm c-gold" data-act="importseed" title="يضيف الناقص فقط من بيانات الإكسيل ولا يعدّل ما عدّلته">📥 استيراد من الإكسيل</button>' : ''
});
/* استيراد البيانات الأساسية (من الإكسيل) وزيارات الإكسيل القديم إلى قاعدة البيانات (شيت جوجل) — يتخطى المكرر ولا يعدّل الموجود */
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function bulkSend(entity, records, key, onP) {
  let added = 0, skipped = 0, done = 0;
  for (const part of chunk(records, 100)) { const r = await API.call('bulk_save', {entity, records: part, key}); added += r.added || 0; skipped += r.skipped || 0; done += part.length; if (onP) onP(done); }
  return {added, skipped};
}
async function seedBasics(onP) {
  const SD = window.SEED || {}; let n = 0;
  const jobs = [['services', SD.services, 'type,name'], ['doctors', SD.doctors, 'name,clinic'], ['companies', SD.companies, 'name'], ['staff', SD.staff, 'name']];
  for (const [e, list, key] of jobs) { if (!list || !list.length) continue; if (onP) onP(e); const r = await bulkSend(e, list, key); n += r.added; }
  await loadAll(['services', 'doctors', 'companies', 'staff']); return n;
}
Acts.importseed = async el => {
  if (!await confirmBox('سيتم إضافة العيادات والعمليات والأشعة والتحاليل (بالاختصارات) والخدمات والأطباء والشركات غير الموجودة فقط، دون تغيير ما عدّلته. متابعة؟')) return;
  await guard(el, async () => { const n = await seedBasics(); toast(n ? `تمت إضافة ${n} سجل ✔` : 'كل البيانات موجودة بالفعل'); refreshView(); });
};
Acts.syncsheets = async el => guard(el, async () => { await API.call('sync_sheets'); toast('تمت مزامنة أوراق جوجل ✔'); });
async function autoSeedCheck() {
  if (!S.user || !S.user.isAdmin || window.__seedAsked) return; window.__seedAsked = true;
  try {
    if (!S.data.services.length) { toast('⏳ جاري تعبئة البيانات الأساسية…'); await seedBasics(); toast('تمت تعبئة العيادات والأشعة والتحاليل والأطباء والشركات ✔'); render(); }
  } catch (e) { toast(e.message || 'تعذر الاستيراد التلقائي', true); window.__seedAsked = false; }
}
window.autoSeedCheck = autoSeedCheck;

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
/* العمليات الجراحية = زيارات من نوع «عمليات جراحية» (تظهر هنا وفي الزيارات) */
SCREEN_RENDER.operations = async function () { S.surgOnly = true; return SCREEN_RENDER.visits(); };

/* ---------- الزيارات ---------- */
function visitAuto(f, why) {
  const clinic = getv(f, 'clinic'), vt = getv(f, 'visitType'), cat = getv(f, 'category'), svc = getv(f, 'service');
  const c = clinicOf(clinic), sv = S.data.services.find(s => s.name === svc && s.type !== 'clinic');
  if (why === 'clinic' || why === 'visitType') { setv(f, 'tax', vt === 'كشف' && c ? c.tax || 0 : 0); }
  /* القيمة: تلقائية عند اختيار «كشف» (سعر العيادة)، وأي بند آخر تُكتب القيمة يدوياً */
  if (['clinic', 'visitType'].includes(why)) {
    if (vt === 'كشف' && c) setv(f, 'value', c.price);
    else if (why === 'visitType' && vt !== 'عمليات جراحية') setv(f, 'value', '');
  }
  const co = S.data.companies.find(x => x.name === getv(f, 'company')), fee = co && co.fee > 0 && vt === 'كشف' ? co.fee : (+getv(f, 'value') || 0);
  setv(f, '_cofee', fmtN(fee)); setv(f, '_req', fmtN(cat === 'company' ? fee * (+getv(f, 'patientPct') || 0) / 100 : 0));
  { const pv = getv(f, 'paid'), due = dueOf({category: cat, value: getv(f, 'value'), patientPct: getv(f, 'patientPct'), discount: getv(f, 'discount'), company: getv(f, 'company'), visitType: vt}); setv(f, '_rem', pv === '' ? fmtN(0) : fmtN(Math.max(0, due - (+pv || 0)))); }
  const dsc = (+getv(f, 'value') || 0) * (+getv(f, 'discount') || 0) / 100; setv(f, '_net', fmtN((+getv(f, 'value') || 0) - dsc));
}
function visitBanner(f, ctx) {
  const box = $('#vbanner', f); if (!box) return;
  const name = getv(f, 'patient'), phone = getv(f, 'phone'); if (!name || ctx.editing) { box.dataset.h = ''; box.innerHTML = ''; return; }
  const all = S.data.visits.filter(v => v.patient === name || (phone && v.phone === phone));
  const lv = lastVisitOf(name, phone, null, ''); if (!lv) { box.dataset.h = ''; box.innerHTML = ''; return; }
  const owed = all.reduce((s2, v) => s2 + owedOf(v), 0), cardv = all.slice().sort((a, b) => b.date.localeCompare(a.date)).find(v => v.cardNo) || lv;
  const part = (l, v) => v === '' || v == null ? '' : `<span><b>${l}:</b> ${esc(v)}</span>`;
  const html = `<div class="vbanner">${part('آخر تاريخ زيارة', lv.date)}${part('نوع الزيارة', lv.visitType || CAT[lv.category] || '')}${part('القيمة', fmtN(+lv.value || 0))}${part('المدفوع', fmtN(paidOf(lv)))}${part('عليه', fmtN(owed))}${part('رقم الكارنيه', cardv.cardNo)}${part('شركة التأمين', cardv.company)}${part('خصم الكارنيه %', (+cardv.discount || 0) || '')}${owed > 0 ? `<button type="button" class="btn sm c-red" data-act="settle" data-p="${esc(name)}" data-ph="${esc(phone)}">💰 تسديد المبلغ</button>` : ''}</div>`;
  if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
}
Acts.settle = el => {
  const name = el.dataset.p, phone = el.dataset.ph, list = S.data.visits.filter(v => (v.patient === name || (phone && v.phone === phone)) && owedOf(v) > 0).sort((a, b) => a.date.localeCompare(b.date));
  const owed = list.reduce((s2, v) => s2 + owedOf(v), 0);
  const m = modal(`<h3>💰 تسديد مديونية ${esc(name)}</h3><p class="muted">إجمالي المتبقي: <b>${fmtN(owed)}</b> — يُوزَّع المبلغ على أقدم الزيارات أولاً.</p><table><thead><tr><th>التاريخ</th><th>القيمة</th><th>المستحق</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>${list.map(v => `<tr><td>${esc(v.date)}</td><td>${fmtN(+v.value || 0)}</td><td>${fmtN(dueOf(v))}</td><td>${fmtN(paidOf(v))}</td><td>${fmtN(owedOf(v))}</td></tr>`).join('')}</tbody></table><div class="fld"><label>المبلغ المسدد الآن</label><input type="number" id="spay" value="${owed}" min="0" max="${owed}" step="any"></div><div class="actions"><button class="btn c-lime" id="sok">✅ تسديد</button><button class="btn ghost" id="scl">إلغاء</button></div>`);
  $('#scl', m).onclick = () => m.remove();
  $('#sok', m).onclick = e => guard(e.target, async () => {
    let amt = Math.min(+$('#spay', m).value || 0, owed); if (amt <= 0) throw new Error('اكتب مبلغاً صحيحاً');
    for (const v of list) { if (amt <= 0) break; const pay = Math.min(amt, owedOf(v)); amt -= pay; await API.call('save', {entity: 'visits', record: Object.assign({}, v, {paid: String(+(paidOf(v) + pay).toFixed(2))})}); }
    await loadAll(['visits']); m.remove(); toast('تم تسديد المبلغ'); if (S.screen === 'visits') { render(); } 
  });
};
function visitLast(f, ctx) {
  visitBanner(f, ctx);
  const lv = lastVisitOf(getv(f, 'patient'), getv(f, 'phone'), ctx.editing, getv(f, 'date'));
  setv(f, '_lastDate', lv ? lv.date : ''); setv(f, '_lastType', lv ? `${lv.visitType}${lv.service ? ' — ' + lv.service : ''} (${lv.clinic || ''})` : '');
}
const _visitsCrud = crud({k: 'visits', ent: 'visits', tools: () => '<button type="button" class="btn sm c-lime" data-act="bulkvisits">👥 إضافة مجمّعة</button><button type="button" class="btn sm c-violet" data-act="turns">🔢 أدوار المرضى</button>', keep: ['date', 'patient', 'phone', 'category', 'company', 'cardNo', 'nationalId', 'birthDate', 'patientPct', 'discount', 'formNo'], t: 'الزيارات', i: '🩺', c: 'teal', add: 'زيارة جديدة', dated: true,
  groups: {rem: {title: '⏳ المتبقي من الزيارة النقدية', show: v => v.category === 'cash' && v.visitType !== 'عمليات جراحية' && (+v.value || 0) - (+v.paid || 0) > 0 && v.paid !== '' && v.paid != null}, op: {title: '🏥 بيانات العملية الجراحية', show: v => v.visitType === 'عمليات جراحية'}, co: {title: '🏢 بيانات الشركة', show: v => v.category === 'company'}, ins: {title: '🛡️ بيانات التأمين', show: v => v.category === 'insurance'}},
  fields: [
    {k: 'serial', l: 'المسلسل (تلقائي)', t: 'ro'}, {k: '_day', l: 'اليوم', t: 'ro'}, {k: 'date', l: 'تاريخ الزيارة', t: 'date', req: 1},
    {k: 'patient', l: 'اسم المريض', req: 1, sg: 'patients'}, {k: 'phone', l: 'رقم التليفون', num: 1},
    {k: '_banner', t: 'html', html: () => '<div class="fld full"><div id="vbanner"></div></div>'},
    {k: 'clinic', l: 'العيادة / القسم', t: 'sel', req: 1, opts: () => ['', ...clinicNames(), ...EXTRA_CLINICS].map(x => ({v: x, l: x || '— اختر العيادة —'}))},
    {k: '_doc', l: 'الطبيب المعالج', t: 'docpick', sg: 'clinicdocs'},
    {k: 'visitType', l: 'الزيارة', t: 'sel', opts: () => VTYPES}, {k: 'service', l: 'البيان / الخدمة', sg: 'bayan'}, {k: 'docNo', l: 'رقم المستند', sg: 'visits.docNo'},
    {k: 'value', l: 'القيمة', t: 'num', req: 1}, {k: 'paid', l: 'المدفوع', t: 'num', ph: 'اتركه فارغاً = مدفوع بالكامل'}, {k: '_rem', l: 'المتبقي', t: 'ro'}, {k: 'tax', l: 'الضريبة (على الكشف فقط)', t: 'ro'},
    {k: 'category', l: 'نوع الزيارة', t: 'seg', w: 'full', opts: Object.keys(CAT).map(k => ({v: k, l: CAT[k], c: CATC[k]}))},
    {k: 'notes', l: 'ملاحظات', t: 'area'},
    {k: 'discount', l: 'نسبة الخصم %', t: 'num', grp: 'ins'}, {k: '_net', l: 'الصافي بعد الخصم', t: 'ro', grp: 'ins'},
    {k: 'company', l: 'اسم الشركة', sg: 'companies', grp: 'co'}, {k: 'formNo', l: 'رقم النموذج', grp: 'co', sg: 'visits.formNo'}, {k: 'formPhoto', l: 'صورة النموذج', t: 'img', grp: 'co'},
    {k: 'birthDate', l: 'تاريخ الميلاد', t: 'date', grp: 'co'}, {k: 'cardNo', l: 'رقم الكارنية', grp: 'co', sg: 'visits.cardNo'}, {k: 'cardPhoto', l: 'صورة الكارنية', t: 'img', grp: 'co'}, {k: 'nationalId', l: 'الرقم القومي', num: 1, grp: 'co'},
    {k: '_cofee', l: 'قيمة كشف الشركة (أساس الحساب)', t: 'ro', grp: 'co'}, {k: 'patientPct', l: 'نسبة تحمل المريض %', t: 'num', grp: 'co'}, {k: '_req', l: 'المبلغ المطلوب من المريض', t: 'ro', grp: 'co'},
    {k: '_lastDate', l: 'آخر تاريخ زيارة (تلقائي)', t: 'ro', grp: 'co'}, {k: '_lastType', l: 'نوع آخر زيارة (تلقائي)', t: 'ro', grp: 'co'},
    {k: 'remTo', l: 'يُسجَّل المتبقي على', t: 'seg', w: 'full', opts: [{v: '', l: '⏳ آجل (على المريض)', c: 'orange'}, {v: 'committee', l: '🏛️ لجنة', c: 'violet'}, {v: 'insurance', l: '🛡️ تأمين', c: 'blue'}], grp: 'rem'},
    {k: 'operation', l: 'العملية', sg: 'opnames', grp: 'op'}, {k: '_anes', l: 'تخدير — اسم الطبيب', t: 'docpick', sg: 'alldocs', grp: 'op'}, {k: 'anesthesia', l: 'تخدير — القيمة', t: 'num', grp: 'op'},
    {k: 'deductAnes', l: 'خصم التخدير من أجر العملية', t: 'chk', l2: 'احسب حساب الطبيب بعد خصم قيمة التخدير', grp: 'op'}, {k: 'doctorPercent', l: 'نسبة الطبيب %', t: 'num', grp: 'op'}
  ],
  filter: r => !S.surgOnly || r.visitType === 'عمليات جراحية',
  extraRows: () => { const {from, to} = getRange(); return (S.opsLegacy || []).filter(o => o.date >= from && o.date <= to).map(o => ({id: o.id, _op: true, date: o.date, patient: o.patient, clinic: o.clinic || '', doctor: o.doctor, visitType: 'عمليات جراحية', service: o.operation, value: o.value, category: 'cash', docNo: o.docNo || '', serial: ''})); },
  cols: [{h: 'م', f: r => r.serial}, {h: 'الباركود', f: r => `<span class="bcode" title="السنة+الشهر+اليوم+المسلسل">${esc(visitCode(r))}</span>`}, {h: 'التاريخ', f: r => esc(r.date)}, {h: 'المريض', f: r => L.patient(r.patient)}, {h: 'العيادة', f: r => L.clinic(r.clinic)}, {h: 'الطبيب', f: r => L.doctor(r.doctor)}, {h: 'الزيارة', f: r => esc(r.visitType)}, {h: 'البيان', f: r => esc(r.service)}, {h: 'القيمة', f: r => fmtN(r.value), sum: r => r.value}, {h: 'تخدير', f: r => +r.anesthesia ? `${esc(r.anesthetist || '')} ${fmtN(r.anesthesia)}` : ''}, {h: 'النوع', f: r => tagCat(r.category)}, {h: 'الشركة', f: r => L.company(r.company)}, {h: 'رقم النموذج', f: r => esc(r.formNo)}, {h: 'صورة النموذج', f: r => thumb(r.formPhoto)}, {h: 'الكارنية', f: r => esc(r.cardNo)}, {h: 'صورة الكارنية', f: r => thumb(r.cardPhoto)}, {h: 'تحمل المريض', f: r => r.category === 'company' ? fmtN(patientShare(r)) : '', sum: patientShare}, {h: 'الخصم', f: r => r.category === 'insurance' ? fmtN(discountAmt(r)) + ' (' + fmtN(r.discount) + '%)' : '', sum: discountAmt}, {h: 'الضريبة', f: r => fmtN(r.tax), sum: r => r.tax}, {h: 'سجّلها', f: r => esc(r.registeredBy)}],
  sort: (a, b) => (b.date + String(1e6 + (b.serial || 0))).localeCompare(a.date + String(1e6 + (a.serial || 0))),
  defaults: () => { const {from, to} = getRange(); const d = from === to && validDate(from) ? from : today(); return {serial: Math.max(S.ctr.visits || 0, S.data.visits.reduce((m, x) => Math.max(m, x.serial || 0), 0)) + 1, date: d, _day: dayName(d), visitType: S.surgOnly ? 'عمليات جراحية' : 'كشف', clinic: S.surgOnly ? 'عمليات جراحية' : '', category: 'cash', tax: 0, patientPct: 0, discount: 0}; },
  collect: raw => {
    docNameCheck(raw); comboCheck(raw.clinic, [...clinicNames(), ...EXTRA_CLINICS], 'العيادة'); comboCheck(raw.visitType, VTYPES, 'نوع الزيارة');
    const d = S.data.doctors.find(x => x.id === raw._doc); const o = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
    o.doctorId = d ? d.id : ''; o.doctor = d ? d.name : '';
    if (o.category !== 'company') { ['company', 'formNo', 'formPhoto', 'cardNo', 'cardPhoto', 'nationalId', 'birthDate'].forEach(k => o[k] = ''); o.patientPct = 0; }
    if (o.category !== 'insurance') o.discount = 0;
    o.payMethod = ''; o.payRef = ''; o.payPhone = ''; if (o.category !== 'cash' || !(restV(o) > 0)) o.remTo = '';
    { const an = S.data.doctors.find(x => x.id === raw._anes); o.anesthetistId = an ? an.id : ''; o.anesthetist = an ? an.name : ''; o.deductAnes = raw.deductAnes ? '1' : ''; if (o.visitType === 'عمليات جراحية') { o.operation = o.operation || o.service; if (!o.operation) throw new Error('اسم العملية مطلوب'); } if (o.visitType !== 'عمليات جراحية') { o.operation = ''; o.anesthesia = 0; o.doctorPercent = 0; o.anesthetist = ''; o.anesthetistId = ''; o.deductAnes = ''; } }
    return o;
  },
  fill: r => Object.assign({}, r, {_doc: r.doctorId || (S.data.doctors.find(d => d.name === r.doctor && d.clinic === r.clinic) || S.data.doctors.find(d => d.name === r.doctor) || {}).id || '', _day: dayName(r.date)}),
  validate: r => r.category === 'company' && !r.company ? 'اختر اسم الشركة' : '',
  after: async (rec, sent) => {
    /* شركة + نسبة تحمل المريض ⇒ زيارة جديدة (المركز / متنوع) بقيمة تحمل المريض مقرّبة لأقرب عدد صحيح */
    try {
      const mark = 'تحمل المريض — مرتبط بالزيارة رقم ' + rec.serial, old = S.data.visits.find(x => x.notes === mark && x.id !== rec.id);
      const req = rec.category === 'company' ? Math.round(coShare(rec) / 10) * 10 : 0;
      if (req > 0) {
        const base = {date: rec.date, patient: rec.patient, phone: rec.phone || '', clinic: 'المركز', doctorId: '', doctor: '', visitType: 'متنوع', service: 'نسبة شركات', value: req, category: 'cash', notes: mark};
        await API.call('save', {entity: 'visits', record: old ? Object.assign({}, old, base) : base});
        toast('تمت إضافة زيارة «المركز — متنوع — نسبة شركات» بقيمة (مقرّبة لأقرب 10): ' + fmtN(req));
      } else if (old) await API.call('delete', {entity: 'visits', id: old.id});
      await loadAll(['visits']);
    } catch (e) {}
    const p = S.data.patients.find(x => x.name === sent.patient);
    try { if (!p) await API.call('save', {entity: 'patients', record: {name: sent.patient, phone: sent.phone}}); else if (sent.phone && p.phone !== sent.phone) await API.call('save', {entity: 'patients', record: Object.assign({}, p, {phone: sent.phone})}); await loadAll(['patients']); } catch (e) {}
  },
  onChange: (n, f, ctx) => {
    if (n === '*') { visitLast(f, ctx); visitAuto(f, '*'); return; }
    if (n === 'date') { setv(f, '_day', dayName(getv(f, 'date'))); visitLast(f, ctx); }
    if (n === 'patient') { const p = S.data.patients.find(x => x.name === getv(f, 'patient')); if (p && p.phone && !ctx.typing) setv(f, 'phone', p.phone); visitLast(f, ctx); }
    if (n === 'phone') visitLast(f, ctx);
    if (n === 'clinic') { const cl = getv(f, 'clinic'), cur = S.data.doctors.find(d => d.id === getv(f, '_doc')), only = S.data.doctors.filter(d => d.clinic === cl); if (cl && [...clinicNames(), ...EXTRA_CLINICS].includes(cl) && !(cur && cur.clinic === cl)) { setv(f, '_doc', only.length === 1 ? only[0].id : ''); docSync(f); } }
    if (['clinic', 'visitType', 'category', 'company', 'service', 'value', 'patientPct', 'discount', 'paid'].includes(n) && !ctx.typing) visitAuto(f, n);
    if (n === 'value' || n === 'patientPct' || n === 'discount' || n === 'paid') visitAuto(f, n);
    if (n === '_doc' && getv(f, 'visitType') === 'عمليات جراحية') { const d = S.data.doctors.find(x => x.id === getv(f, '_doc')); if (d && !getv(f, 'doctorPercent')) setv(f, 'doctorPercent', d.opPercent || 0); }
    if (n === 'operation' && getv(f, 'visitType') === 'عمليات جراحية') { const sv = S.data.services.find(x => x.type === 'operation' && x.name === getv(f, 'operation')); if (sv && sv.price && !getv(f, 'value')) setv(f, 'value', sv.price); }
  }
});

SCREEN_RENDER.visits = async function () { if (S.screen !== 'operations') S.surgOnly = false; return _visitsCrud(); };
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

/* أدوار المرضى: لكل عيادة، ترقيم المرضى حسب ترتيب التسجيل في اليوم — طباعة أو إرسال */
function turnsData(day) {
  const by = new Map(); S.data.visits.filter(v => v.date === day).sort((a, b) => (a.serial || 0) - (b.serial || 0)).forEach(v => { const k = v.clinic || 'بدون عيادة'; (by.get(k) || by.set(k, []).get(k)).push(v); });
  return [...by.entries()].map(([c, l]) => ({c, l}));
}
Acts.turns = () => {
  const {from, to} = getRange(); let day = from === to && validDate(from) ? from : today();
  const m = modal(`<h3>🔢 أدوار المرضى</h3><div class="fld"><label>اليوم</label>${dateFld('tday', day)}</div><div id="tbody"></div><div class="actions"><button class="btn c-teal" id="tpr">🖨️ طباعة</button><button class="btn c-lime" id="tws">📤 إرسال (واتساب / مشاركة)</button><button class="btn ghost" id="tcl">إغلاق</button></div>`);
  const body = () => { const d = turnsData(day); $('#tbody', m).innerHTML = d.length ? d.map(g => `<h4>${esc(g.c)} (${g.l.length})</h4><table><thead><tr><th>الدور</th><th>المريض</th><th>الطبيب</th></tr></thead><tbody>${g.l.map((v, i) => `<tr><td>${i + 1}</td><td>${esc(v.patient)}</td><td>${esc(v.doctor)}</td></tr>`).join('')}</tbody></table>`).join('') : '<div class="empty">لا توجد زيارات في هذا اليوم</div>'; };
  body();
  m.addEventListener('input', e => { if (e.target.name === 'tday' && validDate(e.target.value)) { day = e.target.value; body(); } });
  $('#tcl', m).onclick = () => m.remove();
  $('#tpr', m).onclick = () => { const d = turnsData(day); if (!d.length) return toast('لا توجد زيارات', true); printDoc('أدوار المرضى — ' + day, '', d.map(g => `<h2 class="s">${esc(g.c)}</h2><table><thead><tr><th>الدور</th><th>المريض</th><th>الطبيب</th></tr></thead><tbody>${g.l.map((v, i) => `<tr><td>${i + 1}</td><td>${esc(v.patient)}</td><td>${esc(v.doctor)}</td></tr>`).join('')}</tbody></table>`).join(''), false, {}); };
  $('#tws', m).onclick = () => {
    const d = turnsData(day); if (!d.length) return toast('لا توجد زيارات', true);
    const txt = `*${CENTER}*\nأدوار المرضى — ${day}\n` + d.map(g => `\n*${g.c}*\n` + g.l.map((v, i) => `${i + 1}- ${v.patient}${v.doctor ? ' (' + v.doctor + ')' : ''}`).join('\n')).join('\n');
    if (navigator.share) navigator.share({text: txt}).catch(() => {}); else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
  };
};

/* إضافة مجمّعة: عدة مرضى بنفس البيانات المشتركة (اليوم، العيادة، الطبيب، الزيارة، النوع) مرة واحدة */
Acts.bulkvisits = () => {
  const {from, to} = getRange(), day = from === to && validDate(from) ? from : today(), cls = [...clinicNames(), ...EXTRA_CLINICS];
  const m = modal(`<h3>👥 إضافة زيارات لأكثر من مريض</h3><div class="grid">
    <div class="fld"><label>التاريخ</label>${dateFld('bdate', day)}</div>
    <div class="fld"><label>العيادة</label><select name="bclinic"><option value="">— اختر —</option>${cls.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
    <div class="fld"><label>الطبيب</label><select name="bdoc"><option value="">—</option></select></div>
    <div class="fld"><label>الزيارة</label><select name="bvt">${VTYPES.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
    <div class="fld"><label>نوع الزيارة</label><select name="bcat">${Object.keys(CAT).map(k => `<option value="${k}">${CAT[k]}</option>`).join('')}</select></div>
    <div class="fld"><label>اسم الشركة</label><input name="bco" data-sg="companies" autocomplete="off" placeholder="للزيارات الشركات"></div>
    <div class="fld"><label>البيان / الخدمة</label><input name="bsv" autocomplete="off"></div>
    <div class="fld"><label>القيمة (للجميع، اتركها فارغة لسعر الكشف)</label><input name="bval" type="number" step="any"></div>
    <div class="fld full"><label>المرضى — اسم في كل سطر (اختياري: ، رقم الهاتف ، القيمة)</label><textarea name="blist" rows="7" placeholder="أحمد محمد، 0100000000&#10;سعيد علي، ، 150&#10;منى حسن"></textarea></div></div>
    <p class="muted" id="bcnt">0 مريض</p><div class="actions"><button class="btn c-lime" id="bok">💾 حفظ الكل</button><button class="btn ghost" id="bcl">إلغاء</button></div>`);
  const q = n => $(`[name=${n}]`, m), parse = () => q('blist').value.split('\n').map(l => l.split(/[،,]/).map(x => x.trim())).filter(a => a[0]);
  q('bclinic').onchange = () => { const d = S.data.doctors.filter(x => x.clinic === q('bclinic').value); q('bdoc').innerHTML = '<option value="">—</option>' + d.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join(''); if (d.length === 1) q('bdoc').value = d[0].id; };
  q('blist').oninput = () => { $('#bcnt', m).textContent = parse().length + ' مريض'; };
  $('#bcl', m).onclick = () => m.remove();
  $('#bok', m).onclick = e => guard(e.target, async () => {
    const date = q('bdate').value, cl = q('bclinic').value, vt = q('bvt').value, cat = q('bcat').value, co = q('bco').value.trim(), list = parse();
    if (!validDate(date)) throw new Error('التاريخ يجب أن يكون yyyy/mm/dd'); if (!cl) throw new Error('اختر العيادة'); if (!list.length) throw new Error('اكتب اسم مريض واحد على الأقل');
    if (cat === 'company' && !co) throw new Error('اختر اسم الشركة');
    const c = clinicOf(cl), d = S.data.doctors.find(x => x.id === q('bdoc').value), common = +q('bval').value || 0; let n = 0;
    for (const a of list) {
      const val = +a[2] || common || ((vt === 'كشف' || vt === 'استشارة') && c ? c.price : 0);
      await API.call('save', {entity: 'visits', record: {date, patient: a[0], phone: a[1] || '', clinic: cl, doctorId: d ? d.id : '', doctor: d ? d.name : '', visitType: vt, service: q('bsv').value.trim(), value: val, tax: vt === 'كشف' && c ? c.tax || 0 : 0, category: cat, company: cat === 'company' ? co : '', patientPct: 0, discount: 0}}); n++;
      toast(`⏳ ${n}/${list.length}`);
    }
    await loadAll(['visits']); m.remove(); toast(`تمت إضافة ${n} زيارة ✔`); refreshView();
  });
};

Acts.opconv = el => guard(el, async () => {
  const o = (S.opsLegacy || []).find(x => x.id === el.dataset.id); if (!o) return;
  const d = S.data.doctors.find(x => x.id === o.doctorId) || S.data.doctors.find(x => x.name === o.doctor);
  await API.call('save', {entity: 'visits', record: {date: o.date, patient: o.patient, clinic: o.clinic || 'عمليات جراحية', doctor: o.doctor, doctorId: o.doctorId || (d ? d.id : ''), visitType: 'عمليات جراحية', service: o.operation, operation: o.operation, value: o.value, category: 'cash', docNo: o.docNo || '', notes: o.notes || '', doctorPercent: o.doctorPercent, anesthetist: o.anesthetist || '', anesthetistId: o.anesthetistId || '', anesthesia: o.anesthesia || 0, deductAnes: o.deductAnes || ''}});
  await API.call('delete', {entity: 'operations', id: o.id}); await loadAll(['visits', 'operations']); toast('تم التحويل إلى زيارة'); S.view && S.view.refresh && S.view.refresh();
});
