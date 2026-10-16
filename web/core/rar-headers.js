// Header-only preflight supplements libarchive: reject volume/encryption flags
// even when a volume happens to contain individually complete ordinary files.
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function updateRarCrc(previous,bytes){let n=(previous^0xffffffff)>>>0;for(const v of bytes)n=table[(n^v)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
const crc=b=>updateRarCrc(0,b);
export function validateRarHeaders(bytes){
 const fail=()=>{throw Error('Invalid or truncated RAR header');};
 if(bytes.length<8||![82,97,114,33,26,7].every((n,i)=>bytes[i]===n))fail();
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),five=bytes[6]===1;if(!five&&bytes[6]!==0)fail();if(five&&bytes[7]!==0)fail();
 let p=five?8:7,main=false,ended=false;const entries=[];
 while(p<bytes.length){
  if(five){
   if(p+5>bytes.length)fail();let q=p+4;
   const vint=()=>{let v=0,shift=0;for(let i=0;i<10;i++){if(q>=bytes.length)fail();const b=bytes[q++];v+=(b&127)*2**shift;if(!Number.isSafeInteger(v))fail();if(!(b&128))return v;shift+=7;}fail();};
   const size=vint(),end=q+size;if(size>2097152||end>bytes.length||end<q)fail();
   if(crc(bytes.subarray(p+4,end))!==view.getUint32(p,true))throw Error('Damaged RAR header CRC');
   const kind=vint(),flags=vint();if(flags&24)throw Error('Multipart RAR volumes are not supported');
   if(flags&1)vint();const dataSize=flags&2?vint():0;if(q>end||dataSize>bytes.length-end)fail();
   if(kind===4)throw Error('Encrypted RAR archives are not supported');
   if(kind===1){if(main)fail();main=true;const archiveFlags=vint();if(archiveFlags&3)throw Error('Multipart RAR volumes are not supported');}
   else if(kind===2){
    const fileFlags=vint(),unpacked=vint();vint();if(fileFlags&8)throw Error('Unknown-size RAR entries are not supported');if(fileFlags&2)q+=4;let checksum=null;if(fileFlags&4){if(q+4>end)fail();checksum=view.getUint32(q,true);q+=4;}if(unpacked>0&&checksum===null)throw Error('RAR entries without a CRC are not supported');entries.push({size:unpacked,crc32:checksum,directory:!!(fileFlags&1)});
    const compression=vint(),version=compression&63;if(version>0)throw Error('Unsupported RAR compression version');
    if(compression&0x380){const dictionary=131072*2**((compression>>>10)&31);if(dictionary>268435456)throw Error('RAR dictionary memory limit exceeded');}
    if(q>end)fail();
   }else if(kind===5){if(vint()&1)throw Error('Multipart RAR volumes are not supported');ended=true;}
   else if(kind!==3)throw Error('Unsupported RAR header type');
   if(q>end)fail();p=end+dataSize;
  }else{
   if(p+7>bytes.length)fail();const kind=bytes[p+2],flags=view.getUint16(p+3,true),size=view.getUint16(p+5,true),end=p+size;
   if(size<7||end>bytes.length)fail();if((crc(bytes.subarray(p+2,end))&65535)!==view.getUint16(p,true))throw Error('Damaged RAR header CRC');
   let dataSize=0;if(flags&0x8000){if(size<11)fail();dataSize=view.getUint32(p+7,true);}
   if(kind===0x73){if(main)fail();main=true;if(flags&1)throw Error('Multipart RAR volumes are not supported');if(flags&0x80)throw Error('Encrypted RAR archives are not supported');}
   else if(kind===0x74){if(size<32)fail();entries.push({size:view.getUint32(p+11,true),crc32:view.getUint32(p+16,true),directory:(flags&0xe0)===0xe0});if(flags&3)throw Error('Multipart RAR volumes are not supported');if(flags&4)throw Error('Encrypted RAR entries are not supported');if(flags&0x100){if(size<40)fail();if(view.getUint32(p+32,true))throw Error('RAR data size limit exceeded');}}
   else if(kind===0x7b){if(flags&1)throw Error('Multipart RAR volumes are not supported');ended=true;}
   else if(kind<0x75||kind>0x7a)throw Error('Unsupported RAR header type');
   if(dataSize>bytes.length-end)fail();p=end+dataSize;
  }
  if(ended){if(p!==bytes.length)throw Error('Unexpected data after RAR end header');break;}
 }
 if(!main||five&&!ended)fail();return {entries};
}
