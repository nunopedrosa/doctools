import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {optimizeImage} from '../web/core/images.js';
const read=async n=>new Uint8Array(await readFile('tests/fixtures/'+n));
for (const name of ['RGBA.png','P.png','L.png','RGB.png','photo.jpg','progressive.jpg','gray.jpg']) {
 test('lossless candidate reduces '+name,async()=>{
  const src=await read(name), r=await optimizeImage(src,'word/media/'+name);
  assert.equal(r.status,'optimized',r.reason);assert.ok(r.bytes.length<src.length);
  await mkdir('tests/output/codecs',{recursive:true});await writeFile('tests/output/codecs/'+name,r.bytes);
 });
}
for(const name of ['animated.png','unsupported.gif','bad.png','cmyk.jpg','huge.png']) test('preserves unsupported '+name,async()=>{
 const src=await read(name),r=await optimizeImage(src,'word/media/'+name);assert.notEqual(r.status,'optimized');assert.deepEqual(r.bytes,src);
});
test('extension mismatch preserved',async()=>{const src=await read('photo.jpg');assert.deepEqual((await optimizeImage(src,'word/media/image.png')).bytes,src);});
test('codec failure retains original',async()=>{const src=await read('RGBA.png'); const r=await optimizeImage(src,'word/media/x.png',{png:async()=>{throw Error('fixture failure')}});assert.equal(r.status,'failed');assert.deepEqual(r.bytes,src);});
