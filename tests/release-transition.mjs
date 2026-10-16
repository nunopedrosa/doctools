// Regression derived from the independent review's first-install deployment reproduction.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import {homedir} from 'node:os';
import {chromium} from 'playwright';
const root=resolve('web');let releaseReads=0;
const mime={'.js':'text/javascript','.wasm':'application/wasm','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{
 const name=new URL(req.url,'http://localhost').pathname;const path=resolve(root,'.'+(name==='/'?'/index.html':name));if(!path.startsWith(root+'/'))throw Error('Invalid path');
 let bytes=await readFile(path);
 if(name==='/release.js'&&++releaseReads>1)bytes=Buffer.from(bytes.toString().replace(/export const VERSION="[^"-]+-/, 'export const VERSION="2026.10.15.2-'));
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
const bundled=join(homedir(),'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
let browser,state;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.DOCTOOLS_CHROMIUM||(existsSync(bundled)?bundled:undefined)});
 const context=await browser.newContext(),page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){
  try{state=await page.evaluate(async()=>{
   if(!navigator.serviceWorker.controller)return null;
   const {VERSION}=await import('./release.js'),channel=new MessageChannel();
   const response=new Promise(resolve=>{channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data);};});
   navigator.serviceWorker.controller.postMessage({type:'CHECK'},[channel.port2]);
   return {page:VERSION,worker:await response,status:document.querySelector('#offline-status').textContent};
  });}catch{state=null;}
  if(state?.page.startsWith('2026.10.15.2-')&&state.page===state.worker.version&&state.worker.ready&&state.status==='Ready offline')break;
  await new Promise(r=>setTimeout(r,50));
 }
 assert.ok(state?.page.startsWith('2026.10.15.2-'),JSON.stringify(state));assert.equal(state.page,state.worker.version);assert.equal(state.status,'Ready offline');
 console.log('First-install release transition: page and controlling worker reconciled to the same complete release');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
