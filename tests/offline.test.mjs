import test from 'node:test';import assert from 'node:assert/strict';import {readFile,stat} from 'node:fs/promises';
import {ASSETS,VERSION} from '../web/release.js';
test('offline inventory covers every published runtime import and codec',async()=>{
 assert.ok(VERSION);for(const file of ASSETS)assert.ok((await stat('web/'+file)).isFile(),file);
 for(const file of ASSETS.filter(p=>p.endsWith('.js'))){
  const text=await readFile('web/'+file,'utf8');
  const {posix}=await import('node:path');
  for(const match of text.matchAll(/(?:from\s*|import\s*)['"]([.][^'"]+)['"]/g)){
   const target=posix.normalize(posix.join(posix.dirname(file),match[1]));assert.ok(ASSETS.includes(target),file+' imports uncached '+target);
  }
 }
 for(const file of ['vendor/jpeg.wasm','vendor/squoosh_oxipng_bg.wasm','worker.js','index.html','styles.css'])assert.ok(ASSETS.includes(file));
});
test('manifest start and scope resolve within the application',async()=>{const m=JSON.parse(await readFile('web/manifest.webmanifest'));assert.equal(m.start_url,'./');assert.equal(m.scope,'./');for(const icon of m.icons)assert.ok((await stat('web/'+icon.src)).isFile());});
test('release hashes match every cached runtime file',async()=>{
 const {HASHES}=await import('../web/release.js');const {createHash}=await import('node:crypto');
 for(const path of ASSETS.filter(p=>p!=='release.js'))assert.equal(createHash('sha256').update(await readFile('web/'+path)).digest('hex'),HASHES[path],path+' has stale release hash');
});
