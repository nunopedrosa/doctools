import {pngInfo,optimizePng,equal} from './png.js';
import {verifyPngPixels} from './png-pixels.js';
import {jpegInfo,optimizeJpeg} from './jpeg.js';
export function imageInfo(bytes,path){
 const ext=path.split('.').pop().toLowerCase();
 if(ext==='png')return {format:'PNG',...pngInfo(bytes)};
 if(ext==='jpg'||ext==='jpeg')return {format:'JPEG',...jpegInfo(bytes)};
 return {format:ext.toUpperCase(),unsupported:true};
}
export async function verifyImage(original,candidate,path){
 const a=imageInfo(original,path),b=imageInfo(candidate,path);
 if(a.width!==b.width||a.height!==b.height)throw Error('Image dimensions changed');
 if(a.format==='PNG'){
  if([2,6].includes(a.chunks[0].data[9])){
   const palette=a.chunks.find(c=>c.type==='PLTE');
   if(palette&&(![2,6].includes(b.chunks[0].data[9])||!equal(palette.raw,b.chunks.find(c=>c.type==='PLTE')?.raw||new Uint8Array())))throw Error('PNG suggested palette metadata changed');
  }
  const structural=new Set(['IHDR','PLTE','tRNS','IDAT','IEND']);
  const left=a.chunks.filter(c=>!structural.has(c.type)),right=b.chunks.filter(c=>!structural.has(c.type));
  if(left.length!==right.length||left.some((c,i)=>!equal(c.raw,right[i].raw)))throw Error('PNG metadata changed');
  await verifyPngPixels(original,candidate);
 }else if(a.format==='JPEG'){
  if(!equal(a.frame,b.frame)||a.metadata.length!==b.metadata.length||a.metadata.some((v,i)=>!equal(v,b.metadata[i])))throw Error('JPEG frame or metadata changed');
 }
}
export async function optimizeImage(bytes,path,codecs={}){
 const result={bytes,status:'unsupported',reason:'Format preserved unchanged'};let info;
 try{info=imageInfo(bytes,path);}catch(e){return {...result,reason:e.message};}
 Object.assign(result,{format:info.format,width:info.width,height:info.height});
 if(info.unsupported||info.animated||info.width*info.height>25000000||info.format==='JPEG'&&(info.components>3||info.precision!==8))return {...result,reason:'Unsupported variant or image exceeds 25 megapixels; preserved unchanged'};
 try{
  const candidate=await (info.format==='PNG'?(codecs.png||optimizePng):(codecs.jpeg||optimizeJpeg))(bytes);
  await verifyImage(bytes,candidate,path);
  return candidate.length<bytes.length?{...result,bytes:candidate,status:'optimized',reason:'Lossless optimization'}:{...result,status:'efficient',reason:'Already efficient'};
 }catch(e){return {...result,status:'failed',reason:'Original retained: '+e.message};}
}
