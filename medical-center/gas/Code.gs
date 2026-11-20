/**
 * برنامج إدارة المركز الطبي — محمّل تلقائي التحديث (Google Apps Script)
 * هذا الملف يُلصق مرة واحدة فقط ولا يتغير بعد ذلك: كود الخادم والواجهة يُحمَّلان من GitHub
 * (مجلد medical-center/gas) ويتجددان تلقائياً خلال دقائق من أي تغيير، بدون نشر جديد ولا تغيير الرابط.
 */
var BASE_ = 'https://raw.githubusercontent.com/asalam4a-hue/medical-system/main/medical-center/gas/';
var CHUNK_ = 25000, KEEP_ = 21600, FRESH_ = 180;

function src_(name) {
  var c = CacheService.getScriptCache(), key = 'src_' + name;
  function fromCache() {
    var n = c.get(key + '_n'); if (!n) return null;
    var ks = []; for (var i = 0; i < +n; i++) ks.push(key + '_' + i);
    var o = c.getAll(ks), p = [];
    for (var j = 0; j < ks.length; j++) { if (o[ks[j]] == null) return null; p.push(o[ks[j]]); }
    return p.join('');
  }
  if (c.get(key + '_f')) { var t = fromCache(); if (t) return t; }
  try {
    var r = UrlFetchApp.fetch(BASE_ + name + '?t=' + Date.now(), {muteHttpExceptions: true});
    if (r.getResponseCode() === 200) {
      var txt = r.getContentText('UTF-8');
      if (txt.length > 1000) {
        var o = {}, n = Math.ceil(txt.length / CHUNK_);
        for (var i = 0; i < n; i++) o[key + '_' + i] = txt.substr(i * CHUNK_, CHUNK_);
        o[key + '_n'] = String(n); c.putAll(o, KEEP_); c.put(key + '_f', '1', FRESH_);
        return txt;
      }
    }
  } catch (e) {}
  var st = fromCache(); if (st) return st;      /* تعذّر GitHub: استخدم آخر نسخة محفوظة */
  throw new Error('تعذر تحميل ' + name + ' من GitHub — تأكد من الاتصال ومن أذونات الشبكة');
}
function load_() { if (typeof core_handle !== 'function') (0, eval)(src_('core.js')); }

function doGet() {
  return HtmlService.createHtmlOutput(src_('Index.html'))
    .setTitle('برنامج إدارة المركز الطبي')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doPost(e) { load_(); return core_doPost(e); }
function handle(s) { load_(); return core_handle(s); }
function setup() { load_(); return core_setup(); }
function syncSheets() { load_(); return syncSheets_(); }
