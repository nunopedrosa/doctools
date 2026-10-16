import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {readArchive} from '../../web/core/archive.js';
export const fixture=async name=>new Uint8Array(await readFile(new URL('../fixtures/'+name,import.meta.url)));
export async function assertProtectedZip(src,out,images){const a=await readArchive(src),b=await readArchive(out);try{
 assert.deepEqual(a.entries.map(e=>e.name),b.entries.map(e=>e.name));assert.deepEqual(a.comment,b.comment);
 for(const e of a.entries){const f=b.entries.find(f=>f.name===e.name);assert.equal(f.metadata.comment,e.metadata.comment);assert.equal(f.metadata.externalFileAttributes,e.metadata.externalFileAttributes);if(!images.some(i=>i.path===e.name&&i.status==='optimized')){assert.deepEqual(await a.read(e.name),await b.read(e.name),e.name);assert.deepEqual(await a.raw(e.name),await b.raw(e.name),e.name+' compressed bytes');}}
 }finally{await a.close();await b.close();}}
export async function saveOutput(name,bytes){await mkdir('tests/output/multiformat',{recursive:true});await writeFile('tests/output/multiformat/'+name,bytes);}
