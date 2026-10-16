import {parseXml} from './xml.js';import {resolvePackageTarget} from './paths.js';import {assertZipPackageKind,validateMimetype,xmlElements,xmlChildren} from './zip-package-kind.js';
const C='urn:oasis:names:tc:opendocument:xmlns:container',P='http://www.idpf.org/2007/opf',E='http://www.w3.org/2001/04/xmlenc#';
const remote=s=>/^[a-z][a-z0-9+.-]*:/i.test(s)||s.startsWith('//');
export async function validateEpub(a,f){
 await assertZipPackageKind(a,f);await validateMimetype(a,'application/epub+zip');const names=new Set(a.entries.map(e=>e.name));
 if([...names].some(n=>/^META-INF\/signatures\.xml$/i.test(n)))throw Error('Signed EPUB files cannot be optimized');
 const container=parseXml(await a.read('META-INF/container.xml'));
 if(container.documentElement.localName!=='container'||container.documentElement.namespaceURI!==C)throw Error('Invalid EPUB container');
 const roots=xmlElements(container,C,'rootfile');if(!roots.length)throw Error('Missing EPUB rootfile');
 const images=new Set(),types=new Map(),seen=new Set();
 for(const rf of roots){
  if(rf.getAttribute('media-type')!=='application/oebps-package+xml')throw Error('Invalid EPUB rootfile media type');const path=resolvePackageTarget('',rf.getAttribute('full-path'));if(seen.has(path))throw Error('Duplicate EPUB rootfile');seen.add(path);
  const d=parseXml(await a.read(path)),r=d.documentElement,base=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';
  if(r.namespaceURI!==P||r.localName!=='package'||!/^([23])\./.test(r.getAttribute('version')))throw Error('Invalid EPUB package/version');
  const manifests=xmlChildren(r).filter(e=>e.localName==='manifest'&&e.namespaceURI===P),spines=xmlChildren(r).filter(e=>e.localName==='spine'&&e.namespaceURI===P);if(manifests.length!==1||spines.length!==1)throw Error('Invalid EPUB manifest/spine');
  const ids=new Map();for(const el of xmlChildren(manifests[0])){
   const id=el.getAttribute('id'),href=el.getAttribute('href'),type=el.getAttribute('media-type');if(el.namespaceURI!==P||el.localName!=='item'||!id||ids.has(id)||!href||!type)throw Error('Invalid or duplicate EPUB item');
   if(/signature|encrypted/i.test(type))throw Error('Signed/encrypted EPUB declaration');
   const target=remote(href)?null:resolvePackageTarget(base,href);if(target&&!names.has(target))throw Error('Missing EPUB resource: '+target);ids.set(id,{target,type});
   if(target){if(types.has(target)&&types.get(target)!==type)throw Error('Conflicting EPUB resource media type');types.set(target,type);if(type.startsWith('image/'))images.add(target);}
  }
  const items=xmlChildren(spines[0]);if(!items.length)throw Error('Empty EPUB spine');for(const el of items)if(el.namespaceURI!==P||el.localName!=='itemref'||!ids.has(el.getAttribute('idref'))||!ids.get(el.getAttribute('idref')).target)throw Error('Invalid EPUB spine target');
  for(const el of xmlChildren(manifests[0]))for(const attr of ['fallback','media-overlay'])if(el.hasAttribute(attr)&&!ids.has(el.getAttribute(attr)))throw Error('Missing EPUB manifest reference');
 }
 if(names.has('META-INF/encryption.xml')){
  const d=parseXml(await a.read('META-INF/encryption.xml'));if(d.documentElement.localName!=='encryption'||d.documentElement.namespaceURI!==C)throw Error('Invalid EPUB encryption declaration');
  const nodes=xmlElements(d,E,'EncryptedData');if(!nodes.length||xmlChildren(d.documentElement).length!==nodes.length)throw Error('Unknown EPUB encryption declaration');
  for(const node of nodes){const methods=xmlElements(node,E,'EncryptionMethod'),refs=xmlElements(node,E,'CipherReference');if(methods.length!==1||refs.length!==1||!['http://www.idpf.org/2008/embedding','http://ns.adobe.com/pdf/enc#RC'].includes(methods[0].getAttribute('Algorithm')))throw Error('EPUB encryption/DRM is not supported');const target=resolvePackageTarget('',refs[0].getAttribute('URI')),type=types.get(target);if(!names.has(target)||!type||!(/^(font\/|application\/(vnd\.ms-opentype|font-sfnt|font-woff|x-font-))/i.test(type)))throw Error('Only known font obfuscation is supported');}
 }
 return {imagePaths:[...images],warnings:[]};
}
