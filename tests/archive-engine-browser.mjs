import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {withBrowser} from './helpers/browser.mjs';
await withBrowser(async({page,requests,baseURL,errors})=>{
 for(const [name,container] of [['rar4.cbr','rar'],['rar5.cbr','rar'],['pages.tar','tar'],['pages.7z','7z'],['unicode.7z','7z']]){
  const bytes=Array.from(await readFile('tests/fixtures/multiformat/'+name));
  const result=await page.evaluate(async({bytes,container})=>{
   const code=`import {openNativeArchive} from '${location.origin}/core/archive-native.js';self.onmessage=async({data})=>{let a,b;try{a=await openNativeArchive(new Uint8Array(data.bytes),data.container);let out=null;if(data.container!=='rar'){out=await a.rewrite(new Map(),data.container);b=await openNativeArchive(out,data.container);}const first=await a.read(a.entries[0].name);self.postMessage({names:a.entries.map(e=>e.name),after:b?.entries.map(e=>e.name),size:first.length});}catch(e){self.postMessage({error:e.message});}finally{await a?.close();await b?.close();}}`;
   const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),w=new Worker(url,{type:'module'});
   try{return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native worker timeout')),20000);w.onmessage=e=>{clearTimeout(timer);resolve(e.data);};w.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};w.postMessage({bytes,container});});}finally{w.terminate();URL.revokeObjectURL(url);}
  },{bytes,container});
  assert.equal(result.error,undefined,result.error);assert.ok(result.names.length>0);assert.ok(result.size>0);if(container!=='rar')assert.deepEqual(result.after,result.names);
 }
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&(r.url.startsWith(baseURL+'/')||r.url.startsWith('blob:'+baseURL+'/'))));
});
console.log('Native archive worker: RAR4/RAR5/TAR/7z, writer round trips, Unicode names and no uploads passed');
