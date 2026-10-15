import {VERSION} from './release.js';
export function setupOffline({isBusy,setLocked,status,updateButton}){
 let registration,locked=false,reloading=false,updateNotice=false,mismatched=false;
 const message=(target,type)=>new Promise((resolve,reject)=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('Offline check timed out'));},8000);
  channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};target.postMessage({type},[channel.port2]);
 });
 function reloadWhenIdle(){if(mismatched&&!isBusy()&&!reloading){reloading=true;location.reload();}}
 document.addEventListener('doctools-busy',reloadWhenIdle);
 async function check(){
  if(updateNotice)return;
  const controller=navigator.serviceWorker.controller;if(!controller)return;
  try{let r=await message(controller,'CHECK');if(!r.ready&&navigator.onLine)r=await message(controller,'REPAIR');if(updateNotice)return;if(r.version!==VERSION){mismatched=true;locked=true;setLocked(true);status.textContent='App updated. Finishing the current operation before reloading…';reloadWhenIdle();return;}status.textContent=r.ready&&r.version===VERSION?'Ready offline':'Offline files incomplete. Reconnect and reload to prepare again.';}catch{if(updateNotice)return;status.textContent='Could not verify offline files. Reconnect and reload.';}
 }
 if(!('serviceWorker'in navigator)||!window.isSecureContext){status.textContent='Offline installation needs HTTPS or localhost.';return;}
 navigator.serviceWorker.addEventListener('message',e=>{
  if(e.data?.type==='STATE'){e.ports[0]?.postMessage({version:VERSION});}
  else if(e.data?.type==='LOCK'){
   const idle=!isBusy();if(idle){locked=true;setLocked(true);}e.ports[0]?.postMessage({idle,version:VERSION});
  }else if(e.data?.type==='UNLOCK'){locked=false;setLocked(false);}
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(locked&&!isBusy()&&!reloading){reloading=true;location.reload();}else check();
 });
 window.addEventListener('focus',check);window.addEventListener('online',check);window.addEventListener('pageshow',check);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
 const waiting=async()=>{const current=await navigator.serviceWorker.getRegistration();registration=current;updateButton.hidden=!current?.waiting;updateButton.disabled=isBusy();};
 document.addEventListener('doctools-busy',waiting);
 updateButton.addEventListener('click',async()=>{
  registration=await navigator.serviceWorker.getRegistration();
  const target=registration?.waiting;if(isBusy()||!target){waiting();return;}
  updateNotice=true;updateButton.disabled=true;status.textContent='Checking open windows before updating…';
  try{const r=await message(target,'ACTIVATE');if(!r.accepted){status.textContent='Finish or cancel processing in all open Doctools windows before updating.';waiting();}}catch{status.textContent='Update could not start. Close other Doctools windows and try again.';if(locked){locked=false;setLocked(false);}waiting();}
 });
 status.textContent='Preparing offline files…';
 navigator.serviceWorker.register('./sw.js',{type:'module',scope:'./',updateViaCache:'none'}).then(reg=>{
  registration=reg;waiting();
  const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='redundant')status.textContent='Offline preparation failed. Reconnect and reload to try again.';if(worker.state==='installed'){waiting();check();}});};
  watch(reg.installing);reg.addEventListener('updatefound',()=>watch(reg.installing));
  check();
 }).catch(()=>{status.textContent='Offline preparation failed. Reconnect and reload to try again.';});
}
