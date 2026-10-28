const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.waitForSelector('.login');
await p.fill('#rf [name=username]','admin');await p.fill('#rf [name=password]','1234');await p.click('#rf button[type=submit]');await p.waitForSelector('.kpis');
await p.click('[data-s=visits]');await p.waitForSelector('#frm');
async function add(pt,clinic,doc,cat,extra){await p.fill('[name=patient]',pt);await p.selectOption('[name=clinic]',clinic);await p.selectOption('[name=_doc]',{label:doc});await p.click(`[data-seg=category] button[data-v=${cat}]`);if(extra)await extra();await p.click('#frm button[type=submit]');await p.waitForTimeout(400)}
await add('نقدي1','عظام','احمد عبدالحميد','cash');           // 100 cash
await add('شركة1','عظام','احمد عبدالحميد','company',async()=>{await p.fill('[name=company]','AXA');await p.dispatchEvent('[name=company]','change')}); // 100 company
await add('تأمين1','عظام','احمد عبدالحميد','insurance',async()=>{await p.fill('[name=discount]','10')});     // 100 insurance
await add('لجنة1','عظام','احمد عبدالحميد','committee');      // 100 committee
await p.click('.brand');await p.waitForSelector('.kpis');
console.log('HOME KPIs:',(await p.$$eval('.kpi',k=>k.map(x=>x.innerText.replace(/\s+/g,' ')))).join(' | '));
await p.click('.kpi >> nth=1');await p.waitForSelector('.modal');console.log('MODAL:',(await p.$eval('.modal',m=>m.innerText.replace(/\s+/g,' ').slice(0,330))));await p.click('.modal [data-act=closemodal]');
await p.click('[data-s=reports]');await p.click('[data-s=rep_doctors]');await p.waitForSelector('table');
console.log('DOCTOR ROW:',(await p.$$eval('#rb tbody tr',r=>r.map(x=>x.innerText.replace(/\s+/g,' ')))).join('|'));
console.log('errors',errs.length?errs:'none');await b.close()})();
