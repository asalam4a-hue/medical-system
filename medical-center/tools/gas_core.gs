/**
 * برنامج إدارة المركز الطبي — Google Apps Script
 * قاعدة البيانات: Google Sheets (ورقة لكل شاشة) — الصور: Google Drive (مجلد خاص)
 * نفس أوامر api.js: status, register, login, me, logout, list, save, delete, upload, file
 */
var ENT = ['users', 'staff', 'doctors', 'services', 'operations', 'patients', 'companies', 'visits', 'expenses', 'custody', 'execs', 'opx', 'opset'];
var LOOKUP = ['doctors', 'services', 'patients', 'companies'];
var WRITE = {staff: ['staff'], doctors: ['doctors'], services: ['services'], operations: ['operations'], patients: ['patients', 'visits'], companies: ['companies'], visits: ['visits', 'operations'], expenses: ['expenses', 'dues'], execs: ['execs'], opx: ['opx'], opset: ['opset'], custody: ['custody']};
var FIELDS = {
  users: 'username,nationalId,birthDate,perms,isAdmin,active',
  staff: 'code,name,nationalId,idPhoto,photo',
  doctors: 'code,name,clinic,phone,nationalId,idPhoto,syndicatePhoto,photo,hireDate,percent,fixed,opPercent',
  services: 'type,name,price,tax,abbr',
  operations: 'date,patient,operation,clinic,doctor,doctorId,value,doctorPercent,notes,anesthetist,anesthetistId,anesthesia,deductAnes,docNo',
  patients: 'name,phone',
  companies: 'name,fee,contact',
  visits: 'serial,date,patient,phone,clinic,doctor,doctorId,visitType,service,value,tax,category,company,docNo,formNo,formPhoto,cardNo,cardPhoto,nationalId,patientPct,discount,notes,payMethod,payRef,payPhone,birthDate,paid,operation,anesthetist,anesthetistId,anesthesia,deductAnes,doctorPercent',
  expenses: 'date,category,amount,notes,doctor,dueDate,docNo',
  custody: 'date,person,kind,dir,amount,notes,docNo',
  execs: 'date,patient,cardNo,approvalNo,company,approvalProc,required,done,execDate,clinic,doctor',
  opx: 'date,no,dept,item,center,vendor,invoiceNo,dueDate,amount,desc,status,approvedBy,approvedAt,pays,attach',
  opset: 'kind,code,name,extra,active'
};
var NUMS = 'percent,fixed,opPercent,price,tax,value,doctorPercent,fee,patientPct,discount,amount,code,serial,anesthesia'.split(',');
var DATES = ['date', 'hireDate', 'birthDate', 'dueDate', 'execDate'];
var AUTO = {staff: 'code', doctors: 'code', visits: 'serial'};
var TOKEN_TTL = 21600; // 6 ساعات (أقصى مدة للـ CacheService)

function ApiError(msg, code) { this.message = msg; this.code = code || null; }

/* ---------- الصفحة ---------- */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('برنامج إدارة المركز الطبي')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* نقطة دخول HTTP: تسمح لنسخة PHP/الويب/الأندرويد بالعمل على نفس قاعدة بيانات الشيت */
function doPost(e) {
  return ContentService.createTextOutput(handle(e.postData ? e.postData.contents : '{}')).setMimeType(ContentService.MimeType.JSON);
}

/* نقطة الدخول الوحيدة من الواجهة: google.script.run.handle(JSON) */
function handle(s) {
  try {
    var b = JSON.parse(s);
    return JSON.stringify(route_(b));
  } catch (e) {
    if (e instanceof ApiError) return JSON.stringify({error: e.message, code: e.code});
    console.error(e && e.stack || e);
    return JSON.stringify({error: 'خطأ في الخادم'});
  }
}

/* ---------- التخزين ---------- */
function ss_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('SS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  var ss = SpreadsheetApp.create('بيانات المركز الطبي (لا تعدّلها يدوياً)');
  p.setProperty('SS_ID', ss.getId());
  return ss;
}
function sheet_(name) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(name === 'files' ? ['id', 'driveId', 'mime'] : ['id', 'dt', 'data', 'created']); sh.setFrozenRows(1); sh.getRange('C:C').setNumberFormat('@'); sh.getRange('B:B').setNumberFormat('@'); }
  return sh;
}
function rid_() { var s = ''; for (var i = 0; i < 18; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join(''); }
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function hashPw_(salt, pw) { var h = salt + pw; for (var i = 0; i < 2000; i++) h = sha_(h + salt); return h; }
function validDate_(s) {
  var m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s || ''); if (!m) return false;
  var d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
}
function has_(u, p) { return !!u.isAdmin || (u.perms || []).indexOf(p) >= 0; }
function getAll_(e, from, to) {
  var sh = sheet_(e), n = sh.getLastRow(); if (n < 2) return [];
  var vals = sh.getRange(2, 1, n - 1, 4).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) {
    var dt = String(vals[i][1] || '');
    if (from && dt && dt < from) continue; if (to && dt && dt > to) continue;
    var d = {}; try { d = JSON.parse(vals[i][2]); } catch (x) {} d.id = String(vals[i][0]); out.push(d);
  }
  return out;
}
function findRow_(sh, id) {
  var n = sh.getLastRow(); if (n < 2) return -1;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return -1;
}

/* ---------- أوراق مقروءة بأسماء الشاشات (تتحدث تلقائياً مع كل إدخال/تعديل/حذف) ---------- */
var SHEETN = {staff: 'الموظفون', doctors: 'الأطباء', services: 'الخدمات', operations: 'العمليات', patients: 'المرضى', companies: 'الشركات', visits: 'الزيارات', expenses: 'المصروفات', custody: 'العهد والسلف', execs: 'تنفيذ الشركات', opx: 'المصروفات التشغيلية', opset: 'قوائم المصروفات', users: 'المستخدمون'};
var LABELS = {code: 'الكود', name: 'الاسم', nationalId: 'الرقم القومي', idPhoto: 'صورة البطاقة', photo: 'الصورة', clinic: 'العيادة', phone: 'الهاتف', syndicatePhoto: 'صورة النقابة', hireDate: 'تاريخ التعيين', percent: 'النسبة %', fixed: 'ثابت', opPercent: 'نسبة العمليات %', type: 'النوع', price: 'القيمة', tax: 'الضريبة', abbr: 'الاختصار', date: 'التاريخ', patient: 'المريض', operation: 'العملية', doctor: 'الطبيب', doctorId: 'كود الطبيب', value: 'القيمة', doctorPercent: 'نسبة الطبيب %', notes: 'ملاحظات', anesthetist: 'طبيب التخدير', anesthetistId: 'كود التخدير', anesthesia: 'أجر التخدير', deductAnes: 'خصم التخدير', fee: 'قيمة الكشف', contact: 'جهة الاتصال', serial: 'م', visitType: 'الزيارة', service: 'البيان', category: 'النوع', company: 'الشركة', formNo: 'رقم النموذج', formPhoto: 'صورة النموذج', cardNo: 'رقم الكارنية', cardPhoto: 'صورة الكارنية', patientPct: 'تحمل المريض %', discount: 'الخصم %', payMethod: 'طريقة الدفع', payRef: 'مرجع', payPhone: 'هاتف الدفع', birthDate: 'تاريخ الميلاد', paid: 'المدفوع', amount: 'المبلغ', dueDate: 'تاريخ الاستحقاق', docNo: 'رقم المستند', person: 'الشخص', kind: 'النوع', dir: 'الاتجاه', approvalNo: 'رقم الموافقة', approvalProc: 'الإجراء', required: 'المطلوب', done: 'تم', execDate: 'تاريخ التنفيذ', username: 'المستخدم', isAdmin: 'مدير', active: 'فعّال', perms: 'الصلاحيات', lastLogin: 'آخر دخول', registeredBy: 'سجّله', createdAt: 'وقت الإنشاء'};
var CATL = {cash: 'نقدي', company: 'شركة', insurance: 'تأمين', committee: 'لجنة'};
var MIRROR_OFF = false;
function mirrorKeys_(e) { var k = FIELDS[e].split(','); if (e === 'users') k = ['username', 'isAdmin', 'active', 'lastLogin']; var ex = (e === 'visits' || e === 'expenses' || e === 'custody') ? ['registeredBy', 'createdAt'] : (e === 'users' ? [] : ['createdAt']); return k.filter(function (x) { return x !== 'idPhoto' && x !== 'syndicatePhoto' && x !== 'photo' && x !== 'formPhoto' && x !== 'cardPhoto' && x !== 'payMethod' && x !== 'payRef' && x !== 'payPhone' && x !== 'doctorId' && x !== 'anesthetistId'; }).concat(ex); }
function mirrorVal_(k, v) {
  if (v === undefined || v === null) return '';
  if (k === 'category') return CATL[v] || v;
  if (k === 'isAdmin' || k === 'active' || k === 'done') return v ? 'نعم' : 'لا';
  if (k === 'perms') return Array.isArray(v) ? v.join('، ') : v;
  if (k === 'createdAt' || k === 'lastLogin') return String(v).slice(0, 16).replace('T', ' ');
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}
function mirrorSheet_(e) {
  var ss = ss_(), nm = SHEETN[e], sh = ss.getSheetByName(nm), keys = mirrorKeys_(e);
  if (!sh) {
    sh = ss.insertSheet(nm, 0); var head = ['المعرّف'].concat(keys.map(function (k) { return LABELS[k] || k; }));
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#e8f0fe').setHorizontalAlignment('center');
    sh.setFrozenRows(1); sh.setRightToLeft(true); sh.hideColumns(1);
  }
  return sh;
}
function mirrorRow_(e, r) { return [r.id].concat(mirrorKeys_(e).map(function (k) { return mirrorVal_(k, r[k]); })); }
function mirrorPut_(e, rec) {
  if (MIRROR_OFF || !SHEETN[e]) return;
  try {
    var sh = mirrorSheet_(e), row = findRow_(sh, rec.id), vals = mirrorRow_(e, rec);
    if (row > 0) sh.getRange(row, 1, 1, vals.length).setValues([vals]); else sh.getRange(sh.getLastRow() + 1, 1, 1, vals.length).setValues([vals]);
  } catch (x) { console.error('mirror ' + e + ': ' + x); }
}
function mirrorDel_(e, id) { if (MIRROR_OFF || !SHEETN[e]) return; try { var sh = mirrorSheet_(e), row = findRow_(sh, id); if (row > 0) sh.deleteRow(row); } catch (x) {} }
function mirrorRebuild_(e) {
  if (!SHEETN[e]) return 0;
  var sh = mirrorSheet_(e), n = sh.getLastRow(); if (n > 1) sh.deleteRows(2, n - 1);
  var items = getAll_(e).sort(function (a, b) { return String(a.date || a.createdAt || '').localeCompare(String(b.date || b.createdAt || '')); });
  if (!items.length) return 0;
  var rows = items.map(function (r) { return mirrorRow_(e, r); });
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows); return rows.length;
}
function mirrorAll_() { var o = {}; ENT.forEach(function (e) { o[e] = mirrorRebuild_(e); }); return o; }
function syncSheets() { return mirrorAll_(); } /* يمكن تشغيلها يدوياً من محرر السكربت */

function clean_(e, src) {
  var out = {}, keys = FIELDS[e].split(',');
  keys.forEach(function (k) {
    if (!(k in src)) return; var v = src[k];
    if (k === 'perms') v = Array.isArray(v) ? v.map(String).slice(0, 60) : [];
    else if (k === 'isAdmin' || k === 'active') v = !!v;
    else if (NUMS.indexOf(k) >= 0) v = isNaN(+v) || v === '' || v === null ? 0 : +v;
    else {
      v = String(v == null ? '' : v).trim().slice(0, 500);
      if (DATES.indexOf(k) >= 0 && v && !validDate_(v)) throw new ApiError('صيغة التاريخ يجب أن تكون yyyy/mm/dd');
    }
    out[k] = v;
  });
  return out;
}
/* حفظ جماعي (للمدير): يتخطى المكرر حسب مفتاح، ويكتب دفعة واحدة */
function bulk_(e, me, recs, keyFields) {
  if (e === 'users' || ENT.indexOf(e) < 0) throw new ApiError('كيان غير مسموح');
  var ex = getAll_(e), seen = {}, kf = (keyFields || '').split(',').filter(String);
  var kk = function (r) { return kf.map(function (k) { return String(r[k] == null ? '' : r[k]); }).join('|'); };
  if (kf.length) ex.forEach(function (r) { seen[kk(r)] = 1; });
  var now = new Date().toISOString(), rows = [], added = 0, skipped = 0, ctr = AUTO[e] ? nextCounter_(e, AUTO[e]) - 1 : 0;
  (recs || []).forEach(function (src) {
    var out = clean_(e, src), nm = String(out.name || out.date || out.category || out.type || '').trim(); if (!nm) { skipped++; return; }
    if (kf.length) { var key = kk(out); if (seen[key]) { skipped++; return; } seen[key] = 1; }
    if (AUTO[e]) out[AUTO[e]] = ++ctr;
    var rec = {id: rid_(), createdAt: now}; for (var k in out) rec[k] = out[k]; rec.registeredBy = me.username;
    var copy = {}; for (var k2 in rec) if (k2 !== 'id') copy[k2] = rec[k2];
    rows.push([rec.id, typeof copy.date === 'string' ? copy.date : '', JSON.stringify(copy), now]); added++;
  });
  if (rows.length) { var sh = sheet_(e); sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows); }
  if (AUTO[e]) PropertiesService.getScriptProperties().setProperty('ctr_' + e, String(ctr));
  if (rows.length) mirrorRebuild_(e);
  logAct_(me, 'إضافة جماعية', e, {id: '', name: added + ' سجل'});
  return {added: added, skipped: skipped};
}
function put_(e, rec) {
  var sh = sheet_(e), id = rec.id, copy = {}; for (var k in rec) if (k !== 'id') copy[k] = rec[k];
  var dt = typeof copy.date === 'string' ? copy.date : '', row = findRow_(sh, id);
  if (row > 0) sh.getRange(row, 2, 1, 2).setValues([[dt, JSON.stringify(copy)]]);
  else sh.appendRow([id, dt, JSON.stringify(copy), new Date().toISOString()]);
  mirrorPut_(e, rec);
}
/* سجل العمليات: كل إدخال وتعديل وحذف يُسجَّل في ورقة مستقلة بجوجل شيت */
function logAct_(me, act, e, rec) {
  if (MIRROR_OFF) return;
  try {
    var ss = ss_(), nm = 'سجل العمليات', sh = ss.getSheetByName(nm);
    if (!sh) { sh = ss.insertSheet(nm); sh.getRange(1, 1, 1, 6).setValues([['الوقت', 'المستخدم', 'العملية', 'الشاشة', 'البيان', 'المعرّف']]).setFontWeight('bold').setBackground('#d9ead3'); sh.setFrozenRows(1); sh.setRightToLeft(true); }
    if (e === 'users' && rec) rec = {name: rec.username};
    var d = rec ? (rec.name || rec.patient || rec.category || rec.date || rec.username || '') : '', extra = rec && rec.value ? ' — ' + rec.value : (rec && rec.amount ? ' — ' + rec.amount : '');
    sh.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'), me ? me.username : '', act, SHEETN[e] || e, String(d) + extra, rec && rec.id ? rec.id : '']);
  } catch (x) {}
}
function pub_(u) { var o = {}; for (var k in u) if (k !== 'hash' && k !== 'salt') o[k] = u[k]; return o; }
function peekCounter_(e, f) {
  var v = PropertiesService.getScriptProperties().getProperty('ctr_' + e), m = 0; getAll_(e).forEach(function (r) { m = Math.max(m, +r[f] || 0); });
  return Math.max(+v || 0, m);
}
function nextCounter_(e, f) {
  var p = PropertiesService.getScriptProperties(), key = 'ctr_' + e, v = p.getProperty(key);
  if (v === null) { v = 0; getAll_(e).forEach(function (r) { v = Math.max(v, +r[f] || 0); }); }
  v = (+v) + 1; p.setProperty(key, String(v)); return v;
}
function seed_() {
  MIRROR_OFF = true;
  var now = new Date().toISOString();
  ['services', 'doctors', 'companies', 'staff'].forEach(function (e) {
    (SEED[e] || []).forEach(function (r) { var o = {}; for (var k in r) o[k] = r[k]; o.id = rid_(); o.createdAt = now; if (AUTO[e]) o[AUTO[e]] = nextCounter_(e, AUTO[e]); put_(e, o); });
  });
  MIRROR_OFF = false; mirrorAll_();
}
function withLock_(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- الموجّه ---------- */
function route_(b) {
  var A = String(b.action || ''), cache = CacheService.getScriptCache();
  if (A === 'status') return {hasUsers: getAll_('users').length > 0};
  if (A === 'settings') return {settings: settings_()};

  if (A === 'register') {
    var u = String(b.username || '').trim(), p = String(b.password || '');
    if (u.length < 3 || p.length < 4) throw new ApiError('اسم المستخدم 3 أحرف على الأقل وكلمة السر 4 أحرف على الأقل');
    if (u.length > 40 || p.length > 200) throw new ApiError('بيانات طويلة');
    return withLock_(function () {
      var users = getAll_('users');
      for (var i = 0; i < users.length; i++) if (users[i].username.toLowerCase() === u.toLowerCase()) throw new ApiError('اسم المستخدم موجود بالفعل');
      var first = users.length === 0, salt = rid_(), bd = String(b.birthDate || '');
      put_('users', {id: rid_(), username: u, salt: salt, hash: hashPw_(salt, p), nationalId: String(b.nationalId || '').slice(0, 20), birthDate: validDate_(bd) ? bd : '', perms: first ? ['*'] : [], isAdmin: first, active: first, createdAt: new Date().toISOString()});
      if (first) seed_();
      return {ok: true, pending: !first};
    });
  }

  if (A === 'login') {
    var un = String(b.username || '').trim().toLowerCase(), fkey = 'f_' + sha_(un), fails = +(cache.get(fkey) || 0);
    if (fails >= 5) throw new ApiError('محاولات كثيرة، حاول بعد 10 دقائق');
    var rec = null, all = getAll_('users');
    for (var j = 0; j < all.length; j++) if (all[j].username.toLowerCase() === un) rec = all[j];
    if (!rec || rec.hash !== hashPw_(rec.salt, String(b.password || ''))) { cache.put(fkey, String(fails + 1), 600); throw new ApiError('اسم المستخدم أو كلمة السر غير صحيحة'); }
    if (!rec.active) throw new ApiError('حسابك بانتظار موافقة المدير', 'pending');
    cache.remove(fkey);
    if (rec.isAdmin) { try { var pp = PropertiesService.getScriptProperties(); if (pp.getProperty('MIRROR_V') !== '2') { withLock_(function () { mirrorAll_(); }); pp.setProperty('MIRROR_V', '2'); } } catch (x) { console.error(x); } }
    rec.lastLogin = new Date().toISOString(); rec.lastClient = String(b.client || '').slice(0, 20); put_('users', rec);
    var t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    cache.put('t_' + sha_(t), rec.id, TOKEN_TTL);
    return {token: t, user: pub_(rec)};
  }

  var tk = String(b.token || ''), uid = tk ? cache.get('t_' + sha_(tk)) : null, me = null;
  if (uid) { var us = getAll_('users'); for (var k = 0; k < us.length; k++) if (us[k].id === uid && us[k].active) me = us[k]; }
  if (!me) throw new ApiError('انتهت الجلسة، سجل الدخول من جديد', 'auth');
  me.perms = me.perms || [];
  if (A === 'me') return {user: pub_(me)};
  if (A === 'ping') { cache.put('p_' + me.id, JSON.stringify({at: Date.now(), page: String(b.page || '').slice(0, 60), client: String(b.client || '').slice(0, 20)}), 900); return {ok: true}; }
  if (A === 'presence') {
    if (!me.isAdmin) throw new ApiError('للمدير فقط', 'forbidden');
    var pl = []; getAll_('users').forEach(function (u) { var v = cache.get('p_' + u.id); if (v) { try { var o = JSON.parse(v); o.id = u.id; pl.push(o); } catch (x) {} } });
    return {list: pl};
  }
  if (A === 'logout') { cache.remove('t_' + sha_(tk)); return {ok: true}; }

  if (['settings_save', 'backup', 'restore', 'reset', 'resetvisits', 'master_save', 'master_restore', 'master_info'].indexOf(A) >= 0) {
    if (!me.isAdmin) throw new ApiError('للمدير فقط', 'forbidden');
    if (A === 'settings_save') return withLock_(function () {
      var o = {appName: String(b.appName || '').trim().slice(0, 80), centerName: String(b.centerName || '').trim().slice(0, 80), phone: String(b.phone || '').trim().slice(0, 60), logo: /^[0-9a-f]{18}$/.test(String(b.logo || '')) ? String(b.logo) : '', azkAudio: String(b.azkAudio || '').split(',').filter(function (x) { return /^[0-9a-f]{18}$/.test(x); }).slice(0, 10).join(',')};
      PropertiesService.getScriptProperties().setProperty('SETTINGS', JSON.stringify(o)); return {settings: settings_()};
    });
    if (A === 'backup') return {backup: snapshot_()};
    if (A === 'master_info') return masterInfo_();
    if (A === 'restore') return withLock_(function () { restoreSnapshot_(b.backup); return {ok: true}; });
    if (A === 'master_save') return withLock_(function () {
      var js = JSON.stringify(snapshot_()), sh = ss_().getSheetByName('master') || ss_().insertSheet('master');
      sh.clear(); sh.getRange('A:A').setNumberFormat('@'); var rows = [];
      for (var i = 0; i < js.length; i += 40000) rows.push([js.substr(i, 40000)]);
      sh.getRange(1, 1, rows.length, 1).setValues(rows);
      PropertiesService.getScriptProperties().setProperty('MASTER_AT', new Date().toISOString());
      return masterInfo_();
    });
    if (A === 'master_restore') return withLock_(function () {
      var sh = ss_().getSheetByName('master'); if (!sh || sh.getLastRow() < 1) throw new ApiError('لا توجد نسخة ماستر محفوظة');
      var js = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return String(r[0]); }).join('');
      restoreSnapshot_(JSON.parse(js)); return {ok: true};
    });
    if (A === 'resetvisits') return withLock_(function () {
      if (!me.isAdmin) throw new ApiError('للمدير فقط');
      PropertiesService.getScriptProperties().setProperty('ctr_visits', '0'); wipe_('visits'); return {ok: true};
    });
    if (A === 'reset') return withLock_(function () {
      if (String(b.confirm || '') !== 'حذف الكل') throw new ApiError('اكتب عبارة التأكيد: حذف الكل');
      PropertiesService.getScriptProperties().setProperty('ctr_visits', '0');
      ['patients', 'operations', 'visits', 'expenses', 'custody', 'execs', 'opx'].forEach(function (x) { wipe_(x); });
      return {ok: true};
    });
  }

  var e = String(b.entity || '');
  if (['list', 'save', 'delete', 'bulk_save'].indexOf(A) >= 0 && ENT.indexOf(e) < 0) throw new ApiError('كيان غير معروف');

  if (A === 'list') {
    var reps = me.perms.some(function (x) { return x.indexOf('rep_') === 0; });
    var ok = !!me.isAdmin || (e !== 'users' && (e === 'staff' ? has_(me, 'staff') : (LOOKUP.indexOf(e) >= 0 || has_(me, e) || has_(me, 'dashboard') || has_(me, 'dues') || reps)));
    if (!ok) throw new ApiError('غير مصرح', 'forbidden');
    var items = getAll_(e, b.from || null, b.to || null);
    return {items: e === 'users' ? items.map(pub_) : items, ctr: AUTO[e] ? peekCounter_(e, AUTO[e]) : undefined};
  }

  if (A === 'bulk_save') {
    if (!me.isAdmin) throw new ApiError('للمدير فقط', 'forbidden');
    return withLock_(function () { return bulk_(e, me, b.records || [], String(b.key || '')); });
  }
  if (A === 'sync_sheets') {
    if (!me.isAdmin) throw new ApiError('للمدير فقط', 'forbidden');
    return withLock_(function () { return {ok: true, counts: mirrorAll_()}; });
  }

  if (A === 'save' || A === 'delete') {
    var can = !!me.isAdmin;
    if (!can && e !== 'users') (WRITE[e] || []).forEach(function (x) { if (has_(me, x)) can = true; });
    if (!can) throw new ApiError('غير مصرح', 'forbidden');
    return withLock_(function () { return A === 'delete' ? doDelete_(e, me, String(b.id || '')) : doSave_(e, me, b.record || {}); });
  }

  if (A === 'upload') {
    var mime = String(b.mime || ''), data = String(b.data || '');
    var isAud = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'].indexOf(mime) >= 0;
    if (!isAud && ['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) throw new ApiError('نوع الملف غير مسموح');
    if (data.length > (isAud ? 32000000 : 5500000)) throw new ApiError('الملف كبير جداً');
    if (isAud && !me.isAdmin) throw new ApiError('للمدير فقط', 'forbidden');
    var bytes; try { bytes = Utilities.base64Decode(data); } catch (x) { throw new ApiError('الصورة تالفة'); }
    var b0 = bytes[0] & 255, b1 = bytes[1] & 255, b2 = bytes[2] & 255, b3 = bytes[3] & 255;
    var okMagic = (b0 === 0xFF && b1 === 0xD8 && b2 === 0xFF) || (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) || (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46);
    if (!isAud && !okMagic) throw new ApiError('الملف ليس صورة صالحة');
    var canUp = !!me.isAdmin; ['staff', 'doctors', 'visits', 'patients', 'operations', 'companies', 'expenses'].forEach(function (x) { if (has_(me, x)) canUp = true; });
    if (!canUp) throw new ApiError('غير مصرح', 'forbidden');
    var fid = rid_(), f = folder_().createFile(Utilities.newBlob(bytes, mime, fid));
    f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    sheet_('files').appendRow([fid, f.getId(), mime]);
    return {file: fid};
  }

  if (A === 'file') {
    var id = String(b.id || ''); if (!/^[0-9a-f]{18}$/.test(id)) throw new ApiError('الملف غير موجود');
    var sh = sheet_('files'), row = findRow_(sh, id); if (row < 0) throw new ApiError('الملف غير موجود');
    var r = sh.getRange(row, 1, 1, 3).getValues()[0], blob = DriveApp.getFileById(r[1]).getBlob();
    return {dataUrl: 'data:' + r[2] + ';base64,' + Utilities.base64Encode(blob.getBytes())};
  }
  throw new ApiError('أمر غير معروف');
}

/* ---------- الإعدادات والنسخ الاحتياطي ---------- */
function settings_() {
  var o = {appName: 'برنامج إدارة المركز الطبي', centerName: '', phone: '', logo: '', azkAudio: ''};
  try { var v = JSON.parse(PropertiesService.getScriptProperties().getProperty('SETTINGS') || '{}'); for (var k in v) if (v[k] !== '' || k === 'logo' || k === 'phone') o[k] = v[k]; } catch (x) {}
  return o;
}
function snapshot_() {
  var d = {}; ENT.forEach(function (x) { d[x] = getAll_(x); });
  return {app: 'medical-center', ver: 1, at: new Date().toISOString(), settings: settings_(), data: d};
}
function masterInfo_() {
  var at = PropertiesService.getScriptProperties().getProperty('MASTER_AT') || '', sh = ss_().getSheetByName('master');
  return {at: sh && sh.getLastRow() > 0 ? at : ''};
}
function wipe_(e) { var sh = sheet_(e), n = sh.getLastRow(); if (n > 1) sh.deleteRows(2, n - 1); if (SHEETN[e]) { var m = ss_().getSheetByName(SHEETN[e]); if (m && m.getLastRow() > 1) m.deleteRows(2, m.getLastRow() - 1); } }
function restoreSnapshot_(bk) {
  if (!bk || bk.app !== 'medical-center' || !bk.data) throw new ApiError('ملف النسخة الاحتياطية غير صالح');
  var us = bk.data.users || [];
  if (!us.some(function (u) { return u.isAdmin && u.active; })) throw new ApiError('النسخة لا تحتوي على مدير فعّال');
  ENT.forEach(function (x) {
    var items = bk.data[x]; if (!Array.isArray(items)) items = [];
    wipe_(x); if (!items.length) return;
    var rows = items.map(function (r) {
      var c = {}; for (var k in r) if (k !== 'id') c[k] = r[k];
      return [String(r.id || rid_()), typeof c.date === 'string' ? c.date : '', JSON.stringify(c), new Date().toISOString()];
    });
    sheet_(x).getRange(2, 1, rows.length, 4).setValues(rows);
  });
  var pr = PropertiesService.getScriptProperties(); ['staff', 'doctors', 'visits'].forEach(function (x) { pr.deleteProperty('ctr_' + x); });
  if (bk.settings) pr.setProperty('SETTINGS', JSON.stringify(bk.settings));
  try { mirrorAll_(); } catch (x) {}
}

function folder_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('صور المركز الطبي (خاص)'); p.setProperty('FOLDER_ID', f.getId()); return f;
}

function doDelete_(e, me, id) {
  var all = getAll_(e), r = null; all.forEach(function (x) { if (x.id === id) r = x; });
  if (!r) throw new ApiError('غير موجود');
  if (e === 'users') {
    var admins = all.filter(function (x) { return x.isAdmin && x.active; }).length;
    if (r.id === me.id || (r.isAdmin && admins < 2)) throw new ApiError('لا يمكن حذف هذا المستخدم');
  }
  var sh = sheet_(e), row = findRow_(sh, id); if (row > 0) sh.deleteRow(row);
  mirrorDel_(e, id);
  logAct_(me, 'حذف', e, r);
  return {ok: true};
}

function doSave_(e, me, src) {
  var out = clean_(e, src);
  var all = getAll_(e), id = src.id ? String(src.id) : '', rec = null; all.forEach(function (x) { if (x.id === id) rec = x; });
  if (e === 'users') {
    var nm = String(out.username || '').trim(); if (nm.length < 3) throw new ApiError('اسم المستخدم قصير');
    all.forEach(function (x) { if (x.id !== id && x.username.toLowerCase() === nm.toLowerCase()) throw new ApiError('اسم المستخدم موجود بالفعل'); });
    var pw = String(src.password || '');
    if (!rec && pw.length < 4) throw new ApiError('كلمة السر 4 أحرف على الأقل');
    var admins = all.filter(function (x) { return x.isAdmin && x.active; }).length;
    if (rec && rec.isAdmin && (!out.isAdmin || !out.active) && admins < 2) throw new ApiError('يجب بقاء مدير واحد على الأقل');
    if (pw) { out.salt = rid_(); out.hash = hashPw_(out.salt, pw); }
  } else {
    var nm2 = String(out.name || out.date || out.category || out.type || '').trim(); if (!nm2) throw new ApiError('بيانات ناقصة');
    if (AUTO[e]) out[AUTO[e]] = rec ? (rec[AUTO[e]] || 0) : nextCounter_(e, AUTO[e]);
  }
  var isNew = !rec;
  if (rec) { for (var k in out) rec[k] = out[k]; rec.updatedAt = new Date().toISOString(); }
  else { rec = {id: rid_(), createdAt: new Date().toISOString()}; for (var k2 in out) rec[k2] = out[k2]; if (e === 'visits' || e === 'expenses' || e === 'custody') rec.registeredBy = me.username; }
  put_(e, rec);
  logAct_(me, isNew ? 'إضافة' : 'تعديل', e, rec);
  return {record: e === 'users' ? pub_(rec) : rec};
}

/* ---------- تشغيل مرة واحدة من المحرر: يعطي الصلاحيات وينشئ الأوراق ---------- */
function setup() {
  var ss = ss_();
  ENT.forEach(function (e) { sheet_(e); });
  mirrorAll_();
  Logger.log('تم. ملف البيانات: ' + ss.getUrl());
  return ss.getUrl();
}
