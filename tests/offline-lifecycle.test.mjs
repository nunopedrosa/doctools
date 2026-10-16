import test from 'node:test';import assert from 'node:assert/strict';
import {setupOffline} from '../web/offline.js';
const tick=()=>new Promise(r=>setTimeout(r,20));
test('a different controlling release locks new work and defers reload until idle',async()=>{
 let busy=true,reloads=0,locked=false,checks=0;
 const container=new EventTarget(),registration={installing:null,waiting:null,addEventListener(){}};
 container.controller={postMessage(data,ports){checks++;ports[0].postMessage({ready:true,version:'different-controlling-release'});}};
 container.register=async()=>registration;container.getRegistration=async()=>registration;
 Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:container,onLine:false},configurable:true});
 globalThis.window=Object.assign(new EventTarget(),{isSecureContext:true});globalThis.document=Object.assign(new EventTarget(),{visibilityState:'visible'});
 globalThis.location={reload(){reloads++;}};
 const button=Object.assign(new EventTarget(),{hidden:true,disabled:false}),status={textContent:''};
 setupOffline({isBusy:()=>busy,setLocked:value=>{locked=value;},status,updateButton:button});
 for(let i=0;i<20&&!checks;i++)await tick();await tick();
 assert.equal(locked,true,'mismatch prevents new jobs');assert.equal(reloads,0,'active operation is allowed to finish');
 busy=false;document.dispatchEvent(new CustomEvent('doctools-busy',{detail:false}));await tick();
 assert.equal(reloads,1,'idle mismatch reloads once into controlling release');
});
