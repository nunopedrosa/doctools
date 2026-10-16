import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const fixture=async name=>new Uint8Array(await readFile('tests/fixtures/'+name));
const loader=await import('../web/core/format-loader.js').catch(()=>({}));
test('session retains original/result images and rejects arbitrary preview resources',async()=>{
 assert.equal(typeof loader.openFile,'function','format sessions must be available');
 const src=await fixture('textured.png'),copy=src.slice(),s=await loader.openFile(src,'Example.PNG');
 try{
  const info=await s.inspect();assert.deepEqual(info.modes,['lossless','colors']);
  const r=await s.optimize({mode:'colors',colors:64},()=>{});
  assert.equal(r.converted,false);assert.equal(r.downloadAvailable,true);
  const pair=await s.preview(r.images[0].previewId);assert.deepEqual(pair.before,copy);assert.deepEqual(pair.after,r.bytes);
  await assert.rejects(()=>s.preview('../../secret'),/preview/i);assert.deepEqual(src,copy);
 }finally{await s.close();await s.close();}
 await assert.rejects(()=>s.inspect(),/closed/i);
});
test('no-op sessions preserve exact input bytes without a download',async()=>{
 assert.equal(typeof loader.openFile,'function');
 const src=await fixture('empty.docx'),s=await loader.openFile(src,'empty.docx');
 try{const r=await s.optimize({},()=>{});assert.equal(r.downloadAvailable,false);assert.deepEqual(r.bytes,src);}
 finally{await s.close();}
});
