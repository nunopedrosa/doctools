import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './helpers/formats.mjs';
const native=await import('../web/core/archive-native.js').catch(()=>({}));
for(const variant of ['rar4','rar5'])test('native archive decodes exact synthetic pages '+variant,async()=>{
 assert.equal(typeof native.openNativeArchive,'function','native archive engine must be available');
 const a=await native.openNativeArchive(await fixture('multiformat/'+variant+'.cbr'),'rar');
 try{assert.deepEqual(a.entries.map(e=>e.name),['pages/001.png','pages/002.jpg','ComicInfo.xml']);assert.deepEqual(await a.read('pages/001.png'),await fixture('textured.png'));}
 finally{await a.close();await a.close();}
});
test('native TAR enforces actual byte limits and rejects links',async()=>{
 assert.equal(typeof native.openNativeArchive,'function');
 await assert.rejects(()=>openFixture('linked.tar','tar'),/link|special/i);
 await assert.rejects(()=>openFixture('pages.tar','tar',{entry:100,total:200}),/limit/i);
});

async function openFixture(name,container,limits){return native.openNativeArchive(await fixture('multiformat/'+name),container,limits);}
test('native TAR writer preserves ordered file bytes and timestamps',async()=>{
 assert.equal(typeof native.openNativeArchive,'function');const src=await fixture('multiformat/pages.tar'),a=await native.openNativeArchive(src,'tar');let b;
 try{const bytes=await a.rewrite(new Map(),'tar');b=await native.openNativeArchive(bytes,'tar');assert.deepEqual(a.entries,b.entries);for(const e of a.entries)assert.deepEqual(await a.read(e.name),await b.read(e.name));}
 finally{await a.close();await b?.close();}
});
test('native 7z writer stays in memory and preserves its own supported metadata',async()=>{
 const a=await openFixture('pages.7z','7z');let b;
 try{const out=await a.rewrite(new Map(),'7z');b=await native.openNativeArchive(out,'7z');assert.deepEqual(a.entries,b.entries);for(const e of a.entries)assert.deepEqual(await a.read(e.name),await b.read(e.name));}
 finally{await a.close();await b?.close();}
});
test('compressed RAR4 and solid/compressed RAR5 read independently verified data',async()=>{
 const a=await openFixture('rar4-compressed-single.cbr','rar');try{assert.deepEqual(await a.read('LibarchiveAddingTest.html'),await fixture('multiformat/rar4-compressed-expected.bin'));}finally{await a.close();}
 for(const name of ['test_read_format_rar5_compressed.cbr','test_read_format_rar5_solid.cbr']){const h=await openFixture(name,'rar');try{assert.equal(h.entries[0].name,'test.bin');assert.equal((await h.read('test.bin')).length,1200);}finally{await h.close();}}
});
test('native readers reject encrypted or multipart archive regression cases',async()=>{
 for(const name of ['test_read_format_rar4_solid_encrypted.cbr','test_read_format_rar5_multiarchive_solid.part01.cbr'])await assert.rejects(()=>openFixture(name,'rar'),/encrypt|volume|multipart/i);
 const src=(await fixture('multiformat/rar4.cbr')).slice(),at=Buffer.from(src).indexOf(Buffer.from([137,80,78,71,13,10,26,10]));src[at+80]^=1;await assert.rejects(()=>native.openNativeArchive(src,'rar'),/CRC|checksum|damaged/i);
});
test('TAR and 7z retain long Unicode names and exact image bytes',async()=>{
 for(const container of ['tar','7z']){const a=await openFixture('unicode.'+container,container);let b;try{assert.match(a.entries[0].name,/café\.png$/);const result=await a.rewrite(new Map(),container);b=await native.openNativeArchive(result,container);assert.deepEqual(a.entries,b.entries);assert.deepEqual(await b.read(b.entries[0].name),await fixture('textured.png'));}finally{await a.close();await b?.close();}}
});
test('compressed and solid RAR payload hashes match independent bsdtar extraction',async()=>{
 const {createHash}=await import('node:crypto'),hashes=JSON.parse(new TextDecoder().decode(await fixture('multiformat/compressed-rar-hashes.json')));
 for(const [name,entries] of Object.entries(hashes)){const a=await openFixture(name,'rar');try{for(const [path,sha] of Object.entries(entries))assert.equal(createHash('sha256').update(await a.read(path)).digest('hex'),sha);}finally{await a.close();}}
});
test('native archives reject duplicate/traversal paths, excessive entries and encrypted 7z',async()=>{
 for(const [name,container] of [['duplicate.tar','tar'],['traversal.tar','tar'],['many.tar','tar'],['test_read_format_7zip_encryption.7z','7z'],['test_read_format_7zip_encryption_header.7z','7z']])await assert.rejects(()=>openFixture(name,container));
 const damaged=(await fixture('multiformat/pages.7z')).slice();damaged[40]^=1;await assert.rejects(()=>native.openNativeArchive(damaged,'7z'),/decompress|CRC|corrupt|damage/i);
});
