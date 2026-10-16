import {inspectFile,optimizeFile} from './files.js';
export const inspectDocument=bytes=>inspectFile(bytes,'document.docx');
export const optimizeDocument=(bytes,onProgress=()=>{},options={})=>optimizeFile(bytes,'document.docx',onProgress,options);
