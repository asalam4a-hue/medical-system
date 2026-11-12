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
  let top, bot, txt, mute, started = false;
  const ls = {get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }};
  let muted = ls.get('azk_mute') === '1';
  const list = () => new Date().getHours() < 12 ? AZK_M : AZK_E;
  const kind = () => new Date().getHours() < 12 ? 'm' : 'e';
  /* ---- النص: كل الأذكار وراء بعض في سطر واحد متحرك ---- */
  let shownKind = '';
  const paintText = () => {
    if (!txt || shownKind === kind()) return; shownKind = kind();
    const pre = kind() === 'm' ? '🌅 أذكار الصباح: ' : '🌙 أذكار المساء: ', t = pre + list().join('   ✦   ') + '   ✦   ';
    txt.textContent = t; txt.style.animation = 'none'; void txt.offsetWidth; txt.style.animation = `azkmove ${Math.max(60, Math.round(t.length * .22))}s linear infinite`;
  };
  /* ---- الصوت: ملفات متتابعة (مرفق/حسن صالح ثم قرآن الصباح) ---- */
  const YT_AZK = '2Xf0kDLa8RE', YT_QURAN = 'RZ1x5UjAMZQ';
  let au = null, yt = null, ytReady = false, cur = -1, fails = 0, customUrls = [], customId = '', retryBound = false, playing = false;
  const SHA = '75f3439f6fbe692e9d7c489524777b22b38c2f7c', DEF = [1, 2].map(n => `https://raw.githubusercontent.com/asalam4a-hue/medical-system/${SHA}/medical-center/web/audio/azkar${n}.mp3`);
  const tracks = () => (customUrls.length ? customUrls : DEF).map(u => ({url: u}));
  const loadCustom = async () => {
    try { const id = (window.S && S.settings && S.settings.azkAudio) || window.AZK_AUDIO_ID || ''; if (id === customId) return; customId = id; customUrls = []; for (const x of String(id).split(',').filter(Boolean)) customUrls.push(await fileURL(x)); } catch (e) { customUrls = []; }
  };
  const stopAll = () => { try { if (au) au.pause(); } catch (e) {} try { if (yt && yt.pauseVideo) yt.pauseVideo(); } catch (e) {} };
  const ytInit = cb => {
    if (ytReady) return cb();
    const go = () => {
      const d = document.createElement('div'); d.id = 'azkyt'; d.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:200px;height:120px;opacity:0;pointer-events:none'; const h = document.createElement('div'); h.id = 'azkyt_p'; d.appendChild(h); document.body.appendChild(d);
      yt = new YT.Player('azkyt_p', {width: 200, height: 120, playerVars: {autoplay: 1, controls: 0, playsinline: 1, rel: 0}, events: {
        onReady: () => { ytReady = true; cb(); },
        onStateChange: e => { if (e.data === 0 && cur >= 0 && tracks()[cur] && tracks()[cur].yt) advance(); },
        onError: () => { fails++; advance(); }}});
    };
    if (window.YT && YT.Player) return go();
    const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { if (prev) prev(); go(); };
    const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.onerror = () => { fails++; advance(); }; document.head.appendChild(sc);
  };
  const advance = () => { if (!tracks().length) { playing = false; return; } cur = (cur + 1) % tracks().length; if (fails >= tracks().length * 2) { playing = false; return; } playTrack(); };
  const playTrack = () => {
    if (!S.user || muted || !playing) return; const t = tracks()[cur]; if (!t) return;
    stopAll();
    if (t.url) {
      if (!au) { au = new Audio(); au.onended = advance; au.onerror = () => { fails++; advance(); }; }
      if (au.src !== t.url) au.src = t.url;
      const pr = au.play(); if (pr && pr.catch) pr.catch(() => bindRetry()); fails = 0;
    } else ytInit(() => { try { if (yt.getVideoData && yt.getVideoData().video_id === t.yt && yt.playVideo) { yt.unMute(); yt.playVideo(); } else yt.loadVideoById(t.yt); setTimeout(() => { try { if (yt.getPlayerState() === -1 || yt.getPlayerState() === 5) bindRetry(); else fails = 0; } catch (e) {} }, 4000); } catch (e) { fails++; advance(); } });
  };
  const bindRetry = () => { if (retryBound) return; retryBound = true; const h = () => { retryBound = false; document.removeEventListener('click', h, true); if (!muted && S.user) { if (cur < 0) cur = 0; playing = true; playTrack(); } }; document.addEventListener('click', h, true); };
  const startAudio = async () => { await loadCustom(); if (cur < 0) cur = 0; playing = true; fails = 0; playTrack(); };
  const stats = () => {
    try {
      const t = today(), vs = visitsIn(t, t), st = statementRows(t, t), sm = c => vs.filter(v => v.category === c).reduce((s, v) => s + (+v.value || 0), 0), tax = vs.reduce((s, v) => s + (+v.tax || 0), 0);
      return [['🧾 زيارات اليوم', vs.length + S.data.operations.filter(o => o.date === t).length], ['🩺 الكشف', fmtN(st.kosf)], ['🧩 متنوع', fmtN(st.mixed)], ['🏥 العمليات', fmtN(st.opsRev)], ['💰 إجمالي الإيراد', fmtN(st.dayRev)], ['💵 النقدي', fmtN(vs.reduce((s, v) => s + cashOf(v), 0))], ['🏢 الشركات', fmtN(vs.reduce((s, v) => s + coAmt(v), 0))], ['🏛️ اللجنة', fmtN(vs.reduce((s, v) => s + comAmt(v), 0))], ['🛡️ التأمين', fmtN(vs.reduce((s, v) => s + discountAmt(v), 0))], ['🏛️ الضريبة', fmtN(tax)], ['💸 المصروفات', fmtN(st.expO)], ['📊 الصافي', fmtN(st.net)]];
    } catch (e) { return []; }
  };
  const paint = () => { if (!bot) return; const h = stats().map(x => `<span class="dchip">${x[0]}: <b>${x[1]}</b></span>`).join(''); const key = h; if (bot.dataset.k !== key) { bot.dataset.k = key; bot.firstChild.innerHTML = `<div class="dtrack">${h}${h}</div>`; } };
  const mount = app => {
    if (!top) {
      top = document.createElement('div'); top.className = 'azkbar noprint';
      mute = document.createElement('button'); mute.className = 'azkmute'; mute.type = 'button';
      mute.onclick = () => { muted = !muted; ls.set('azk_mute', muted ? '1' : '0'); mute.textContent = muted ? '🔇' : '🔊'; mute.title = muted ? 'تشغيل الصوت' : 'إيقاف الصوت'; if (muted) stopAll(); else startAudio(); };
      txt = document.createElement('span'); txt.className = 'azktxt'; const w = document.createElement('div'); w.className = 'azkwrap'; w.appendChild(txt);
      top.append(mute, w);
      bot = document.createElement('div'); bot.className = 'daybar noprint'; bot.innerHTML = '<div class="dwrap"></div>';
      setInterval(() => { paint(); paintText(); if (!S.user) { stopAll(); started = false; playing = false; } }, 4000);
    }
    mute.textContent = muted ? '🔇' : '🔊'; mute.title = muted ? 'تشغيل الصوت' : 'إيقاف الصوت';
    app.insertBefore(top, app.firstChild); app.appendChild(bot); bot.dataset.k = ''; paint();
    paintText(); if (!started) { started = true; if (!muted) startAudio(); }
  };
  return {mount, paint, reload: async () => { await loadCustom(); if (playing && !muted) { cur = -1; advance(); } }};
})();
window.Bars = Bars;
