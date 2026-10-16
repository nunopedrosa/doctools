import test from 'node:test';import assert from 'node:assert/strict';
const {resultPresentation}=await import('../web/result-view.js').catch(()=>({}));
test('larger comic conversions remain downloadable without claiming savings',()=>{
 assert.equal(typeof resultPresentation,'function');
 const r=resultPresentation('Volume.One.CBR',100,{extension:'cbz',label:'CBZ',bytes:new Uint8Array(125),converted:true,changed:true,downloadAvailable:true});
 assert.equal(r.filename,'Volume.One-converted.cbz');assert.match(r.savings,/larger/i);assert.doesNotMatch(r.savings,/saved/i);assert.equal(r.downloadLabel,'Download CBZ');assert.match(r.title,/convert/i);
});
test('ordinary package downloads retain their real format and safe filenames',()=>{
 assert.equal(typeof resultPresentation,'function');
 const r=resultPresentation('<deck>.PPTX',100,{extension:'pptx',label:'PPTX',bytes:new Uint8Array(75),converted:false,changed:true,downloadAvailable:true});
 assert.equal(r.filename,'_deck_-compressed.pptx');assert.match(r.savings,/25.*saved/);assert.equal(r.downloadLabel,'Download PPTX');
});
