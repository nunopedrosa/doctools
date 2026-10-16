// Page rendering is optional, local and separate from saved PDF bytes.
// Only PDF.js core rendering is used; no viewer, scripting or annotation UI.
export function createPdfPreview(){
 const $=id=>document.getElementById(id);let serial=0,tasks=[],docs=[],renders=[],timer=null,current=1,count=0,locked=false;
 function dispose(){clearTimeout(timer);timer=null;for(const r of renders)r.cancel();renders=[];for(const t of tasks)Promise.resolve(t.destroy()).catch(()=>{});tasks=[];docs=[];for(const id of ['pdf-before','pdf-after']){$(id).width=0;$(id).height=0;}locked=false;}
 function clear(){serial++;dispose();$('pdf-preview').hidden=true;}
 async function render(){const job=serial;locked=true;$('pdf-prev').disabled=true;$('pdf-next').disabled=true;$('pdf-preview-message').textContent='Rendering page '+current+'…';try{
  for(let i=0;i<2;i++){const page=await docs[i].getPage(current);if(job!==serial)return;const base=page.getViewport({scale:1}),scale=Math.min(1.6,Math.sqrt(2000000/(base.width*base.height))),viewport=page.getViewport({scale}),canvas=$(i?'pdf-after':'pdf-before');canvas.width=Math.max(1,Math.floor(viewport.width));canvas.height=Math.max(1,Math.floor(viewport.height));const task=page.render({canvasContext:canvas.getContext('2d'),viewport,annotationMode:0});renders.push(task);await task.promise;page.cleanup();if(job!==serial)return;}
  clearTimeout(timer);timer=null;renders=[];locked=false;$('pdf-preview-message').textContent='Page '+current+' of '+count+'. Preview resolution is limited; the saved PDF keeps its original image dimensions.';$('pdf-prev').disabled=current<=1;$('pdf-next').disabled=current>=count;
 }catch(e){if(job===serial){dispose();$('pdf-preview-message').textContent='Preview unavailable: '+e.message;}}}
 function deadline(){clearTimeout(timer);timer=setTimeout(()=>{serial++;dispose();$('pdf-preview-message').textContent='Preview time limit reached. Close the preview and try again.';},120000);}
 $('pdf-close').addEventListener('click',clear);for(const [id,delta]of [['pdf-prev',-1],['pdf-next',1]])$(id).addEventListener('click',()=>{if(locked||!docs.length)return;current+=delta;deadline();render();});
 return {clear,isBusy:()=>locked,loading(){clear();$('pdf-preview').hidden=false;$('pdf-preview-message').textContent='Loading local PDF preview…';},async show({before,after,pages}){
  const job=++serial;locked=true;deadline();try{const pdfjs=await import('./vendor/pdfjs/pdf.js');if(job!==serial)return;pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.js',import.meta.url).href;count=pages;current=1;
   for(const bytes of [before,after]){const task=pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,enableScripting:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true,maxImageSize:25000000,canvasMaxAreaInBytes:16000000,cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href,iccUrl:new URL('./vendor/pdfjs/iccs/',import.meta.url).href,useWorkerFetch:true});tasks.push(task);const doc=await task.promise;if(job!==serial){await task.destroy();return;}docs.push(doc);}
   await render();if(job===serial)$('pdf-close').focus({preventScroll:true});
  }catch(e){if(job===serial){dispose();$('pdf-preview-message').textContent='Preview unavailable: '+e.message;}}
 }};
}
