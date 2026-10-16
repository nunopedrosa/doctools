const decoder=new TextDecoder('utf-8',{fatal:true});
const paxKeys=new Set(['path','size','mtime','atime','ctime','uid','gid','uname','gname','hdrcharset']);
function number(bytes){
 if(bytes[0]&128){let n=BigInt(bytes[0]&127);for(const b of bytes.subarray(1))n=n*256n+BigInt(b);if(n>250n*1024n*1024n)throw Error('TAR size limit exceeded');return Number(n);}
 const raw=decoder.decode(bytes).replace(/\0/g,'').trim();if(raw&&!/^[0-7]+$/.test(raw))throw Error('Invalid TAR numeric field');const n=raw?parseInt(raw,8):0;if(!Number.isSafeInteger(n)||n<0||n>250*1024*1024)throw Error('TAR size limit exceeded');return n;
}
export function validateTarHeaders(bytes){
 if(bytes.length<1024||bytes.length%512!==0)throw Error('Invalid or truncated TAR archive');let p=0,total=0,count=0;
 while(p+512<=bytes.length){const block=bytes.subarray(p,p+512);
  if(!block.some(v=>v!==0)){if(bytes.length-p<1024||bytes.subarray(p).some(v=>v!==0))throw Error('Unexpected or truncated TAR trailing data');return;}
  const expected=number(block.subarray(148,156)),actual=block.reduce((n,b,i)=>n+(i>=148&&i<156?32:b),0);if(expected!==actual)throw Error('Invalid TAR header checksum');
  const size=number(block.subarray(124,136)),end=p+512+Math.ceil(size/512)*512;if(end>bytes.length-1024)throw Error('Truncated TAR entry');
  const type=block[156];if(![0,48,53,120,103,76].includes(type))throw Error('TAR links and special files are not supported');
  total+=size;if(total>250*1024*1024||++count>10000)throw Error('Expanded TAR limit exceeded');
  if(type===120||type===103){
   const payload=bytes.subarray(p+512,p+512+size);let at=0;
   while(at<payload.length){const space=payload.indexOf(32,at);if(space<0)throw Error('Invalid TAR PAX metadata');const raw=decoder.decode(payload.subarray(at,space));if(!/^[0-9]+$/.test(raw))throw Error('Invalid TAR PAX record');const n=Number(raw),stop=at+n;if(!Number.isSafeInteger(n)||stop>payload.length||stop<=space+1||payload[stop-1]!==10)throw Error('Invalid TAR PAX length');const text=decoder.decode(payload.subarray(space+1,stop-1)),eq=text.indexOf('=');if(eq<1||!paxKeys.has(text.slice(0,eq)))throw Error('Unsupported TAR PAX metadata');if(text.startsWith('hdrcharset=')&&!['hdrcharset=UTF-8','hdrcharset=ISO-IR 10646 2000 UTF-8'].includes(text))throw Error('Unsupported TAR character encoding');at=stop;}
  }
  p=end;
 }
 throw Error('Truncated TAR end marker');
}
