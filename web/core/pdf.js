import {openPdf} from './pdf-engine.js';import {verifyPdfSnapshots} from './pdf-verify.js';import {jpegInfo} from './jpeg.js';import {optimizeImage,verifyImage} from './images.js';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export async function openPdfSession(bytes,format){
 let source=bytes,original=await openPdf(bytes),result=null,output=null,rows=[],closed=false,serial=0;const info=await original.inspect();
 const active=()=>{if(closed)throw Error('File session is closed');};
 const images=info.images.map(i=>({...i,path:'Image '+i.objectId,size:i.size,format:i.eligible?'JPEG':'PDF image'}));
 // Eligibility additionally checks the actual JPEG frame, rather than trusting its PDF dictionary.
 for(const image of images)if(image.eligible){try{const b=await original.readImage(image.objectId),j=jpegInfo(b);image.size=b.length;if(j.width!==image.width||j.height!==image.height||j.precision!==8||j.components!==(image.colorSpace==='/DeviceRGB'?3:1)||j.width*j.height>25000000){image.eligible=false;image.reason='JPEG frame is complex, oversized or does not match its PDF dictionary';}}catch(e){image.eligible=false;image.reason='JPEG retained: '+e.message;}}
 return {
  async inspect(){active();return {...format,pages:info.pages,objects:info.objects,images,modes:format.modes,qualityControls:['jpeg-quality']};},
  async optimize(options={},progress=()=>{}){
   active();if(!format.modes.includes(options.mode||'lossless'))throw Error('Unsupported PDF mode');if(result){await result.close();result=null;}output=null;rows=[];
   const work=await openPdf(source),replacements=new Map(),expected=new Map();let done=0;
   try{
    const before=await work.snapshot();
    for(const image of images){let r={status:'unsupported',reason:image.reason,bytes:null};if(image.eligible){const src=await original.readImage(image.objectId);r=await optimizeImage(src,'image.jpg',{},options);if(r.status==='optimized'){replacements.set(image.objectId,r.bytes);expected.set(image.objectId,{hash:await hash(r.bytes),perceptual:!!r.perceptual});}}
     rows.push({path:image.path,objectId:image.objectId,before:image.size,after:r.bytes?.length||image.size,status:r.status,reason:r.reason,perceptual:!!r.perceptual});progress({done:++done,total:images.length,path:image.path});
    }
    const candidate=await work.write(replacements);result=await openPdf(candidate.bytes);verifyPdfSnapshots(before,await result.snapshot(),expected,candidate.mapping);
    for(const [id,b]of replacements)await verifyImage(await original.readImage(id),await result.readImage(candidate.mapping[id]),'image.jpg',expected.get(id).perceptual?{mode:'colors'}:{});
    if(candidate.bytes.length<source.length){output=candidate.bytes;rows=rows.map(r=>({...r,outputId:candidate.mapping[r.objectId]}));}
    else{await result.close();result=null;output=source;rows=rows.map(r=>({...r,after:r.before,perceptual:false,status:r.status==='optimized'?'efficient':r.status,reason:r.status==='optimized'?'Original retained: complete PDF did not shrink':r.reason}));}
   }finally{await work.close();}
   rows=rows.map(r=>({...r,previewable:r.status==='optimized',previewId:r.status==='optimized'?'pdf-image-'+(++serial):undefined}));
   return {...format,label:'PDF',bytes:output,changed:output!==source,converted:false,downloadAvailable:output!==source,images:rows,warnings:['Complex images and inline images are preserved. Page layout, text, fonts and other document resources are retained.']};
  },
  async preview(id){active();const row=rows.find(i=>i.previewId===id&&i.previewable);if(!row||!result)throw Error('No changed PDF image available for preview');return {before:await original.readImage(row.objectId),after:await result.readImage(row.outputId),mime:'image/jpeg',perceptual:row.perceptual};},
  async pagePreview(){active();return {before:source.slice(),after:(output||source).slice(),pages:info.pages};},
  async close(){if(closed)return;closed=true;await original.close();if(result)await result.close();result=null;source=null;output=null;rows=[];}
 };
}
