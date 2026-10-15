import {inspectFile,optimizeFile,fileType} from './core/files.js';
import {readArchive} from './core/archive.js';
let input,output,images,id,name,busy=false;
self.onmessage=async({data})=>{
 if(busy)return;
 busy=true;
 try{
  if(data.type==='inspect'){
   id=data.id;name=data.name;input=new Uint8Array(data.bytes);output=null;images=null;
   const summary=await inspectFile(input,name);self.postMessage({id,type:'inspected',summary});
  }else if(data.type==='optimize'&&data.id===id&&input){
   output=null;images=null;
   const result=await optimizeFile(input,name,p=>self.postMessage({id,type:'progress',...p}),data.options);
   output=result.bytes;images=result.images;
   // Transfer an independent result so a no-op cannot detach the retained input unexpectedly.
   result.bytes=result.bytes.slice();self.postMessage({id,type:'result',result},[result.bytes.buffer]);
  }else if(data.type==='preview'&&data.id===id&&input&&output){
   if(!images.some(i=>i.path===data.path&&(i.perceptual||i.previewable)))throw Error('No changed image available for preview');
   const standalone=fileType(name).kind==='image';
   const read=async bytes=>{if(standalone)return bytes.slice();const archive=await readArchive(bytes);try{return await archive.read(data.path);}finally{await archive.close();}};
   const before=await read(input),after=await read(output);
   const mime=/\.png$/i.test(data.path)?'image/png':'image/jpeg',perceptual=images.find(i=>i.path===data.path).perceptual;
   self.postMessage({id,type:'preview',path:data.path,mime,perceptual,before,after},[before.buffer,after.buffer]);
  }
 }catch(e){self.postMessage({id:data.id,type:data.type==='preview'?'preview-error':'error',message:e.message||'Processing failed. Choose another file.'});}
 finally{busy=false;}
};
