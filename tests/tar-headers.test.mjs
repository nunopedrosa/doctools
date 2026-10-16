import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './helpers/formats.mjs';
const {validateTarHeaders}=await import('../web/core/tar-headers.js').catch(()=>({}));
test('TAR preflight rejects unpreservable metadata, links, truncation and hidden trailing files',async()=>{
 assert.equal(typeof validateTarHeaders,'function');const src=await fixture('multiformat/pages.tar');assert.doesNotThrow(()=>validateTarHeaders(src));
 assert.throws(()=>validateTarHeaders(src.subarray(0,src.length-1025)),/truncated|TAR/i);
 const linked=await fixture('multiformat/linked.tar');assert.throws(()=>validateTarHeaders(linked),/link|special/i);
 const custom=await fixture('multiformat/custom-pax.tar');assert.throws(()=>validateTarHeaders(custom),/metadata|PAX/i);
 const trailing=new Uint8Array(src.length+src.length);trailing.set(src);trailing.set(src,src.length);assert.throws(()=>validateTarHeaders(trailing),/trailing|TAR/i);
});
