import {readArchive,rewriteArchive} from './archive.js';
import {validatePackage} from './package.js';
import {imageInfo,optimizeImage,verifyImage} from './images.js';
import {equal} from './png.js';
export async function inspectDocument(bytes){
 const a=await readArchive(bytes);try{
  const {mediaPaths}=await validatePackage(a);const images=[];
  for(const path of mediaPaths){const b=await a.read(path);let format;try{format=imageInfo(b,path).format;}catch{format='Unrecognized';}images.push({path,format,size:b.length});}
  return {images,entries:a.entries.length};
 }finally{await a.close();}
}
export async function optimizeDocument(bytes,onProgress=()=>{}){
 const a=await readArchive(bytes);try{
  const {mediaPaths}=await validatePackage(a),replacements=new Map(),images=[];let done=0;
  for(const path of mediaPaths){const src=await a.read(path),r=await optimizeImage(src,path);images.push({path,status:r.status,reason:r.reason,before:src.length,after:r.bytes.length});if(r.status==='optimized')replacements.set(path,r.bytes);onProgress({done:++done,total:mediaPaths.length,path});}
  if(!replacements.size)return {bytes,changed:false,images};
  const candidate=await rewriteArchive(a,replacements),b=await readArchive(candidate);
  try{
   await validatePackage(b);
   if(a.entries.length!==b.entries.length||a.entries.some(e=>!b.entries.some(f=>f.name===e.name)))throw Error('Output package entries changed');
   for(const e of a.entries){const src=await a.read(e.name),out=await b.read(e.name);if(replacements.has(e.name)){
    if(!equal(out,replacements.get(e.name)))throw Error('Output image mismatch');verifyImage(src,out,e.name);
   }else if(!equal(src,out))throw Error('Output changed a protected document part');}
  }finally{await b.close();}
  return candidate.length<bytes.length?{bytes:candidate,changed:true,images}:{bytes,changed:false,images:images.map(i=>({...i,status:i.status==='optimized'?'efficient':i.status,reason:i.status==='optimized'?'Original retained: complete package did not shrink':i.reason,after:i.before}))};
 }finally{await a.close();}
}
