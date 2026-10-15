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
 const original=pngInfo(bytes),out=optimise(bytes,2,original.chunks[0].data[12]===1,false),candidate=pngInfo(out);
 const layoutChanged=['IHDR','PLTE','tRNS'].some(type=>{
  const a=original.chunks.find(c=>c.type===type)?.data||new Uint8Array(),b=candidate.chunks.find(c=>c.type===type)?.data||new Uint8Array();return !equal(a,b);
 });
 if(layoutChanged){
  if([2,6].includes(original.chunks[0].data[9])&&original.chunks.some(c=>c.type==='PLTE'))throw Error('Suggested PNG palette requires original representation');
  if(original.chunks.some(c=>['bKGD','sBIT','hIST','pCAL'].includes(c.type)))throw Error('Representation-dependent PNG metadata; original retained');
  const gray=type=>type===0||type===4;
  if(original.chunks.some(c=>c.type==='iCCP')&&gray(original.chunks[0].data[9])!==gray(candidate.chunks[0].data[9]))throw Error('Color profile requires original sample representation');
  const known=new Set(['IHDR','PLTE','tRNS','IDAT','IEND','cHRM','gAMA','iCCP','sRGB','cICP','mDCV','cLLI','eXIf','pHYs','tEXt','zTXt','iTXt','tIME','oFFs','sCAL','sTER']);
  if(original.chunks.some(c=>!known.has(c.type)&&c.type[3]===c.type[3].toUpperCase()))throw Error('Unknown PNG metadata requires original representation');
 }
 // IHDR/PLTE/tRNS describe the compressed samples, so use them together from
 // the candidate. Preserve every other original chunk, including its payload.
 const structural=new Set(['IHDR','PLTE','tRNS','IDAT','IEND']);
 const before=[],after=[];let seenData=false;
 for(const c of original.chunks){if(c.type==='IDAT')seenData=true;else if(!structural.has(c.type))(seenData?after:before).push(c.raw);}
 let parts;
 if(!layoutChanged){
  parts=[bytes.slice(0,8)];let inserted=false;
  for(const c of original.chunks){if(c.type==='IDAT'){if(!inserted){parts.push(...candidate.chunks.filter(c=>c.type==='IDAT').map(c=>c.raw));inserted=true;}}else parts.push(c.raw);}
 }else parts=[bytes.slice(0,8),candidate.chunks[0].raw,...before,...candidate.chunks.filter(c=>['PLTE','tRNS','IDAT'].includes(c.type)).map(c=>c.raw),...after,candidate.chunks.at(-1).raw];
 const result=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;
}
