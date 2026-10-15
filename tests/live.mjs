// Explicit hosted smoke test: only synthetic local fixtures, no uploads.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {ASSETS,HASHES,VERSION} from '../web/release.js';
import {optimizeFile} from '../web/core/files.js';
const base=new URL(process.argv[2]||'https://smaller.basecentral.link/');
assert.equal(base.protocol,'https:','Live checks require trusted HTTPS');
for(const path of ASSETS){
 const response=await fetch(new URL(path,base));assert.equal(response.status,200,path);
 const bytes=new Uint8Array(await response.arrayBuffer());
 const expected=path==='release.js'?createHash('sha256').update(await readFile('web/release.js')).digest('hex'):HASHES[path];
 assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,path+' must match local release');
 if(path.endsWith('.wasm'))assert.match(response.headers.get('content-type'),/application\/wasm/);
 if(path.endsWith('.js'))assert.match(response.headers.get('content-type'),/(java|ecma)script/);
 assert.match(response.headers.get('cache-control')||'',/no-cache/,path+' must revalidate');
}
for(const path of ['.git/config','README.md','tests/fixtures/photo.jpg','scripts/codec/jpeg.c','.htaccess']){
 const response=await fetch(new URL(path,base));assert.ok([403,404].includes(response.status),path+' must be inaccessible');
}
const bundled=join(homedir(),'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.DOCTOOLS_CHROMIUM||(existsSync(bundled)?bundled:undefined)});
 const context=await browser.newContext({acceptDownloads:true}),requests=[],errors=[];
 context.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base.href);await page.getByText('Ready offline',{exact:true}).waitFor({timeout:45000});
 await mkdir('tests/output/live',{recursive:true});
 await page.screenshot({path:'tests/output/live/home.png',fullPage:true});
 await context.setOffline(true);await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base.href);await page.getByText('Ready offline',{exact:true}).waitFor();
 for(const [name,label] of [['photo.jpg','JPEG'],['textured.png','PNG'],['mixed.docx','DOCX']]){
  await page.getByLabel('Choose a DOCX or image').setInputFiles('tests/fixtures/'+name);
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
 const cached=await page.evaluate(async()=>{const result=[];for(const key of await caches.keys())for(const request of await (await caches.open(key)).keys())result.push(request.url);return result;});
 const allowed=new Set(ASSETS.map(p=>new URL(p,base).href));assert.ok(cached.every(url=>allowed.has(url)),'Only runtime assets are cached');
 assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(base.href)||r.url.startsWith('blob:'+base.origin+'/'))),'No uploads or external app requests');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({url:base.href,version:VERSION,assets:ASSETS.length,browser:browser.version(),offline:['JPEG','PNG','DOCX'],previews:true,uploads:0}));
}finally{await browser?.close();}
