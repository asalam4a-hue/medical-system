(function () {
  /* ساعة الأعلى */
  var top = document.getElementById('topclock');
  function tick() {
    var d = new Date();
    if (top) top.textContent = d.toLocaleDateString('ar-EG', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'}) + ' — ' + d.toLocaleTimeString('ar-EG');
  }
  if (top) { tick(); setInterval(tick, 1000); }

  /* إظهار/إخفاء الحقول الشرطية */
  var cond = document.querySelectorAll('[data-showif]');
  function applyCond() {
    cond.forEach(function (w) {
      var p = w.getAttribute('data-showif').split(':');
      var ctl = document.querySelector('[name="' + p[0] + '"]');
      var show = ctl && ctl.value === p[1];
      w.style.display = show ? '' : 'none';
      w.querySelectorAll('input,select,textarea').forEach(function (i) { if (!i.readOnly) i.disabled = !show; });
    });
  }
  if (cond.length) {
    document.querySelectorAll('select,input').forEach(function (i) { i.addEventListener('change', applyCond); });
    applyCond();
  }

  /* استخراج تاريخ الميلاد من الرقم القومي (شاشة المستخدمين) */
  var nid = document.getElementById('f_national_id'), bd = document.getElementById('f_birth_date');
  if (nid && bd) nid.addEventListener('input', function () {
    var v = nid.value.replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; });
    if (/^[23]\d{13}$/.test(v) && !bd.value) {
      var y = (v[0] === '2' ? '19' : '20') + v.substr(1, 2), m = v.substr(3, 2), d = v.substr(5, 2);
      if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) bd.value = y + '-' + m + '-' + d;
    }
  });
})();
