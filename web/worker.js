import {inspectDocument,optimizeDocument} from './core/document.js';
import {readArchive} from './core/archive.js';
let input,output,images,id,busy=false;
self.onmessage=async({data})=>{
 if(busy)return;
 busy=true;
 try{
  if(data.type==='inspect'){
   id=data.id;input=new Uint8Array(data.bytes);
   const summary=await inspectDocument(input);self.postMessage({id,type:'inspected',summary});
  }else if(data.type==='optimize'&&data.id===id&&input){
   output=null;images=null;
   const result=await optimizeDocument(input,p=>self.postMessage({id,type:'progress',...p}),data.options);
   output=result.bytes;images=result.images;
   // Transfer an independent result so a no-op cannot detach the retained input unexpectedly.
   result.bytes=result.bytes.slice();self.postMessage({id,type:'result',result},[result.bytes.buffer]);
  }else if(data.type==='preview'&&data.id===id&&input&&output){
   if(!images.some(i=>i.path===data.path&&i.perceptual))throw Error('No color-reduced image available for preview');
   const read=async bytes=>{const archive=await readArchive(bytes);try{return await archive.read(data.path);}finally{await archive.close();}};
   const before=await read(input),after=await read(output);
   self.postMessage({id,type:'preview',path:data.path,before,after},[before.buffer,after.buffer]);
  }
 }catch(e){self.postMessage({id:data.id,type:data.type==='preview'?'preview-error':'error',message:e.message||'Processing failed. Choose another document.'});}
 finally{busy=false;}
};
