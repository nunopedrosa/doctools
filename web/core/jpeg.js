import createJpeg from '../vendor/jpeg.js';
let ready;
export function jpegInfo(bytes){
 if(bytes[0]!==255||bytes[1]!==216)throw Error('Invalid JPEG signature');
 const metadata=[];let width,height,components,precision,frame,ended=false;
 for(let p=2;p<bytes.length;){
  if(bytes[p++]!==255)throw Error('Invalid JPEG marker');while(bytes[p]===255)p++;
  const marker=bytes[p++];if(marker===217){ended=true;break;}
  if(p+2>bytes.length)throw Error('Truncated JPEG');const n=(bytes[p]<<8)|bytes[p+1];
  if(n<2||p+n>bytes.length)throw Error('Truncated JPEG segment');
  if(marker>=224&&marker<=239||marker===254)metadata.push(bytes.slice(p-2,p+n));
  if([192,193,194].includes(marker)){if(n<8||n!==8+3*bytes[p+7])throw Error('Invalid JPEG frame');precision=bytes[p+2];height=(bytes[p+3]<<8)|bytes[p+4];width=(bytes[p+5]<<8)|bytes[p+6];components=bytes[p+7];frame=bytes.slice(p+2,p+n);}
  p+=n;
  if(marker===218){
   // Walk entropy bytes without treating stuffed FF bytes or restart markers as
   // segments. Metadata is also legal between scans and before the final EOI.
   while(p<bytes.length){
    const next=bytes.indexOf(255,p);if(next<0){p=bytes.length;break;}p=next;
    let q=p+1;while(bytes[q]===255)q++;
    if(bytes[q]===0||bytes[q]>=208&&bytes[q]<=215){p=q+1;continue;}
    break;
   }
  }
 }
 if(!ended)throw Error('Truncated JPEG: missing end marker');
 if(!width||!height)throw Error('Unsupported JPEG frame');return {width,height,components,precision,metadata,frame};
}
async function initialize(){
 if(!ready)ready=(async()=>{
  const url=new URL('../vendor/jpeg.wasm',import.meta.url);
  return createJpeg(url.protocol==='file:'?{wasmBinary:new Uint8Array(await (await import('node:fs/promises')).readFile(url))}:{});
 })();return ready;
}
export async function optimizeJpeg(bytes){
 const m=await initialize(),p=m._malloc(bytes.length);if(!p)throw Error('JPEG allocation failed');
 try{m.HEAPU8.set(bytes,p);let best=bytes;
  for(const progressive of [0,1]){if(!m._optimize_jpeg(p,bytes.length,progressive))throw Error('JPEG optimizer rejected image');const result=m.HEAPU8.slice(m._result_data(),m._result_data()+m._result_size());if(result.length<best.length)best=result;}
  return best;
 }finally{m._free(p);}
}
export async function recompressJpeg(bytes,quality=70){
 if(!Number.isInteger(quality)||quality<1||quality>95)throw Error('JPEG quality must be an integer from 1 to 95');
 const m=await initialize(),p=m._malloc(bytes.length);if(!p)throw Error('JPEG allocation failed');
 try{
  m.HEAPU8.set(bytes,p);
  if(!m._recompress_jpeg(p,bytes.length,quality))throw Error('JPEG quality reduction rejected unsupported or damaged image');
  const result=m.HEAPU8.slice(m._result_data(),m._result_data()+m._result_size());
  const original=jpegInfo(bytes).metadata,retained=jpegInfo(result).metadata;
  if(retained.length>original.length||retained.some((v,i)=>v.length!==original[i].length||!v.every((b,j)=>b===original[i][j])))throw Error('JPEG metadata changed during recompression');
  if(retained.length===original.length)return result;
  // Baseline decoding encounters some markers only after scanlines are read.
  // Restore that original metadata tail before EOI, preserving marker order.
  const tail=original.slice(retained.length),out=new Uint8Array(result.length+tail.reduce((n,v)=>n+v.length,0));
  out.set(result.subarray(0,-2));let offset=result.length-2;
  for(const marker of tail){out.set(marker,offset);offset+=marker.length;}out.set([255,217],offset);return out;
 }finally{m._free(p);}
}
