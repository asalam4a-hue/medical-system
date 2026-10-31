/* ============ إدارة البرنامج (للمدير فقط): الإعدادات، النسخ الاحتياطي، الاسترجاع، نسخة الماستر، حذف الكل ============ */
'use strict';
SCREEN_RENDER.admin = async function () {
  if (!can('admin')) { $('#main').innerHTML = '<div class="panel">⛔ للمدير فقط</div>'; return; }
  const main = $('#main'); let st = {}, master = {at: ''};
  try { st = (await API.call('settings')).settings; master = await API.call('master_info'); } catch (e) {}
  const fmtAt = a => a ? a.slice(0, 10).replace(/-/g, '/') + ' ' + a.slice(11, 16) + ' UTC' : 'لا توجد نسخة محفوظة';
  main.innerHTML = `${pageHead('إدارة البرنامج', '⚙️', 'orange')}
  <div class="panel accent c-teal"><h3>⚙️ إعدادات البرنامج</h3><form id="stf">
    <div class="fld"><label>اسم البرنامج</label><input name="appName" value="${esc(st.appName)}"></div>
    <div class="fld"><label>اسم المركز</label><input name="centerName" value="${esc(st.centerName)}"></div>
    <div class="fld"><label>رقم الهاتف</label><input name="phone" value="${esc(st.phone)}" dir="ltr"></div>
    <div class="fld"><label>اللوجو</label><div class="imgfld"><div class="th" data-act="lightbox" data-fid="${esc(st.logo)}">🖼️</div><input type="file" accept="image/*" class="hid"><button type="button" class="btn sm c-blue" data-act="pickimg">📷 اختيار اللوجو</button><button type="button" class="btn sm ghost" id="nologo">إزالة</button><input type="hidden" name="logo" value="${esc(st.logo)}"></div></div>
    <div class="actions"><button class="btn c-teal" type="submit">💾 حفظ الإعدادات</button></div></form></div>
  <div class="panel accent c-blue"><h3>💾 النسخ الاحتياطي والاسترجاع</h3>
    <p class="muted">النسخة تشمل كل بيانات البرنامج والمستخدمين والإعدادات (الصور لا تدخل في الملف).</p>
    <div class="actions"><button class="btn c-blue" id="bk">⬇️ تنزيل نسخة احتياطية</button><button class="btn c-orange" id="rs">⬆️ استرجاع من ملف</button><input type="file" id="rsf" accept=".json,application/json" class="hid"></div></div>
  <div class="panel accent c-violet"><h3>👑 النسخة الماستر</h3>
    <p class="muted">نسخة كاملة محفوظة على الخادم نفسه تستطيع الرجوع إليها بضغطة واحدة. آخر نسخة: <b id="mat">${fmtAt(master.at)}</b></p>
    <div class="actions"><button class="btn c-violet" id="ms">📌 حفظ نسخة ماستر الآن</button><button class="btn c-orange" id="mr">↩️ استرجاع النسخة الماستر</button></div></div>
  <div class="panel accent c-red"><h3>🗑️ حذف كل البيانات</h3>
    <p class="muted">يحذف الزيارات والمرضى والأطباء والخدمات والعمليات والمصروفات وكل بيانات البرنامج، ويُبقي المستخدمين وإعدادات البرنامج والنسخة الماستر. لا يمكن التراجع إلا بالاسترجاع.</p>
    <div class="fld"><label>اكتب عبارة التأكيد: حذف الكل</label><input id="rc" autocomplete="off"></div>
    <div class="actions"><button class="btn c-red" id="rz">🗑️ حذف الكل</button></div></div>`;
  const reload = async () => { await loadAll(); await loadSettings(); render(); };
  hydrateImgs(main);
  $('#nologo').onclick = () => { const h = $('[name=logo]', main); h.value = ''; const th = $('.th', main); th.dataset.fid = ''; th.innerHTML = '🖼️'; };
  $('#stf').onsubmit = e => { e.preventDefault(); guard($('button[type=submit]', e.target), async () => { const v = readForm(e.target); const r = await API.call('settings_save', v); applySettings(r.settings); toast('تم حفظ الإعدادات'); render(); }); };
  $('#bk').onclick = e => guard(e.target, async () => {
    const r = await API.call('backup'); const blob = new Blob([JSON.stringify(r.backup)], {type: 'application/json'});
    saveBlob(blob, 'zahraa-backup-' + today().replace(/\//g, '-') + '.json'); toast('تم تنزيل النسخة الاحتياطية');
  });
  $('#rs').onclick = () => $('#rsf').click();
  $('#rsf').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let bk; try { bk = JSON.parse(await f.text()); } catch (x) { return toast('الملف غير صالح', true); }
    if (!await confirmBox('سيتم استبدال كل بيانات البرنامج الحالية بمحتوى هذه النسخة. هل أنت متأكد؟')) return;
    await guard(null, async () => { await API.call('restore', {backup: bk}); toast('تم الاسترجاع — سجّل الدخول من جديد'); logoutLocal(); }); };
  $('#ms').onclick = e => guard(e.target, async () => { const r = await API.call('master_save'); $('#mat').textContent = fmtAt(r.at); toast('تم حفظ النسخة الماستر'); });
  $('#mr').onclick = async e => { if (!await confirmBox('سيتم استبدال كل البيانات الحالية بالنسخة الماستر. هل أنت متأكد؟')) return;
    guard(e.target, async () => { await API.call('master_restore'); toast('تم استرجاع النسخة الماستر — سجّل الدخول من جديد'); logoutLocal(); }); };
  $('#rz').onclick = async e => { if ($('#rc').value.trim() !== 'حذف الكل') return toast('اكتب عبارة التأكيد: حذف الكل', true);
    if (!await confirmBox('تحذير: سيتم حذف جميع بيانات البرنامج نهائياً. هل أنت متأكد؟')) return;
    guard(e.target, async () => { await API.call('reset', {confirm: 'حذف الكل'}); toast('تم حذف كل البيانات'); await reload(); }); };
};

/* ---------- متابعة المستخدمين (متصل / الصفحة الحالية) ---------- */
const fmtDT = iso => { const d = new Date(iso); if (isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
async function loadPres() { try { S.pres = {}; (await API.call('presence')).list.forEach(x => { S.pres[x.id] = x; }); } catch (e) {} }
const _usersScreen = SCREEN_RENDER.users;
SCREEN_RENDER.users = async function (a) {
  await loadPres(); const r = _usersScreen(a); clearInterval(window.__pt);
  window.__pt = setInterval(async () => {
    if (S.screen !== 'users' || !S.user) { clearInterval(window.__pt); return; }
    if (document.querySelector('.modal') || document.hidden) return; const ae = document.activeElement; if (ae && ae.closest && ae.closest('form')) return;
    await loadPres(); if (S.view && S.view.refresh) S.view.refresh();
  }, 10000);
  return r;
};
