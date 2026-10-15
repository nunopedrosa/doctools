import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {optimizeDocument} from '../web/core/document.js';
const root=resolve('web');
const mime={'.js':'text/javascript','.wasm':'application/wasm','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),p=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!p.startsWith(root+'/'))throw Error('path');const bytes=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(bytes);
}catch{res.writeHead(404);res.end('Not found');}});
await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
const baseURL='http://127.0.0.1:'+server.address().port;
let pw;try{pw=await import('playwright');}catch{pw=await import(pathToFileURL(process.env.DOCTOOLS_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);}
const executablePath=process.env.DOCTOOLS_CHROMIUM||join(homedir(),'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
let browser;
try{
 browser=await pw.chromium.launch({headless:true,executablePath});
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[],requests=[];
 page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await page.goto(baseURL);
 await page.getByLabel('Choose a DOCX file').setInputFiles('tests/fixtures/mixed.docx');
 await page.getByRole('button',{name:'Optimize without quality loss'}).waitFor({state:'visible',timeout:10000});
 await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);
 assert.equal(await page.locator('#progress').isVisible(),false,'inspection progress clears when ready');
 await page.getByRole('button',{name:'Optimize without quality loss'}).click();
 await page.getByRole('link',{name:'Download DOCX'}).waitFor({timeout:30000});
 const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'Download DOCX'}).click();const download=await downloaded;
 assert.match(download.suggestedFilename(),/-compressed\.docx$/);
 await mkdir('tests/output/browser',{recursive:true});await download.saveAs('tests/output/browser/download.docx');
 const output=new Uint8Array(await readFile('tests/output/browser/download.docx'));
 assert.ok(output.length<(await stat('tests/fixtures/mixed.docx')).size);
 // Full document engine validates browser-produced download; a second pass must be a no-op.
 assert.equal((await optimizeDocument(output)).changed,false);
 await page.screenshot({path:'tests/output/browser/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Clear document'}).click();assert.equal(await page.getByRole('link',{name:'Download DOCX'}).count(),0);
 await page.getByLabel('Choose a DOCX file').setInputFiles('tests/fixtures/signed.docx');
 await page.getByRole('alert').filter({hasText:/sign/i}).waitFor();
 await page.getByLabel('Choose a DOCX file').setInputFiles({name:'<img src=x>.DOCX',mimeType:'application/octet-stream',buffer:await readFile('tests/fixtures/empty.docx')});
 await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);
 assert.equal(await page.locator('#filename').textContent(),'<img src=x>.DOCX');assert.equal(await page.locator('#filename img').count(),0);
 await page.getByRole('button',{name:'Optimize without quality loss'}).click();await page.getByText('No reduction needed',{exact:true}).waitFor();
 // Hold only the first worker's startup response so cancellation is deterministic.
 let releaseWorker;const gate=new Promise(r=>{releaseWorker=r;});
 await page.route('**/worker.js',async route=>{const response=await route.fetch();await gate;await route.fulfill({response});},{times:1});
 await page.getByLabel('Choose a DOCX file').setInputFiles('tests/fixtures/mixed.docx');
 await page.getByRole('button',{name:'Cancel processing'}).click();releaseWorker();
 await page.getByLabel('Choose a DOCX file').setInputFiles('tests/fixtures/empty.docx');await page.waitForFunction(()=>!document.querySelector('#optimize').disabled);
 assert.equal(await page.locator('#filename').textContent(),'empty.docx');
 await page.setViewportSize({width:320,height:740});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'tests/output/browser/mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Clear document'}).click();await page.keyboard.press('Tab');
 assert.equal(errors.length,0,errors.join('\n'));assert.ok(requests.every(r=>r.method==='GET'&&r.url.startsWith(baseURL)),JSON.stringify(requests));
 console.log('Browser: optimize/download, integrity, signatures, uppercase extension, escaped filenames, no-op, cancellation/reselection, 320px layout, no uploads passed');
 await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
