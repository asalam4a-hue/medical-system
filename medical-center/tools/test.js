const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1280,height:900}, locale:'ar-EG'});
  const p = await ctx.newPage(); const errs=[];
  p.on('pageerror', e => errs.push('PAGEERR '+e.message)); p.on('console', m => { if (m.type()==='error') errs.push('CONSOLE '+m.text()); });
  await p.goto((process.env.URL||'http://localhost:8765/index.html')); await p.waitForSelector('.login');
  await p.screenshot({path:'/tmp/s1_login.png'});
  await p.fill('#rf [name=username]','admin'); await p.fill('#rf [name=password]','1234'); await p.fill('#rf [name=nationalId]','29001011234567'); await p.type('#rf [name=birthDate]','19900101');
  await p.click('#rf button[type=submit]'); await p.waitForSelector('.kpis',{timeout:8000});
  console.log('clinic cards', await p.locator('.tile.clinic').count(), 'tiles', await p.locator('.tile:not(.clinic)').count());
  await p.screenshot({path:'/tmp/s2_home.png', fullPage:true});
  // visits
  await p.click('[data-s=visits]'); await p.waitForSelector('#frm');
  await p.fill('[name=patient]','محمد علي'); await p.fill('[name=phone]','01012345678');
  await p.selectOption('[name=clinic]','عظام');
  console.log('value after clinic', await p.inputValue('[name=value]'), 'tax', await p.inputValue('[name=tax]'));
  const opts = await p.$$eval('[name=_doc] option', o=>o.map(x=>x.textContent)); console.log('doctors', opts.join('|'));
  await p.selectOption('[name=_doc]', {label:'احمد عبدالحميد'});
  await p.click('#frm button[type=submit]'); await p.waitForTimeout(500);
  console.log('rows after save1', await p.locator('#lst tbody tr').count());
  // company visit
  await p.fill('[name=patient]','سعيد حسن'); await p.selectOption('[name=clinic]','باطنه وطوارئ'); await p.selectOption('[name=_doc]',{index:1});
  await p.click('[data-seg=category] button[data-v=company]'); await p.waitForTimeout(100);
  console.log('co block visible', await p.locator('[data-grp=co]').isVisible());
  await p.fill('[name=company]','AXA'); await p.dispatchEvent('[name=company]','change');
  console.log('value after company', await p.inputValue('[name=value]'));
  await p.fill('[name=patientPct]','20'); await p.waitForTimeout(100);
  console.log('required from patient', await p.inputValue('[name=_req]'));
  await p.fill('[name=formNo]','F-77'); await p.fill('[name=cardNo]','C-88');
  await p.screenshot({path:'/tmp/s3_visit.png', fullPage:true});
  await p.click('#frm button[type=submit]'); await p.waitForTimeout(500);
  console.log('rows after save2', await p.locator('#lst tbody tr').count());
  // second visit same patient to test last visit
  await p.fill('[name=patient]','محمد علي'); await p.dispatchEvent('[name=patient]','change');
  console.log('autofill phone', await p.inputValue('[name=phone]'));
  // reports
  await p.click('.brand'); await p.waitForSelector('.kpis'); await p.click('[data-s=reports]'); await p.waitForSelector('.cards');
  await p.click('[data-s=rep_doctors]'); await p.waitForSelector('table');
  const rows = await p.$$eval('#rb tbody tr', r=>r.map(x=>x.innerText.replace(/\s+/g,' ')));
  console.log('DOCTOR ACCOUNTS:\n'+rows.join('\n'));
  await p.screenshot({path:'/tmp/s4_docs.png', fullPage:true});
  await p.click('#rb .lnk[data-t=doctor]'); await p.waitForSelector('.sect'); await p.screenshot({path:'/tmp/s5_docstmt.png', fullPage:true});
  await p.click('.brand'); await p.click('[data-s=reports]'); await p.click('[data-s=rep_companies]'); await p.waitForSelector('table'); await p.screenshot({path:'/tmp/s6_comp.png', fullPage:true});
  await p.click('.brand'); await p.click('[data-s=reports]'); await p.click('[data-s=rep_daily]'); await p.waitForSelector('.charts'); await p.screenshot({path:'/tmp/s7_daily.png', fullPage:true});
  // users screen
  await p.click('.brand'); await p.click('[data-s=users]'); await p.waitForSelector('.perm-grid'); await p.screenshot({path:'/tmp/s8_users.png', fullPage:true});
  console.log('ERRORS', errs.length? errs.join('\n'):'none');
  await b.close();
})();
