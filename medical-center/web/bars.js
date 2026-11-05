/* ===== شريط الأذكار (أعلى) + شريط حسابات اليوم (أسفل) ===== */
const AZK_M = ['أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',
  'اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور',
  'اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك علي وأبوء بذنبي فاغفر لي فإنه لا يغفر الذنوب إلا أنت',
  'رضيت بالله ربا وبالإسلام دينا وبمحمد صلى الله عليه وسلم نبيا',
  'اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت',
  'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم',
  'سبحان الله وبحمده، سبحان الله العظيم',
  'أستغفر الله العظيم وأتوب إليه',
  'حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم',
  'اللهم صل وسلم على نبينا محمد'];
const AZK_E = ['أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير',
  'اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير',
  'اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك علي وأبوء بذنبي فاغفر لي فإنه لا يغفر الذنوب إلا أنت',
  'أعوذ بكلمات الله التامات من شر ما خلق',
  'اللهم إني أسألك العفو والعافية في الدنيا والآخرة',
  'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم',
  'سبحان الله وبحمده، سبحان الله العظيم',
  'أستغفر الله العظيم وأتوب إليه',
  'يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله ولا تكلني إلى نفسي طرفة عين',
  'اللهم صل وسلم على نبينا محمد'];
const Bars = (() => {
  let top, bot, txt, mute, idx = 0, timer = null, started = false;
  const ls = {get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }};
  let muted = ls.get('azk_mute') === '1';
  const list = () => new Date().getHours() < 12 ? AZK_M : AZK_E;
  const speech = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  const stopSpeak = () => { try { speech() && speechSynthesis.cancel(); } catch (e) {} };
  const AUD = {m: 'https://archive.org/download/makkah-live.-net-athkar-01/MakkahLive.Net_athkar_03.mp3', e: 'https://archive.org/download/makkah-live.-net-athkar-01/MakkahLive.Net_athkar_04.mp3'};
  let au = null, auKind = '', auOk = true, retryBound = false;
  const kind = () => new Date().getHours() < 12 ? 'm' : 'e';
  const playAudio = () => {
    if (!S.user || muted || !auOk) { if (au) au.pause(); return; }
    const k = kind();
    if (!au || auKind !== k) { if (au) au.pause(); au = new Audio(AUD[k]); au.loop = true; au.preload = 'auto'; auKind = k; au.onerror = () => { auOk = false; next(true); }; }
    const pr = au.play(); if (pr && pr.catch) pr.catch(() => { if (retryBound) return; retryBound = true; const h = () => { retryBound = false; document.removeEventListener('click', h, true); playAudio(); }; document.addEventListener('click', h, true); });
  };
  const next = (speak) => {
    clearTimeout(timer);
    if (!S.user) { started = false; stopSpeak(); if (au) au.pause(); return; }
    const L = list(), t = L[idx++ % L.length], pre = new Date().getHours() < 12 ? '🌅 أذكار الصباح: ' : '🌙 أذكار المساء: ';
    const dur = Math.max(14, t.length * .2);
    if (txt) { txt.textContent = pre + t; txt.style.animation = 'none'; void txt.offsetWidth; txt.style.animation = `azkmove ${dur}s linear forwards`; }
    const fallback = () => { timer = setTimeout(next, dur * 1000 + 1500); };
    if (auOk) { playAudio(); return fallback(); }
    if (muted || !speech()) return fallback();
    try {
      stopSpeak(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ar-SA'; u.rate = .9;
      const v = speechSynthesis.getVoices().find(x => /^ar/i.test(x.lang)); if (v) u.voice = v;
      let done = false; const fin = () => { if (done) return; done = true; timer = setTimeout(next, 2500); };
      u.onend = fin; u.onerror = () => { if (done) return; done = true; fallback(); };
      speechSynthesis.speak(u); timer = setTimeout(fin, 90000);
    } catch (e) { fallback(); }
  };
  const stats = () => {
    try {
      const t = today(), vs = visitsIn(t, t), st = statementRows(t, t), sm = c => vs.filter(v => v.category === c).reduce((s, v) => s + (+v.value || 0), 0), tax = vs.reduce((s, v) => s + (+v.tax || 0), 0);
      return [['🧾 زيارات اليوم', vs.length], ['🩺 الكشف', fmtN(st.kosf)], ['🧩 متنوع', fmtN(st.mixed)], ['🏥 العمليات', fmtN(st.opsRev)], ['💰 إجمالي الإيراد', fmtN(st.dayRev)], ['🏢 الشركات', fmtN(sm('company'))], ['🏛️ اللجنة', fmtN(sm('committee'))], ['🛡️ التأمين', fmtN(sm('insurance'))], ['🏛️ الضريبة', fmtN(tax)], ['💸 المصروفات', fmtN(st.expO)], ['📊 الصافي', fmtN(st.net)]];
    } catch (e) { return []; }
  };
  const paint = () => { if (!bot) return; const h = stats().map(x => `<span class="dchip">${x[0]}: <b>${x[1]}</b></span>`).join(''); const key = h; if (bot.dataset.k !== key) { bot.dataset.k = key; bot.firstChild.innerHTML = `<div class="dtrack">${h}${h}</div>`; } };
  const mount = app => {
    if (!top) {
      top = document.createElement('div'); top.className = 'azkbar noprint';
      mute = document.createElement('button'); mute.className = 'azkmute'; mute.type = 'button';
      mute.onclick = () => { muted = !muted; ls.set('azk_mute', muted ? '1' : '0'); mute.textContent = muted ? '🔇' : '🔊'; mute.title = muted ? 'تشغيل الصوت' : 'إيقاف الصوت'; if (muted) { stopSpeak(); if (au) au.pause(); } else playAudio(); clearTimeout(timer); idx--; next(); };
      txt = document.createElement('span'); txt.className = 'azktxt'; const w = document.createElement('div'); w.className = 'azkwrap'; w.appendChild(txt);
      top.append(mute, w);
      bot = document.createElement('div'); bot.className = 'daybar noprint'; bot.innerHTML = '<div class="dwrap"></div>';
      setInterval(paint, 4000);
    }
    mute.textContent = muted ? '🔇' : '🔊'; mute.title = muted ? 'تشغيل الصوت' : 'إيقاف الصوت';
    app.insertBefore(top, app.firstChild); app.appendChild(bot); bot.dataset.k = ''; paint();
    if (!started) { started = true; idx = 0; next(); }
  };
  return {mount, paint};
})();
window.Bars = Bars;
