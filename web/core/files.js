import {inspectDocument,optimizeDocument} from './document.js';
import {imageInfo,optimizeImage} from './images.js';
import {fileType} from './file-types.js';
export {fileType} from './file-types.js';
export async function inspectFile(bytes,name){
 const type=fileType(name),limit=(type.kind==='image'?50:100)*1024*1024;
 if(bytes.length>limit)throw Error('This file exceeds the '+(type.kind==='image'?50:100)+' MiB input limit.');
 if(type.kind==='document')return {...type,...await inspectDocument(bytes)};
 const info=imageInfo(bytes,name);
 if(!info.width||!info.height||info.width*info.height>25000000)throw Error('Single images must be at most 25 megapixels.');
 return {...type,images:[{path:name,format:info.format,width:info.width,height:info.height,size:bytes.length}]};
}
export async function optimizeFile(bytes,name,onProgress=()=>{},options={}){
 const type=fileType(name);
 if(type.kind==='document')return {...type,...await optimizeDocument(bytes,onProgress,options)};
 await inspectFile(bytes,name);
 const r=await optimizeImage(bytes,name,{},options);
 if(r.status==='failed')throw Error(r.reason);
 onProgress({done:1,total:1,path:name});
 const changed=r.status==='optimized';
 return {...type,bytes:r.bytes,changed,images:[{path:name,status:r.status,reason:r.reason,perceptual:!!r.perceptual,previewable:changed,before:bytes.length,after:r.bytes.length}]};
}
