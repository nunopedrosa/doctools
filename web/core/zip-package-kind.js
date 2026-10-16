export async function recognizeZipPackage(archive){
 const names=new Set(archive.entries.map(e=>e.name.toLowerCase()));
 if(names.has('[content_types].xml')||names.has('_rels/.rels'))return 'office';
 if(names.has('stack.xml')||names.has('mergedimage.png'))return 'ora';
 if(names.has('meta-inf/container.xml')||names.has('meta-inf/encryption.xml'))return 'epub';
 if(names.has('meta-inf/manifest.xml'))return 'odf';
 if(names.has('mimetype')){const type=new TextDecoder().decode(await archive.read(archive.entries.find(e=>e.name.toLowerCase()==='mimetype').name));if(type==='image/openraster')return 'ora';if(type==='application/epub+zip')return 'epub';if(type.startsWith('application/vnd.oasis.opendocument.'))return 'odf';throw Error('Unrecognized typed ZIP package');}
 if([...names].some(n=>n.endsWith('.kml')))return 'kmz';
 if(names.has('meta-inf/manifest.mf')||names.has('androidmanifest.xml')||[...names].some(n=>n.startsWith('_xmlsignatures/')))return 'signed or application';
 return null;
}
export async function assertZipPackageKind(a,f){if(await recognizeZipPackage(a)!==f.family)throw Error('Package does not match the selected format');}
export async function validateMimetype(a,mime){
 const e=a.entries[0],m=e?.metadata,l=m?.localDirectory;
 if(e?.name!=='mimetype'||m.offset!==0||m.compressionMethod!==0||l?.compressionMethod!==0||l.filenameLength!==8||l.extraFieldLength!==0||new TextDecoder().decode(await a.read('mimetype'))!==mime)throw Error('Invalid mimetype: must be exact, physically first and stored without local extra fields');
}
export const xmlChildren=e=>Array.from(e.childNodes).filter(n=>n.nodeType===1);
export const xmlElements=(d,ns,name)=>Array.from(d.getElementsByTagNameNS(ns,name));
