import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';import {withBrowser} from './helpers/browser.mjs';import {enabledFormats} from '../web/core/formats.js';
for(const fallbackDialog of [false,true])await withBrowser(async({page,context,requests,errors})=>{
 assert.equal(await page.getByRole('button',{name:/^About \./}).count(),enabledFormats().length,'each format needs a clickable explanation');
 await page.getByText('Ready offline',{exact:true}).waitFor({timeout:45000});
 const before=requests.length;
 for(const f of enabledFormats()){
  const button=page.getByRole('button',{name:'About .'+f.extension,exact:true});await button.focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.textContent(),new RegExp(f.extension.toUpperCase()));
  await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(d=>d.contains(document.activeElement)));
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.ok(await button.evaluate(b=>b===document.activeElement));
 }
 assert.equal(requests.length,before,'format descriptions must make no additional requests');
 await page.getByLabel('Choose a file').setInputFiles('tests/fixtures/mixed.docx');
 await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);
 await page.locator('#optimize').click();await page.getByRole('link',{name:'Download DOCX',exact:true}).waitFor();
 const href=await page.getByRole('link',{name:'Download DOCX',exact:true}).getAttribute('href');
 await page.getByRole('button',{name:'About .png',exact:true}).focus();await page.keyboard.press('Space');
 await page.getByRole('dialog').waitFor();await page.keyboard.press('Shift+Tab');
 assert.ok(await page.getByRole('dialog').evaluate(d=>d.contains(document.activeElement)));
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('link',{name:'Download DOCX',exact:true}).getAttribute('href'),href,'help must retain download');
 await context.setOffline(true);await page.reload();await page.getByText('Ready offline',{exact:true}).waitFor();
 await page.getByRole('button',{name:'About .vsdx',exact:true}).click();assert.match(await page.getByRole('dialog').textContent(),/Microsoft Visio/);
 await mkdir('tests/output/formats',{recursive:true});await page.screenshot({path:'tests/output/formats/help-desktop.png',fullPage:true});
 await page.setViewportSize({width:320,height:740});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mkdir('tests/output/formats',{recursive:true});await page.screenshot({path:'tests/output/formats/help-'+(fallbackDialog?'fallback':'native')+'.png',fullPage:false});
 await page.getByRole('button',{name:'Close format description',exact:true}).click();
 assert.ok(requests.slice(before).every(r=>r.method==='GET'&&r.url.startsWith('http://127.0.0.1:')));assert.deepEqual(errors,[]);
},{fallbackDialog});
console.log('Format help: enabled extensions, keyboard, native/fallback modal, focus restoration, 320px and offline passed');
