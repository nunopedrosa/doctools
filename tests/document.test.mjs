import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
import {inspectDocument,optimizeDocument} from '../web/core/document.js';import {readArchive} from '../web/core/archive.js';
const file=async n=>new Uint8Array(await readFile('tests/fixtures/'+n));
for(const name of ['mixed.docx','strict.docx'])test('preserves complete package '+name,async()=>{
 const src=await file(name),copy=src.slice();const summary=await inspectDocument(src);assert.equal(summary.images.length,5);
 const r=await optimizeDocument(src);assert.ok(r.changed);assert.ok(r.bytes.length<src.length);assert.deepEqual(src,copy);
 const a=await readArchive(src),b=await readArchive(r.bytes);
 try{assert.deepEqual(a.entries.map(e=>e.name).sort(),b.entries.map(e=>e.name).sort());
 for(const e of a.entries){if(!r.images.some(i=>i.path===e.name&&i.status==='optimized'))assert.deepEqual(await a.read(e.name),await b.read(e.name),e.name);}
 }finally{a.close();b.close();}await writeFile('tests/output/'+name,r.bytes);
});
for(const n of ['signed.docx','signed-rel.docx','traversal.docx','bad-xml.docx','entity.docx','broken-rel.docx','missing.docx','wrong-type.docx','duplicate.docx','crc.docx','header-mismatch.docx','encrypted.docx','office-encrypted.docx'])test('rejects '+n,async()=>{const src=await file(n);await assert.rejects(()=>inspectDocument(src));});
test('empty document returns exact original',async()=>{const src=await file('empty.docx'),r=await optimizeDocument(src);assert.equal(r.changed,false);assert.deepEqual(r.bytes,src);});
test('expanded limits apply to real reads',async()=>{const src=await file('mixed.docx');await assert.rejects(()=>readArchive(src,{entry:100,total:200}),/limit/i);});
test('entry count bounded',async()=>{const src=await file('mixed.docx');await assert.rejects(()=>readArchive(src,{entries:2}),/limit/i);});
test('optimized document is stable on a second pass',async()=>{const r=await optimizeDocument(await file('mixed.docx'));const again=await optimizeDocument(r.bytes);assert.equal(again.changed,false);assert.deepEqual(again.bytes,r.bytes);});
test('aggregate expanded-byte limit rejects many small entries',async()=>{const src=await file('mixed.docx');await assert.rejects(()=>readArchive(src,{total:1000}),/limit/i);});
test('input-byte limit is enforced',async()=>{const src=await file('mixed.docx');await assert.rejects(()=>readArchive(src,{input:10}),/limit/i);});
test('UTF16 main document can be inspected',async()=>{assert.equal((await inspectDocument(await file('utf16.docx'))).images.length,5);});
test('false declared ZIP sizes are rejected',async()=>{const src=await file('false-size.docx');await assert.rejects(()=>inspectDocument(src));});
test('real Word package preserves comments, tracked changes, headers and layout XML',async()=>{
 const src=await file('realistic.docx'),result=await optimizeDocument(src);assert.ok(result.changed);
 const a=await readArchive(src),b=await readArchive(result.bytes);try{for(const e of a.entries)if(!e.name.startsWith('word/media/'))assert.deepEqual(await a.read(e.name),await b.read(e.name),e.name);}finally{await a.close();await b.close();}
 await writeFile('tests/output/realistic.docx',result.bytes);
});
