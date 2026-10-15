import {VERSION,ASSETS,HASHES} from './release.js';
const PREFIX='doctools-assets-',CACHE=PREFIX+VERSION,base=new URL('./',self.location.href);
const urlFor=path=>new URL(path,base).href;
const expectedRelease=`export const VERSION=${JSON.stringify(VERSION)};\nexport const ASSETS=${JSON.stringify(ASSETS)};\nexport const HASHES=${JSON.stringify(HASHES)};\n`;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{
  const cache=await caches.open(CACHE);
  for(const path of ASSETS){
   const response=await fetch(urlFor(path),{cache:'reload'});if(!response.ok)throw Error('Offline asset unavailable');
   const bytes=await response.clone().arrayBuffer();
   if(path==='release.js'){if(new TextDecoder().decode(bytes)!==expectedRelease)throw Error('Release manifest changed during installation');}
   else{const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==HASHES[path])throw Error('Release asset mismatch');}
   await cache.put(urlFor(path),response);
  }
 }catch(e){await caches.delete(CACHE);throw e;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Retain old caches while any existing client may still use them; update lock causes those windows to reload.
 await self.clients.claim();
})()));
async function ready(){const cache=await caches.open(CACHE);return (await Promise.all(ASSETS.map(p=>cache.match(urlFor(p))))).every(Boolean);}
let activating=false;
function ask(client,type){return new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve({idle:false});},3000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};client.postMessage({type},[channel.port2]);});}
const appClients=async()=> (await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.url.startsWith(base.href));
self.addEventListener('message',event=>{
 if(event.data?.type==='CHECK')event.waitUntil((async()=>{event.ports[0]?.postMessage({ready:await ready(),version:VERSION});})());
 if(event.data?.type==='REPAIR')event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{for(const path of ASSETS){if(await cache.match(urlFor(path)))continue;
   const response=await fetch(urlFor(path),{cache:'reload'});if(!response.ok)throw Error('Missing asset');
   const bytes=await response.clone().arrayBuffer();
   if(path==='release.js'){if(new TextDecoder().decode(bytes)!==expectedRelease)throw Error('Release changed');}
   else{const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==HASHES[path])throw Error('Release changed');}
   await cache.put(urlFor(path),response);
  }}catch{}event.ports[0]?.postMessage({ready:await ready(),version:VERSION});
 })());
 if(event.data?.type==='CHECK')event.waitUntil((async()=>{
  const clients=await appClients(),states=await Promise.all(clients.map(c=>ask(c,'STATE')));
  if(states.every(s=>s.version===VERSION))for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE&&!self.registration.waiting&&!self.registration.installing)await caches.delete(key);
 })());
 if(event.data?.type==='ACTIVATE')event.waitUntil((async()=>{
  if(activating){event.ports[0]?.postMessage({accepted:false});return;}activating=true;
  const clients=await appClients(),states=await Promise.all(clients.map(c=>ask(c,'LOCK'))),latest=await appClients();
  const accepted=states.every(s=>s.idle)&&latest.length===clients.length&&latest.every(c=>clients.some(p=>p.id===c.id));
  event.ports[0]?.postMessage({accepted});
  if(accepted)await self.skipWaiting();else{for(const client of clients)client.postMessage({type:'UNLOCK'});activating=false;}
 })());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
 const path=url.pathname.slice(base.pathname.length);
 if(event.request.mode==='navigate')event.respondWith(caches.open(CACHE).then(c=>c.match(urlFor('index.html'))).then(r=>r||new Response('Offline files unavailable. Reconnect and reload.',{status:503})));
 else if(ASSETS.includes(path))event.respondWith(caches.open(CACHE).then(c=>c.match(urlFor(path))).then(r=>r||new Response('Offline asset missing. Reconnect and reload.',{status:503})));
});
