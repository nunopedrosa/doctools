import {parseXml} from './xml.js';import {resolvePackageTarget} from './paths.js';import {assertZipPackageKind,validateMimetype,xmlElements,xmlChildren} from './zip-package-kind.js';
const M='urn:oasis:names:tc:opendocument:xmlns:manifest:1.0',O='urn:oasis:names:tc:opendocument:xmlns:office:1.0';
export async function validateOdf(a,f){
 await assertZipPackageKind(a,f);await validateMimetype(a,f.mime);
 const names=new Set(a.entries.map(e=>e.name));if([...names].some(n=>/^META-INF\/.*signatures/i.test(n)))throw Error('Signed OpenDocument files cannot be optimized');
 const d=parseXml(await a.read('META-INF/manifest.xml')),root=d.documentElement;
 if(root.namespaceURI!==M||root.localName!=='manifest')throw Error('Invalid OpenDocument manifest');
 if(xmlElements(d,M,'encryption-data').length||Array.from(d.getElementsByTagName('*')).some(e=>/signature/i.test(e.localName)))throw Error('Encrypted or signed OpenDocument is not supported');
 const paths=new Set(),images=[];let rootType;
 for(const el of xmlChildren(root)){
  if(el.namespaceURI!==M||el.localName!=='file-entry')throw Error('Invalid OpenDocument manifest entry');
  const raw=el.getAttributeNS(M,'full-path'),type=el.getAttributeNS(M,'media-type');if(!raw||paths.has(raw))throw Error('Duplicate or missing OpenDocument path');paths.add(raw);
  if(raw==='/'){rootType=type;continue;}
  const path=resolvePackageTarget('',raw);if(!names.has(path)&&!names.has(path+'/'))throw Error('Missing OpenDocument resource: '+path);
  if(/signature/i.test(type))throw Error('Signed OpenDocument declaration');if(type.startsWith('image/')&&names.has(path))images.push(path);
 }
 if(rootType!==f.mime)throw Error('OpenDocument type does not match extension');
 const content=parseXml(await a.read('content.xml'));if(content.documentElement.namespaceURI!==O||content.documentElement.localName!=='document-content')throw Error('Invalid OpenDocument content root');
 const bodies=xmlElements(content,O,'body'),expected=({odt:'text',ott:'text',ods:'spreadsheet',ots:'spreadsheet',odp:'presentation',otp:'presentation',odg:'drawing',otg:'drawing'})[f.extension];
 if(bodies.length!==1||xmlChildren(bodies[0]).length!==1||xmlChildren(bodies[0])[0].localName!==expected||xmlChildren(bodies[0])[0].namespaceURI!==O)throw Error('OpenDocument body does not match format');
 return {imagePaths:images,warnings:[]};
}
