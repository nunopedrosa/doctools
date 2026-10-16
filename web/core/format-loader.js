import {formatForName} from './formats.js';
import {checkLimit} from './limits.js';
export async function openFile(bytes,name){
 const format=formatForName(name);checkLimit(bytes.length,(format.kind==='image'?50:100)*1024*1024,'Input file');
 if(format.kind==='image'){
  const {openImageSession}=await import('./image-session.js');const s=await openImageSession(bytes,format);return namedSession(s,name);
 }
 const [{openZipSession},{validatePackage}]=await Promise.all([import('./zip-session.js'),import('./package.js')]);
 return openZipSession(bytes,format,validatePackage);
}
function namedSession(session,name){
 const inspect=session.inspect.bind(session),optimize=session.optimize.bind(session);
 session.inspect=async()=>{const r=await inspect();r.images=r.images.map(i=>({...i,path:name}));return r;};
 session.optimize=async(...args)=>{const r=await optimize(...args);r.images=r.images.map(i=>({...i,path:name}));return r;};return session;
}
