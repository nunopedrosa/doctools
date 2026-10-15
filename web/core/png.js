import init, {optimise} from '../vendor/oxipng.js';
let ready;
export const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export function pngChunks(bytes) {
 if(bytes.length<33 || !equal(bytes.slice(0,8),new Uint8Array([137,80,78,71,13,10,26,10]))) throw Error('Invalid PNG signature');
 const chunks=[];let p=8;
 while(p<bytes.length){
  if(p+12>bytes.length)throw Error('Truncated PNG');
  const n=new DataView(bytes.buffer,bytes.byteOffset+p,4).getUint32(0);
  if(n>bytes.length-p-12)throw Error('Invalid PNG chunk');
  const type=String.fromCharCode(...bytes.slice(p+4,p+8));
  chunks.push({type,data:bytes.slice(p+8,p+8+n),raw:bytes.slice(p,p+n+12)});p+=n+12;
  if(type==='IEND')break;
 }
 if(p!==bytes.length || chunks.at(-1)?.type!=='IEND' || chunks[0]?.type!=='IHDR')throw Error('Invalid PNG structure');
 return chunks;
}
export function pngInfo(bytes){const chunks=pngChunks(bytes),h=chunks[0].data,v=new DataView(h.buffer,h.byteOffset,h.byteLength);return {width:v.getUint32(0),height:v.getUint32(4),animated:chunks.some(c=>c.type==='acTL'),chunks};}
export async function optimizePng(bytes){
 if(!ready)ready=(async()=>{
  const url=new URL('../vendor/squoosh_oxipng_bg.wasm',import.meta.url);
  const binary=url.protocol==='file:'?new Uint8Array(await (await import('node:fs/promises')).readFile(url)):await (await fetch(url)).arrayBuffer();
  await init(binary);
 })();await ready;
 const original=pngInfo(bytes),out=optimise(bytes,2,false,false),candidate=pngInfo(out);
 // Conservatively retain the original when optimization changes its sample/palette representation.
 if(!equal(original.chunks[0].data.slice(0,10),candidate.chunks[0].data.slice(0,10)))throw Error('Sample representation changed; original retained');
 for(const type of ['PLTE','tRNS']){
  const a=original.chunks.find(c=>c.type===type)?.data||new Uint8Array(),b=candidate.chunks.find(c=>c.type===type)?.data||new Uint8Array();
  if(!equal(a,b))throw Error('Palette representation changed; original retained');
 }
 // Keep all original non-IDAT chunks in their original order and positions relative to image data.
 const idat=candidate.chunks.filter(c=>c.type==='IDAT');let inserted=false;const parts=[bytes.slice(0,8)];
 for(const c of original.chunks){if(c.type==='IDAT'){if(!inserted){parts.push(...idat.map(c=>c.raw));inserted=true;}}else parts.push(c.raw);}
 const result=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;
}
