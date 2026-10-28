const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const props={},cache={};
function mkSheet(){const rows=[];const sh={rows,
 appendRow(r){rows.push(r.slice())},getLastRow(){return rows.length},setFrozenRows(){},
 getRange(r,c,nr=1,nc=1){return{setNumberFormat(){},getValues(){return rows.slice(r-1,r-1+nr).map(x=>{const o=[];for(let i=0;i<nc;i++)o.push(x[c-1+i]===undefined?'':x[c-1+i]);return o})},setValues(v){v.forEach((row,i)=>row.forEach((x,j)=>{rows[r-1+i][c-1+j]=x}))}}},
 deleteRow(n){rows.splice(n-1,1)}};return sh}
const sheets={};const ss={getId:()=>'SS',getSheetByName:n=>sheets[n]||null,insertSheet:n=>sheets[n]=mkSheet()};
const files={};
const ctx={console,JSON,Math,Date,String,Number,Array,isNaN,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k in props?props[k]:null,setProperty:(k,v)=>props[k]=v})},
 CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>cache[k]=v,remove:k=>delete cache[k]})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 SpreadsheetApp:{create:()=>ss,openById:()=>ss},
 Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(a,s)=>[...crypto.createHash('sha256').update(s).digest()].map(b=>b>127?b-256:b),getUuid:()=>crypto.randomUUID(),base64Decode:s=>[...Buffer.from(s,'base64')].map(b=>b>127?b-256:b),base64Encode:b=>Buffer.from(b.map(x=>x&255)).toString('base64'),newBlob:(bytes,mime,name)=>({bytes,getBytes:()=>bytes})},
 DriveApp:{Access:{PRIVATE:1},Permission:{NONE:1},createFolder:()=>({getId:()=>'F',createFile:blob=>{const id='D'+Object.keys(files).length;files[id]=blob;return{getId:()=>id,setSharing(){}}}}),getFolderById:()=>({createFile:blob=>{const id='D'+Object.keys(files).length;files[id]=blob;return{getId:()=>id,setSharing(){}}}}),getFileById:id=>({getBlob:()=>files[id]})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('gas/Seed.gs','utf8')+fs.readFileSync('gas/Code.gs','utf8'),ctx);
const call=o=>JSON.parse(ctx.handle(JSON.stringify(o)));
const assert=(c,m)=>{if(!c){console.log('FAIL',m);process.exitCode=1}else console.log('ok',m)};
assert(call({action:'status'}).hasUsers===false,'status empty');
assert(call({action:'register',username:'admin',password:'1234'}).pending===false,'first user admin');
assert(call({action:'register',username:'nurse',password:'abcd'}).pending===true,'second pending');
assert(call({action:'login',username:'nurse',password:'abcd'}).code==='pending','pending cannot login');
assert(call({action:'login',username:'admin',password:'x'}).error,'bad pw');
const L=call({action:'login',username:'admin',password:'1234'});const T=L.token;assert(T&&L.user.isAdmin,'login');
const docs=call({action:'list',entity:'doctors',token:T}).items;assert(docs.length===34&&docs[0].code===1,'seed doctors '+docs.length);
const v=call({action:'save',entity:'visits',token:T,record:{date:'2026/10/27',patient:'x',value:'100',isAdmin:true}}).record;assert(v.serial===1&&v.value===100&&v.registeredBy==='admin'&&!v.isAdmin,'save visit');
const v2=call({action:'save',entity:'visits',token:T,record:{date:'2026/10/28',patient:'y',value:5}}).record;assert(v2.serial===2,'serial 2');
assert(call({action:'save',entity:'visits',token:T,record:{id:v.id,date:'2026/10/27',patient:'x2',value:7}}).record.serial===1,'edit keeps serial');
assert(call({action:'list',entity:'visits',token:T,from:'2026/10/28',to:'2026/10/28'}).items.length===1,'range');
assert(call({action:'save',entity:'visits',token:T,record:{date:'2026/13/01',patient:'z'}}).error,'bad date rejected');
const nurse=call({action:'list',entity:'users',token:T}).items.find(u=>u.username==='nurse');
assert(!('hash' in nurse),'no hash leaked');
call({action:'save',entity:'users',token:T,record:{id:nurse.id,username:'nurse',active:true,perms:['patients'],isAdmin:false}});
const NT=call({action:'login',username:'nurse',password:'abcd'}).token;assert(NT,'nurse login after approval (password kept)');
assert(call({action:'list',entity:'users',token:NT}).code==='forbidden','nurse cannot list users');
assert(call({action:'list',entity:'visits',token:NT}).code==='forbidden','nurse cannot list visits');
assert(call({action:'save',entity:'doctors',token:NT,record:{name:'q'}}).code==='forbidden','nurse cannot write doctors');
assert(call({action:'save',entity:'patients',token:NT,record:{name:'p1',phone:'1'}}).record,'nurse writes patients');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64').toString('base64');
const up=call({action:'upload',token:T,mime:'image/png',data:png});assert(up.file,'upload');
assert(call({action:'file',token:T,id:up.file}).dataUrl.startsWith('data:image/png;base64,'),'file fetch');
assert(call({action:'upload',token:T,mime:'image/png',data:Buffer.from('hello world!!').toString('base64')}).error,'non-image rejected');
assert(call({action:'delete',entity:'users',token:T,id:call({action:'me',token:T}).user.id}).error,'cannot delete self');
assert(call({action:'delete',entity:'visits',token:T,id:v2.id}).ok,'delete visit');
assert(call({action:'list',entity:'visits',token:'bad'}).code==='auth','bad token');
