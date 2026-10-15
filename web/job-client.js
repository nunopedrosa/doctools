import {fileType} from './core/file-types.js';
export function createJobClient(onMessage){
 let worker=null,id=0;
 const clear=()=>{id++;worker?.terminate();worker=null;};
 return {
  async inspect(file){
   clear();const jobId=id;
   try{
    const type=fileType(file.name),limit=type.kind==='image'?50:100;
    if(file.size>limit*1024*1024)throw Error('This file exceeds the '+limit+' MiB input limit.');
    worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{if(data.id===id)onMessage(data);};
    worker.onerror=e=>{if(jobId===id)onMessage({id,type:'error',message:e.message||'Could not start local processing. Reload and try again.'});};
    const bytes=await file.arrayBuffer();if(jobId!==id)return;
    worker.postMessage({id,type:'inspect',name:file.name,bytes},[bytes]);
   }catch(e){if(jobId===id)onMessage({id,type:'error',message:e.message});}
  },
  optimize(options={}){worker?.postMessage({id,type:'optimize',options});},
  preview(path){worker?.postMessage({id,type:'preview',path});},
  cancel:clear,clear,
 };
}
