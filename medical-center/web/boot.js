/* القشرة الثابتة: تشغّل حزمة التطبيق (المضمّنة أو الأحدث المخزّنة) وتتحقق من GitHub (medical-center/version.json)
   وعند وجود نسخة أحدث تحمّلها وتخزّنها وتعيد التشغيل تلقائياً. */
(function () {
  var K = 'mc_app', RAW = 'https://raw.githubusercontent.com/asalam4a-hue/medical-system/main/medical-center/', P = window.__P, st = null;
  try { st = JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) {}
  if (st && st.build > P.build && st.items) P = st;                 /* نسخة مخزّنة أحدث من المضمّنة (مثلاً بعد تثبيت APK قديم) */
  window.BUILD_TS = P.build;
  function run(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.k === 'css') { var s = document.createElement('style'); s.textContent = it.c; document.head.appendChild(s); }
      else { var sc = document.createElement('script'); sc.text = it.c; document.body.appendChild(sc); }
    }
  }
  try { run(P.items); } catch (e) { console.error(e); }
  function get(url) {
    return new Promise(function (ok, no) {
      var u = url + '?t=' + Date.now();
      if (window.AndroidBridge && window.AndroidBridge.httpPost) {
        var id = 'u' + Math.random().toString(36).slice(2); window.__nat = window.__nat || {};
        var prev = window.__nativeCb;
        window.__nativeCb = function (i, s, t) { var f = window.__nat[i]; if (f) { delete window.__nat[i]; f(s, t); } else if (prev) prev(i, s, t); };
        window.__nat[id] = function (s, t) { ok(t); }; setTimeout(function () { no(new Error('t')); }, 25000); window.AndroidBridge.httpPost(id, u, '');
      } else fetch(u, {cache: 'no-store'}).then(function (r) { return r.text(); }).then(ok, no);
    });
  }
  var busy = false;
  window.__checkUpdate = function () {
    if (busy) return; busy = true;
    get(RAW + 'version.json').then(function (t) {
      var j = JSON.parse(t); if (!(j.build > P.build)) { busy = false; return; }
      return get(RAW + 'php/index.html').then(function (h) {
        var a = h.indexOf('/*P1*/'), b = h.indexOf('/*P2*/'); if (a < 0 || b < a) { busy = false; return; }
        var np = JSON.parse(h.slice(a + 6, b));
        if (np && np.build >= j.build && np.items && np.items.length) { localStorage.setItem(K, JSON.stringify(np)); if (window.toast) toast('تم تحديث البرنامج تلقائياً — سيُعاد التشغيل'); setTimeout(function () { location.reload(); }, 1200); }
        else busy = false;
      });
    }).catch(function () { busy = false; });
  };
  setTimeout(window.__checkUpdate, 4000); setInterval(window.__checkUpdate, 600000);
})();
