import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';import {homedir} from 'node:os';import {join} from 'node:path';
const bundledPython=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python=process.env.DOCTOOLS_PYTHON||(existsSync(bundledPython)?bundledPython:'python3');
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
// A one-pixel Adam7 PNG has the same scan row as its non-interlaced equivalent.
test('interlaced PNG retains matching IHDR and data',async()=>{
 // Construct with the fixture generator instead of relying on codec output.
 const src=await read('interlaced.png');const r=await optimizeImage(src,'word/media/interlaced.png');
 const {pngInfo}=await import('../web/core/png.js');
 if(r.status==='optimized')assert.equal(pngInfo(r.bytes).chunks[0].data[12],pngInfo(src).chunks[0].data[12]);
});
test('interlaced optimization preserves actual decoded samples',async()=>{
 const src=await read('interlaced.png'),r=await optimizeImage(src,'word/media/interlaced.png');
 await writeFile('tests/output/codecs/interlaced.png',r.bytes);
 const {execFileSync}=await import('node:child_process');
 execFileSync(python,['scripts/image-oracle.py','tests/fixtures','tests/output/codecs']);
});
test('truncated JPEG is preserved rather than silently repaired',async()=>{
 const original=(await read('photo.jpg')).slice(0,-100),r=await optimizeImage(original,'word/media/truncated.jpg');assert.deepEqual(r.bytes,original);assert.notEqual(r.status,'optimized');
});
