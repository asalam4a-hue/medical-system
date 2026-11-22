/* القشرة الثابتة: تشغّل حزمة التطبيق (المضمّنة أو الأحدث المخزّنة) وتتحقق من GitHub (medical-center/version.json)
   وعند وجود نسخة أحدث تحمّلها وتخزّنها وتعيد التشغيل تلقائياً. */
(function () {
  var K = 'mc_app', P = window.__P, st = null;
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
  /* ثلاثة مصادر بالترتيب: GitHub raw ثم jsDelivr ثم واجهة GitHub API */
  var REPO = 'asalam4a-hue/medical-system';
  function one(url, hdr) {
    return new Promise(function (ok, no) {
      if (window.AndroidBridge && window.AndroidBridge.httpPost && !hdr) {
        var id = 'u' + Math.random().toString(36).slice(2); window.__nat = window.__nat || {};
        var prev = window.__nativeCb;
        window.__nativeCb = function (i, s, t) { var f = window.__nat[i]; if (f) { delete window.__nat[i]; f(s, t); } else if (prev) prev(i, s, t); };
        window.__nat[id] = function (s, t) { (s >= 200 && s < 300 && t) ? ok(t) : no(new Error('HTTP ' + s)); }; setTimeout(function () { no(new Error('t')); }, 25000); window.AndroidBridge.httpPost(id, url, '');
      } else fetch(url, {cache: 'no-store', headers: hdr || {}}).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(ok, no);
    });
  }
  function get(path) {
    var t = '?t=' + Date.now(), list = [
      ['https://raw.githubusercontent.com/' + REPO + '/main/medical-center/' + path + t, null],
      ['https://cdn.jsdelivr.net/gh/' + REPO + '@main/medical-center/' + path, null],
      ['https://api.github.com/repos/' + REPO + '/contents/medical-center/' + path + '?ref=main', {Accept: 'application/vnd.github.raw'}]
    ];
    return list.reduce(function (p, it) { return p.catch(function () { return one(it[0], it[1]).then(function (x) { if (!x || x.length < 20) throw new Error('empty'); return x; }); }); }, Promise.reject(new Error('start')));
  }
  /* تطبيق التحديث في الخلفية: ينتظر حتى لا يكون المستخدم يكتب أو يحفظ، ثم يعيد التشغيل ويرجع لنفس الشاشة دون تسجيل خروج */
  var applying = false;
  function applyWhenIdle() {
    if (applying) return; applying = true;
    var tick = function () {
      var idle = true; try { idle = !(S.dirty || S.busy) && (!S.user || !document.querySelector('.modal')); } catch (e) {}
      if (idle && !document.hidden) {
        try { sessionStorage.setItem('mc_resume', JSON.stringify({t: Date.now(), screen: S.screen, arg: S.arg})); } catch (e) {}
        try { if (window.toast) toast('✔ تم تحديث البرنامج'); } catch (e) {}
        setTimeout(function () { location.reload(); }, 400);
      } else setTimeout(tick, 8000);
    };
    setTimeout(tick, 500);
  }
  var busy = false;
  window.__checkUpdate = function () {
    if (busy) return; busy = true;
    get('version.json').then(function (t) {
      var j = JSON.parse(t); if (!(j.build > P.build)) { busy = false; return; }
      return get('php/index.html').then(function (h) {
        var a = h.indexOf('/*P1*/'), b = h.indexOf('/*P2*/'); if (a < 0 || b < a) { busy = false; return; }
        var np = JSON.parse(h.slice(a + 6, b));
        if (np && np.build >= j.build && np.items && np.items.length) { localStorage.setItem(K, JSON.stringify(np)); applyWhenIdle(); }
        else busy = false;
      });
    }).catch(function () { busy = false; });
  };
  setTimeout(window.__checkUpdate, 4000); setInterval(window.__checkUpdate, 600000);
})();
