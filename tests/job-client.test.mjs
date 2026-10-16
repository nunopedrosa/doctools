import test from 'node:test';import assert from 'node:assert/strict';
import {createJobClient} from '../web/job-client.js';
test('expired processing terminates worker and ignores its stale replies',async t=>{
 const previous=globalThis.Worker,events=[],workers=[];
 class WorkerFixture{constructor(){workers.push(this);}postMessage(m){this.sent=m;}terminate(){this.terminated=true;}}
 globalThis.Worker=WorkerFixture;t.after(()=>{globalThis.Worker=previous;t.mock.timers.reset();});
 t.mock.timers.enable({apis:['setTimeout']});
 const client=createJobClient(m=>events.push(m));await client.inspect({name:'x.png',size:2,arrayBuffer:async()=>new ArrayBuffer(2)});
 const first=workers[0];t.mock.timers.tick(120001);
 assert.equal(first.terminated,true,'timeout must terminate native execution');
 assert.equal(events.length,1);assert.equal(events[0].type,'error');assert.match(events[0].message,/time/i);
 first.onmessage({data:{id:first.sent.id,type:'result',result:{}}});assert.equal(events.length,1);
 await client.inspect({name:'y.png',size:2,arrayBuffer:async()=>new ArrayBuffer(2)});
 client.clear();workers[1].onmessage({data:{id:workers[1].sent.id,type:'inspected'}});assert.equal(events.length,1);
});
test('completed operations stop timers; later optimize and preview each receive a deadline',async t=>{
 const previous=globalThis.Worker,events=[],workers=[];
 class WorkerFixture{constructor(){workers.push(this);}postMessage(m){this.sent=m;}terminate(){this.terminated=true;}}
 globalThis.Worker=WorkerFixture;t.after(()=>{globalThis.Worker=previous;t.mock.timers.reset();});t.mock.timers.enable({apis:['setTimeout']});
 const client=createJobClient(m=>events.push(m));await client.inspect({name:'x.png',size:2,arrayBuffer:async()=>new ArrayBuffer(2)});const w=workers[0],id=w.sent.id;
 w.onmessage({data:{id,type:'inspected'}});t.mock.timers.tick(120001);assert.equal(events.length,1);assert.equal(w.terminated,undefined);
 client.optimize({});w.onmessage({data:{id,type:'progress',done:1,total:2}});t.mock.timers.tick(120001);assert.equal(events.at(-1).type,'error');assert.equal(w.terminated,true);
});
