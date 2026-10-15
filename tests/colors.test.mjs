import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {optimizeImage,verifyImage} from '../web/core/images.js';
import {pngInfo} from '../web/core/png.js';
import {optimizeDocument} from '../web/core/document.js';
import {readArchive} from '../web/core/archive.js';
const read=async n=>new Uint8Array(await readFile('tests/fixtures/'+n));
test('optional color reduction shrinks a textured PNG beyond exact lossless',async()=>{
 const src=await read('textured.png'),original=src.slice();
 const lossless=await optimizeImage(src,'word/media/texture.png');
 const reduced=await optimizeImage(src,'word/media/texture.png',{}, {mode:'colors',colors:64});
 assert.equal(reduced.status,'optimized',reduced.reason);assert.equal(reduced.perceptual,true);
 assert.ok(reduced.bytes.length<lossless.bytes.length*.6);
 const info=pngInfo(reduced.bytes);assert.equal(info.width,320);assert.equal(info.height,240);
 assert.ok(info.chunks.find(c=>c.type==='PLTE').data.length<=64*3);
 await assert.rejects(verifyImage(src,reduced.bytes,'word/media/texture.png'),/pixel/);
 await verifyImage(src,reduced.bytes,'word/media/texture.png',{mode:'colors'});
 assert.deepEqual(src,original);await writeFile('tests/output/colors.png',reduced.bytes);
});
test('16-bit and representation-dependent metadata use lossless fallback',async()=>{
 for(const name of ['gray16.png','background.png']){
  const src=await read(name),r=await optimizeImage(src,'word/media/'+name,{}, {mode:'colors',colors:32});
  assert.notEqual(r.perceptual,true);await verifyImage(src,r.bytes,'word/media/'+name);
 }
});
test('color mode rejects a changed alpha value independently of RGB changes',async()=>{
 await assert.rejects(verifyImage(await read('textured.png'),await read('textured-alpha.png'),'word/media/texture.png',{mode:'colors'}),/transparency/);
});
test('perceptual DOCX protects every other package part',async()=>{
 const src=await read('colors.docx'),r=await optimizeDocument(src,()=>{},{mode:'colors',colors:64});
 assert.ok(r.images.some(i=>i.perceptual));assert.equal(r.changed,true);
 const a=await readArchive(src),b=await readArchive(r.bytes);
 try{for(const entry of a.entries){if(!r.images.some(i=>i.path===entry.name&&i.status==='optimized'))assert.deepEqual(await b.read(entry.name),await a.read(entry.name));}}
 finally{await a.close();await b.close();}
 await writeFile('tests/output/colors.docx',r.bytes);
});
