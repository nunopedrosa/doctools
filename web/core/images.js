import {pngInfo,optimizePng,equal} from './png.js';
import {verifyPngPixels} from './png-pixels.js';
import {jpegInfo,optimizeJpeg,recompressJpeg} from './jpeg.js';
export function imageInfo(bytes,path){
 const ext=path.split('.').pop().toLowerCase();
 if(ext==='png')return {format:'PNG',...pngInfo(bytes)};
 if(ext==='jpg'||ext==='jpeg')return {format:'JPEG',...jpegInfo(bytes)};
 return {format:ext.toUpperCase(),unsupported:true};
}
export async function verifyImage(original,candidate,path,options={}){
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
  await verifyPngPixels(original,candidate,{colors:options.mode==='colors'});
 }else if(a.format==='JPEG'){
  const frameMatches=options.mode==='colors'?a.frame.length===b.frame.length&&a.frame.every((v,i)=>i>=8&&(i-8)%3===0||v===b.frame[i]):equal(a.frame,b.frame);
  if(!frameMatches||a.metadata.length!==b.metadata.length||a.metadata.some((v,i)=>!equal(v,b.metadata[i])))throw Error('JPEG frame or metadata changed');
 }
}
export async function optimizeImage(bytes,path,codecs={},options={}){
 const result={bytes,status:'unsupported',reason:'Format preserved unchanged'};let info;
 try{info=imageInfo(bytes,path);}catch(e){return {...result,reason:e.message};}
 Object.assign(result,{format:info.format,width:info.width,height:info.height});
 if(info.unsupported||info.animated||info.width*info.height>25000000||info.format==='JPEG'&&(info.components>3||info.precision!==8))return {...result,reason:'Unsupported variant or image exceeds 25 megapixels; preserved unchanged'};
 try{
  let best={...result,status:'efficient',reason:'Already efficient'};
  try{
   const candidate=await (info.format==='PNG'?(codecs.png||optimizePng):(codecs.jpeg||optimizeJpeg))(bytes);
   await verifyImage(bytes,candidate,path);
   if(candidate.length<bytes.length)best={...result,bytes:candidate,status:'optimized',reason:'Lossless optimization'};
  }catch(e){best={...result,status:'failed',reason:'Original retained: '+e.message};}
  if(options.mode==='colors'&&info.format==='PNG'){
   try{
    const {reducePngColors}=await import('./colors.js');
    const candidate=await reducePngColors(bytes,options.colors??128);
    await verifyImage(bytes,candidate,path,options);
    if(candidate.length<best.bytes.length)best={...result,bytes:candidate,status:'optimized',perceptual:true,reason:'Color reduction (up to '+(options.colors??128)+' colors); review preview'};
   }catch(e){best.reason+='; color reduction skipped: '+e.message;}
  }
  if(options.mode==='colors'&&info.format==='JPEG'){
   try{
    const candidate=await recompressJpeg(bytes,options.jpegQuality??70);
    await verifyImage(bytes,candidate,path,options);
    if(candidate.length<best.bytes.length)best={...result,bytes:candidate,status:'optimized',perceptual:true,reason:'JPEG quality '+(options.jpegQuality??70)+'; review preview'};
   }catch(e){best.reason+='; JPEG quality reduction skipped: '+e.message;}
  }
  return best;
 }catch(e){return {...result,status:'failed',reason:'Original retained: '+e.message};}
}
