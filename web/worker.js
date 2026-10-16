import {openFile} from './core/format-loader.js';
let session=null,id,busy=false,images=[];
self.onmessage=async({data})=>{
 if(busy)return;busy=true;
 try{
  if(data.type==='inspect'){
   if(session)await session.close();session=null;id=data.id;images=[];
   session=await openFile(new Uint8Array(data.bytes),data.name);
   self.postMessage({id,type:'inspected',summary:await session.inspect()});
  }else if(data.type==='optimize'&&data.id===id&&session){
   const result=await session.optimize(data.options,p=>self.postMessage({id,type:'progress',...p}));images=result.images;
   result.bytes=result.bytes.slice();self.postMessage({id,type:'result',result},[result.bytes.buffer]);
  }else if(data.type==='page-preview'&&data.id===id&&session?.pagePreview){const pair=await session.pagePreview();self.postMessage({id,type:'page-preview',...pair},[pair.before.buffer,pair.after.buffer]);
  }else if(data.type==='preview'&&data.id===id&&session){
   // Compatibility with the old page's path messages is limited to known result rows.
   const previewId=data.previewId||images.find(i=>i.path===data.path)?.previewId;
   const pair=await session.preview(previewId);
   self.postMessage({id,type:'preview',...pair},[pair.before.buffer,pair.after.buffer]);
  }
 }catch(e){self.postMessage({id:data.id,type:data.type==='preview'?'preview-error':'error',message:e.message||'Processing failed. Choose another file.'});}
 finally{busy=false;}
};
