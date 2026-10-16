import assert from 'node:assert/strict';import {readFile,mkdir} from 'node:fs/promises';import {withBrowser} from './helpers/browser.mjs';import {enabledFormats} from '../web/core/formats.js';import {optimizeFile} from '../web/core/files.js';
const fixtureMap={png:'textured.png',jpg:'photo.jpg',jpeg:'photo.jpg'};
await withBrowser(async({page,context,requests,errors,baseURL})=>{
 assert.equal(await page.getByLabel('Choose a file',{exact:true}).count(),1,'picker must describe all file families');
 await page.getByText('Ready offline',{exact:true}).waitFor({timeout:45000});await context.setOffline(true);await page.reload();await page.getByText('Ready offline',{exact:true}).waitFor();
 await mkdir('tests/output/formats',{recursive:true});
 for(const f of enabledFormats()){
  const path='tests/fixtures/'+(fixtureMap[f.extension]||'multiformat/mixed.'+f.extension),buffer=await readFile(path),name='Example.'+f.extension.toUpperCase();
  await page.getByLabel('Choose a file',{exact:true}).setInputFiles({name,mimeType:f.mime,buffer});await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);
  await page.getByLabel('Compression mode').selectOption('lossless');await page.locator('#optimize').click();
  const expected=await optimizeFile(new Uint8Array(buffer),name);
  if(expected.downloadAvailable){
   const link=page.getByRole('link',{name:'Download '+f.outputLabel,exact:true});await link.waitFor();const event=page.waitForEvent('download');await link.click();const download=await event;assert.equal(download.suggestedFilename(),'Example-compressed.'+f.outputExtension);await download.saveAs('tests/output/formats/'+f.extension+'-result.'+f.outputExtension);
   const pair=page.getByRole('button',{name:/^Preview /}).first();if(await pair.count()){await pair.click();await page.waitForFunction(()=>document.querySelector('#preview-after').naturalWidth>0);await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  }else{await page.getByText('No reduction needed',{exact:true}).waitFor();assert.equal(await page.locator('#download-slot a').count(),0);}
  await page.getByRole('button',{name:'About .'+f.extension,exact:true}).click();await page.getByRole('button',{name:'Close format description',exact:true}).click();await page.getByRole('button',{name:'Clear file',exact:true}).click();
 }
 await page.getByLabel('Choose a file',{exact:true}).setInputFiles('tests/fixtures/empty.docx');await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);assert.match(await page.locator('#summary').textContent(),/0 embedded images/);
 await page.screenshot({path:'tests/output/formats/desktop.png',fullPage:true});
 assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(baseURL+'/')||r.url.startsWith('blob:'+baseURL+'/'))));assert.deepEqual(errors,[]);
 const cached=await page.evaluate(async()=>{const urls=[];for(const k of await caches.keys())for(const r of await (await caches.open(k)).keys())urls.push(r.url);return urls;});assert.ok(cached.every(u=>!u.includes('Example')&&!u.includes('/fixtures/')));
});
console.log('Formats browser: every enabled extension, offline processing, preview, downloads, help, no-op and no uploads passed');
