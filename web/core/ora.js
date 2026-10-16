import {parseXml} from './xml.js';import {pngInfo} from './png.js';import {verifyPngPixels} from './png-pixels.js';import {resolvePackageTarget} from './paths.js';import {assertZipPackageKind,validateMimetype,xmlChildren} from './zip-package-kind.js';
export async function validateOra(a,f){
 await assertZipPackageKind(a,f);await validateMimetype(a,'image/openraster');
 const names=new Set(a.entries.map(e=>e.name)),d=parseXml(await a.read('stack.xml')),r=d.documentElement;
 if(r.localName!=='image'||r.namespaceURI)throw Error('Invalid OpenRaster stack root');
 const width=Number(r.getAttribute('w')),height=Number(r.getAttribute('h'));if(!Number.isSafeInteger(width)||width<=0||!Number.isSafeInteger(height)||height<=0)throw Error('Invalid OpenRaster canvas');
 const paths=new Set(),constraints=new Map();let layers=0;
 function visit(el,depth){if(depth>128)throw Error('OpenRaster nesting limit');for(const child of xmlChildren(el)){
  if(child.namespaceURI)throw Error('Unsupported OpenRaster stack namespace');
  if(child.localName==='stack')visit(child,depth+1);
  else if(child.localName==='layer'){const raw=child.getAttribute('src'),path=resolvePackageTarget('',raw);if(path!==raw||!path.endsWith('.png')||!names.has(path))throw Error('Missing or invalid OpenRaster layer');paths.add(path);layers++;for(const key of ['x','y'])if(child.hasAttribute(key)&&!Number.isSafeInteger(Number(child.getAttribute(key))))throw Error('Invalid layer offset');if(child.hasAttribute('opacity')&&!(Number(child.getAttribute('opacity'))>=0&&Number(child.getAttribute('opacity'))<=1))throw Error('Invalid layer opacity');}
  else throw Error('Unsupported OpenRaster stack element');
 }}visit(r,0);if(!layers)throw Error('OpenRaster has no layers');
 for(const path of ['mergedimage.png','Thumbnails/thumbnail.png']){if(!names.has(path))throw Error('Missing OpenRaster composite or thumbnail');paths.add(path);}
 for(const path of paths){const bytes=await a.read(path),info=pngInfo(bytes),h=info.chunks[0].data;if(info.animated||![8,16].includes(h[8]))throw Error('Invalid OpenRaster PNG sample representation');
  if(path==='mergedimage.png'&&(info.width!==width||info.height!==height))throw Error('OpenRaster composite dimensions do not match canvas');
  if(path==='Thumbnails/thumbnail.png'&&(h[8]!==8||h[12]!==0||info.width>256||info.height>256))throw Error('Invalid OpenRaster thumbnail');
  // Decode bounded images to reject corrupt layer data before inspection succeeds.
  if(info.width*info.height<=25000000)await verifyPngPixels(bytes,bytes);
  constraints.set(path,{bitDepths:path==='Thumbnails/thumbnail.png'?[8]:[8,16],interlace:path==='Thumbnails/thumbnail.png'?0:null});
 }
 return {imagePaths:[...paths],modes:['lossless'],imageConstraints:constraints,warnings:[]};
}
export function oraRepresentationAllowed(bytes,constraint){const h=pngInfo(bytes).chunks[0].data;return constraint.bitDepths.includes(h[8])&&(constraint.interlace===null||h[12]===constraint.interlace);}
