import {parseXml} from './xml.js';
import {resolvePackageTarget} from './paths.js';
const REL='http://schemas.openxmlformats.org/package/2006/relationships',CT='http://schemas.openxmlformats.org/package/2006/content-types';
const children=el=>Array.from(el.childNodes).filter(n=>n.nodeType===1);
const forbidden=/digital-signature|macroenabled|macrosheet|vbaproject|vba-project|activex/i;
export async function validateOpc(archive){
 const names=new Set(archive.entries.map(e=>e.name));
 for(const n of ['[Content_Types].xml','_rels/.rels'])if(!names.has(n))throw Error('Invalid Office package: missing '+n);
 if([...names].some(n=>/^_xmlsignatures\//i.test(n)||/(^|\/)(vba(project|data)?\.(bin|xml)|macrosheets|activex)(\/|$)/i.test(n)))throw Error('Signed or macro-bearing packages cannot be optimized');
 const doc=parseXml(await archive.read('[Content_Types].xml'));
 if(doc.documentElement.localName!=='Types'||doc.documentElement.namespaceURI!==CT)throw Error('Invalid content types');
 const overrides=new Map(),defaults=new Map();
 for(const el of children(doc.documentElement)){
  if(el.namespaceURI!==CT)throw Error('Invalid content type namespace');
  const type=el.getAttribute('ContentType');if(!type||forbidden.test(type))throw Error('Unsupported or signed/macro content type');
  if(el.localName==='Override'){
   const raw=el.getAttribute('PartName');if(!raw.startsWith('/'))throw Error('Invalid content type part URI');
   const path=resolvePackageTarget('',raw);if(overrides.has(path))throw Error('Duplicate content type part');overrides.set(path,type);
  }else if(el.localName==='Default'){
   const ext=el.getAttribute('Extension').toLowerCase();if(!ext||ext.includes('/')||defaults.has(ext))throw Error('Invalid or duplicate content type');defaults.set(ext,type);
  }else throw Error('Invalid content type element');
 }
 const types=new Map();
 for(const e of archive.entries){if(e.directory||e.name==='[Content_Types].xml')continue;const type=overrides.get(e.name)||defaults.get(e.name.split('.').pop().toLowerCase());if(!type)throw Error('Missing content type: '+e.name);types.set(e.name,type);}
 const relationships=[];
 for(const e of archive.entries.filter(e=>e.name.endsWith('.rels'))){
  const root=e.name==='_rels/.rels',mark=e.name.lastIndexOf('/_rels/');
  if(!root&&mark<0)throw Error('Invalid relationships path');
  const folder=root?'':e.name.slice(0,mark),owner=root?null:folder+'/'+e.name.slice(mark+7,-5);
  if(owner&&!names.has(owner))throw Error('Missing relationship source: '+owner);
  const rels=parseXml(await archive.read(e.name));if(rels.documentElement.localName!=='Relationships'||rels.documentElement.namespaceURI!==REL)throw Error('Invalid relationships part');
  const ids=new Set();
  for(const r of children(rels.documentElement)){
   const id=r.getAttribute('Id'),type=r.getAttribute('Type'),target=r.getAttribute('Target'),mode=r.getAttribute('TargetMode');
   if(r.localName!=='Relationship'||r.namespaceURI!==REL||!id||ids.has(id)||!type||!target||mode&&!['Internal','External'].includes(mode))throw Error('Invalid or duplicate relationship');
   ids.add(id);if(forbidden.test(type)||/\/vbaProject$/i.test(type))throw Error('Signed or macro-bearing relationships cannot be optimized');
   const external=mode==='External';const path=external?target:resolvePackageTarget(folder,target);if(!external&&!names.has(path))throw Error('Missing relationship target: '+path);
   relationships.push({source:owner,target:path,type,external,id});
  }
 }
 return {types,relationships};
}
export {recognizeZipPackage} from './zip-package-kind.js';
