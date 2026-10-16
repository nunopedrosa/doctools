import test from 'node:test';import assert from 'node:assert/strict';import {FORMATS} from '../web/core/formats.js';
const {FORMAT_HELP}=await import('../web/format-help-data.js').catch(()=>({}));
test('every selectable format can explain its purpose, applications and output policy',()=>{
 assert.ok(FORMAT_HELP,'offline format descriptions must exist');
 for(const f of FORMATS){const h=FORMAT_HELP[f.id];assert.ok(h,f.id);assert.ok(h.title.includes(f.extension.toUpperCase()),f.id);assert.ok(h.description.length>20,f.id);assert.ok(h.applications.length>0,f.id);assert.ok(h.policy.length>20,f.id);assert.ok(h.sources.every(s=>s.startsWith('https://')),f.id);}
 assert.match(FORMAT_HELP.cbr.policy,/CBZ/);assert.match(FORMAT_HELP.ora.policy,/lossless/i);assert.match(FORMAT_HELP.dotx.description,/template/i);
});
