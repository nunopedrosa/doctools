import {LIMITS,checkLimit} from './limits.js';
// Reject the next actual write BEFORE copying it into retained output storage.
export function boundedZipWriter(limit=LIMITS.total){
 let size=0,chunks=[];return {writable:new WritableStream({write(chunk){checkLimit(size+chunk.length,limit,'Archive output');chunks.push(chunk.slice());size+=chunk.length;},abort(){chunks=[];size=0;}}),getData(){const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}chunks=[];return out;}};
}
export function checkZipHeaderBudget(entries,limit=LIMITS.total){let minimum=22;const enc=new TextEncoder();for(const e of entries){minimum+=76+2*enc.encode(e.name).length;checkLimit(minimum,limit,'Archive output headers');}}
