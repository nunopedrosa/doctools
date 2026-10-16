import {readArchive,rewriteArchive} from './archive.js';
import {imageInfo,optimizeImage,verifyImage} from './images.js';
import {equal} from './png.js';
export async function openZipSession(input,format,validator){
 const a=await readArchive(input);let b=null,output=null,rows=[],closed=false,source=input,serial=0;
 const active=()=>{if(closed)throw Error('File session is closed');};
 let validation;
 try{validation=await validator(a,format);}catch(e){await a.close();throw e;}
 const paths=validation.imagePaths||validation.mediaPaths,modes=validation.modes||format.modes;
 return {
  async inspect(){active();const images=[];for(const path of paths){const src=await a.read(path);let info;try{info=imageInfo(src,path);}catch{info={format:'Unrecognized'};}images.push({path,format:info.format,width:info.width,height:info.height,size:src.length});}return {...format,modes,qualityControls:format.extension==='ora'?[]:['colors','jpeg-quality'],images,entries:a.entries.length};},
  async optimize(options={},onProgress=()=>{}){
   active();if(!modes.includes(options.mode||'lossless'))throw Error('This format supports exact lossless optimization only.');
   if(b){await b.close();b=null;}output=null;rows=[];const replacements=new Map();let done=0;
   for(const path of paths){const src=await a.read(path),r=await optimizeImage(src,path,{},options);rows.push({path,status:r.status,reason:r.reason,perceptual:!!r.perceptual,before:src.length,after:r.bytes.length});if(r.status==='optimized')replacements.set(path,r.bytes);onProgress({done:++done,total:paths.length,path});}
   if(replacements.size){
    const candidate=await rewriteArchive(a,replacements);b=await readArchive(candidate);
    try{
     await validator(b,format);
     if(a.entries.length!==b.entries.length||a.entries.some((e,i)=>e.name!==b.entries[i].name))throw Error('Output package entries or ordering changed');
     for(const e of a.entries){const src=await a.read(e.name),out=await b.read(e.name);if(replacements.has(e.name)){if(!equal(out,replacements.get(e.name)))throw Error('Output image mismatch');await verifyImage(src,out,e.name,rows.find(i=>i.path===e.name)?.perceptual?{mode:'colors'}:{});}else if(!equal(src,out))throw Error('Output changed a protected package part');}
    }catch(e){await b.close();b=null;throw e;}
    if(candidate.length<source.length)output=candidate;
   }
   if(!output){output=source;if(b){await b.close();b=null;}rows=rows.map(r=>({...r,perceptual:false,status:r.status==='optimized'?'efficient':r.status,reason:r.status==='optimized'?'Original retained: complete package did not shrink':r.reason,after:r.before}));}
   rows=rows.map(r=>({...r,previewable:r.status==='optimized',previewId:r.status==='optimized'?'image-'+(++serial):undefined}));
   const changed=output!==source;return {...format,label:format.outputLabel,extension:format.outputExtension,mime:format.outputMime,bytes:output,changed,converted:false,downloadAvailable:changed,images:rows,warnings:validation.warnings||[]};
  },
  async preview(id){active();const row=rows.find(r=>r.previewId===id&&r.previewable);if(!row||!b)throw Error('No changed image available for preview');return {before:await a.read(row.path),after:await b.read(row.path),mime:/\.png$/i.test(row.path)?'image/png':'image/jpeg',perceptual:row.perceptual};},
  async close(){if(closed)return;closed=true;await a.close();if(b)await b.close();b=null;source=null;output=null;rows=[];}
 };
}
