/**
 * برنامج إدارة المركز الطبي — Google Apps Script
 * قاعدة البيانات: Google Sheets (ورقة لكل شاشة) — الصور: Google Drive (مجلد خاص)
 * نفس أوامر api.js: status, register, login, me, logout, list, save, delete, upload, file
 */
var ENT = ['users', 'staff', 'doctors', 'services', 'operations', 'patients', 'companies', 'visits', 'expenses'];
var LOOKUP = ['doctors', 'services', 'patients', 'companies'];
var WRITE = {staff: ['staff'], doctors: ['doctors'], services: ['services'], operations: ['operations'], patients: ['patients', 'visits'], companies: ['companies'], visits: ['visits'], expenses: ['expenses', 'dues']};
var FIELDS = {
  users: 'username,nationalId,birthDate,perms,isAdmin,active',
  staff: 'code,name,nationalId,idPhoto,photo',
  doctors: 'code,name,clinic,phone,nationalId,idPhoto,syndicatePhoto,photo,hireDate,percent,fixed,opPercent',
  services: 'type,name,price,tax',
  operations: 'date,patient,operation,clinic,doctor,doctorId,value,doctorPercent,notes',
  patients: 'name,phone',
  companies: 'name,fee,contact',
  visits: 'serial,date,patient,phone,clinic,doctor,doctorId,visitType,service,value,tax,category,company,formNo,formPhoto,cardNo,cardPhoto,nationalId,patientPct,discount,notes',
  expenses: 'date,category,amount,notes,doctor'
};
var NUMS = 'percent,fixed,opPercent,price,tax,value,doctorPercent,fee,patientPct,discount,amount,code,serial'.split(',');
var DATES = ['date', 'hireDate', 'birthDate'];
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
function put_(e, rec) {
  var sh = sheet_(e), id = rec.id, copy = {}; for (var k in rec) if (k !== 'id') copy[k] = rec[k];
  var dt = typeof copy.date === 'string' ? copy.date : '', row = findRow_(sh, id);
  if (row > 0) sh.getRange(row, 2, 1, 2).setValues([[dt, JSON.stringify(copy)]]);
  else sh.appendRow([id, dt, JSON.stringify(copy), new Date().toISOString()]);
}
function pub_(u) { var o = {}; for (var k in u) if (k !== 'hash' && k !== 'salt') o[k] = u[k]; return o; }
function nextCounter_(e, f) {
  var p = PropertiesService.getScriptProperties(), key = 'ctr_' + e, v = p.getProperty(key);
  if (v === null) { v = 0; getAll_(e).forEach(function (r) { v = Math.max(v, +r[f] || 0); }); }
  v = (+v) + 1; p.setProperty(key, String(v)); return v;
}
function seed_() {
  var now = new Date().toISOString();
  ['services', 'doctors', 'companies', 'staff'].forEach(function (e) {
    (SEED[e] || []).forEach(function (r) { var o = {}; for (var k in r) o[k] = r[k]; o.id = rid_(); o.createdAt = now; if (AUTO[e]) o[AUTO[e]] = nextCounter_(e, AUTO[e]); put_(e, o); });
  });
}
function withLock_(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- الموجّه ---------- */
function route_(b) {
  var A = String(b.action || ''), cache = CacheService.getScriptCache();
  if (A === 'status') return {hasUsers: getAll_('users').length > 0};

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
    var t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    cache.put('t_' + sha_(t), rec.id, TOKEN_TTL);
    return {token: t, user: pub_(rec)};
  }

  var tk = String(b.token || ''), uid = tk ? cache.get('t_' + sha_(tk)) : null, me = null;
  if (uid) { var us = getAll_('users'); for (var k = 0; k < us.length; k++) if (us[k].id === uid && us[k].active) me = us[k]; }
  if (!me) throw new ApiError('انتهت الجلسة، سجل الدخول من جديد', 'auth');
  me.perms = me.perms || [];
  if (A === 'me') return {user: pub_(me)};
  if (A === 'logout') { cache.remove('t_' + sha_(tk)); return {ok: true}; }

  var e = String(b.entity || '');
  if (['list', 'save', 'delete'].indexOf(A) >= 0 && ENT.indexOf(e) < 0) throw new ApiError('كيان غير معروف');

  if (A === 'list') {
    var reps = me.perms.some(function (x) { return x.indexOf('rep_') === 0; });
    var ok = !!me.isAdmin || (e !== 'users' && (e === 'staff' ? has_(me, 'staff') : (LOOKUP.indexOf(e) >= 0 || has_(me, e) || has_(me, 'dashboard') || has_(me, 'dues') || reps)));
    if (!ok) throw new ApiError('غير مصرح', 'forbidden');
    var items = getAll_(e, b.from || null, b.to || null);
    return {items: e === 'users' ? items.map(pub_) : items};
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
  return {ok: true};
}

function doSave_(e, me, src) {
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
  else { rec = {id: rid_(), createdAt: new Date().toISOString()}; for (var k2 in out) rec[k2] = out[k2]; if (e === 'visits' || e === 'expenses') rec.registeredBy = me.username; }
  put_(e, rec);
  return {record: e === 'users' ? pub_(rec) : rec};
}
