import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {optimizeImage,verifyImage} from '../web/core/images.js';
import {jpegInfo} from '../web/core/jpeg.js';
import {optimizeDocument} from '../web/core/document.js';
import {readArchive} from '../web/core/archive.js';
const read=async n=>new Uint8Array(await readFile('tests/fixtures/'+n));
for(const name of ['photo.jpg','progressive.jpg','gray.jpg'])test('optional JPEG recompression preserves dimensions and metadata: '+name,async()=>{
 const src=await read(name),copy=src.slice(),exact=await optimizeImage(src,name);
 const r=await optimizeImage(src,name,{}, {mode:'colors',jpegQuality:75});
 assert.equal(r.perceptual,true,r.reason);assert.ok(r.bytes.length<exact.bytes.length);
 const a=jpegInfo(src),b=jpegInfo(r.bytes);assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.deepEqual(a.metadata,b.metadata);
 await verifyImage(src,r.bytes,name,{mode:'colors'});assert.deepEqual(src,copy);
 await writeFile('tests/output/quality-'+name,r.bytes);
});
test('JPEG quality setting affects output only in optional mode',async()=>{
 const src=await read('photo.jpg');
 const low=await optimizeImage(src,'photo.jpg',{}, {mode:'colors',jpegQuality:60});
 const high=await optimizeImage(src,'photo.jpg',{}, {mode:'colors',jpegQuality:90});
 assert.ok(low.bytes.length<high.bytes.length);
 assert.deepEqual((await optimizeImage(src,'photo.jpg',{}, {mode:'lossless',jpegQuality:60})).bytes,(await optimizeImage(src,'photo.jpg')).bytes);
});
test('JPEG recompression preserves comments stored after entropy-coded scan data',async()=>{
 const src=await read('photo.jpg'),comment=new TextEncoder().encode('KEEP_POST_SCAN_METADATA'),segment=new Uint8Array(comment.length+4);
 segment.set([255,254,0,comment.length+2]);segment.set(comment,4);
 const withComment=new Uint8Array(src.length+segment.length);withComment.set(src.slice(0,-2));withComment.set(segment,src.length-2);withComment.set([255,217],withComment.length-2);
 const r=await optimizeImage(withComment,'photo.jpg',{}, {mode:'colors',jpegQuality:70});
 assert.equal(r.perceptual,true,r.reason);assert.ok(Buffer.from(r.bytes).includes(Buffer.from(comment)),'late JPEG comment must survive');
 const clean=await optimizeImage(src,'photo.jpg',{}, {mode:'colors',jpegQuality:70});
 await assert.rejects(verifyImage(withComment,clean.bytes,'photo.jpg',{mode:'colors'}),/metadata/);
 await writeFile('tests/output/quality-postscan.jpg',r.bytes);
});
test('bad JPEG quality, unsupported color space and truncated inputs retain safe fallback',async()=>{
 for(const [name,quality,truncated] of [['photo.jpg',0,false],['cmyk.jpg',75,false],['photo.jpg',75,true]]){
  let src=await read(name);if(truncated)src=src.slice(0,-100);
  const r=await optimizeImage(src,name,{}, {mode:'colors',jpegQuality:quality});
  assert.notEqual(r.perceptual,true);if(truncated||name==='cmyk.jpg')assert.deepEqual(r.bytes,src);
 }
});
test('JPEG recompression inside DOCX preserves all other package parts',async()=>{
 const src=await read('mixed.docx'),r=await optimizeDocument(src,()=>{},{mode:'colors',jpegQuality:75});
 assert.ok(r.images.some(i=>/\.jpg$/.test(i.path)&&i.perceptual));
 const a=await readArchive(src),b=await readArchive(r.bytes);
 try{for(const e of a.entries){if(!r.images.some(i=>i.path===e.name&&i.status==='optimized'))assert.deepEqual(await a.read(e.name),await b.read(e.name));}}
 finally{await a.close();await b.close();}
});
