import {inspectDocument,optimizeDocument} from './core/document.js';
let input,id,busy=false;
self.onmessage=async({data})=>{
 if(busy)return;
 busy=true;
 try{
  if(data.type==='inspect'){
   id=data.id;input=new Uint8Array(data.bytes);
   const summary=await inspectDocument(input);self.postMessage({id,type:'inspected',summary});
  }else if(data.type==='optimize'&&data.id===id&&input){
   const result=await optimizeDocument(input,p=>self.postMessage({id,type:'progress',...p}));
   // Transfer an independent result so a no-op cannot detach the retained input unexpectedly.
   result.bytes=result.bytes.slice();self.postMessage({id,type:'result',result},[result.bytes.buffer]);
  }
 }catch(e){self.postMessage({id:data.id,type:'error',message:e.message||'Processing failed. Choose another document.'});}
 finally{busy=false;}
};
