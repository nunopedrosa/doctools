import init,{decode,decode_rgba16} from '../vendor/png-decode.js';
let ready;
async function initialize(){
 if(!ready)ready=(async()=>{
  const url=new URL('../vendor/squoosh_png_bg.wasm',import.meta.url);
  const binary=url.protocol==='file:'?new Uint8Array(await (await import('node:fs/promises')).readFile(url)):await (await fetch(url)).arrayBuffer();
  await init(binary);
 })();await ready;
}
export async function decodePngRgba(bytes){await initialize();return decode(bytes);}
export async function verifyPngPixels(original,candidate,{colors=false}={}){
 await initialize();
 // Compare unpremultiplied samples, including RGB under zero alpha. Use 16-bit
 // decoding whenever either representation has 16-bit samples; no rounding to 8-bit.
 const wide=original[24]===16||candidate[24]===16;
 const left=wide?decode_rgba16(original):decode(original);
 let pixels,width,height;
 try{pixels=wide?left.data.slice():left.data;width=left.width;height=left.height;}finally{if(wide)left.free();}
 const right=wide?decode_rgba16(candidate):decode(candidate);
 try{
  const other=right.data;
  if(width!==right.width||height!==right.height||pixels.length!==other.length)throw Error('PNG dimensions changed');
  if(colors){
   if(wide)throw Error('Color reduction does not support 16-bit PNG');
   for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==other[i])throw Error('PNG transparency changed; original retained');
  }else if(!pixels.every((v,i)=>v===other[i]))throw Error('PNG pixel values changed; original retained');
 }finally{if(wide)right.free();}
}
