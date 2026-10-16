import {openFile} from './format-loader.js';
export {formatForName as fileType} from './formats.js';
export async function inspectFile(bytes,name){const s=await openFile(bytes,name);try{return await s.inspect();}finally{await s.close();}}
export async function optimizeFile(bytes,name,onProgress=()=>{},options={}){const s=await openFile(bytes,name);try{return await s.optimize(options,onProgress);}finally{await s.close();}}
