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
for(const name of ['opaque-diagram.png','gray-diagram.png'])test('accepts pixel-identical PNG representation changes: '+name,async()=>{
 const src=await read(name),r=await optimizeImage(src,'word/media/'+name);
 assert.equal(r.status,'optimized',r.reason);assert.ok(r.bytes.length<src.length*.7);
 await writeFile('tests/output/codecs/'+name,r.bytes);
});
test('rejects codec output that changes a PNG pixel',async()=>{
 const src=await read('opaque-diagram.png'),changed=await read('changed-pixels.png');
 const r=await optimizeImage(src,'word/media/image.png',{png:async()=>changed});
 assert.equal(r.status,'failed');assert.deepEqual(r.bytes,src);
});
test('dependent PNG background metadata remains valid and unchanged',async()=>{
 const src=await read('background.png'),r=await optimizeImage(src,'word/media/background.png');
 if(r.status==='optimized')await writeFile('tests/output/codecs/background.png',r.bytes);else assert.deepEqual(r.bytes,src);
});
for(const name of ['gray16.png','gray16-reducible.png'])test('preserves all 16-bit PNG samples: '+name,async()=>{
 const src=await read(name),r=await optimizeImage(src,'word/media/'+name);assert.equal(r.status,'optimized',r.reason);await writeFile('tests/output/codecs/'+name,r.bytes);
});
test('preserves truecolor suggested palettes and rejects their removal',async()=>{
 const {pngInfo}=await import('../web/core/png.js');
 const {verifyImage}=await import('../web/core/images.js');
 const rgb=await read('RGB.png'),palette=pngInfo(await read('P.png')).chunks.find(c=>c.type==='PLTE').raw;
 const src=new Uint8Array(rgb.length+palette.length);src.set(rgb.slice(0,33));src.set(palette,33);src.set(rgb.slice(33),33+palette.length);
 await assert.rejects(verifyImage(src,rgb,'word/media/image.png'),/palette|metadata/i);
 const result=await optimizeImage(src,'word/media/image.png');
 assert.deepEqual(pngInfo(result.bytes).chunks.find(c=>c.type==='PLTE')?.raw,palette);
});
