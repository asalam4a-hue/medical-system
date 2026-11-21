/**
 * برنامج إدارة المركز الطبي — محمّل تلقائي التحديث (Google Apps Script)
 * هذا الملف يُلصق مرة واحدة فقط ولا يتغير بعد ذلك: كود الخادم والواجهة يُحمَّلان من GitHub
 * (مجلد medical-center/gas) ويتجددان تلقائياً خلال دقائق من أي تغيير، بدون نشر جديد ولا تغيير الرابط.
 */
/* ثلاثة مصادر بالترتيب: إن تعذّر أحدها ينتقل للتالي (GitHub raw ثم jsDelivr ثم واجهة GitHub API) */
var REPO_ = 'asalam4a-hue/medical-system', DIR_ = 'medical-center/gas/';
var CHUNK_ = 25000, KEEP_ = 21600, FRESH_ = 180, SRC_USED_ = '';
function fetchSrc_(name) {
  var t = '?t=' + Date.now(), tries = [
    ['raw', 'https://raw.githubusercontent.com/' + REPO_ + '/main/' + DIR_ + name + t, {}],
    ['jsdelivr', 'https://cdn.jsdelivr.net/gh/' + REPO_ + '@main/' + DIR_ + name, {}],
    ['github-api', 'https://api.github.com/repos/' + REPO_ + '/contents/' + DIR_ + name + '?ref=main', {Accept: 'application/vnd.github.raw'}]
  ], errs = [];
  for (var i = 0; i < tries.length; i++) {
    try {
      var r = UrlFetchApp.fetch(tries[i][1], {muteHttpExceptions: true, headers: tries[i][2]});
      if (r.getResponseCode() === 200) { var txt = r.getContentText('UTF-8'); if (txt.length > 1000) return {txt: txt, via: tries[i][0]}; errs.push(tries[i][0] + ': ملف فارغ'); }
      else errs.push(tries[i][0] + ': HTTP ' + r.getResponseCode());
    } catch (e) { errs.push(tries[i][0] + ': ' + String(e.message || e).slice(0, 80)); }
  }
  throw new Error(errs.join(' | '));
}
function src_(name) {
  var c = CacheService.getScriptCache(), key = 'src_' + name;
  function fromCache() {
    var n = c.get(key + '_n'); if (!n) return null;
    var ks = []; for (var i = 0; i < +n; i++) ks.push(key + '_' + i);
    var o = c.getAll(ks), p = [];
    for (var j = 0; j < ks.length; j++) { if (o[ks[j]] == null) return null; p.push(o[ks[j]]); }
    SRC_USED_ = (c.get(key + '_w') || 'cache') + '+cache'; return p.join('');
  }
  if (c.get(key + '_f')) { var t = fromCache(); if (t) return t; }
  var fail = '';
  try {
    var got = fetchSrc_(name), txt = got.txt, o = {}, n = Math.ceil(txt.length / CHUNK_);
    for (var i = 0; i < n; i++) o[key + '_' + i] = txt.substr(i * CHUNK_, CHUNK_);
    o[key + '_n'] = String(n); o[key + '_w'] = got.via; c.putAll(o, KEEP_); c.put(key + '_f', '1', FRESH_);
    SRC_USED_ = got.via; return txt;
  } catch (e) { fail = String(e.message || e); }
  var st = fromCache(); if (st) return st;      /* تعذّر GitHub: استخدم آخر نسخة محفوظة */
  throw new Error('تعذر تحميل ' + name + ' من GitHub — ' + fail);
}
function load_() { if (typeof core_handle !== 'function') (0, eval)(src_('core.js')); }

function doGet() {
  return HtmlService.createHtmlOutput(src_('Index.html'))
    .setTitle('برنامج إدارة المركز الطبي')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function gh_fail_(x) { return JSON.stringify({error: 'خادم Google لا يستطيع تحميل الكود من GitHub: ' + String(x.message || x) + ' — شغّل الدالة setup ووافق على الأذونات', code: 'github', loader: 1}); }
function doPost(e) { try { load_(); } catch (x) { return ContentService.createTextOutput(gh_fail_(x)).setMimeType(ContentService.MimeType.JSON); } return core_doPost(e); }
function handle(s) { try { load_(); } catch (x) { return gh_fail_(x); } return core_handle(s); }
function setup() { load_(); return core_setup(); }
function syncSheets() { load_(); return syncSheets_(); }
