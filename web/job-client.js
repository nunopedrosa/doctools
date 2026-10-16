import {fileType} from './core/file-types.js';
export function createJobClient(onMessage){
 let worker=null,id=0,timer=null;
 const stopTimer=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
 const clear=()=>{stopTimer();id++;worker?.terminate();worker=null;};
 const fail=(jobId,message)=>{if(jobId!==id)return;clear();onMessage({id:jobId,type:'error',message});};
 const deadline=()=>{stopTimer();const jobId=id;timer=setTimeout(()=>fail(jobId,'Processing time limit reached. Try a smaller file.'),120000);};
 return {
  async inspect(file){
   clear();const jobId=id;
   try{
    const type=fileType(file.name),limit=type.kind==='image'?50:100;
    if(file.size>limit*1024*1024)throw Error('This file exceeds the '+limit+' MiB input limit.');
    worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{if(data.id!==id)return;if(data.type!=='progress')stopTimer();onMessage(data);};
    worker.onerror=e=>fail(jobId,e.message||'Could not start local processing. Reload and try again.');
    deadline();const bytes=await file.arrayBuffer();if(jobId!==id)return;
    worker.postMessage({id,type:'inspect',name:file.name,bytes},[bytes]);
   }catch(e){fail(jobId,e.message);}
  },
  optimize(options={}){if(worker){deadline();worker.postMessage({id,type:'optimize',options});}},
  preview(previewId){if(worker){deadline();worker.postMessage({id,type:'preview',previewId});}},
  pagePreview(){if(worker){deadline();worker.postMessage({id,type:'page-preview'});}},
  cancel:clear,clear,
 };
}
