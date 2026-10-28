/* طبقة الاتصال: php | gas | local (تجريبي داخل المتصفح)
   نفس الأوامر تعمل في الثلاثة: status, register, login, me, logout, list, save, delete, upload, file */
(function(){
'use strict';
const MODE = window.API_MODE || 'php';
let token = null;
try { token = sessionStorage.getItem('mc_token'); } catch(e){}

async function call(action, payload){
  const body = Object.assign({action, token}, payload||{});
  let res;
  if (MODE === 'gas') {
    const txt = await new Promise((ok, fail) => {
      google.script.run.withSuccessHandler(ok).withFailureHandler(e => fail(new Error((e && e.message) || String(e)))).handle(JSON.stringify(body));
    });
    res = JSON.parse(txt);
  } else if (MODE === 'local') {
    res = await Local.handle(JSON.parse(JSON.stringify(body)));
  } else {
    const url = server();
    const gasRemote = /^https:\/\/script\.google(usercontent)?\.com\//.test(url);
    const r = await fetch(url, {method:'POST', redirect:'follow', headers:{'Content-Type': gasRemote ? 'text/plain;charset=utf-8' : 'application/json'}, body: JSON.stringify(body)});
    const t = await r.text();
    try { res = JSON.parse(t); } catch(e){ throw new Error('استجابة غير صالحة من الخادم'); }
  }
  if (res.error) { const e = new Error(res.error); e.code = res.code; throw e; }
  return res;
}
function server(){ let u = ''; try { u = localStorage.getItem('mc_server') || ''; } catch(e){} return u || window.API_URL || 'api.php'; }
function setServer(u){ try { u ? localStorage.setItem('mc_server', u) : localStorage.removeItem('mc_server'); } catch(e){} setToken(null); }
function setToken(t){ token = t; try { t ? sessionStorage.setItem('mc_token', t) : sessionStorage.removeItem('mc_token'); } catch(e){} }
window.API = {call, setToken, setServer, server, getToken: () => token, mode: MODE};

/* ====================== خادم تجريبي داخل المتصفح ====================== */
const ENT = ['users','staff','doctors','services','operations','patients','companies','visits','expenses'];
const LOOKUP = ['doctors','services','patients','companies'];
const WRITE = {staff:['staff'],doctors:['doctors'],services:['services'],operations:['operations'],patients:['patients','visits'],companies:['companies'],visits:['visits'],expenses:['expenses','dues']};
const FIELDS = {
  users:'username,nationalId,birthDate,perms,isAdmin,active',
  staff:'code,name,nationalId,idPhoto,photo',
  doctors:'code,name,clinic,phone,nationalId,idPhoto,syndicatePhoto,photo,hireDate,percent,fixed,opPercent',
  services:'type,name,price,tax',
  operations:'date,patient,operation,clinic,doctor,doctorId,value,doctorPercent,notes',
  patients:'name,phone',
  companies:'name,fee,contact',
  visits:'serial,date,patient,phone,clinic,doctor,doctorId,visitType,service,value,tax,category,company,formNo,formPhoto,cardNo,cardPhoto,nationalId,patientPct,discount,notes',
  expenses:'date,category,amount,notes,doctor'
};
const NUMS = new Set('percent,fixed,opPercent,price,tax,value,doctorPercent,fee,patientPct,discount,amount,code,serial'.split(','));
const DATES = new Set(['date','hireDate','birthDate']);
const AUTO = {staff:'code', doctors:'code', visits:'serial'};

const mem = {};
const store = {
  get(k){ try { const v = localStorage.getItem(k); if (v) return JSON.parse(v); } catch(e){ if (mem[k]) return JSON.parse(mem[k]); } return null; },
  set(k, v){ const s = JSON.stringify(v); try { localStorage.setItem(k, s); } catch(e){ mem[k] = s; } }
};
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(16).padStart(2,'0')).join('');
async function sha(s){
  if (crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2,'0')).join(''); }
  let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return String(h);
}
const validDate = s => { if (!/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return false; const [y,m,d] = s.split('/').map(Number); const t = new Date(y, m-1, d); return t.getFullYear()===y && t.getMonth()===m-1 && t.getDate()===d; };
const has = (u, p) => u.isAdmin || (u.perms || []).includes(p);

const Local = {
  db(){ return store.get('mc_db') || {rec:{}, files:{}, tokens:{}, fails:{}}; },
  save(db){ store.set('mc_db', db); },
  async handle(b){
    const db = this.db();
    const fail = (error, code) => ({error, code});
    const A = b.action;
    if (A === 'status') return {hasUsers: (db.rec.users || []).length > 0};
    if (A === 'register') {
      const users = db.rec.users || (db.rec.users = []);
      const u = String(b.username || '').trim(), p = String(b.password || '');
      if (u.length < 3 || p.length < 4) return fail('اسم المستخدم 3 أحرف على الأقل وكلمة السر 4 أحرف على الأقل');
      if (users.some(x => x.username.toLowerCase() === u.toLowerCase())) return fail('اسم المستخدم موجود بالفعل');
      const first = users.length === 0, salt = rid();
      const rec = {id: rid(), username: u, salt, hash: await sha(salt + p), nationalId: String(b.nationalId || '').slice(0, 20), birthDate: validDate(b.birthDate) ? b.birthDate : '', perms: first ? ['*'] : [], isAdmin: first, active: first, createdAt: new Date().toISOString()};
      users.push(rec);
      if (first && window.SEED) this.seed(db);
      this.save(db);
      return {ok: true, pending: !first};
    }
    if (A === 'login') {
      const users = db.rec.users || [], u = String(b.username || '').trim().toLowerCase();
      const f = db.fails[u] || {n: 0, t: 0};
      if (f.n >= 5 && Date.now() - f.t < 600000) return fail('محاولات كثيرة، حاول بعد 10 دقائق');
      const rec = users.find(x => x.username.toLowerCase() === u);
      if (!rec || rec.hash !== await sha(rec.salt + String(b.password || ''))) { db.fails[u] = {n: f.n + 1, t: Date.now()}; this.save(db); return fail('اسم المستخدم أو كلمة السر غير صحيحة'); }
      if (!rec.active) return fail('حسابك بانتظار موافقة المدير', 'pending');
      delete db.fails[u];
      const t = rid() + rid(); db.tokens[t] = {id: rec.id, exp: Date.now() + 12 * 3600e3}; this.save(db);
      return {token: t, user: this.pub(rec)};
    }
    const tk = db.tokens[b.token];
    const me = tk && tk.exp > Date.now() && (db.rec.users || []).find(x => x.id === tk.id && x.active);
    if (!me) return fail('انتهت الجلسة، سجل الدخول من جديد', 'auth');
    if (A === 'me') return {user: this.pub(me)};
    if (A === 'logout') { delete db.tokens[b.token]; this.save(db); return {ok: true}; }
    const e = b.entity;
    if (['list','save','delete'].includes(A) && !ENT.includes(e)) return fail('كيان غير معروف');
    if (A === 'list') {
      const readable = me.isAdmin || (e !== 'users' && (e === 'staff' ? has(me, 'staff') : (LOOKUP.includes(e) || has(me, e) || has(me, 'dashboard') || has(me, 'dues') || me.perms.some(p => p.startsWith('rep_')))));
      if (!readable) return fail('غير مصرح', 'forbidden');
      let items = (db.rec[e] || []).slice();
      if (b.from) items = items.filter(r => !r.date || r.date >= b.from);
      if (b.to) items = items.filter(r => !r.date || r.date <= b.to);
      return {items: items.map(r => e === 'users' ? this.pub(r) : r)};
    }
    if (A === 'save' || A === 'delete') {
      const ok = me.isAdmin || (e !== 'users' && (WRITE[e] || []).some(p => has(me, p)));
      if (!ok) return fail('غير مصرح', 'forbidden');
      const list = db.rec[e] || (db.rec[e] = []);
      if (A === 'delete') {
        const r = list.find(x => x.id === b.id); if (!r) return fail('غير موجود');
        if (e === 'users' && (r.id === me.id || (r.isAdmin && list.filter(x => x.isAdmin && x.active).length < 2))) return fail('لا يمكن حذف هذا المستخدم');
        db.rec[e] = list.filter(x => x.id !== b.id); this.save(db); return {ok: true};
      }
      const src = b.record || {}, out = {};
      for (const k of FIELDS[e].split(',')) {
        if (!(k in src)) continue; let v = src[k];
        if (k === 'perms') v = Array.isArray(v) ? v.map(String).slice(0, 60) : [];
        else if (k === 'isAdmin' || k === 'active') v = !!v;
        else if (NUMS.has(k)) v = Number(v) || 0;
        else { v = String(v == null ? '' : v).trim().slice(0, 500); if (DATES.has(k) && v && !validDate(v)) return fail('صيغة التاريخ يجب أن تكون yyyy/mm/dd'); }
        out[k] = v;
      }
      let rec = src.id && list.find(x => x.id === src.id);
      if (e === 'users') {
        const nm = String(out.username || '').trim();
        if (nm.length < 3) return fail('اسم المستخدم قصير');
        if (list.some(x => x.id !== src.id && x.username.toLowerCase() === nm.toLowerCase())) return fail('اسم المستخدم موجود بالفعل');
        if (!rec && String(src.password || '').length < 4) return fail('كلمة السر 4 أحرف على الأقل');
        if (rec && (rec.isAdmin && (!out.isAdmin || !out.active)) && list.filter(x => x.isAdmin && x.active).length < 2) return fail('يجب بقاء مدير واحد على الأقل');
        if (src.password) { out.salt = rid(); out.hash = await sha(out.salt + src.password); }
      } else {
        if (!String(out.name || out.date || out.category || out.type || '').trim()) return fail('بيانات ناقصة');
        if (e !== 'users' && AUTO[e] && !rec) out[AUTO[e]] = list.reduce((m, x) => Math.max(m, x[AUTO[e]] || 0), 0) + 1;
        if (rec && AUTO[e]) out[AUTO[e]] = rec[AUTO[e]];
      }
      if (rec) Object.assign(rec, out, {updatedAt: new Date().toISOString()});
      else { rec = Object.assign({id: rid(), createdAt: new Date().toISOString()}, out); if (e === 'visits' || e === 'expenses') rec.registeredBy = me.username; list.push(rec); }
      this.save(db);
      return {record: e === 'users' ? this.pub(rec) : rec};
    }
    if (A === 'upload') {
      if (!['image/jpeg','image/png','image/webp'].includes(b.mime)) return fail('يسمح بالصور فقط');
      if (String(b.data || '').length > 5.5e6) return fail('الصورة كبيرة جداً');
      const id = rid(); db.files[id] = 'data:' + b.mime + ';base64,' + b.data; this.save(db); return {file: id};
    }
    if (A === 'file') { const d = db.files[b.id]; return d ? {dataUrl: d} : fail('الملف غير موجود'); }
    return fail('أمر غير معروف');
  },
  pub(r){ const o = Object.assign({}, r); delete o.hash; delete o.salt; return o; },
  seed(db){
    const S = window.SEED, mk = (e, a) => { const list = db.rec[e] || (db.rec[e] = []); a.forEach(x => list.push(Object.assign({id: rid(), createdAt: new Date().toISOString()}, x, AUTO[e] ? {[AUTO[e]]: list.length + 1} : {}))); };
    mk('services', S.services); mk('doctors', S.doctors); mk('companies', S.companies); mk('staff', S.staff);
  }
};
})();
