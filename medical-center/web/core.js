/* ============ النواة: أدوات، حالة، واجهة عامة، دخول، شاشة رئيسية ============ */
'use strict';
window.__errs = []; window.addEventListener('error', e => { try { window.__errs.push((e.message || 'error') + (e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno : '')); } catch (x) {} }); window.addEventListener('unhandledrejection', e => { try { window.__errs.push('promise: ' + ((e.reason && e.reason.message) || e.reason)); } catch (x) {} });
window.BUILD = '2026-11-04-c';

let CENTER = 'برنامج إدارة المركز الطبي', APPNAME = 'برنامج إدارة المركز الطبي', CPHONE = '', CLOGO = '', CLOGOID = '';
function applySettings(s) {
  if (!s) return; window.AZK_AUDIO_ID = s.azkAudio || ''; APPNAME = s.appName || APPNAME; CENTER = s.centerName || APPNAME; CPHONE = s.phone || ''; document.title = APPNAME;
  if ((s.logo || '') !== CLOGOID) { CLOGOID = s.logo || ''; CLOGO = ''; if (CLOGOID && S.user) fileURL(CLOGOID).then(u => { CLOGO = u; if (S.user) { const b = $('.top .brand'); if (b) { const sv = $('svg,img', b); if (sv) sv.outerHTML = `<img src="${u}" alt="">`; } } }).catch(() => {}); }
}
async function loadSettings() { try { applySettings((await API.call('settings')).settings); } catch (e) {} }
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtN = n => new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(+n || 0);
const pad = n => String(n).padStart(2, '0');
const toStr = d => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const today = () => toStr(new Date());
const DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const validDate = s => { if (!/^\d{4}\/\d{2}\/\d{2}$/.test(s || '')) return false; const [y,m,d] = s.split('/').map(Number); const t = new Date(y, m-1, d); return t.getFullYear()===y && t.getMonth()===m-1 && t.getDate()===d; };
const dayName = s => { if (!validDate(s)) return ''; const [y,m,d] = s.split('/').map(Number); return DAYS[new Date(y, m-1, d).getDay()]; };
const CAT = {cash:'نقدي', company:'شركة', committee:'لجنة', insurance:'تأمين'};
const CATC = {cash:'teal', company:'blue', committee:'violet', insurance:'orange'};
const VTYPES = ['كشف','استشارة','متنوع','كشف خارجى','عمليات جراحية'];
const SVTYPE = {clinic:'عيادة', operation:'عملية', radiology:'أشعة', lab:'تحاليل', service:'خدمة'};
const SVCOLOR = {clinic:'orange', operation:'red', radiology:'cyan', lab:'pink', service:'violet'};
const EXTRA_CLINICS = ['الأشعة','التحاليل','المركز','عمليات جراحية'];
const SEED_EXP = ['مصاريف متنوعة','مصاريف تشغيل','مصاريف نقل','مرتبات الموظفين والعمال','اجور الأطباء والتمريض','مستلزمات طبيه وأدويه','كهرباء','إيصال مياه','صيانه','بوفيه','أدوات كتابيه','اتصالات وتليفون وانترنت','دعايا','مكافآت','حوافز','نثريات وإكراميات ومصروفات أخرى'];

const SCREENS = [
  {k:'visits', t:'الزيارات', i:'🩺', c:'teal'},
  {k:'patients', t:'المرضى', i:'🧑‍🤝‍🧑', c:'blue'},
  {k:'doctors', t:'الأطباء', i:'👨‍⚕️', c:'violet'},
  {k:'dues', t:'مستحقات الأطباء', i:'💵', c:'lime'},
  {k:'services', t:'الخدمات', i:'💉', c:'orange'},
  {k:'operations', t:'العمليات', i:'🏥', c:'red'},
  {k:'companies', t:'شركات التأمين', i:'🏢', c:'cyan'},
  {k:'staff', t:'العاملين', i:'👥', c:'lime'},
  {k:'expenses', t:'المصروفات', i:'💸', c:'gold'},
  {k:'execs', t:'تنفيذ الشركات', i:'📋', c:'cyan'},
  {k:'custody', t:'العهد والسلف', i:'💼', c:'blue'},
  {k:'opx_data', t:'إدارة المصروفات', i:'💳', c:'orange'},
  {k:'opx_reg', t:'سجل المصروفات', i:'📒', c:'gold'},
  {k:'opx_apr', t:'الاعتماد والسداد', i:'✅', c:'lime'},
  {k:'opx_items', t:'بنود الصرف', i:'🏷️', c:'blue'},
  {k:'opx_set', t:'إعدادات المصروفات', i:'🛠️', c:'violet'},
  {k:'users', t:'المستخدمين', i:'🔐', c:'pink'},
  {k:'admin', t:'إدارة البرنامج', i:'⚙️', c:'orange'}
];
const REPS = [
  {k:'rep_totals', t:'الإجماليات بالتفصيل', i:'🧮', c:'gold'},
  {k:'rep_daily', t:'ملخص اليوم والإيرادات', i:'📈', c:'teal'},
  {k:'rep_doctors', t:'حسابات الأطباء', i:'👨‍⚕️', c:'violet'},
  {k:'rep_cash', t:'حركة الخزينة', i:'🏦', c:'lime'},
  {k:'rep_settle', t:'كشف تسويات المصروفات', i:'📑', c:'gold'},
  {k:'rep_journal', t:'تحليل إيرادات العيادة', i:'🧾', c:'cyan'},
  {k:'rep_committee', t:'تقرير اللجنة', i:'🏛️', c:'violet'},
  {k:'rep_clinics', t:'تقارير العيادات', i:'🏨', c:'orange'},
  {k:'rep_companies', t:'شركات التأمين', i:'🏢', c:'cyan'},
  {k:'rep_patients', t:'المرضى', i:'🧑‍🤝‍🧑', c:'blue'},
  {k:'rep_services', t:'الخدمات والزيارات', i:'💉', c:'pink'},
  {k:'rep_operations', t:'العمليات', i:'🏥', c:'red'},
  {k:'rep_expenses', t:'المصروفات', i:'💸', c:'gold'},
  {k:'opx_rep', t:'المصروفات التشغيلية', i:'📊', c:'orange'},
  {k:'rep_staff', t:'نشاط مسئولي التسجيل', i:'👥', c:'lime'}
];
const ALL_COLORS = ['teal','orange','pink','violet','blue','gold','red','lime','cyan'];
const COLHEX = {teal:'#14c8b4',orange:'#ff8a1f',pink:'#ff3d9a',violet:'#8a5cff',blue:'#2f9bff',gold:'#ffc400',red:'#ff4d4d',lime:'#8fd91a',cyan:'#12c6e8'};

const S = {ctr: {}, scope: {}, user: null, data: {users:[],staff:[],doctors:[],services:[],operations:[],patients:[],companies:[],visits:[],expenses:[],custody:[],execs:[],opx:[],opset:[]}, screen: 'home', arg: null, stack: [], rng: {mode:'today', a: today(), b: today()}, view: null};
const Acts = {};
let clockTimer = null;

/* ---------- صلاحيات ---------- */
const can = p => S.user && (p === 'admin' ? !!S.user.isAdmin : S.user.isAdmin || (S.user.perms || []).includes(p) || (S.user.perms || []).includes('*'));
const anyRep = () => REPS.some(r => can(r.k));

/* ---------- واجهة عامة ---------- */
function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), err ? 4500 : 2200);
}
function modal(html, onClose) {
  const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="m">${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m) { m.remove(); onClose && onClose(); } });
  document.body.appendChild(m); return m;
}
function confirmBox(msg) {
  return new Promise(ok => {
    const m = modal(`<p style="font-size:1.15rem;font-weight:bold">${esc(msg)}</p><div class="actions"><button class="btn c-red" id="cy">نعم، متأكد</button><button class="btn ghost" id="cn">إلغاء</button></div>`, () => ok(false));
    $('#cy', m).onclick = () => { m.remove(); ok(true); }; $('#cn', m).onclick = () => { m.remove(); ok(false); };
  });
}
const spin = () => '<div class="spinner"></div>';
async function guard(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); }
  catch (e) { if (e.code === 'auth') { logoutLocal(); } toast(e.message || 'حدث خطأ', true); }
  finally { if (btn) btn.disabled = false; }
}

/* ---------- الصور ---------- */
const imgCache = new Map();
async function fileURL(id) {
  if (!id) return '';
  if (imgCache.has(id)) return imgCache.get(id);
  const r = await API.call('file', {id}); imgCache.set(id, r.dataUrl); return r.dataUrl;
}
async function hydrateImgs(root = document) {
  for (const el of $$('[data-fid]', root)) {
    const id = el.dataset.fid; if (!id || el.dataset.done === id) continue; el.dataset.done = id;
    try { const u = await fileURL(id); if (el.tagName === 'IMG') el.src = u; else { el.innerHTML = `<img src="${u}" alt="">`; } } catch (e) { el.textContent = '⚠️'; }
  }
}
async function compressImage(file) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('تعذر قراءة الصورة')); i.src = url; });
  const k = Math.min(1, 1280 / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}
Acts.lightbox = el => { const id = el.dataset.fid; if (!id) return; fileURL(id).then(u => modal(`<img src="${u}" alt="">`)); };
Acts.pickimg = el => $('input[type=file]', el.closest('.imgfld')).click();

document.addEventListener('change', async e => {
  const f = e.target; if (f.type !== 'file' || !f.files[0]) return;
  const box = f.closest('.imgfld'); if (!box) return;
  await guard(null, async () => {
    toast('جاري رفع الصورة…');
    const data = await compressImage(f.files[0]);
    const r = await API.call('upload', {mime: 'image/jpeg', data});
    imgCache.set(r.file, 'data:image/jpeg;base64,' + data);
    $('input[type=hidden]', box).value = r.file; const th = $('.th', box); th.dataset.fid = r.file; th.dataset.done = ''; hydrateImgs(box);
    toast('تم إرفاق الصورة');
    const hn = ($('input[type=hidden]', box) || {}).name, form = box.closest('form');
    if (form && (hn === 'cardPhoto' || hn === 'idPhoto') && window.OCR) {
      toast('🔍 جاري قراءة بيانات الصورة…');
      try { const done = await OCR.fillForm(form, 'data:image/jpeg;base64,' + data, hn === 'cardPhoto' ? 'card' : 'id'); toast(done.length ? '✅ تمت قراءة: ' + done.join('، ') + ' — راجع البيانات' : 'لم أتمكن من قراءة بيانات واضحة — أدخلها يدوياً'); }
      catch (e) { toast(e.message || 'تعذرت قراءة الصورة', true); }
    }
  });
  f.value = '';
});

/* ---------- حقول النماذج ---------- */
function dateFld(name, val, extra = '') {
  return `<div class="dt"><input type="text" name="${name}" value="${esc(val || '')}" inputmode="numeric" placeholder="yyyy/mm/dd" maxlength="10" data-dt ${extra}><span class="dtb"><button type="button" tabindex="-1" title="اختيار من التقويم">📅</button><input type="date" class="dpk" aria-label="اختيار من التقويم"></span></div>`;
}
document.addEventListener('pointerdown', e => { const d = e.target; if (!d.classList || !d.classList.contains('dpk')) return; const t = $('[data-dt]', d.closest('.dt')); d.value = t && validDate(t.value) ? t.value.replace(/\//g, '-') : ''; }, true);
document.addEventListener('change', e => {
  const d = e.target; if (d.type !== 'date' || !d.value) return;
  const t = $('[data-dt]', d.closest('.dt')); if (!t) return; t.value = d.value.replace(/-/g, '/'); t.dispatchEvent(new Event('input', {bubbles: true})); t.dispatchEvent(new Event('change', {bubbles: true}));
});
document.addEventListener('input', e => {
  const t = e.target; if (!t.matches || !t.matches('[data-dt]')) return;
  let d = t.value.replace(/[٠-٩]/g, x => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)).replace(/[۰-۹]/g, x => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/\D/g, '').slice(0, 8), o = d.slice(0, 4); if (d.length > 4) o += '/' + d.slice(4, 6); if (d.length > 6) o += '/' + d.slice(6, 8);
  if (t.value !== o) t.value = o;
});

function fieldHTML(f, v) {
  const val = v == null ? '' : v, req = f.req ? '<i>*</i>' : '', nm = `name="${f.k}"`;
  let inner;
  switch (f.t) {
    case 'date': inner = dateFld(f.k, val); break;
    case 'num': inner = `<input type="number" step="any" ${nm} value="${esc(val)}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>`; break;
    case 'sel': inner = `<select ${nm}>${(() => { let ol0 = typeof f.opts === 'function' ? f.opts() : f.opts; if (val !== '' && !ol0.some(o => String(o.v != null ? o.v : o) === String(val))) ol0 = [...ol0, {v: val, l: val}]; return ol0; })().map(o => { const ov = o.v != null ? o.v : o, ol = o.l != null ? o.l : o; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`; break;
    case 'area': inner = `<textarea ${nm} rows="2">${esc(val)}</textarea>`; break;
    case 'ro': inner = `<input type="text" ${nm} value="${esc(val)}" readonly tabindex="-1">`; break;
    case 'img': inner = `<div class="imgfld"><div class="th" data-act="lightbox" data-fid="${esc(val)}">🖼️</div><input type="file" accept="image/*" class="hid"><button type="button" class="btn sm c-blue" data-act="pickimg">📷 إرفاق صورة</button><input type="hidden" ${nm} value="${esc(val)}"></div>`; break;
    case 'combo': inner = `<input type="text" ${nm} value="${esc(val)}" data-sg="${f.sg}" autocomplete="off" placeholder="اكتب أو اختر…">`; break;
    case 'docpick': inner = `<div class="docpick"><input type="text" name="${f.k}n" data-sg="${f.sg || 'alldocs'}" autocomplete="off" placeholder="اكتب اسم الطبيب…"><input type="hidden" ${nm} value="${esc(val)}"></div>`; break;
    case 'seg': inner = `<div class="seg" data-seg="${f.k}">${f.opts.map(o => `<button type="button" data-act="seg" data-v="${esc(o.v)}" class="c-${o.c || 'blue'} ${o.v === val ? 'on' : ''}">${esc(o.l)}</button>`).join('')}<input type="hidden" ${nm} value="${esc(val)}"></div>`; break;
    case 'chk': inner = `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" style="width:auto" ${nm} ${val ? 'checked' : ''}> ${esc(f.l2 || 'نعم')}</label>`; break;
    default: inner = `<input type="${f.pw ? 'password' : 'text'}" ${nm} value="${esc(val)}" ${f.sg ? `data-sg="${f.sg}" autocomplete="off"` : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.num ? 'inputmode="numeric"' : ''}>`;
  }
  return `<div class="fld ${f.w === 'full' || f.t === 'area' ? 'full' : ''}" data-f="${f.k}"><label>${esc(f.l)} ${req}</label>${inner}</div>`;
}
Acts.seg = el => {
  const box = el.closest('[data-seg]'); $$('button', box).forEach(b => b.classList.toggle('on', b === el));
  const h = $('input', box); h.value = el.dataset.v; h.dispatchEvent(new Event('change', {bubbles: true}));
};
function readForm(root) {
  const o = {};
  $$('[name]', root).forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : (el.value || '').trim(); });
  return o;
}
function setForm(root, vals) {
  for (const [k, v] of Object.entries(vals)) { const el = $(`[name="${k}"]`, root); if (!el) continue; if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v; if (el.type === 'hidden' && el.closest('[data-seg]')) $$('button', el.closest('[data-seg]')).forEach(b => b.classList.toggle('on', b.dataset.v === v)); if (el.type === 'hidden' && el.closest('.imgfld')) { const th = $('.th', el.closest('.imgfld')); th.dataset.fid = v || ''; th.dataset.done = ''; th.innerHTML = '🖼️'; } }
  docSync(root); hydrateImgs(root);
}
/* مربعات الطبيب بالكتابة: النص الظاهر ↔ المعرّف المخفي */
function docSync(root) { $$('.docpick', root).forEach(w => { const id = $('input[type=hidden]', w).value, d = S.data.doctors.find(x => x.id === id), t = $('input[type=text]', w); t.value = d ? d.name : ''; }); }
function docResolve(name, clinic) {
  name = String(name || '').trim(); if (!name) return null;
  const same = S.data.doctors.filter(d => d.name === name); return same.find(d => clinic && d.clinic === clinic) || same[0] || null;
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.matches || !t.matches('.docpick input[type=text]')) return;
  const form = t.closest('form'), cl = form ? ($('[name=clinic]', form) || {}).value : '', h = $('input[type=hidden]', t.closest('.docpick')), d = docResolve(t.value, cl);
  h.value = d ? d.id : ''; h.dispatchEvent(new Event('change', {bubbles: true}));
});
const docNameCheck = raw => { for (const k of ['_doc', '_anes']) if (raw[k + 'n'] && !raw[k]) throw new Error('اسم الطبيب غير مسجل في شاشة الأطباء: ' + raw[k + 'n']); };
const comboCheck = (v, list, label) => { if (v && !list.includes(v)) throw new Error(label + ' غير موجود — اختر من القائمة المقترحة'); };

/* ---------- التنبؤ بالكتابة ---------- */
let sgBox = null, sgIdx = -1, sgInput = null;
function uniq(arr) { const m = new Map(); arr.forEach(x => { x = String(x == null ? '' : x).trim(); if (x) m.set(x, (m.get(x) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); }
const SG = {
  patients: () => uniq([...S.data.patients.map(p => p.name), ...S.data.visits.map(v => v.patient)]),
  doctors: () => uniq(S.data.doctors.map(d => d.name)),
  clinics: () => clinicNames(),
  clinicsx: () => { const ok = [...clinicNames(), ...EXTRA_CLINICS]; return uniq([...S.data.visits.map(v => v.clinic), ...ok]).filter(x => ok.includes(x)); },
  vtypes: () => uniq([...S.data.visits.map(v => v.visitType), ...VTYPES]),
  alldocs: () => uniq(S.data.doctors.map(d => d.name)),
  clinicdocs: () => { const f = sgInput && sgInput.closest('form'), cl = f ? ($('[name=clinic]', f) || {}).value : '', ds = S.data.doctors.filter(d => !cl || d.clinic === cl), names = ds.map(d => d.name); return uniq([...S.data.visits.filter(v => !cl || v.clinic === cl).map(v => v.doctor), ...names]).filter(x => names.includes(x)); },
  custperson: () => uniq(S.data.custody.map(c => c.person)),
  opnames: () => uniq([...S.data.services.filter(x => x.type === 'operation').map(x => x.name), ...S.data.operations.map(o => o.operation)]),
  companies: () => uniq(S.data.companies.map(c => c.name)),
  services: () => uniq(S.data.services.map(s => s.name)),
  expcats: () => uniq([...S.data.expenses.map(x => x.category), ...SEED_EXP]),
  bayan: () => { const cl = ($('[name=clinic]') || {}).value; const t = cl === 'الأشعة' ? 'radiology' : cl === 'التحاليل' ? 'lab' : cl === 'عمليات جراحية' ? 'operation' : null; return uniq([...S.data.services.filter(s => t ? s.type === t : s.type !== 'clinic').map(s => s.name), ...S.data.visits.map(v => v.service)]); }
};
function sgList(key) { if (SG[key]) return SG[key](); const [e, f] = key.split('.'); return uniq((S.data[e] || []).map(r => r[f])); }
function sgClose() { if (sgBox) { sgBox.remove(); sgBox = null; sgIdx = -1; } }
function sgOpen(inp) {
  const q = inp.value.trim().toLowerCase(); sgInput = inp;
  let list = sgList(inp.dataset.sg);
  if (q) list = [...list.filter(x => x.toLowerCase().startsWith(q)), ...list.filter(x => !x.toLowerCase().startsWith(q) && x.toLowerCase().includes(q))];
  list = list.filter(x => x.toLowerCase() !== q).slice(0, 12);
  sgClose(); if (!list.length) return;
  sgBox = document.createElement('div'); sgBox.className = 'sgbox';
  const r = inp.getBoundingClientRect(); sgBox.style.cssText = `top:${r.bottom + scrollY + 2}px;left:${r.left + scrollX}px;width:${r.width}px`;
  sgBox.innerHTML = list.map(x => `<div>${esc(x)}</div>`).join(''); document.body.appendChild(sgBox);
  sgBox.addEventListener('mousedown', e => { const d = e.target.closest('div'); if (!d) return; e.preventDefault(); sgPick(d.textContent); });
}
function sgPick(v) { sgInput.value = v; sgClose(); sgInput.dispatchEvent(new Event('input', {bubbles: true})); sgInput.dispatchEvent(new Event('change', {bubbles: true})); }
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('[data-sg]')) sgOpen(e.target); });
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('[data-sg]')) sgOpen(e.target); });
document.addEventListener('focusout', () => setTimeout(sgClose, 120));
document.addEventListener('keydown', e => {
  if (!sgBox || !e.target.matches('[data-sg]')) return;
  const items = $$('div', sgBox);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sgIdx = (sgIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((d, i) => d.classList.toggle('on', i === sgIdx)); }
  else if (e.key === 'Enter' && sgIdx >= 0) { e.preventDefault(); sgPick(items[sgIdx].textContent); }
  else if (e.key === 'Escape') sgClose();
});

/* ---------- مخططات إنفوجرافيك ---------- */
function donut(items, size = 190) {
  const tot = items.reduce((s, i) => s + i.v, 0), R = 70, C = 2 * Math.PI * R; let off = 0;
  const segs = tot ? items.filter(i => i.v > 0).map(i => { const len = i.v / tot * C; const s = `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${COLHEX[i.c] || i.c}" stroke-width="30" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(i.l)}: ${fmtN(i.v)}</title></circle>`; off += len; return s; }).join('') : '';
  return `<div style="text-align:center"><svg viewBox="0 0 200 200" width="${size}" height="${size}"><circle r="${R}" cx="100" cy="100" fill="none" stroke="#eef0f6" stroke-width="30"/>${segs}<text x="100" y="96" text-anchor="middle" font-size="13" font-family="Times New Roman">الإجمالي</text><text x="100" y="120" text-anchor="middle" font-size="22" font-weight="bold" font-family="Times New Roman">${fmtN(tot)}</text></svg><div class="legend">${items.map(i => `<span><i style="background:${COLHEX[i.c] || i.c}"></i>${esc(i.l)}: ${fmtN(i.v)}</span>`).join('')}</div></div>`;
}
function bars(items, click) {
  const mx = Math.max(1, ...items.map(i => i.v));
  return items.length ? items.map((i, n) => `<div class="barrow c-${i.c || ALL_COLORS[n % 9]}"><span ${click ? `class="lnk" data-act="${click}" data-v="${esc(i.l)}"` : ''}>${esc(i.l)}</span><div class="tr"><i style="width:${Math.max(2, i.v / mx * 100)}%"></i></div><b>${fmtN(i.v)}</b></div>`).join('') : '<div class="empty">لا توجد بيانات</div>';
}

/* ---------- الحسابات (مطابقة لمعادلات ملف الإكسيل) ---------- */
const clinicNames = () => S.data.services.filter(s => s.type === 'clinic').map(s => s.name);
const clinicOf = n => S.data.services.find(s => s.type === 'clinic' && s.name === n);
const isSurg = v => v.visitType === 'عمليات جراحية';
const visitsIn = (f, t) => S.data.visits.filter(v => v.date >= f && v.date <= t && !isSurg(v));
function deriveOps() { S.data.operations = (S.opsLegacy || []).concat(S.data.visits.filter(isSurg).map(v => ({id: v.id, _v: 1, serial: v.serial, date: v.date, patient: v.patient, operation: v.operation || v.service, clinic: v.clinic, doctor: v.doctor, doctorId: v.doctorId, value: v.value, doctorPercent: v.doctorPercent, notes: v.notes, anesthetist: v.anesthetist, anesthetistId: v.anesthetistId, anesthesia: v.anesthesia, deductAnes: v.deductAnes, docNo: v.docNo}))); }
function findDoctor(v) {
  const D = S.data.doctors;
  return D.find(d => d.id === v.doctorId) || D.find(d => d.name === v.doctor && d.clinic === v.clinic) || D.find(d => d.name === v.doctor);
}
const isOn = v => v === true || v === 'true' || v === '1' || v === 1;
/* حساب العملية: نصيب الطبيب بعد خصم التخدير (إن اختيرت الخانة) + مستحق طبيب التخدير */
function opCalc(o) {
  const d = S.data.doctors.find(x => x.id === o.doctorId) || S.data.doctors.find(x => x.name === o.doctor);
  const pct = +(o.doctorPercent != null && o.doctorPercent !== '' ? o.doctorPercent : (d ? d.opPercent : 0)) || 0, an = +o.anesthesia || 0, base = Math.max(0, (+o.value || 0) - (isOn(o.deductAnes) ? an : 0));
  return {doc: d, pct, anes: an, base, surgeon: base * pct / 100};
}
function emptyAcc(key, doc, name, clinic) { return {key, doc, name, clinic, visits: 0, kosf: 0, mixed: 0, committee: 0, company: 0, insurance: 0, consult: 0, total: 0, tax: 0, due: 0, fixed: 0, right: 0, ops: 0, dayMap: new Map()}; }
const opsCountR = () => { const {from, to} = getRange(); return S.data.operations.filter(o => o.date >= from && o.date <= to).length; };
const isCenterShare = v => (v.notes || '').startsWith('تحمل المريض —') || (v.clinic === 'المركز' && v.service === 'نسبة شركات');
function accounts(from, to) {
  const map = new Map();
  for (const v of visitsIn(from, to)) {
    if (isCenterShare(v)) continue;
    const d = findDoctor(v), key = d ? d.id : '?|' + (v.doctor || '') + '|' + (v.clinic || '');
    let r = map.get(key); if (!r) { r = emptyAcc(key, d, d ? d.name : (v.doctor || '—'), d ? d.clinic : v.clinic); map.set(key, r); }
    const val = +v.value || 0, tx = +v.tax || 0; r.visits++;
    if (v.visitType === 'كشف') r.kosf += val; if (v.visitType === 'متنوع') r.mixed += val; if (v.visitType === 'استشارة') r.consult++;
    r.committee += comAmt(v); if (v.category === 'company') r.company += val; if (v.category === 'insurance') r.insurance += val; else if (v.remTo === 'insurance') r.insurance += xfer(v);
    r.total += val; r.tax += tx;
    const dm = r.dayMap.get(v.date) || {rev: 0, tax: 0}; dm.rev += val; dm.tax += tx; r.dayMap.set(v.date, dm);
  }
  for (const r of map.values()) {
    const pct = r.doc ? +r.doc.percent || 0 : 0, fx = r.doc ? +r.doc.fixed || 0 : 0;
    for (const dm of r.dayMap.values()) { const due = (dm.rev - dm.tax) * pct / 100; r.due += due; r.fixed += fx; r.right += Math.max(fx, due); }
    r.cash = r.kosf + r.mixed - r.committee - r.company - r.insurance;
  }
  for (const o of S.data.operations.filter(o => o.date >= from && o.date <= to)) {
    const d = S.data.doctors.find(x => x.id === o.doctorId) || S.data.doctors.find(x => x.name === o.doctor);
    const key = d ? d.id : '?|' + (o.doctor || '') + '|' + (o.clinic || '');
    let r = map.get(key); if (!r) { r = emptyAcc(key, d, d ? d.name : (o.doctor || '—'), d ? d.clinic : o.clinic); r.cash = 0; map.set(key, r); }
    const oc = opCalc(o); r.ops += oc.surgeon;
    if (oc.anes > 0 && (o.anesthetistId || o.anesthetist)) {
      const ad = S.data.doctors.find(x => x.id === o.anesthetistId) || S.data.doctors.find(x => x.name === o.anesthetist), ak = ad ? ad.id : '?|' + (o.anesthetist || '') + '|';
      let ar = map.get(ak); if (!ar) { ar = emptyAcc(ak, ad, ad ? ad.name : (o.anesthetist || '—'), ad ? ad.clinic : ''); ar.cash = 0; map.set(ak, ar); }
      ar.ops += oc.anes;
    }
  }
  return [...map.values()].sort((a, b) => (a.clinic || '').localeCompare(b.clinic || '', 'ar') || a.name.localeCompare(b.name, 'ar'));
}
function lastDue(doc) {
  const vs = S.data.visits.filter(v => { const d = findDoctor(v); return d && d.id === doc.id; });
  if (!vs.length) return null;
  const last = vs.reduce((m, v) => v.date > m ? v.date : m, ''); const a = accounts(last, last).find(r => r.doc && r.doc.id === doc.id);
  return a ? {date: last, amount: a.right} : null;
}
function lastVisitOf(patient, phone, beforeId, beforeDate) {
  const vs = S.data.visits.filter(v => v.id !== beforeId && (!beforeDate || v.date <= beforeDate) && ((patient && v.patient === patient) || (phone && v.phone === phone)));
  return vs.sort((a, b) => (b.date + String(1e6 + (b.serial || 0))).localeCompare(a.date + String(1e6 + (a.serial || 0))))[0] || null;
}
/* الشركات: قيمة الكشف بالشركة (من شاشة شركات التأمين) هي أساس نسبة تحمل المريض */
const coFee = n => +((S.data.companies.find(c => c.name === n) || {}).fee) || 0;
const coVal = v => (v.visitType === 'كشف' && coFee(v.company) > 0) ? coFee(v.company) : (+v.value || 0);
const coShare = v => coVal(v) * (+v.patientPct || 0) / 100;
const coDue = v => coVal(v) - coShare(v);
/* إيراد اليوم = كل الزيارات؛ الصافي يُخصم منه الشركات واللجنة وقيمة نسبة خصم التأمين فقط */
const expOther = (f, t) => S.data.expenses.filter(x => x.date >= f && x.date <= t && !x.doctor).reduce((s, x) => s + (+x.amount || 0), 0);
const payDay = x => x.dueDate || x.date;
const docPaid = (f, t) => S.data.expenses.filter(x => x.doctor && payDay(x) >= f && payDay(x) <= t).reduce((s, x) => s + (+x.amount || 0), 0);
const isCash = v => (v.category || 'cash') === 'cash';
const cashRev = a => a.filter(isCash).reduce((s, v) => s + (+v.value || 0), 0);
const patientShare = v => v.category === 'company' ? coShare(v) : 0;
/* مديونية المريض: المستحق عليه = (كاش: القيمة | شركة: نصيب المريض | تأمين: الصافي بعد الخصم | لجنة: 0) — والمدفوع الفارغ = مسدد بالكامل */
const restV = v => (v.paid === '' || v.paid == null) ? 0 : Math.max(0, (+v.value || 0) - (+v.paid || 0));
const xfer = v => v.category === 'cash' && (v.remTo === 'committee' || v.remTo === 'insurance') ? restV(v) : 0;
const comAmt = v => v.category === 'committee' ? ((v.paid === '' || v.paid == null) ? (+v.value || 0) : restV(v)) : (v.remTo === 'committee' ? xfer(v) : 0);
const dueOf = v => v.category === 'company' ? coShare(v) : v.category === 'committee' ? 0 : (+v.value || 0) - discountAmt(v) - (v.remTo === 'committee' ? xfer(v) : 0);
const owedOf = v => (v.paid === '' || v.paid == null) ? 0 : Math.max(0, dueOf(v) - (+v.paid || 0));
const paidOf = v => (v.paid === '' || v.paid == null) ? dueOf(v) : (+v.paid || 0);
const discountAmt = v => v.category === 'insurance' ? (+v.value || 0) * (+v.discount || 0) / 100 : (v.remTo === 'insurance' ? xfer(v) : 0);

/* ---------- شريط التاريخ المشترك ---------- */
const getRange = () => { const r = S.rng; if (r.mode === 'all') return {from: '0000/00/00', to: '9999/99/99'}; return r.mode === 'today' ? {from: today(), to: today()} : r.mode === 'day' ? {from: r.a, to: r.a} : {from: r.a <= r.b ? r.a : r.b, to: r.a <= r.b ? r.b : r.a}; };
const rangeLabel = () => { if (S.rng.mode === 'all') return 'كل الفترات'; const {from, to} = getRange(); return from === to ? `${dayName(from)} ${from}` : `من ${from} إلى ${to}`; };
function rangeBar() {
  const r = S.rng;
  return `<div class="bar noprint" data-rangebar><div class="seg">${[['today','اليوم'],['day','تاريخ محدد'],['range','من – إلى'],['all','الكل']].map(([k, l]) => `<button class="c-teal ${r.mode === k ? 'on' : ''}" data-act="rmode" data-v="${k}">${l}</button>`).join('')}</div>${r.mode === 'day' || r.mode === 'range' ? `<span>${r.mode === 'range' ? 'من' : 'التاريخ'}</span>${dateFld('rA', r.a)}` : ''}${r.mode === 'range' ? `<span>إلى</span>${dateFld('rB', r.b)}` : ''}<b>${esc(rangeLabel())}</b></div>`;
}
Acts.rmode = el => { S.rng.mode = el.dataset.v; if (S.rng.mode !== 'today' && !validDate(S.rng.a)) S.rng.a = today(); if (!validDate(S.rng.b)) S.rng.b = today(); refreshView(); };
const rangeSet = e => {
  const n = e.target.name; if ((n !== 'rA' && n !== 'rB') || !e.target.matches || !e.target.matches('[data-dt]')) return;
  const v = e.target.value; if (!validDate(v)) { if (e.type === 'change' && v) toast('التاريخ يجب أن يكون yyyy/mm/dd', true); return; }
  const k = n === 'rA' ? 'a' : 'b'; if (S.rng[k] === v) return; S.rng[k] = v; refreshView(true);
};
document.addEventListener('change', rangeSet); document.addEventListener('input', rangeSet);
function refreshView(keepFocus) { if (S.view && S.view.refresh) S.view.refresh(); else render(); }

/* ---------- التنقل ---------- */
function nav(screen, arg) { S.stack.push({screen: S.screen, arg: S.arg}); S.screen = screen; S.arg = arg; render(); scrollTo(0, 0); }
function back() { const p = S.stack.pop(); if (!p) return home(); S.screen = p.screen; S.arg = p.arg; render(); }
function home() { S.stack = []; S.screen = 'home'; S.arg = null; render(); }
Acts.home = () => home(); Acts.back = () => back();
Acts.logout = async () => { try { await API.call('logout'); } catch (e) {} logoutLocal(); };
function logoutLocal() { API.setToken(null); S.user = null; S.stack = []; S.screen = 'home'; render(); }
Acts.go = el => { el.classList.add('pop'); setTimeout(() => { nav(el.dataset.s, el.dataset.arg); }, 260); };

let syncSig = '';
const curTitle = () => S.screen === 'home' ? 'الرئيسية' : ((SCREENS.concat(REPS)).find(x => x.k === S.screen) || {t: S.screen}).t;
async function syncOnce() {
  if (!S.user || document.hidden) return;
  API.call('ping', {page: curTitle()}).catch(e => { if (e.code === 'auth') logoutLocal(); });
  if (document.querySelector('.modal')) return;
  const ae = document.activeElement; if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) && ae.closest('form')) return;
  try {
    const old = JSON.stringify(S.data); await loadAll();
    if (JSON.stringify(S.data) !== old) {
      /* تحديث صامت في الخلفية: بدون إشعار وبدون إغلاق الصفحة/النماذج المفتوحة */
      const y = window.scrollY, sc = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
      if (S.view && S.view.refresh) { try { await S.view.refresh(); } catch (e) {} }
      else if (!S.dirty) { S.syncing = true; render(); S.syncing = false; }
      window.scrollTo(0, y || sc);
    }
  } catch (e) { if (e.code === 'auth') logoutLocal(); }
}
window.__syncNow = () => syncOnce();
document.addEventListener('input', e => { if (e.target && e.target.closest && e.target.closest('#main form')) S.dirty = true; }, true);
function startSync() {
  if (window.__sync) return; window.__sync = setInterval(syncOnce, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncOnce(); });
  window.addEventListener('online', () => syncOnce());
}
async function loadAll(ents) {
  if (!ents) loadSettings();
  await Promise.all((ents || Object.keys(S.data)).map(async e => {
    try { const rr = await API.call('list', {entity: e}); if (e === 'operations') S.opsLegacy = rr.items; else S.data[e] = rr.items; if (rr.ctr != null) S.ctr[e] = rr.ctr; } catch (err) { if (err.code === 'auth') throw err; S.data[e] = []; }
  }));
  deriveOps();
}

const LOGO = `<svg viewBox="0 0 120 120" aria-label="شعار المركز"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ac9"/><stop offset="1" stop-color="#ff3d9a"/></linearGradient><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ff5d6"/><stop offset="1" stop-color="#2f9bff"/></linearGradient><linearGradient id="lg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ff8a1f"/></linearGradient></defs><g transform="translate(60 60)"><ellipse rx="14" ry="34" cy="-26" fill="url(#lg1)" transform="rotate(0)"/><ellipse rx="14" ry="34" cy="-26" fill="url(#lg3)" transform="rotate(72)"/><ellipse rx="14" ry="34" cy="-26" fill="url(#lg2)" transform="rotate(144)"/><ellipse rx="14" ry="34" cy="-26" fill="url(#lg1)" transform="rotate(216)" opacity=".85"/><ellipse rx="14" ry="34" cy="-26" fill="url(#lg3)" transform="rotate(288)" opacity=".85"/><circle r="17" fill="#fff"/><path d="M-4-11h8v7h7v8h-7v7h-8v-7h-7v-8h7z" fill="#ff3d9a"/></g></svg>`;

/* ---------- الهيكل العام ---------- */
function render() {
  clearInterval(clockTimer); S.view = null; S.scope = {}; S.dirty = false; sgClose();
  const app = $('#app');
  if (!S.user) return renderLogin(app);
  app.innerHTML = `<div class="shell"><aside class="side noprint" id="side">${sideHTML()}</aside><div class="content"><header class="top"><button class="btn sm c-orange menubtn" data-act="sidetoggle">☰</button><div class="brand" data-act="home">${CLOGO ? `<img src="${CLOGO}" alt="">` : LOGO}<span>${esc(APPNAME)}</span></div><div class="grow"></div>${S.screen !== 'home' ? '<button class="btn sm c-blue" data-act="back">↩ رجوع</button><button class="btn sm c-teal" data-act="home">🏠 الرئيسية</button>' : ''}<div class="who"><span>المستخدم:</span><b>${esc(S.user.username)}</b><button class="btn sm c-red" data-act="logout">خروج</button></div></header><main class="main" id="main">${spin()}</main></div></div>`;
  if (window.Bars) Bars.mount(app);
  const f = S.screen === 'home' ? renderHome : window.SCREEN_RENDER && window.SCREEN_RENDER[S.screen];
  if (f) Promise.resolve(f(S.arg)).catch(e => { if (e.code === 'auth') logoutLocal(); else $('#main').innerHTML = `<div class="panel">⚠️ ${esc(e.message)}</div>`; });
  else $('#main').innerHTML = `<div class="panel"><b>الشاشة غير موجودة</b> (${esc(S.screen)})<br><small dir="ltr">build ${window.BUILD || '?'} — screens loaded: ${Object.keys(window.SCREEN_RENDER || {}).length}${(window.__errs || []).length ? '<br>errors: ' + esc(window.__errs.join(' | ')) : ''}</small></div>`;
}
function sideHTML() {
  const it = (k, t, i) => can(k) ? `<button class="si ${S.screen === k ? 'on' : ''}" data-act="sgo" data-s="${k}"><span>${i}</span>${t}</button>` : '';
  const grp = (t, a) => a.join('').trim() ? `<div class="sh">${t}</div>${a.join('')}` : '';
  const sc = k => { const x = SCREENS.find(y => y.k === k); return it(k, x.t, x.i); };
  return `<div class="sbrand" data-act="home">${CLOGO ? `<img src="${CLOGO}" alt="">` : LOGO}<b>${esc(APPNAME)}</b></div>
  <button class="si ${S.screen === 'home' ? 'on' : ''}" data-act="sgo" data-s="home"><span>🏠</span>الرئيسية</button>
  ${grp('العمل اليومي', ['visits', 'patients', 'operations', 'doctors', 'dues', 'services', 'companies', 'staff', 'expenses', 'execs', 'custody'].map(sc))}
  ${grp('المصروفات التشغيلية', ['opx_data', 'opx_reg', 'opx_apr', 'opx_items'].map(sc))}
  ${grp('التقارير', [anyRep() ? `<button class="si ${S.screen === 'reports' || /^(rep_|opx_rep)/.test(S.screen) ? 'on' : ''}" data-act="sgo" data-s="reports"><span>📊</span>التقارير</button>` : ''])}
  ${grp('الإعدادات', [sc('opx_set'), sc('users'), sc('admin')])}
  <button class="si ${S.screen === 'guide' ? 'on' : ''}" data-act="sgo" data-s="guide"><span>📖</span>دليل الاستخدام</button>`;
}
Acts.sgo = el => { S.stack = []; S.screen = el.dataset.s; S.arg = null; render(); scrollTo(0, 0); };
Acts.sidetoggle = () => { const s = $('#side'); if (s) s.classList.toggle('open'); };
const pageHead = (t, i, c) => `<div class="pagehead c-${c}"><h1><span class="ico">${i}</span>${esc(t)}</h1></div>`;

/* ---------- شاشة الدخول ---------- */
function clockSVG() {
  let ticks = ''; for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180, big = i % 5 === 0, r1 = big ? 80 : 86; ticks += `<line x1="${100 + Math.sin(a) * r1}" y1="${100 - Math.cos(a) * r1}" x2="${100 + Math.sin(a) * 92}" y2="${100 - Math.cos(a) * 92}" stroke="${big ? '#000' : '#888'}" stroke-width="${big ? 3 : 1.2}"/>`; }
  let nums = ''; for (let i = 1; i <= 12; i++) { const a = i * 30 * Math.PI / 180; nums += `<text x="${100 + Math.sin(a) * 68}" y="${100 - Math.cos(a) * 68 + 6}" text-anchor="middle" font-size="16" font-weight="bold" font-family="Times New Roman">${i}</text>`; }
  return `<svg viewBox="0 0 200 200"><defs><linearGradient id="cr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ff5d6"/><stop offset=".5" stop-color="#8a5cff"/><stop offset="1" stop-color="#ff3d9a"/></linearGradient></defs><circle cx="100" cy="100" r="97" fill="#fff" stroke="url(#cr)" stroke-width="6"/>${ticks}${nums}<line id="hh" x1="100" y1="100" x2="100" y2="55" stroke="#000" stroke-width="6" stroke-linecap="round"/><line id="mh" x1="100" y1="100" x2="100" y2="38" stroke="#000" stroke-width="4" stroke-linecap="round"/><line id="sh" x1="100" y1="112" x2="100" y2="28" stroke="#ff3d9a" stroke-width="2" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="#ff8a1f"/></svg>`;
}
function tick() {
  const n = new Date(), s = n.getSeconds(), m = n.getMinutes() + s / 60, h = n.getHours() % 12 + m / 60;
  const set = (id, a) => { const e = $('#' + id); if (e) e.setAttribute('transform', `rotate(${a} 100 100)`); };
  set('sh', s * 6); set('mh', m * 6); set('hh', h * 30);
  const dg = $('#dg'); if (dg) dg.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(s)}`;
  const dl = $('#dl'); if (dl) dl.textContent = `${DAYS[n.getDay()]}  ${toStr(n)}`;
}
async function renderLogin(app) {
  loadSettings();
  let hasUsers = true, connErr = ''; try { hasUsers = (await API.call('status')).hasUsers; } catch (e) { connErr = e.message || 'تعذر الاتصال بالخادم'; }
  const canServer = API.mode === 'php';
  app.innerHTML = `<div class="login"><button class="newuser" id="nu" title="${hasUsers ? 'مستخدم جديد' : 'إنشاء أول مستخدم (المدير)'}" aria-label="مستخدم جديد">👤<sup>＋</sup></button><div class="box"><h1>${esc(APPNAME)}</h1>${connErr ? `<div class="panel" style="border:2px solid #ff4d4d;margin-bottom:8px">⚠️ ${esc(connErr)}<br><small>تحقق من اتصال الإنترنت أو اضغط فحص الاتصال للتشخيص.</small> <button class="btn sm c-blue" onclick="location.reload()">إعادة المحاولة</button> <button class="btn sm c-orange" id="dg2">🔧 فحص الاتصال</button><div id="dgo" style="font-size:.8rem;margin-top:6px;text-align:right;direction:rtl"></div></div>` : ''}
  <div class="clockbox">${clockSVG()}<div><div class="digital" id="dg">--:--:--</div><div class="dateline" id="dl"></div></div></div>
  <form id="lf" class="panel accent c-teal" autocomplete="off"><div class="fld"><label>اسم المستخدم</label><input name="username" autocomplete="off" autocapitalize="off" spellcheck="false" readonly required></div><div class="fld"><label>كلمة السر</label><input name="password" type="password" autocomplete="new-password" readonly required></div><button class="glow c-teal btnbig" type="submit">دخول ➜</button><p class="muted" style="margin:0;text-align:center;font-size:.85rem">${hasUsers ? 'الدخول بعد موافقة المدير فقط' : 'لا يوجد مستخدمون بعد — اضغط أيقونة 👤＋ لإنشاء أول مستخدم (المدير)'}</p></form>
  <form id="rf" class="panel accent c-pink hidden" autocomplete="off"><h3>مستخدم جديد</h3>${hasUsers ? '<p style="margin:0">سيتم تفعيل الحساب بعد موافقة المدير ومنحه الصلاحيات، ولا يمكنك الدخول قبل ذلك.</p>' : '<p style="margin:0"><b>أول مستخدم يصبح مدير النظام</b> ويُحمَّل الأطباء والعيادات والشركات من ملف الإكسيل تلقائياً.</p>'}
  <div class="fld"><label>اسم المستخدم</label><input name="username" required></div><div class="fld"><label>كلمة السر</label><input name="password" type="password" required></div><div class="fld"><label>الرقم القومي</label><input name="nationalId" inputmode="numeric" maxlength="14"></div><div class="fld"><label>تاريخ الميلاد</label>${dateFld('birthDate', '')}</div><button class="glow c-pink btnbig" type="submit">إنشاء الحساب</button><button type="button" class="linkbtn" id="bk">رجوع لتسجيل الدخول</button></form>
</div></div>`;
  tick(); clockTimer = setInterval(tick, 1000);
  /* منع الملء التلقائي لليوزر والباسورد: الحقول تبدأ فارغة وللقراءة فقط حتى النقر عليها */
  $$('#lf input').forEach(i => { i.addEventListener('focus', () => i.removeAttribute('readonly'), {once: true}); });
  [150, 600, 1500].forEach(ms => setTimeout(() => { const f = $('#lf'); if (f) $$('input', f).forEach(i => { if (document.activeElement !== i) i.value = ''; }); }, ms));
  const dg2 = $('#dg2'); if (dg2) dg2.onclick = async () => { dg2.disabled = true; $('#dgo').textContent = 'جاري الفحص…'; const r = await API.diag(); $('#dgo').innerHTML = r.map(x => `<div>${esc(x)}</div>`).join(''); dg2.disabled = false; };
  const showReg = on => { $('#lf').classList.toggle('hidden', on); $('#rf').classList.toggle('hidden', !on); };
  $('#nu').onclick = () => showReg(true);
  $('#bk').onclick = () => showReg(false);
  if (false) $('#srv').onclick = () => { const cur = (() => { try { return localStorage.getItem('mc_server') || ''; } catch (e) { return ''; } })();
    const u = prompt('الصق رابط نشر Google Apps Script (ينتهي بـ /exec) لتعمل هذه النسخة على نفس بيانات الشيت.\nاتركه فارغاً للعودة للخادم المحلي.', cur);
    if (u === null) return; const t = u.trim(); if (t && !/^https:\/\/script\.google\.com\/.+\/exec/.test(t)) return toast('الرابط غير صحيح');
    API.setServer(t); toast(t ? 'تم الربط بجوجل شيت' : 'تمت العودة للخادم المحلي'); renderLogin(app); };
  $('#lf').onsubmit = e => { e.preventDefault(); const b = $('button', e.target); guard(b, async () => { const v = readForm(e.target); const r = await API.call('login', v); API.setToken(r.token); S.user = r.user; await loadAll(); render(); setTimeout(() => window.autoSeedCheck && autoSeedCheck(), 600); }); };
  $('#rf').onsubmit = e => { e.preventDefault(); const b = $('button', e.target); guard(b, async () => {
    const v = readForm(e.target); if (v.birthDate && !validDate(v.birthDate)) throw new Error('تاريخ الميلاد يجب أن يكون yyyy/mm/dd');
    const r = await API.call('register', v); toast(r.pending ? 'تم إنشاء الحساب، بانتظار موافقة المدير' : 'تم إنشاء حساب المدير، سجل الدخول');
    if (r.pending) { renderLogin(app); return; }
    const l = await API.call('login', {username: v.username, password: v.password}); API.setToken(l.token); S.user = l.user; await loadAll(); render(); setTimeout(() => window.autoSeedCheck && autoSeedCheck(), 600);
  }); };
}

/* ---------- الشاشة الرئيسية ---------- */
function renderHome() {
  const main = $('#main');
  const draw = () => {
    const {from, to} = getRange(), vs = visitsIn(from, to), acc = accounts(from, to);
    const st = statementRows(from, to), tax = vs.reduce((s, v) => s + (+v.tax || 0), 0), dues = st.due, exp = st.expO;
    const cm = new Map(); vs.filter(v => v.clinic).forEach(v => { const dn = v.doctor || '', k = v.clinic + '\u0001' + dn, o = cm.get(k) || {n: v.clinic, d: dn, cnt: 0, rev: 0}; o.cnt++; o.rev += +v.value || 0; cm.set(k, o); });
    S.data.operations.filter(x => x.date >= from && x.date <= to && x.clinic).forEach(x => { const dn = x.doctor || '', k = x.clinic + '\u0001' + dn, o = cm.get(k) || {n: x.clinic, d: dn, cnt: 0, rev: 0}; o.cnt++; o.rev += +x.value || 0; cm.set(k, o); });
    const clin = [...cm.values()];
    clin.sort((a, b) => b.rev - a.rev || b.cnt - a.cnt); const mx = Math.max(1, ...clin.map(c => c.rev));
    const kp = [['عدد الزيارات', vs.length + opsCountR(), 'teal', '🧾'], ['إيراد الكشف', fmtN(st.kosf), 'blue', '🩺'], ['إيراد متنوع', fmtN(st.mixed), 'cyan', '🧩'], ['إيراد العمليات', fmtN(st.opsRev), 'red', '🏥'], ['إجمالي إيراد اليوم', fmtN(st.dayRev), 'orange', '💰'], ['حقوق الأطباء (المستحق)', fmtN(dues), 'violet', '👨‍⚕️'], ['مدفوع للأطباء', fmtN(st.paid), 'lime', '💵'], ['المصروفات', fmtN(exp), 'gold', '💸'], ['الصافي', fmtN(st.net), 'teal', '📊'], ['الضريبة', fmtN(tax), 'pink', '🏛️'], ['إجمالي اللجنة', fmtN(vs.reduce((t, v) => t + comAmt(v), 0)), 'violet', '🏛️'], ['إجمالي الشركات', fmtN(vs.filter(v => v.category === 'company').reduce((t, v) => t + (+v.value || 0), 0)), 'blue', '🏢']];
    const catData = Object.keys(CAT).map(k => ({l: CAT[k], v: vs.filter(v => (v.category || 'cash') === k).reduce((s, v) => s + (+v.value || 0), 0), c: CATC[k]}));
    const tiles = SCREENS.filter(s => can(s.k)).map(s => ({...s, n: s.k === 'visits' ? vs.length : null}));
    if (anyRep()) tiles.push({k: 'reports', t: 'التقارير', i: '📊', c: 'violet'});
    main.innerHTML = `<div class="pagehead"><h1>🏠 الشاشة الرئيسية — ${esc(rangeLabel())}</h1></div>${rangeBar()}<div class="bar noprint">${window.exportButtons}</div>
    <div class="kpis">${kp.map(k => `<div class="glow kpi c-${k[2]}" data-act="kpi" data-l="${esc(k[0])}" data-v="${esc(k[1])}"><small>${k[3]} ${k[0]}</small><strong>${k[1]}</strong></div>`).join('')}</div>
    ${tiles.length ? '' : '<div class="panel">حسابك مفعّل لكن لم يُمنح أي صلاحيات بعد. اطلب من المدير فتح الشاشات المطلوبة.</div>'}
    <div class="sect"><h2>الشاشات</h2></div><div class="cards">${tiles.map(t => `<button class="glow tile c-${t.c}" data-act="go" data-s="${t.k}"><span class="ic">${t.i}</span><b>${t.t}</b>${t.n != null ? `<span class="n">${t.n}</span>` : ''}</button>`).join('')}</div>
    <div class="sect"><h2>العيادات — ${esc(rangeLabel())}</h2></div><div class="cards">${clin.map((c, i) => `<button class="glow tile clinic c-${ALL_COLORS[i % 9]}" data-act="clinicrep" data-v="${esc(c.n)}" data-d="${esc(c.d)}"><div class="row"><b>${esc(c.n)}</b><span class="n">${c.cnt}</span></div><small class="cdocs">${c.d ? 'د. ' + esc(String(c.d).replace(/^د\.?\s*/, '')) : ''}</small><div class="row"><small>زيارة</small><strong>${fmtN(c.rev)}</strong></div><div class="meter"><i style="width:${c.rev / mx * 100}%"></i></div></button>`).join('') || '<div class="empty">لا توجد زيارات في هذه الفترة</div>'}</div>`;
  };
  S.view = {refresh: draw, exportData: () => {
    const {from, to} = getRange(), vs = visitsIn(from, to), acc = accounts(from, to);
    const st = statementRows(from, to);
    const cl = [...clinicNames(), ...EXTRA_CLINICS].map(n => { const c = vs.filter(v => v.clinic === n); return [n, c.length, c.reduce((s, v) => s + (+v.value || 0), 0)]; }).filter(r => r[1] || clinicOf(r[0]));
    return [{name: 'المؤشرات', rows: [['البند', 'القيمة'], ['عدد الزيارات', vs.length + opsCountR()], ...st.rows, ...st.memo]}, {name: 'العيادات', rows: [['العيادة', 'الزيارات', 'الإيراد'], ...cl]}];
  }}; draw();
}

/* ---------- ربط الأسماء بالتقارير (الضغط على أي اسم) ---------- */
const L = {
  doctor: n => n ? `<span class="lnk" data-act="lnk" data-t="doctor" data-v="${esc(n)}">${esc(n)}</span>` : '',
  patient: n => n ? `<span class="lnk" data-act="lnk" data-t="patient" data-v="${esc(n)}">${esc(n)}</span>` : '',
  clinic: n => n ? `<span class="lnk" data-act="lnk" data-t="clinic" data-v="${esc(n)}">${esc(n)}</span>` : '',
  company: n => n ? `<span class="lnk" data-act="lnk" data-t="company" data-v="${esc(n)}">${esc(n)}</span>` : ''
};
Acts.lnk = el => {
  const m = {doctor: 'rep_doctors', patient: 'rep_patients', clinic: 'rep_clinics', company: 'rep_companies'}[el.dataset.t];
  if (!can(m)) return toast('لا تملك صلاحية هذا التقرير', true);
  nav(m, el.dataset.v);
};

document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const f = Acts[el.dataset.act]; if (f) { e.preventDefault(); f(el, e); } });

window.addEventListener('DOMContentLoaded', async () => {
  try { if (window.AndroidBridge) API.setToken(null); if (API.getToken()) { S.user = (await API.call('me')).user; await loadAll(); } } catch (e) { API.setToken(null); S.user = null; }
  render(); startSync(); setTimeout(() => window.autoSeedCheck && autoSeedCheck(), 1500);
});

Acts.clinicdet = el => {
  const n = el.dataset.v, dd = el.dataset.d || '', {from, to} = getRange(), vs = S.data.visits.filter(v => v.clinic === n && v.date >= from && v.date <= to && (!dd || (v.doctor || '') === dd)), dm = new Map();
  vs.forEach(v => { const d = v.doctor || 'بدون طبيب', o = dm.get(d) || {cnt: 0, rev: 0}; o.cnt++; o.rev += +v.value || 0; dm.set(d, o); });
  const rows = [...dm.entries()].sort((a, b) => b[1].cnt - a[1].cnt);
  const m = modal(`<h3>🏥 ${esc(n)}${dd ? ' — ' + esc(dd) : ''} — ${esc(rangeLabel())}</h3><table><thead><tr><th>الطبيب</th><th>الزيارات</th><th>الإيراد</th></tr></thead><tbody>${rows.map(([d, o]) => `<tr><td>${esc(d)}</td><td>${o.cnt}</td><td>${fmtN(o.rev)}</td></tr>`).join('')}</tbody><tfoot><tr><td>الإجمالي</td><td>${vs.length}</td><td>${fmtN(vs.reduce((t, v) => t + (+v.value || 0), 0))}</td></tr></tfoot></table><div class="actions"><button class="btn c-teal" id="cdr">📋 تقرير العيادة</button><button class="btn ghost" id="cdc">إغلاق</button></div>`);
  $('#cdc', m).onclick = () => m.remove(); $('#cdr', m).onclick = () => { m.remove(); Acts.clinicrep({dataset: {v: n}}); };
};
