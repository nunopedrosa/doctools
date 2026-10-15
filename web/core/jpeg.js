import createJpeg from '../vendor/jpeg.js';
let ready;
export function jpegInfo(bytes){
 if(bytes[0]!==255||bytes[1]!==216)throw Error('Invalid JPEG signature');
 const metadata=[];let width,height,components,precision,frame;
 for(let p=2;p<bytes.length;){
  if(bytes[p++]!==255)throw Error('Invalid JPEG marker');while(bytes[p]===255)p++;
  const marker=bytes[p++];if(marker===217)break;
  if(marker===218)break;
  if(p+2>bytes.length)throw Error('Truncated JPEG');const n=(bytes[p]<<8)|bytes[p+1];
  if(n<2||p+n>bytes.length)throw Error('Truncated JPEG segment');
  if(marker>=224&&marker<=239||marker===254)metadata.push(bytes.slice(p-2,p+n));
  if([192,193,194].includes(marker)){precision=bytes[p+2];height=(bytes[p+3]<<8)|bytes[p+4];width=(bytes[p+5]<<8)|bytes[p+6];components=bytes[p+7];frame=bytes.slice(p+2,p+n);}
  p+=n;
 }
 if(!width||!height)throw Error('Unsupported JPEG frame');return {width,height,components,precision,metadata,frame};
}
export async function optimizeJpeg(bytes){
 if(!ready)ready=(async()=>{
  const url=new URL('../vendor/jpeg.wasm',import.meta.url);
  return createJpeg(url.protocol==='file:'?{wasmBinary:new Uint8Array(await (await import('node:fs/promises')).readFile(url))}:{});
 })();const m=await ready,p=m._malloc(bytes.length);if(!p)throw Error('JPEG allocation failed');
 try{m.HEAPU8.set(bytes,p);let best=bytes;
  for(const progressive of [0,1]){if(!m._optimize_jpeg(p,bytes.length,progressive))throw Error('JPEG optimizer rejected image');const result=m.HEAPU8.slice(m._result_data(),m._result_data()+m._result_size());if(result.length<best.length)best=result;}
  return best;
 }finally{m._free(p);}
}
