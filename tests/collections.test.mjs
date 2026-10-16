import test from 'node:test';import assert from 'node:assert/strict';import {inspectFile,optimizeFile} from '../web/core/files.js';import {openNativeArchive} from '../web/core/archive-native.js';import {readArchive} from '../web/core/archive.js';import {fixture,assertProtectedZip,saveOutput} from './helpers/formats.mjs';
for(const extension of ['zip','tar','7z'])test('image collection retains its format and protected files '+extension,async()=>{
 const src=await fixture('multiformat/pages.'+extension),r=await optimizeFile(src,'pages.'+extension,()=>{},{mode:'colors',colors:64,jpegQuality:70});
 assert.equal(r.extension,extension);assert.equal(r.converted,false);assert.equal(r.changed,true);
 if(extension==='zip')await assertProtectedZip(src,r.bytes,r.images);else{const a=await openNativeArchive(src,extension),b=await openNativeArchive(r.bytes,extension);try{assert.deepEqual(a.entries.map(e=>e.name),b.entries.map(e=>e.name));for(const e of a.entries)if(!r.images.some(i=>i.path===e.name&&i.status==='optimized'))assert.deepEqual(await a.read(e.name),await b.read(e.name));}finally{await a.close();await b.close();}}
 await saveOutput('pages.'+extension,r.bytes);
});
test('generic ZIP cannot bypass a known Office package validator',async()=>{const src=await fixture('multiformat/disguised-office.zip');await assert.rejects(()=>inspectFile(src,'images.zip'),/package|Office|format/i);});
test('collection sessions reject special files rather than changing their meaning',async()=>{await assert.rejects(()=>inspectFixture('linked.tar'));});
async function inspectFixture(name){return inspectFile(await fixture('multiformat/'+name),name);}

test('self-extracting ZIP input is rejected',async()=>{const src=await fixture('multiformat/pages.zip');const sfx=new Uint8Array(src.length+4);sfx.set([77,90,0,0]);sfx.set(src,4);await assert.rejects(()=>inspectFile(sfx,'images.zip'),/ZIP|signature|extract/i);});
