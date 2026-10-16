import assert from 'node:assert/strict';import {withBrowser} from './helpers/browser.mjs';
await withBrowser(async({page,context,requests,errors,baseURL})=>{
 await page.getByText('Ready offline',{exact:true}).waitFor({timeout:60000});await context.setOffline(true);await page.reload();await page.getByText('Ready offline',{exact:true}).waitFor();
 await page.getByLabel('Choose a file',{exact:true}).setInputFiles('tests/fixtures/multiformat/pdf/features.pdf');await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);await page.getByLabel('Compression mode').selectOption('colors');await page.locator('#optimize').click();await page.getByRole('link',{name:'Download PDF',exact:true}).waitFor();
 await page.getByRole('button',{name:'Preview PDF pages',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pdf-preview-message').textContent.includes('Page 1 of'));
 assert.ok(await page.locator('#pdf-before').evaluate(c=>c.width*c.height<=2000000));assert.equal(await page.evaluate(()=>globalThis.PDF_SCRIPT_EXECUTED),undefined);
 await page.screenshot({path:'tests/output/formats/pdf-desktop.png',fullPage:true});await page.getByRole('button',{name:'Close PDF preview',exact:true}).click();assert.equal(await page.locator('#pdf-preview').isVisible(),false);
 await page.getByRole('button',{name:'Preview PDF pages',exact:true}).click();await page.getByRole('button',{name:'Clear file',exact:true}).click();assert.equal(await page.locator('#pdf-preview').isVisible(),false);
 assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(baseURL+'/')||r.url.startsWith('blob:'+baseURL+'/'))));assert.deepEqual(errors,[]);
});console.log('PDF browser: offline optimization, safe page preview, bounded canvases and cleanup passed');
