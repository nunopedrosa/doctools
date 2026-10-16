import test from 'node:test';import assert from 'node:assert/strict';import {inspectFile,optimizeFile} from '../web/core/files.js';import {fixture,assertProtectedZip,saveOutput} from './helpers/formats.mjs';
for(const extension of ['docx','dotx','pptx','ppsx','potx','xlsx','xltx','vsdx'])test('preserves protected package parts '+extension,async()=>{
 const src=await fixture('multiformat/mixed.'+extension),summary=await inspectFile(src,'mixed.'+extension);assert.ok(summary.images.length>=2);
 const r=await optimizeFile(src,'mixed.'+extension);assert.equal(r.extension,extension);assert.equal(r.converted,false);assert.equal(r.changed,true);await assertProtectedZip(src,r.bytes,r.images);await saveOutput('mixed.'+extension,r.bytes);
});
test('uses the declared main relationship instead of a fixed directory',async()=>{assert.ok((await inspectFile(await fixture('multiformat/relocated.pptx'),'relocated.pptx')).images.length>=2);});
for(const name of ['hidden-vba.pptx','vba-content-type.xlsx','vba-relationship.docx','signed.vsdx','missing-image.pptx','duplicate-rel.xlsx','wrong-root.potx','wrong-main-type.dotx','encoded-traversal.xlsx'])test('rejects unsafe OPC package '+name,async()=>{await assert.rejects(()=>inspectFileFixture(name));});
async function inspectFileFixture(name){return inspectFile(await fixture('multiformat/'+name),name);}
