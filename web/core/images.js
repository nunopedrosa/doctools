import {pngInfo,optimizePng,equal} from './png.js';
import {jpegInfo,optimizeJpeg} from './jpeg.js';
export function imageInfo(bytes,path){
 const ext=path.split('.').pop().toLowerCase();
 if(ext==='png')return {format:'PNG',...pngInfo(bytes)};
 if(ext==='jpg'||ext==='jpeg')return {format:'JPEG',...jpegInfo(bytes)};
 return {format:ext.toUpperCase(),unsupported:true};
}
export function verifyImage(original,candidate,path){
 const a=imageInfo(original,path),b=imageInfo(candidate,path);
 if(a.width!==b.width||a.height!==b.height)throw Error('Image dimensions changed');
 if(a.format==='PNG'){
  const left=a.chunks.filter(c=>c.type!=='IDAT'),right=b.chunks.filter(c=>c.type!=='IDAT');
  if(left.length!==right.length||left.some((c,i)=>!equal(c.raw,right[i].raw)))throw Error('PNG metadata changed');
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
  verifyImage(bytes,candidate,path);
  return candidate.length<bytes.length?{...result,bytes:candidate,status:'optimized',reason:'Lossless optimization'}:{...result,status:'efficient',reason:'Already efficient'};
 }catch(e){return {...result,status:'failed',reason:'Original retained: '+e.message};}
}
