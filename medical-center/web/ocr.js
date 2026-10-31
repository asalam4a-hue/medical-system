/* ============ قراءة بيانات الكارنيه / البطاقة من الصورة (OCR داخل المتصفح — الصورة لا تُرسل لأي خدمة خارجية) ============ */
'use strict';
const OCR = (() => {
  const AR_DIG = '٠١٢٣٤٥٦٧٨٩', FA_DIG = '۰۱۲۳۴۵۶۷۸۹';
  const normDigits = s => String(s || '').replace(/[٠-٩]/g, c => AR_DIG.indexOf(c)).replace(/[۰-۹]/g, c => FA_DIG.indexOf(c));
  const STOP = /جمهورية|مصر|العربية|بطاقة|تحقيق|شخصية|وزارة|الداخلية|تأمين|الرقم|القومي|كارنيه|كارنية|الصحي|هيئة|صالحة|حتى|تاريخ|الميلاد|محل|الإقامة|العنوان|المهنة|الحالة|الاجتماعية|الديانة|مسلم|مسيحي|اعزب|متزوج|ذكر|انثى|أنثى|شركة|رقم|بطاقه|المستفيد|الاسم/;
  function birthFromNid(n) {
    if (!/^[23]\d{13}$/.test(n)) return '';
    const y = (n[0] === '2' ? 1900 : 2000) + (+n.slice(1, 3)), m = +n.slice(3, 5), d = +n.slice(5, 7);
    const dt = new Date(y, m - 1, d); if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
    return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  }
  /* تحليل النص المستخرج → {nationalId, birthDate, cardNo, name} */
  function parse(text) {
    const t = normDigits(text), out = {nationalId: '', birthDate: '', cardNo: '', name: ''};
    const compact = t.replace(/[ \t]/g, '');
    const m14 = compact.match(/[23]\d{13}/g); if (m14) { const v = m14.find(x => birthFromNid(x)); if (v) { out.nationalId = v; out.birthDate = birthFromNid(v); } }
    const seqs = (t.match(/\d[\d\- ]{4,}\d/g) || []).map(x => x.replace(/[\s-]/g, '')).filter(x => x.length >= 5 && x.length <= 16 && x !== out.nationalId && !(out.nationalId && x.includes(out.nationalId)));
    if (seqs.length) out.cardNo = seqs.sort((a, b) => b.length - a.length)[0];
    const cands = t.split(/\r?\n/).map(l => l.replace(/[^؀-ۿ ]/g, ' ').replace(/\s+/g, ' ').trim()).filter(l => {
      const w = l.split(' ').filter(x => x.length > 1); return w.length >= 2 && w.length <= 5 && l.length >= 6 && !STOP.test(l);
    });
    if (cands.length) { out.name = cands[0]; if (cands[1] && cands[1].split(' ').length <= 2) out.name += ' ' + cands[1]; }
    return out;
  }
  let loading = null, worker = null;
  const loadLib = () => loading || (loading = new Promise((ok, no) => {
    if (window.Tesseract) return ok(); const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js'; s.onload = ok; s.onerror = () => { loading = null; no(new Error('تعذر تحميل أداة القراءة — تحقق من الإنترنت')); };
    document.head.appendChild(s);
  }));
  async function read(dataUrl) {
    await loadLib(); if (!worker) worker = await Tesseract.createWorker('ara+eng');
    const r = await worker.recognize(dataUrl); return r.data.text || '';
  }
  /* تعبئة الحقول الفارغة فقط في نموذج الإدخال */
  async function fillForm(form, dataUrl, kind) {
    const text = await read(dataUrl), p = parse(text), done = [];
    const put = (n, v, label) => { const el = $(`[name="${n}"]`, form); if (el && v && !el.value.trim()) { el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); done.push(label); } };
    put('nationalId', p.nationalId, 'الرقم القومي'); put('birthDate', p.birthDate, 'تاريخ الميلاد');
    if (kind === 'card') put('cardNo', p.cardNo, 'رقم الكارنيه');
    put($(`[name="patient"]`, form) ? 'patient' : 'name', p.name, 'الاسم');
    return done;
  }
  return {parse, read, fillForm, birthFromNid};
})();
