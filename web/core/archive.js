import {ZipReader,ZipWriter,Uint8ArrayReader,Uint8ArrayWriter,configure} from '../vendor/zip.js';
import {LIMITS,checkLimit} from './limits.js';
configure({useWebWorkers:false});
export async function readArchive(bytes,custom={}){
 const limits={...LIMITS,...custom};checkLimit(bytes.length,limits.input,'Input file');
 if(bytes[0]===0xd0&&bytes[1]===0xcf)throw Error('Encrypted or legacy Office container: save an unencrypted DOCX first');
 const reader=new ZipReader(new Uint8ArrayReader(bytes),{strictness:'strict',checkCrc32:true,checkOverlappingEntry:true});
 const entries=[],byName=new Map();let declared=0,actual=0;const measured=new Set();
 try{
  for await(const e of reader.getEntriesGenerator()){
   checkLimit(entries.length+1,limits.entries,'Archive entry count');
   const name=e.filename;
   if(!name||name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.split('/').some(p=>p==='..'||p==='.')||/^[A-Za-z]:/.test(name)||byName.has(name))throw Error('Unsafe or duplicate archive path');
   if(e.encrypted)throw Error('Encrypted ZIP entries are not supported');
   if(![0,8].includes(e.compressionMethod))throw Error('Unsupported ZIP compression');
   checkLimit(e.uncompressedSize,limits.entry,'Expanded entry');declared+=e.uncompressedSize;checkLimit(declared,limits.total,'Expanded package');
   entries.push({name,size:e.uncompressedSize,directory:e.directory,metadata:e});byName.set(name,e);
  }
  async function read(name,raw=false){
   const e=byName.get(name);if(!e)throw Error('Missing package part: '+name);
   let size=0;const chunks=[];
   const stream=new WritableStream({write(chunk){size+=chunk.length;checkLimit(size,raw?limits.input:limits.entry,'Expanded entry');if(!raw&&!measured.has(name))checkLimit(actual+size,limits.total,'Expanded package');chunks.push(chunk.slice());}});
   await e.getData(stream,{passThrough:raw,checkCrc32:!raw,checkOverlappingEntry:true,strictness:'strict'});
   if(!raw){if(size!==e.uncompressedSize)throw Error('Archive expanded size mismatch');if(!measured.has(name)){actual+=size;measured.add(name);}}
   const out=new Uint8Array(size);let p=0;for(const c of chunks){out.set(c,p);p+=c.length;}return out;
  }
  const archive={entries,comment:reader.comment,read,raw:name=>read(name,true),close:()=>reader.close()};
  // Validate every entry, including unsupported media and opaque embedded objects, before inspection succeeds.
  for(const e of entries)await read(e.name);
  return archive;
 }catch(error){await reader.close();throw error;}
}
export async function rewriteArchive(archive,replacements){
 const writer=new ZipWriter(new Uint8ArrayWriter(),{useWebWorkers:false});
 for(const e of archive.entries){
  const replacement=replacements.get(e.name);
  const source=replacement||await archive.raw(e.name);
  await writer.add(e.name,new Uint8ArrayReader(source),replacement?{
   entry:e.metadata,level:6,
  }:{entry:e.metadata,passThrough:true});
 }
 return writer.close(archive.comment);
}
