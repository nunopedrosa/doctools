// Explicit hosted smoke test: only synthetic local fixtures, no uploads.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {ASSETS,HASHES,VERSION} from '../web/release.js';
import {enabledFormats} from '../web/core/formats.js';
import {optimizeFile} from '../web/core/files.js';
const base=new URL(process.argv[2]||'https://smaller.basecentral.link/');
assert.equal(base.protocol,'https:','Live checks require trusted HTTPS');
for(let start=0;start<ASSETS.length;start+=8)await Promise.all(ASSETS.slice(start,start+8).map(async path=>{
 const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,path);
 const bytes=new Uint8Array(await response.arrayBuffer());
 const expected=path==='release.js'?createHash('sha256').update(await readFile('web/release.js')).digest('hex'):HASHES[path];
 assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,path+' must match local release');
 if(path.endsWith('.wasm'))assert.match(response.headers.get('content-type'),/application\/wasm/);
 if(path.endsWith('.js'))assert.match(response.headers.get('content-type'),/(java|ecma)script/);
 assert.match(response.headers.get('cache-control')||'',/no-cache/,path+' must revalidate');
}));
console.log('Verified '+ASSETS.length+' live asset hashes, MIME types and revalidation headers.');
for(const path of ['.git/config','README.md','tests/fixtures/photo.jpg','scripts/codec/jpeg.c','.htaccess']){
 const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(30000)});assert.ok([403,404].includes(response.status),path+' must be inaccessible');
}
const bundled=join(homedir(),'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.DOCTOOLS_CHROMIUM||(existsSync(bundled)?bundled:undefined)});
 const context=await browser.newContext({acceptDownloads:true}),requests=[],errors=[];
 context.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const installStart=Date.now();await page.goto(base.href);await page.getByText('Ready offline',{exact:true}).waitFor({timeout:180000});console.log('Fresh browser Ready offline after '+Math.round((Date.now()-installStart)/1000)+' seconds.');
 await mkdir('tests/output/live',{recursive:true});
 await page.screenshot({path:'tests/output/live/home.png',fullPage:true});
 await context.setOffline(true);await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base.href);await page.getByText('Ready offline',{exact:true}).waitFor();
 for(const [name,label] of [['photo.jpg','JPEG'],['textured.png','PNG'],['mixed.docx','DOCX']]){
  await page.getByLabel('Choose a file').setInputFiles('tests/fixtures/'+name);
  await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);
  await page.getByLabel('Compression mode').selectOption('colors');await page.locator('#optimize').click();
  await page.getByRole('link',{name:'Download '+label,exact:true}).waitFor({timeout:30000});
  const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'Download '+label,exact:true}).click();
  const download=await downloaded;assert.match(download.suggestedFilename(),/-compressed\.(docx|png|jpg)$/);
  const target='tests/output/live/'+name;await download.saveAs(target);
  const source=new Uint8Array(await readFile('tests/fixtures/'+name)),output=new Uint8Array(await readFile(target));assert.ok(output.length<source.length);
  if(label!=='DOCX'){
   const expected=await optimizeFile(source,name,()=>{},{mode:'colors',colors:128,jpegQuality:70});assert.deepEqual(output,expected.bytes);
   await page.getByRole('button',{name:'Preview '+name,exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#preview-after').naturalWidth>0);
  }
  await page.screenshot({path:'tests/output/live/'+label.toLowerCase()+'.png',fullPage:true});
  await page.getByRole('button',{name:'Clear file'}).click();
 }
 const fixtureMap={png:'textured.png',jpg:'photo.jpg',jpeg:'photo.jpg',ora:'multiformat/layers.ora',pdf:'multiformat/pdf/features.pdf',...Object.fromEntries(['cbz','cbr','cb7','cbt','zip','tar','7z'].map(e=>[e,'multiformat/pages.'+e]))};
 for(const f of enabledFormats()){
  const path='tests/fixtures/'+(fixtureMap[f.extension]||'multiformat/mixed.'+f.extension),source=new Uint8Array(await readFile(path));
  await page.getByLabel('Choose a file',{exact:true}).setInputFiles({name:'example.'+f.extension,mimeType:f.mime,buffer:Buffer.from(source)});await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);await page.getByLabel('Compression mode').selectOption('lossless');await page.locator('#optimize').click();
  const expected=await optimizeFile(source,'example.'+f.extension);
  if(expected.downloadAvailable){await page.getByRole('link',{name:'Download '+f.outputLabel,exact:true}).waitFor({timeout:30000});}else await page.getByText('No reduction needed',{exact:true}).waitFor();
  await page.getByRole('button',{name:'About .'+f.extension,exact:true}).click();await page.getByRole('button',{name:'Close format description',exact:true}).click();
  if(f.extension==='pdf'){await page.getByRole('button',{name:'Preview PDF pages',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#pdf-preview-message').textContent.includes('Page 1 of'));assert.equal(await page.evaluate(()=>globalThis.PDF_SCRIPT_EXECUTED),undefined);await page.screenshot({path:'tests/output/live/pdf-pages.png',fullPage:true});await page.getByRole('button',{name:'Close PDF preview',exact:true}).click();}
  await page.getByRole('button',{name:'Clear file',exact:true}).click();
 }
 const cached=await page.evaluate(async()=>{const result=[];for(const key of await caches.keys())for(const request of await (await caches.open(key)).keys())result.push(request.url);return result;});
 const allowed=new Set(ASSETS.map(p=>new URL(p,base).href));assert.ok(cached.every(url=>allowed.has(url)),'Only runtime assets are cached');
 assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(base.href)||r.url.startsWith('blob:'+base.origin+'/'))),'No uploads or external app requests');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({url:base.href,version:VERSION,assets:ASSETS.length,browser:browser.version(),offline:enabledFormats().map(f=>f.extension),formats:enabledFormats().length,previews:true,uploads:0}));
}finally{await browser?.close();}
