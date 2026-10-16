import {boundedZipWriter,checkZipHeaderBudget} from './bounded-writer.js';
import {validateTarHeaders} from './tar-headers.js';
import {validateRarHeaders,updateRarCrc} from './rar-headers.js';
import {LIMITS,checkLimit} from './limits.js';import {safeEntryName} from './paths.js';
let ready;
const decoder=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
async function initialize(){if(!ready)ready=(async()=>{const {default:create}=await import('../vendor/archive.js'),url=new URL('../vendor/archive.wasm',import.meta.url);return create(url.protocol==='file:'?{wasmBinary:new Uint8Array(await (await import('node:fs/promises')).readFile(url))}:{});})();return ready;}
function text(m,p){if(!p)return '';const end=m.HEAPU8.indexOf(0,p);if(end<0)throw Error('Invalid native string');return decoder.decode(m.HEAPU8.subarray(p,end));}
function signature(bytes,container){
 if(container==='rar'){if(bytes.length<8||!([82,97,114,33,26,7].every((v,i)=>bytes[i]===v))||![0,1].includes(bytes[6]))throw Error('Invalid RAR signature');}
 else if(container==='7z'){if(bytes.length<32||![55,122,188,175,39,28].every((v,i)=>bytes[i]===v))throw Error('Invalid 7z signature');}
 else if(container==='tar'){
  if(bytes.length<1024||bytes.length%512!==0)throw Error('Invalid or truncated TAR archive');
  const first=bytes.subarray(0,512);if(first.some(v=>v!==0)){
   const raw=decoder.decode(first.subarray(148,156)).replace(/\0/g,'').trim();if(!/^[0-7]+$/.test(raw))throw Error('Invalid TAR checksum');
   const sum=first.reduce((n,b,i)=>n+(i>=148&&i<156?32:b),0);if(sum!==parseInt(raw,8))throw Error('Invalid TAR checksum');
  }
  if(bytes.subarray(-1024).some(v=>v!==0))throw Error('Truncated TAR end marker');
 }else throw Error('Unsupported archive container');
}
export async function openNativeArchive(bytes,container,custom={}){
 const limits={...LIMITS,...custom};checkLimit(bytes.length,limits.input,'Input file');signature(bytes,container);
 const rar=container==='rar'?validateRarHeaders(bytes):null;
 if(container==='tar')validateTarHeaders(bytes);
 const m=await initialize(),ptr=m._malloc(bytes.length);if(!ptr)throw Error('Archive memory limit reached');m.HEAPU8.set(bytes,ptr);
 const format={tar:1,'7z':2,rar:3}[container],entries=[],byName=new Map();let h=0,cursor=0,closed=false,total=0;
 const error=()=>Error(text(m,m._ds_arc_error(h))||'Archive processing failed');
 const check=()=>{if(closed)throw Error('Archive session is closed');};
 function reset(){if(h)m._ds_arc_close(h);h=m._ds_arc_open(ptr,bytes.length,format);cursor=0;total=0;if(!h)throw error();}
 function metadata(){const e=JSON.parse(text(m,m._ds_arc_entry_json(h)));safeEntryName(e.name);checkLimit(encoder.encode(e.name).length,65535,'Archive name');checkLimit(e.size,limits.entry,'Expanded entry');for(const key of ['mode','uid','gid','mtime','mtimeNs','atime','atimeNs','ctime','ctimeNs','birthtime','birthtimeNs','times'])if(!Number.isSafeInteger(e[key]))throw Error('Unsupported archive metadata range');return e;}
 function consume(collect,index){let size=0,checksum=0;const chunks=[];for(;;){const n=m._ds_arc_read_chunk(h);if(n<0)throw error();if(!n)break;size+=n;total+=n;checkLimit(size,limits.entry,'Expanded entry');checkLimit(total,limits.total,'Expanded package');const chunk=m.HEAPU8.subarray(m._ds_arc_chunk_data(h),m._ds_arc_chunk_data(h)+n);if(rar)checksum=updateRarCrc(checksum,chunk);if(collect)chunks.push(chunk.slice());}if(rar){const expected=rar.entries[index];if(!expected||expected.size!==size||expected.crc32!==null&&expected.crc32!==checksum)throw Error('RAR file CRC or size mismatch');}if(!collect)return size;const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;}
 async function close(){if(closed)return;closed=true;if(h)m._ds_arc_close(h);h=0;m._free(ptr);}
 try{
  reset();let declared=0;for(;;){const n=m._ds_arc_next(h);if(n<0)throw error();if(!n)break;checkLimit(entries.length+1,limits.entries,'Archive entry count');const meta=metadata();if(byName.has(meta.name))throw Error('Duplicate archive path');declared+=meta.size;checkLimit(declared,limits.total,'Expanded package');const actual=consume(false,cursor);if(actual!==meta.size)throw Error('Archive expanded size mismatch');const e={name:meta.name,size:meta.size,directory:meta.directory,metadata:Object.freeze(meta)};byName.set(meta.name,entries.length);entries.push(Object.freeze(e));cursor++;}
 if(rar&&entries.length!==rar.entries.length)throw Error('RAR entry inventory mismatch');
 }catch(e){await close();throw e;}
 async function read(name){check();const target=byName.get(name);if(target===undefined)throw Error('Missing archive entry');if(target<cursor)reset();while(cursor<=target){const n=m._ds_arc_next(h);if(n!==1)throw error();const meta=metadata();if(meta.name!==entries[cursor].name)throw Error('Archive entry changed');const wanted=cursor===target;cursor++;const value=consume(wanted,cursor-1);if(wanted)return value;}throw Error('Missing archive entry');}
 function string(value,allocated){const b=encoder.encode(value+'\0'),p=m._malloc(b.length);if(!p)throw Error('Archive memory limit reached');m.HEAPU8.set(b,p);allocated.push(p);return p;}
 async function rewrite(replacements,outputContainer){
  check();if(outputContainer==='zip'){
   checkZipHeaderBudget(entries,limits.total);const {ZipWriter,Uint8ArrayReader}=await import('../vendor/zip.js');const writer=new ZipWriter(boundedZipWriter(limits.total),{useWebWorkers:false});
   for(const e of entries){const src=replacements.get(e.name)||await read(e.name),md=e.metadata;
    await writer.add(e.name,new Uint8ArrayReader(src),{directory:e.directory,lastModDate:new Date(Math.max(315532800,md.times&1?md.mtime:315532800)*1000),externalFileAttributes:(md.mode<<16)>>>0,uid:md.uid,gid:md.gid,level:6});
   }
   const out=await writer.close();checkLimit(out.length,limits.total,'Archive output');return out;
  }
  const kind={tar:1,'7z':2}[outputContainer];if(!kind)throw Error('Unsupported output archive format');const w=m._ds_arc_writer_open(kind);if(!w)throw Error(text(m,m._ds_arc_error(0))||'Archive writing failed');
  const writerError=()=>Error(text(m,m._ds_arc_error(w))||'Archive writing failed');
  try{
   for(const e of entries){const src=replacements.get(e.name)||await read(e.name),md=e.metadata,pointers=[];
    try{const pName=string(e.name,pointers),pU=string(md.uname,pointers),pG=string(md.gname,pointers);
     if(m._ds_arc_writer_header(w,pName,src.length,md.mode,md.uid,md.gid,pU,pG,md.times,md.mtime,md.mtimeNs,md.atime,md.atimeNs,md.ctime,md.ctimeNs,md.birthtime,md.birthtimeNs)<0)throw writerError();
     const p=m._malloc(65536);if(!p)throw Error('Archive memory limit reached');pointers.push(p);
     for(let at=0;at<src.length;at+=65536){const c=src.subarray(at,at+65536);m.HEAPU8.set(c,p);if(m._ds_arc_writer_chunk(w,p,c.length)<0)throw writerError();}
    }finally{for(const p of pointers)m._free(p);}
   }
   if(m._ds_arc_writer_finish(w)<0)throw writerError();const n=m._ds_arc_result_size(w);checkLimit(n,limits.total,'Archive output');return m.HEAPU8.slice(m._ds_arc_result_data(w),m._ds_arc_result_data(w)+n);
  }finally{m._ds_arc_close(w);}
 }
 return {entries:Object.freeze(entries),read,rewrite,close};
}
