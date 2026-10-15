import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectFile,optimizeFile} from '../web/core/files.js';
const read=async n=>new Uint8Array(await readFile('tests/fixtures/'+n));
test('standalone PNGs use the same optimizer and retain input and format',async()=>{
 const src=await read('textured.png'),copy=src.slice(),summary=await inspectFile(src,'Example.PNG');
 assert.equal(summary.kind,'image');assert.equal(summary.images[0].width,320);
 const r=await optimizeFile(src,'Example.PNG',()=>{},{mode:'colors',colors:64});
 assert.equal(r.mime,'image/png');assert.equal(r.extension,'png');assert.equal(r.changed,true);assert.equal(r.images.length,1);assert.equal(r.images[0].perceptual,true);assert.deepEqual(src,copy);
});
test('standalone JPEG quality compression and DOCX routing both work',async()=>{
 const image=await optimizeFile(await read('photo.jpg'),'photo.JPEG',()=>{},{mode:'colors',jpegQuality:70});
 assert.equal(image.mime,'image/jpeg');assert.equal(image.extension,'jpeg');assert.equal(image.images[0].perceptual,true);assert.equal(image.changed,true);
 const doc=await optimizeFile(await read('mixed.docx'),'Mixed.DOCX');assert.equal(doc.kind,'document');assert.equal(doc.extension,'docx');assert.equal(doc.changed,true);
});
test('standalone rejects unsupported extensions, mismatched signatures, large dimensions and corrupt data',async()=>{
 for(const [file,name] of [['unsupported.gif','x.gif'],['photo.jpg','x.png'],['bad.png','x.png'],['huge.png','x.png']])await assert.rejects(inspectFile(await read(file),name));
 const src=(await read('photo.jpg')).slice(0,-100);await assert.rejects(optimizeFile(src,'bad.jpg'),/retained|reject|damaged|truncated/i);
});
test('an already efficient standalone image keeps its exact bytes',async()=>{
 const first=await optimizeFile(await read('photo.jpg'),'photo.jpg'),second=await optimizeFile(first.bytes,'photo.jpg');
 assert.equal(second.changed,false);assert.deepEqual(second.bytes,first.bytes);
});
