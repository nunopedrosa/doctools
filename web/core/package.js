import XML from '../vendor/xml.js';
const REL='http://schemas.openxmlformats.org/package/2006/relationships',CT='http://schemas.openxmlformats.org/package/2006/content-types';
const DOC='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
export function parseXml(bytes){
 const encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';
 const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML declarations with entities or DTDs are not supported');
 const errors=[];const doc=new XML.DOMParser({onError:(level,message)=>{if(level!=='warning')errors.push(message);}}).parseFromString(text,'application/xml');
 if(errors.length||!doc.documentElement)throw Error('Malformed package XML');return doc;
}
function targetPath(base,target){
 if(target.includes('\\')||target.includes('\0'))throw Error('Invalid relationship target');
 const decoded=decodeURIComponent(target.split('#')[0]);
 if(/^[a-z][a-z0-9+.-]*:/i.test(decoded)||decoded.startsWith('//'))throw Error('Invalid internal relationship URI');
 const stack=decoded.startsWith('/')?[]:base.split('/').filter(Boolean);
 for(const p of decoded.split('/')){if(!p||p==='.')continue;if(p==='..'){if(!stack.length)throw Error('Relationship escapes package');stack.pop();}else stack.push(p);}
 return stack.join('/');
}
export async function validatePackage(archive){
 const names=new Set(archive.entries.map(e=>e.name));
 for(const n of ['[Content_Types].xml','_rels/.rels','word/document.xml'])if(!names.has(n))throw Error('Not a valid DOCX: missing '+n);
 if([...names].some(n=>n.toLowerCase().startsWith('_xmlsignatures/')))throw Error('Digitally signed DOCX cannot be modified without invalidating its signature');
 const types=parseXml(await archive.read('[Content_Types].xml'));
 if(types.documentElement.localName!=='Types'||types.documentElement.namespaceURI!==CT)throw Error('Invalid content types');
 const overrides=new Map(),defaults=new Map();
 for(const el of Array.from(types.documentElement.childNodes).filter(n=>n.nodeType===1)){
  if(el.namespaceURI!==CT)throw Error('Invalid content type namespace');
  if(el.localName==='Override'){const path=targetPath('',el.getAttribute('PartName'));if(overrides.has(path))throw Error('Duplicate content type');overrides.set(path,el.getAttribute('ContentType'));}
  else if(el.localName==='Default'){const ext=el.getAttribute('Extension').toLowerCase();if(defaults.has(ext))throw Error('Duplicate content type');defaults.set(ext,el.getAttribute('ContentType'));}
 }
 if(overrides.get('word/document.xml')!==DOC)throw Error('Unsupported document content type');
 for(const e of archive.entries){if(e.directory||e.name==='[Content_Types].xml')continue;if(!overrides.has(e.name)&&!defaults.has(e.name.split('.').pop().toLowerCase()))throw Error('Missing content type: '+e.name);}
 const main=parseXml(await archive.read('word/document.xml'));
 if(main.documentElement.localName!=='document'||!['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main'].includes(main.documentElement.namespaceURI))throw Error('Invalid Word document XML');
 let office=false;
 for(const e of archive.entries.filter(e=>e.name.endsWith('.rels'))){
  const doc=parseXml(await archive.read(e.name));
  if(doc.documentElement.localName!=='Relationships'||doc.documentElement.namespaceURI!==REL)throw Error('Invalid relationships part');
  const base=e.name==='_rels/.rels'?'':e.name.slice(0,e.name.lastIndexOf('/_rels/'));
  if(e.name!=='_rels/.rels'&&!e.name.includes('/_rels/'))throw Error('Invalid relationships path');
  const ids=new Set();
  for(const r of Array.from(doc.documentElement.childNodes).filter(n=>n.nodeType===1)){
   if(r.localName!=='Relationship'||r.namespaceURI!==REL)throw Error('Invalid relationship element');
   const id=r.getAttribute('Id'),type=r.getAttribute('Type'),target=r.getAttribute('Target');
   if(!id||ids.has(id)||!type||!target)throw Error('Invalid or duplicate relationship');ids.add(id);
   if(type.includes('/digital-signature/'))throw Error('Digitally signed package cannot be optimized');
   if(r.getAttribute('TargetMode')==='External')continue;
   const resolved=targetPath(base,target);if(!names.has(resolved))throw Error('Missing relationship target: '+resolved);
   if(e.name==='_rels/.rels'&&type.endsWith('/officeDocument')&&resolved==='word/document.xml')office=true;
  }
 }
 if(!office)throw Error('Missing main document relationship');
 return {mediaPaths:[...names].filter(n=>n.startsWith('word/media/')&&!n.endsWith('/'))};
}
