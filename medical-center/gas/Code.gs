/**
 * برنامج إدارة المركز الطبي — Google Apps Script
 * قاعدة البيانات: Google Sheets (ورقة لكل شاشة) — الصور: Google Drive (مجلد خاص)
 * نفس أوامر api.js: status, register, login, me, logout, list, save, delete, upload, file
 */
var ENT = ['users', 'staff', 'doctors', 'services', 'operations', 'patients', 'companies', 'visits', 'expenses', 'custody', 'execs'];
var LOOKUP = ['doctors', 'services', 'patients', 'companies'];
var WRITE = {staff: ['staff'], doctors: ['doctors'], services: ['services'], operations: ['operations'], patients: ['patients', 'visits'], companies: ['companies'], visits: ['visits'], expenses: ['expenses', 'dues'], execs: ['execs'], custody: ['custody']};
var FIELDS = {
  users: 'username,nationalId,birthDate,perms,isAdmin,active',
  staff: 'code,name,nationalId,idPhoto,photo',
  doctors: 'code,name,clinic,phone,nationalId,idPhoto,syndicatePhoto,photo,hireDate,percent,fixed,opPercent',
  services: 'type,name,price,tax,abbr',
  operations: 'date,patient,operation,clinic,doctor,doctorId,value,doctorPercent,notes,anesthetist,anesthetistId,anesthesia,deductAnes',
  patients: 'name,phone',
  companies: 'name,fee,contact',
  visits: 'serial,date,patient,phone,clinic,doctor,doctorId,visitType,service,value,tax,category,company,formNo,formPhoto,cardNo,cardPhoto,nationalId,patientPct,discount,notes,payMethod,payRef,payPhone,birthDate,paid',
  expenses: 'date,category,amount,notes,doctor,dueDate,docNo',
  custody: 'date,person,kind,dir,amount,notes,docNo',
  execs: 'date,patient,cardNo,approvalNo,company,approvalProc,required,done,execDate,clinic,doctor'
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
var SHEETN = {staff: 'الموظفون', doctors: 'الأطباء', services: 'الخدمات', operations: 'العمليات', patients: 'المرضى', companies: 'الشركات', visits: 'الزيارات', expenses: 'المصروفات', custody: 'العهد والسلف', execs: 'تنفيذ الشركات', users: 'المستخدمون'};
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
  return {added: added, skipped: skipped};
}
function put_(e, rec) {
  var sh = sheet_(e), id = rec.id, copy = {}; for (var k in rec) if (k !== 'id') copy[k] = rec[k];
  var dt = typeof copy.date === 'string' ? copy.date : '', row = findRow_(sh, id);
  if (row > 0) sh.getRange(row, 2, 1, 2).setValues([[dt, JSON.stringify(copy)]]);
  else sh.appendRow([id, dt, JSON.stringify(copy), new Date().toISOString()]);
  mirrorPut_(e, rec);
}
function pub_(u) { var o = {}; for (var k in u) if (k !== 'hash' && k !== 'salt') o[k] = u[k]; return o; }
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

  if (['settings_save', 'backup', 'restore', 'reset', 'master_save', 'master_restore', 'master_info'].indexOf(A) >= 0) {
    if (!me.isAdmin) throw new ApiError('للمدير فقط', 'forbidden');
    if (A === 'settings_save') return withLock_(function () {
      var o = {appName: String(b.appName || '').trim().slice(0, 80), centerName: String(b.centerName || '').trim().slice(0, 80), phone: String(b.phone || '').trim().slice(0, 60), logo: /^[0-9a-f]{18}$/.test(String(b.logo || '')) ? String(b.logo) : ''};
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
    if (A === 'reset') return withLock_(function () {
      if (String(b.confirm || '') !== 'حذف الكل') throw new ApiError('اكتب عبارة التأكيد: حذف الكل');
      ['patients', 'operations', 'visits', 'expenses', 'custody', 'execs'].forEach(function (x) { wipe_(x); });
      var pr = PropertiesService.getScriptProperties(); ['visits'].forEach(function (x) { pr.deleteProperty('ctr_' + x); });
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
    return {items: e === 'users' ? items.map(pub_) : items};
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
    if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) throw new ApiError('يسمح بالصور فقط');
    if (data.length > 5500000) throw new ApiError('الصورة كبيرة جداً');
    var bytes; try { bytes = Utilities.base64Decode(data); } catch (x) { throw new ApiError('الصورة تالفة'); }
    var b0 = bytes[0] & 255, b1 = bytes[1] & 255, b2 = bytes[2] & 255, b3 = bytes[3] & 255;
    var okMagic = (b0 === 0xFF && b1 === 0xD8 && b2 === 0xFF) || (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47) || (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46);
    if (!okMagic) throw new ApiError('الملف ليس صورة صالحة');
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
  var o = {appName: 'برنامج إدارة المركز الطبي', centerName: '', phone: '', logo: ''};
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
  if (rec) { for (var k in out) rec[k] = out[k]; rec.updatedAt = new Date().toISOString(); }
  else { rec = {id: rid_(), createdAt: new Date().toISOString()}; for (var k2 in out) rec[k2] = out[k2]; if (e === 'visits' || e === 'expenses' || e === 'custody') rec.registeredBy = me.username; }
  put_(e, rec);
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

/* ---------- البيانات الأساسية الأولية (تُضاف عند تسجيل أول مدير) ---------- */
var SEED = {"services":[{"type":"clinic","name":"عظام","price":100.0,"tax":10.0},{"type":"clinic","name":"رمد","price":100.0,"tax":10.0},{"type":"clinic","name":"باطنه وطوارئ","price":60.0,"tax":10.0},{"type":"clinic","name":"كلى والكلى الصناعية","price":100.0,"tax":10.0},{"type":"clinic","name":"جلديه","price":90.0,"tax":10.0},{"type":"clinic","name":"انف واذن","price":80.0,"tax":10.0},{"type":"clinic","name":"جهاز هضمي وكبد","price":110.0,"tax":10.0},{"type":"clinic","name":"مخ وأعصاب","price":130.0,"tax":10.0},{"type":"clinic","name":"نساء","price":100.0,"tax":10.0},{"type":"clinic","name":"تخاطب وتنمية مهارات","price":50.0,"tax":5.0},{"type":"clinic","name":"صدر","price":90.0,"tax":10.0},{"type":"clinic","name":"جراحة عامه","price":70.0,"tax":10.0},{"type":"clinic","name":"علاج طبيعى","price":50.0,"tax":10.0},{"type":"clinic","name":"مسالك بوليه","price":110.0,"tax":10.0},{"type":"clinic","name":"اسنان","price":40.0,"tax":10.0},{"type":"clinic","name":"تركيبات الاسنان","price":0,"tax":0},{"type":"clinic","name":"عمليات جراحية","price":0,"tax":0},{"type":"clinic","name":"تحاليل","price":0,"tax":0},{"type":"clinic","name":"معمل شركات","price":0,"tax":0},{"type":"clinic","name":"الحجامه","price":200.0,"tax":10.0},{"type":"clinic","name":"تخدير","price":0,"tax":0},{"type":"clinic","name":"طبيب اطفال","price":0,"tax":0},{"type":"radiology","name":"أشعة أسنان (فيلم)","price":40,"tax":0},{"type":"radiology","name":"أشعة أسنان (2 فيلم)","price":80,"tax":0},{"type":"radiology","name":"أشعة أسنان (4 أفلام)","price":160,"tax":0},{"type":"radiology","name":"أشعة عادية","price":0,"tax":0},{"type":"radiology","name":"موجات صوتية","price":250,"tax":0},{"type":"lab","name":"تحاليل","price":0,"tax":0},{"type":"lab","name":"تحاليل شركات","price":0,"tax":0},{"type":"lab","name":"معمل لاب تولاب","price":0,"tax":0},{"type":"operation","name":"عمليات جراحية","price":0,"tax":0},{"type":"operation","name":"فتح خراج","price":400,"tax":0},{"type":"operation","name":"استئصال كيس شمعي","price":450,"tax":0},{"type":"operation","name":"استئصال بواسير وشرخ شرجي","price":0,"tax":0},{"type":"operation","name":"خياطة جرح تحت مخدر موضعي","price":77,"tax":0},{"type":"operation","name":"تركيب جبيرة تحت الركبة","price":110,"tax":0},{"type":"operation","name":"جبس تحت الركبة","price":0,"tax":0},{"type":"operation","name":"طوارئ جراحة","price":0,"tax":0},{"type":"operation","name":"طوارئ عظام","price":0,"tax":0},{"type":"service","name":"كشف","price":0,"tax":0},{"type":"service","name":"استشارة","price":0,"tax":0},{"type":"service","name":"غيار","price":0,"tax":0},{"type":"service","name":"خياطة","price":0,"tax":0},{"type":"service","name":"نسبة شركات","price":0,"tax":0},{"type":"service","name":"خلع أسنان عادي (ضرس)","price":200,"tax":0},{"type":"service","name":"خلع جراحي","price":350,"tax":0},{"type":"service","name":"حشو أسنان","price":0,"tax":0},{"type":"service","name":"حشو كمبوزيت (ضرس)","price":400,"tax":0},{"type":"service","name":"حشو ليزر (ضرس)","price":400,"tax":0},{"type":"service","name":"حشو عصب (ضرس)","price":750,"tax":0},{"type":"service","name":"إزالة رواسب","price":300,"tax":0},{"type":"service","name":"طربوش بورسلين","price":1000,"tax":0},{"type":"service","name":"دعامة فايبر جلاس","price":600,"tax":0},{"type":"service","name":"علاج طبيعي (جلسة)","price":50,"tax":0},{"type":"service","name":"جلسات علاج طبيعي (6)","price":300,"tax":0},{"type":"service","name":"جلسات علاج طبيعي (12)","price":600,"tax":0},{"type":"service","name":"حجامة","price":200,"tax":0},{"type":"lab","name":"صورة دم كاملة (CBC)","price":0,"tax":0,"abbr":"CBC"},{"type":"lab","name":"سرعة الترسيب (ESR)","price":0,"tax":0,"abbr":"ESR"},{"type":"lab","name":"بروتين سي التفاعلي (CRP)","price":0,"tax":0,"abbr":"CRP"},{"type":"lab","name":"هيموجلوبين (HB)","price":0,"tax":0,"abbr":"HB"},{"type":"lab","name":"زمرة الدم وعامل ريسس (ABO/Rh)","price":0,"tax":0,"abbr":"ABO/Rh"},{"type":"lab","name":"زمن البروثرومبين (PT)","price":0,"tax":0,"abbr":"PT"},{"type":"lab","name":"زمن الثرومبوبلاستين الجزئي (PTT)","price":0,"tax":0,"abbr":"PTT"},{"type":"lab","name":"نسبة التجلط الدولية (INR)","price":0,"tax":0,"abbr":"INR"},{"type":"lab","name":"سكر صائم (FBS)","price":0,"tax":0,"abbr":"FBS"},{"type":"lab","name":"سكر فطار (2hPP)","price":0,"tax":0,"abbr":"2hPP"},{"type":"lab","name":"سكر عشوائي (RBS)","price":0,"tax":0,"abbr":"RBS"},{"type":"lab","name":"سكر تراكمي (HbA1c)","price":0,"tax":0,"abbr":"HbA1c"},{"type":"lab","name":"منحنى السكر (GTT)","price":0,"tax":0,"abbr":"GTT"},{"type":"lab","name":"وظائف كبد (LFT)","price":0,"tax":0,"abbr":"LFT"},{"type":"lab","name":"انزيم ALT (SGPT/ALT)","price":0,"tax":0,"abbr":"SGPT/ALT"},{"type":"lab","name":"انزيم AST (SGOT/AST)","price":0,"tax":0,"abbr":"SGOT/AST"},{"type":"lab","name":"فوسفاتيز قلوي (ALP)","price":0,"tax":0,"abbr":"ALP"},{"type":"lab","name":"جاما جي تي (GGT)","price":0,"tax":0,"abbr":"GGT"},{"type":"lab","name":"بيليروبين كلي ومباشر (Bil)","price":0,"tax":0,"abbr":"Bil"},{"type":"lab","name":"ألبومين (Alb)","price":0,"tax":0,"abbr":"Alb"},{"type":"lab","name":"بروتين كلي (TP)","price":0,"tax":0,"abbr":"TP"},{"type":"lab","name":"وظائف كلى (KFT)","price":0,"tax":0,"abbr":"KFT"},{"type":"lab","name":"يوريا (Urea)","price":0,"tax":0,"abbr":"Urea"},{"type":"lab","name":"كرياتينين (Creat)","price":0,"tax":0,"abbr":"Creat"},{"type":"lab","name":"حمض اليوريك (UA)","price":0,"tax":0,"abbr":"UA"},{"type":"lab","name":"صوديوم (Na)","price":0,"tax":0,"abbr":"Na"},{"type":"lab","name":"بوتاسيوم (K)","price":0,"tax":0,"abbr":"K"},{"type":"lab","name":"كالسيوم (Ca)","price":0,"tax":0,"abbr":"Ca"},{"type":"lab","name":"فوسفور (P)","price":0,"tax":0,"abbr":"P"},{"type":"lab","name":"مغنيسيوم (Mg)","price":0,"tax":0,"abbr":"Mg"},{"type":"lab","name":"حديد (Fe)","price":0,"tax":0,"abbr":"Fe"},{"type":"lab","name":"سعة ارتباط الحديد (TIBC)","price":0,"tax":0,"abbr":"TIBC"},{"type":"lab","name":"فيريتين (Ferritin)","price":0,"tax":0,"abbr":"Ferritin"},{"type":"lab","name":"دهون ثلاثية (TG)","price":0,"tax":0,"abbr":"TG"},{"type":"lab","name":"كوليسترول كلي (Chol)","price":0,"tax":0,"abbr":"Chol"},{"type":"lab","name":"كوليسترول HDL (HDL)","price":0,"tax":0,"abbr":"HDL"},{"type":"lab","name":"كوليسترول LDL (LDL)","price":0,"tax":0,"abbr":"LDL"},{"type":"lab","name":"ملف دهون كامل (Lipid Profile)","price":0,"tax":0,"abbr":"Lipid Profile"},{"type":"lab","name":"الغدة الدرقية TSH (TSH)","price":0,"tax":0,"abbr":"TSH"},{"type":"lab","name":"هرمون T3 الحر (FT3)","price":0,"tax":0,"abbr":"FT3"},{"type":"lab","name":"هرمون T4 الحر (FT4)","price":0,"tax":0,"abbr":"FT4"},{"type":"lab","name":"فيتامين د (Vit D)","price":0,"tax":0,"abbr":"Vit D"},{"type":"lab","name":"فيتامين ب12 (Vit B12)","price":0,"tax":0,"abbr":"Vit B12"},{"type":"lab","name":"حمض الفوليك (Folic)","price":0,"tax":0,"abbr":"Folic"},{"type":"lab","name":"هرمون الحليب (PRL)","price":0,"tax":0,"abbr":"PRL"},{"type":"lab","name":"هرمون FSH (FSH)","price":0,"tax":0,"abbr":"FSH"},{"type":"lab","name":"هرمون LH (LH)","price":0,"tax":0,"abbr":"LH"},{"type":"lab","name":"استراديول (E2)","price":0,"tax":0,"abbr":"E2"},{"type":"lab","name":"بروجيستيرون (PROG)","price":0,"tax":0,"abbr":"PROG"},{"type":"lab","name":"تستوستيرون (TESTO)","price":0,"tax":0,"abbr":"TESTO"},{"type":"lab","name":"هرمون الحمل الكمي (B-hCG)","price":0,"tax":0,"abbr":"B-hCG"},{"type":"lab","name":"اختبار حمل في البول (UPT)","price":0,"tax":0,"abbr":"UPT"},{"type":"lab","name":"تحليل بول كامل (Urine Analysis)","price":0,"tax":0,"abbr":"Urine Analysis"},{"type":"lab","name":"مزرعة بول (Urine C/S)","price":0,"tax":0,"abbr":"Urine C/S"},{"type":"lab","name":"تحليل براز (Stool Analysis)","price":0,"tax":0,"abbr":"Stool Analysis"},{"type":"lab","name":"مزرعة براز (Stool C/S)","price":0,"tax":0,"abbr":"Stool C/S"},{"type":"lab","name":"مسحة حلق مزرعة (Throat C/S)","price":0,"tax":0,"abbr":"Throat C/S"},{"type":"lab","name":"مزرعة دم (Blood C/S)","price":0,"tax":0,"abbr":"Blood C/S"},{"type":"lab","name":"أمصال الروماتيزم (RF)","price":0,"tax":0,"abbr":"RF"},{"type":"lab","name":"ASO (ASO)","price":0,"tax":0,"abbr":"ASO"},{"type":"lab","name":"أجسام مضادة نووية (ANA)","price":0,"tax":0,"abbr":"ANA"},{"type":"lab","name":"فيروس الكبد سي (HCV Ab)","price":0,"tax":0,"abbr":"HCV Ab"},{"type":"lab","name":"فيروس الكبد بي (HBsAg)","price":0,"tax":0,"abbr":"HBsAg"},{"type":"lab","name":"فيروس نقص المناعة (HIV)","price":0,"tax":0,"abbr":"HIV"},{"type":"lab","name":"فحص الزهري (VDRL)","price":0,"tax":0,"abbr":"VDRL"},{"type":"lab","name":"اختبار هيليكوباكتر بيلوري (H. pylori)","price":0,"tax":0,"abbr":"H. pylori"},{"type":"lab","name":"مستضد البروستاتا (PSA)","price":0,"tax":0,"abbr":"PSA"},{"type":"lab","name":"مؤشر أورام CEA (CEA)","price":0,"tax":0,"abbr":"CEA"},{"type":"lab","name":"مؤشر أورام AFP (AFP)","price":0,"tax":0,"abbr":"AFP"},{"type":"lab","name":"انزيم القلب CK-MB (CK-MB)","price":0,"tax":0,"abbr":"CK-MB"},{"type":"lab","name":"تروبونين (Troponin)","price":0,"tax":0,"abbr":"Troponin"},{"type":"lab","name":"انزيمات الباكرياس أميليز (Amylase)","price":0,"tax":0,"abbr":"Amylase"},{"type":"lab","name":"ليباز (Lipase)","price":0,"tax":0,"abbr":"Lipase"},{"type":"lab","name":"LDH (LDH)","price":0,"tax":0,"abbr":"LDH"},{"type":"lab","name":"D-Dimer (D-Dimer)","price":0,"tax":0,"abbr":"D-Dimer"},{"type":"lab","name":"تعداد الشبكيات (Retics)","price":0,"tax":0,"abbr":"Retics"},{"type":"lab","name":"عدد الصفائح (PLT)","price":0,"tax":0,"abbr":"PLT"},{"type":"lab","name":"صورة دم بالمجهر (Blood Film)","price":0,"tax":0,"abbr":"Blood Film"},{"type":"lab","name":"نسبة الأنسولين (Insulin)","price":0,"tax":0,"abbr":"Insulin"},{"type":"lab","name":"كورتيزول (Cortisol)","price":0,"tax":0,"abbr":"Cortisol"},{"type":"lab","name":"بول 24 ساعة بروتين (24h Urine Protein)","price":0,"tax":0,"abbr":"24h Urine Protein"},{"type":"lab","name":"نسبة الألبومين للكرياتينين في البول (ACR)","price":0,"tax":0,"abbr":"ACR"},{"type":"radiology","name":"أشعة صدر (Chest X-Ray)","price":0,"tax":0,"abbr":"Chest X-Ray"},{"type":"radiology","name":"أشعة بطن (Abdomen X-Ray)","price":0,"tax":0,"abbr":"Abdomen X-Ray"},{"type":"radiology","name":"أشعة عمود فقري عنقي (C-Spine X-Ray)","price":0,"tax":0,"abbr":"C-Spine X-Ray"},{"type":"radiology","name":"أشعة عمود فقري قطني (L-Spine X-Ray)","price":0,"tax":0,"abbr":"L-Spine X-Ray"},{"type":"radiology","name":"أشعة عمود فقري ظهري (D-Spine X-Ray)","price":0,"tax":0,"abbr":"D-Spine X-Ray"},{"type":"radiology","name":"أشعة حوض (Pelvis X-Ray)","price":0,"tax":0,"abbr":"Pelvis X-Ray"},{"type":"radiology","name":"أشعة ركبة (Knee X-Ray)","price":0,"tax":0,"abbr":"Knee X-Ray"},{"type":"radiology","name":"أشعة كتف (Shoulder X-Ray)","price":0,"tax":0,"abbr":"Shoulder X-Ray"},{"type":"radiology","name":"أشعة قدم (Foot X-Ray)","price":0,"tax":0,"abbr":"Foot X-Ray"},{"type":"radiology","name":"أشعة كف اليد (Hand X-Ray)","price":0,"tax":0,"abbr":"Hand X-Ray"},{"type":"radiology","name":"أشعة جيوب أنفية (PNS X-Ray)","price":0,"tax":0,"abbr":"PNS X-Ray"},{"type":"radiology","name":"أشعة أسنان بانوراما (OPG)","price":0,"tax":0,"abbr":"OPG"},{"type":"radiology","name":"موجات صوتية على البطن والحوض (US Abd & Pelvis)","price":0,"tax":0,"abbr":"US Abd & Pelvis"},{"type":"radiology","name":"موجات صوتية على الكلى والمسالك (US KUB)","price":0,"tax":0,"abbr":"US KUB"},{"type":"radiology","name":"موجات صوتية على الغدة الدرقية (US Thyroid)","price":0,"tax":0,"abbr":"US Thyroid"},{"type":"radiology","name":"موجات صوتية على الثدي (US Breast)","price":0,"tax":0,"abbr":"US Breast"},{"type":"radiology","name":"موجات صوتية على الحوض (US Pelvis)","price":0,"tax":0,"abbr":"US Pelvis"},{"type":"radiology","name":"موجات صوتية على البروستاتا (US Prostate)","price":0,"tax":0,"abbr":"US Prostate"},{"type":"radiology","name":"موجات صوتية على الرقبة (US Neck)","price":0,"tax":0,"abbr":"US Neck"},{"type":"radiology","name":"موجات صوتية دوبلر على الأوردة (Venous Doppler)","price":0,"tax":0,"abbr":"Venous Doppler"},{"type":"radiology","name":"موجات صوتية دوبلر على الشرايين (Arterial Doppler)","price":0,"tax":0,"abbr":"Arterial Doppler"},{"type":"radiology","name":"متابعة حمل بالموجات الصوتية (Obstetric US)","price":0,"tax":0,"abbr":"Obstetric US"},{"type":"radiology","name":"موجات صوتية على الخصية (US Scrotum)","price":0,"tax":0,"abbr":"US Scrotum"},{"type":"radiology","name":"موجات صوتية على الأنسجة الرخوة (US Soft Tissue)","price":0,"tax":0,"abbr":"US Soft Tissue"},{"type":"radiology","name":"موجات صوتية على المفاصل (MSK US)","price":0,"tax":0,"abbr":"MSK US"},{"type":"radiology","name":"رسم قلب (ECG)","price":0,"tax":0,"abbr":"ECG"},{"type":"radiology","name":"إيكو على القلب (Echo)","price":0,"tax":0,"abbr":"Echo"},{"type":"radiology","name":"رسم عصب (NCV)","price":0,"tax":0,"abbr":"NCV"},{"type":"radiology","name":"رسم عضلات (EMG)","price":0,"tax":0,"abbr":"EMG"},{"type":"radiology","name":"رسم مخ (EEG)","price":0,"tax":0,"abbr":"EEG"},{"type":"radiology","name":"أشعة مقطعية على المخ (CT Brain)","price":0,"tax":0,"abbr":"CT Brain"},{"type":"radiology","name":"أشعة مقطعية على الصدر (CT Chest)","price":0,"tax":0,"abbr":"CT Chest"},{"type":"radiology","name":"أشعة مقطعية على البطن والحوض (CT Abd & Pelvis)","price":0,"tax":0,"abbr":"CT Abd & Pelvis"},{"type":"radiology","name":"أشعة مقطعية على الجيوب الأنفية (CT PNS)","price":0,"tax":0,"abbr":"CT PNS"},{"type":"radiology","name":"أشعة مقطعية على العمود الفقري القطني (CT L-Spine)","price":0,"tax":0,"abbr":"CT L-Spine"},{"type":"radiology","name":"أشعة رنين مغناطيسي على المخ (MRI Brain)","price":0,"tax":0,"abbr":"MRI Brain"},{"type":"radiology","name":"أشعة رنين على العمود الفقري القطني (MRI L-Spine)","price":0,"tax":0,"abbr":"MRI L-Spine"},{"type":"radiology","name":"أشعة رنين على العمود الفقري العنقي (MRI C-Spine)","price":0,"tax":0,"abbr":"MRI C-Spine"},{"type":"radiology","name":"أشعة رنين على الركبة (MRI Knee)","price":0,"tax":0,"abbr":"MRI Knee"},{"type":"radiology","name":"أشعة رنين على الكتف (MRI Shoulder)","price":0,"tax":0,"abbr":"MRI Shoulder"},{"type":"radiology","name":"أشعة ماموجرام (Mammography)","price":0,"tax":0,"abbr":"Mammography"},{"type":"radiology","name":"قياس كثافة العظام (DEXA)","price":0,"tax":0,"abbr":"DEXA"},{"type":"radiology","name":"أشعة بالصبغة على المسالك (IVU)","price":0,"tax":0,"abbr":"IVU"},{"type":"radiology","name":"أشعة بالصبغة على الرحم (HSG)","price":0,"tax":0,"abbr":"HSG"},{"type":"radiology","name":"أشعة بالصبغة على المريء والمعدة (Barium Swallow/Meal)","price":0,"tax":0,"abbr":"Barium Swallow/Meal"}],"doctors":[{"name":"عبدالغنى احمد","clinic":"جراحة عامه","percent":60.0,"fixed":200.0,"opPercent":0},{"name":"ياسر طه","clinic":"تخدير","percent":100.0,"fixed":0,"opPercent":0},{"name":"ايه رأفت","clinic":"اسنان","percent":40.0,"fixed":0,"opPercent":0},{"name":"كامل ربيع","clinic":"تحاليل","percent":0,"fixed":0,"opPercent":0},{"name":"عمر محمود","clinic":"اسنان","percent":40.0,"fixed":0,"opPercent":0},{"name":"اسماء محمد","clinic":"نساء","percent":60.0,"fixed":0,"opPercent":0},{"name":"احمد عبدالحميد","clinic":"عظام","percent":60.0,"fixed":200.0,"opPercent":0},{"name":"اسلام السيد","clinic":"باطنه وطوارئ","percent":50.0,"fixed":500.0,"opPercent":0},{"name":"محمد صلاح","clinic":"علاج طبيعى","percent":50.0,"fixed":0,"opPercent":0},{"name":"كريم مشالى","clinic":"اسنان","percent":50.0,"fixed":0,"opPercent":0},{"name":"حسنى جمال","clinic":"طبيب اطفال","percent":100.0,"fixed":0,"opPercent":0},{"name":"محمد الجمل","clinic":"عظام","percent":70.0,"fixed":100.0,"opPercent":0},{"name":"محمد شاكر","clinic":"اسنان","percent":40.0,"fixed":0,"opPercent":0},{"name":"محمد طه","clinic":"جهاز هضمي وكبد","percent":50.0,"fixed":200.0,"opPercent":0},{"name":"ندى عادل","clinic":"اسنان","percent":40.0,"fixed":0,"opPercent":0},{"name":"اشرف الالفى","clinic":"باطنه وطوارئ","percent":50.0,"fixed":500.0,"opPercent":0},{"name":"جمال الخولى","clinic":"مسالك بوليه","percent":60.0,"fixed":0,"opPercent":0},{"name":"محمد عباس","clinic":"رمد","percent":60.0,"fixed":0,"opPercent":0},{"name":"منصور مهدى","clinic":"صدر","percent":60.0,"fixed":200.0,"opPercent":0},{"name":"احمد اشرف","clinic":"باطنه وطوارئ","percent":50.0,"fixed":500.0,"opPercent":0},{"name":"عاطف حسن","clinic":"كلى والكلى الصناعية","percent":60.0,"fixed":0,"opPercent":0},{"name":"هانم عبدالفتاح الدموكي","clinic":"تخاطب وتنمية مهارات","percent":50.0,"fixed":0,"opPercent":0},{"name":"اسماء محمد","clinic":"عمليات جراحية","percent":60.0,"fixed":0,"opPercent":0},{"name":"يارا بهاء","clinic":"جلديه","percent":60.0,"fixed":200.0,"opPercent":0},{"name":"جمال هنداوى","clinic":"اسنان","percent":40.0,"fixed":0,"opPercent":0},{"name":"على محجوب","clinic":"انف واذن","percent":60.0,"fixed":0,"opPercent":0},{"name":"علاء الدين محمود","clinic":"مخ وأعصاب","percent":60.0,"fixed":0,"opPercent":0},{"name":"محمد ايمن","clinic":"باطنه وطوارئ","percent":50.0,"fixed":500.0,"opPercent":0},{"name":"على محجوب","clinic":"عمليات جراحية","percent":45.0,"fixed":0,"opPercent":0},{"name":"عبدالغنى احمد","clinic":"عمليات جراحية","percent":60.0,"fixed":0,"opPercent":0},{"name":"محمد صلاح","clinic":"الحجامه","percent":0,"fixed":0,"opPercent":0},{"name":"اميره بهاء","clinic":"رمد","percent":60.0,"fixed":200.0,"opPercent":0},{"name":"عبدالرحمن على","clinic":"جلديه","percent":60.0,"fixed":200.0,"opPercent":0},{"name":"سوسن محمود","clinic":"نساء","percent":50.0,"fixed":0,"opPercent":0}],"companies":[{"name":"AXA","fee":160.0},{"name":"الاهلى للخدمات الطبية","fee":100.0},{"name":"DMS","fee":175.0},{"name":"Careplus","fee":180.0},{"name":"المشرق","fee":150.0},{"name":"EGYMED","fee":200.0},{"name":"SMART","fee":160.0},{"name":"Nextcare","fee":140.0}],"staff":[{"name":"حماده حسن محمود"},{"name":"سعد سعيد ناجي"},{"name":"احمد عبدالسلام"},{"name":"منى عبدالعزيز عبد الوهاب"},{"name":"عواطف علي عبدالعظيم"},{"name":"ايمان فؤاد علي"},{"name":"هبه محمود رمضان"},{"name":"فاطمه فتحي عبد الوارث"}],"expenseCats":["مصاريف متنوعة","زيت","مصاريف تشغيل","مصاريف نقل","تجهيزات طبيه وأخرى","بنزين","مكأفات","مكأفات عمليات","بوفية","مصروفات محطة المياه","صيانه","تراخيص ورسوم وكارتات وجراج","جاز","مصروفات المصعد","رسوم تراخيص طبيه","انتقالات","مصروفات نقل","اتصالات وتليفون وانترنت","دعايا","مطبوعات","أدوات كتابيه","سباكه","نثريات وإكراميات ومصروفات أخرى","بوفيه","بدل ضيافه","مصروفات نظافه","كهرباء","نجاره ودهانات","اجهزة كهربائيه","إيصالات كهرباء","إيصال مياه","إيصال ضرائب","صيانة أجهزه طبيه","معمل لاب تولاب","مستلزمات معمل","تركيبات أسنان","مستلزمات أسنان","مستلزمات طبيه وأدويه","مرتبات الموظفين والعمال","اجور الأطباء والتمريض","مكافآت","بدلات","حوافز","مصروفات التأمين الصحي","الرد النقدي"]};
