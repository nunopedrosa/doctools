import {formatForName} from './formats.js';
import {checkLimit} from './limits.js';
export async function openFile(bytes,name){
 const format=formatForName(name);checkLimit(bytes.length,(format.kind==='image'?50:100)*1024*1024,'Input file');
 if(format.family==='pdf')return (await import('./pdf.js')).openPdfSession(bytes,format);
 if(format.kind==='image'){
  const {openImageSession}=await import('./image-session.js');const s=await openImageSession(bytes,format);return namedSession(s,name);
 }
 if(['cbr','cb7','cbt','tar','7z'].includes(format.extension))return (await import('./archive-session.js')).openArchiveSession(bytes,format);
 const {openZipSession}=await import('./zip-session.js');
 if(['cbz','zip'].includes(format.extension))return openZipSession(bytes,format,(await import('./collections.js')).validateCollection);
 if(format.family==='ora')return openZipSession(bytes,format,(await import('./ora.js')).validateOra);
 if(format.family==='odf')return openZipSession(bytes,format,(await import('./odf.js')).validateOdf);
 if(format.family==='epub')return openZipSession(bytes,format,(await import('./epub.js')).validateEpub);
 const validator=format.family==='kmz'?(await import('./kmz.js')).validateKmz:(await import('./office.js')).validateOffice;
 return openZipSession(bytes,format,validator);
}
function namedSession(session,name){
 const inspect=session.inspect.bind(session),optimize=session.optimize.bind(session);
 session.inspect=async()=>{const r=await inspect();r.images=r.images.map(i=>({...i,path:name}));return r;};
 session.optimize=async(...args)=>{const r=await optimize(...args);r.images=r.images.map(i=>({...i,path:name}));return r;};return session;
}
