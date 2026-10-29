/* ============ تحليل إيرادات العيادة: دفتر الخزينة + الإيرادات غير المحصلة + العهد والسلف + تحليل المصروفات ============ */
'use strict';
const jnorm = s => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[ةه]/g, 'ه').replace(/[ـ\s()\-/]/g, '');
/* مجموعات أعمدة المصروفات: [المجموعة, [[العمود، [أسماء البنود المقبولة]]]] */
const JGROUPS = [
  ['تجهيزات طبية وأخرى', [['تجهيزات طبية وأخرى', ['تجهيزات طبيه وأخرى']]]],
  ['مصروفات محطة المياه', [['مصروفات محطة المياه', ['مصروفات محطة المياه']]]],
  ['مصروفات السيارة', [['بنزين', ['بنزين']], ['زيت', ['زيت']], ['صيانة', ['صيانه', 'صيانة السيارة']], ['تراخيص ورسوم وكارتات وجراج', ['تراخيص ورسوم وكارتات وجراج', 'تراخيص ورسوم']]]],
  ['مصروفات نقل', [['مصروفات نقل', ['مصاريف نقل', 'مصروفات نقل']]]],
  ['مصروفات مولد الكهرباء', [['جاز', ['جاز']], ['صيانة', ['صيانة المولد', 'صيانه مولد']]]],
  ['مصروفات المصعد', [['مصروفات المصعد', ['مصروفات المصعد']]]],
  ['رسوم تراخيص طبية ونفايات', [['رسوم تراخيص طبية ونفايات', ['رسوم تراخيص طبيه', 'رسوم تراخيص طبية ونفايات']]]],
  ['انتقالات', [['انتقالات', ['انتقالات']]]],
  ['اتصالات وتليفون وانترنت', [['اتصالات وتليفون وانترنت', ['اتصالات وتليفون وانترنت']]]],
  ['الدعاية والمطبوعات والأدوات الكتابية', [['دعايا', ['دعايا']], ['مطبوعات', ['مطبوعات']], ['أدوات كتابية', ['أدوات كتابيه']]]],
  ['البوفيه والضيافة', [['بوفيه', ['بوفيه', 'بوفية']], ['بدل ضيافة', ['بدل ضيافه']]]],
  ['مصروفات نظافة', [['مصروفات نظافة', ['مصروفات نظافه']]]],
  ['نثريات وإكراميات ومصروفات أخرى', [['نثريات وإكراميات ومصروفات أخرى', ['نثريات وإكراميات ومصروفات أخرى', 'مصاريف متنوعة', 'مصاريف تشغيل']]]],
  ['مصروفات الصيانة', [['كهرباء', ['كهرباء']], ['سباكة', ['سباكه']], ['نجارة وألوميتال ودهانات', ['نجاره ودهانات', 'نجاره والوميتال ودهانات']], ['أجهزة كهربائية', ['اجهزة كهربائيه']]]],
  ['إيصالات كهرباء', [['إيصالات كهرباء', ['إيصالات كهرباء']]]],
  ['إيصال مياه', [['إيصال مياه', ['إيصال مياه']]]],
  ['إيصالات تأمينات وضرائب', [['إيصالات تأمينات وضرائب', ['إيصال ضرائب', 'إيصالات تأمينات وضرائب']]]],
  ['مصروفات المستلزمات الطبية', [['صيانة أجهزة طبية', ['صيانة أجهزه طبيه']], ['معمل لاب تولاب', ['معمل لاب تولاب']], ['مستلزمات معمل', ['مستلزمات معمل']], ['تركيبات أسنان', ['تركيبات أسنان']], ['مستلزمات أسنان', ['مستلزمات أسنان']], ['مستلزمات طبية وأدوية', ['مستلزمات طبيه وأدويه']]]],
  ['الأجور والمرتبات', [['مرتبات الموظفين والعمال', ['مرتبات الموظفين والعمال']], ['أجور الأطباء والتمريض', ['اجور الأطباء والتمريض', 'مستحقات أطباء']], ['مكافآت', ['مكافآت', 'مكأفات', 'مكأفات عمليات']], ['بدلات', ['بدلات']], ['حوافز', ['حوافز']]]],
  ['مصروفات التأمين الصحي', [['مصروفات التأمين الصحي', ['مصروفات التأمين الصحي']]]]
];
const JLEAVES = []; JGROUPS.forEach(([g, cols]) => cols.forEach(([l, al]) => JLEAVES.push({g, l, al: al.map(jnorm)})));
const JOTHER = JLEAVES.findIndex(x => x.l === 'نثريات وإكراميات ومصروفات أخرى'), JDOC = JLEAVES.findIndex(x => x.l === 'أجور الأطباء والتمريض');
const jleaf = cat => { const k = jnorm(cat), i = JLEAVES.findIndex(x => x.al.includes(k)); return i >= 0 ? i : JOTHER; };

function journalLedger(from, to) {
  const ents = [], dates = new Set();
  const mk = (date, ord, o) => { ents.push(Object.assign({date, ord, in: 0, out: 0, co: 0, refund: 0, com: 0, tax: 0, ins: 0, cd: 0, cc: 0, ex: {}, bayan: '', op: '', doc: '', note: ''}, o)); dates.add(date); };
  const vsAll = S.data.visits.filter(v => v.date <= to), opsAll = S.data.operations.filter(o => o.date <= to);
  [...new Set([...vsAll.map(v => v.date), ...opsAll.map(o => o.date)])].forEach(d => {
    const vs = vsAll.filter(v => v.date === d), ops = opsAll.filter(o => o.date === d);
    const rev = sum(vs, val) + sum(ops, o => o.value), co = sum(vs.filter(v => v.category === 'company'), val), com = sum(vs.filter(v => v.category === 'committee'), val), ins = sum(vs, discountAmt), tax = sum(vs, v => v.tax);
    mk(d, 0, {bayan: 'إيرادات العيادة', op: 'إيراد', note: `${vs.length} زيارة${ops.length ? ' + ' + ops.length + ' عملية' : ''}`, in: rev - co - com - ins, co, com, ins, tax});
  });
  S.data.expenses.filter(e => e.date <= to).forEach(e => {
    const amt = +e.amount || 0;
    if (e.doctor) mk(e.date, 2, {bayan: e.doctor, op: 'صرف طبيب', doc: e.docNo || '', note: e.notes || '', out: amt, ex: {[JDOC]: amt}});
    else if (jnorm(e.category) === jnorm('الرد النقدي')) mk(e.date, 1, {bayan: e.category, op: 'رد نقدي', doc: e.docNo || '', note: e.notes || '', out: amt, refund: amt});
    else mk(e.date, 1, {bayan: e.category || '', op: 'مصروف', doc: e.docNo || '', note: e.notes || '', out: amt, ex: {[jleaf(e.category)]: amt}});
  });
  S.data.custody.filter(c => c.date <= to).forEach(c => { const amt = +c.amount || 0, give = c.dir === 'out'; mk(c.date, 3, {bayan: `${c.kind || 'عهدة'} — ${c.person || ''}`, op: give ? 'صرف عهدة/سلفة' : 'رد عهدة/سلفة', doc: c.docNo || '', note: c.notes || '', out: give ? amt : 0, in: give ? 0 : amt, cd: give ? amt : 0, cc: give ? 0 : amt}); });
  ents.sort((a, b) => a.date.localeCompare(b.date) || a.ord - b.ord);
  let bal = 0, cbal = 0; const rows = []; let open = null;
  ents.forEach(e => { if (!open && e.date >= from) open = {bal, cbal}; bal += e.in - e.out; cbal += e.cd - e.cc; e.bal = bal; e.cbal = cbal; if (e.date >= from) rows.push(e); });
  if (!open) open = {bal, cbal};
  return {rows, open, close: {bal, cbal}};
}

SCREEN_RENDER.rep_journal = async function () {
  if (!can('rep_journal')) { $('#main').innerHTML = '<div class="panel">⛔ لا تملك صلاحية هذا التقرير</div>'; return; }
  const main = $('#main'); let showAll = false;
  const build = () => {
    const {from, to} = getRange(), L_ = journalLedger(from, to), rows = L_.rows;
    const T = k => sum(rows, r => r[k]);
    const leafTot = JLEAVES.map((_, i) => sum(rows, r => r.ex[i] || 0));
    const vis = JLEAVES.map((_, i) => showAll || leafTot[i] !== 0);
    const groups = JGROUPS.map(([g, cols]) => ({g, idx: cols.map(c => JLEAVES.findIndex(x => x.g === g && x.l === c[0])).filter(i => vis[i])})).filter(x => x.idx.length);
    return {from, to, L_, rows, T, leafTot, groups};
  };
  const draw = () => {
    const {L_, rows, T, leafTot, groups} = build(), n = x => x ? fmtN(x) : '', b = t => `<b>${t}</b>`, Lv = JLEAVES;
    const head = `<thead><tr><th rowspan="2">التاريخ</th><th colspan="3">حركة الخزينة</th><th colspan="5">إيرادات غير محصلة</th><th colspan="3">العهد والسلف</th><th colspan="4">تحليل القيد</th>${groups.map(x => x.idx.length === 1 && Lv[x.idx[0]].l === x.g ? `<th rowspan="2">${esc(x.g)}</th>` : `<th colspan="${x.idx.length}">${esc(x.g)}</th>`).join('')}</tr>
      <tr><th>الرصيد</th><th>مدين</th><th>دائن</th><th>شركات</th><th>رد نقدي أو شركات</th><th>لجنة</th><th>ضرائب مرتبات</th><th>تأمينات</th><th>الرصيد</th><th>مدين</th><th>دائن</th><th>البيان</th><th>العملية</th><th>رقم المستند</th><th>التعليق</th>${groups.map(x => x.idx.length === 1 && Lv[x.idx[0]].l === x.g ? '' : x.idx.map(i => `<th>${esc(Lv[i].l)}</th>`).join('')).join('')}</tr></thead>`;
    const cells = r => [esc(r.date), fmtN(r.bal), n(r.in), n(r.out), n(r.co), n(r.refund), n(r.com), n(r.tax), n(r.ins), fmtN(r.cbal), n(r.cd), n(r.cc), esc(r.bayan), esc(r.op), esc(r.doc), esc(r.note), ...groups.flatMap(x => x.idx.map(i => n(r.ex[i])))];
    const openRow = [b('رصيد مرحل'), b(fmtN(L_.open.bal)), '', '', '', '', '', '', '', b(fmtN(L_.open.cbal)), '', '', '', '', '', '', ...groups.flatMap(x => x.idx.map(() => ''))];
    const tot = [b('الإجمالي'), b(fmtN(L_.close.bal)), b(fmtN(T('in'))), b(fmtN(T('out'))), b(fmtN(T('co'))), b(fmtN(T('refund'))), b(fmtN(T('com'))), b(fmtN(T('tax'))), b(fmtN(T('ins'))), b(fmtN(L_.close.cbal)), b(fmtN(T('cd'))), b(fmtN(T('cc'))), '', '', '', '', ...groups.flatMap(x => x.idx.map(i => b(fmtN(leafTot[i]))))];
    main.innerHTML = `${pageHead('تحليل إيرادات العيادة', '🧾', 'cyan')}${rangeBar()}<div class="bar noprint">${window.exportButtons}<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="jall" ${showAll ? 'checked' : ''} style="width:auto"> إظهار كل أعمدة المصروفات (حتى الفارغة)</label></div>
    ${kpiRow([['رصيد الخزينة أول الفترة', fmtN(L_.open.bal), 'teal'], ['إجمالي المدين (قبض)', fmtN(T('in')), 'lime'], ['إجمالي الدائن (صرف)', fmtN(T('out')), 'red'], ['رصيد الخزينة آخر الفترة', fmtN(L_.close.bal), 'orange'], ['رصيد العهد والسلف', fmtN(L_.close.cbal), 'blue']])}
    <div class="tbl-wrap"><table>${head}<tbody>${rows.length || L_.open.bal ? `<tr class="daytot">${openRow.map(x => `<td>${x}</td>`).join('')}</tr>` : ''}${rows.map(r => `<tr>${cells(r).map(x => `<td>${x}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${16 + groups.reduce((s, x) => s + x.idx.length, 0)}" class="empty">لا توجد حركة في هذه الفترة</td></tr>`}</tbody><tfoot><tr>${tot.map(x => `<td>${x}</td>`).join('')}</tr></tfoot></table></div>
    <small class="muted">مدين الخزينة = إيرادات اليوم − (الشركات + اللجنة + قيمة خصم التأمين) ؛ دائن الخزينة = المصروفات + المدفوع للأطباء + الرد النقدي + صرف العهد والسلف. المدفوع للأطباء يُسجَّل بتاريخ الصرف.</small>`;
    $('#jall').onchange = e => { showAll = e.target.checked; draw(); };
  };
  S.view = {refresh: draw, exportData: () => {
    const {L_, rows, T, leafTot, groups} = build(), N = x => x ? +(+x).toFixed(2) : '';
    const top = ['التاريخ', 'حركة الخزينة', '', '', 'إيرادات غير محصلة', '', '', '', '', 'العهد والسلف', '', '', 'تحليل القيد', '', '', '', ...groups.flatMap(x => x.idx.map((_, k) => k ? '' : x.g))];
    const sub = ['', 'الرصيد', 'مدين', 'دائن', 'شركات', 'رد نقدي أو شركات', 'لجنة', 'ضرائب مرتبات', 'تأمينات', 'الرصيد', 'مدين', 'دائن', 'البيان', 'العملية', 'رقم المستند', 'التعليق', ...groups.flatMap(x => x.idx.map(i => JLEAVES[i].l))];
    const out = [top, sub, ['رصيد مرحل', N(L_.open.bal), '', '', '', '', '', '', '', N(L_.open.cbal), ...Array(6 + groups.reduce((s, x) => s + x.idx.length, 0)).fill('')]];
    rows.forEach(r => out.push([r.date, N(r.bal), N(r.in), N(r.out), N(r.co), N(r.refund), N(r.com), N(r.tax), N(r.ins), N(r.cbal), N(r.cd), N(r.cc), r.bayan, r.op, r.doc, r.note, ...groups.flatMap(x => x.idx.map(i => N(r.ex[i])))]));
    out.push(['الإجمالي', N(L_.close.bal), N(T('in')), N(T('out')), N(T('co')), N(T('refund')), N(T('com')), N(T('tax')), N(T('ins')), N(L_.close.cbal), N(T('cd')), N(T('cc')), '', '', '', '', ...groups.flatMap(x => x.idx.map(i => N(leafTot[i])))]);
    return [{name: 'تحليل إيرادات العيادة', rows: out}]; }};
  draw();
};
