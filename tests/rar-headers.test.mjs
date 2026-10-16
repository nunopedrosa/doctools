import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './helpers/formats.mjs';
const {validateRarHeaders}=await import('../web/core/rar-headers.js').catch(()=>({}));
test('validates RAR headers and rejects multipart archives even with complete pages',async()=>{
 assert.equal(typeof validateRarHeaders,'function');
 for(const v of ['rar4','rar5']){const src=await fixture('multiformat/'+v+'.cbr');assert.doesNotThrow(()=>validateRarHeaders(src));assert.throws(()=>validateRarHeaders(awaitableMutation(src)),/CRC|damaged|header/i);const multi=await fixture('multiformat/'+v+'-volume.cbr');assert.throws(()=>validateRarHeaders(multi),/volume|multipart/i);assert.throws(()=>validateRarHeaders(src.subarray(0,50)),/truncated|header|size/i);}
});
function awaitableMutation(src){const b=src.slice();b[12]^=1;return b;}
