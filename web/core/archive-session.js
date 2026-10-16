import {openNativeArchive} from './archive-native.js';import {readArchive} from './archive.js';import {validateCollection} from './collections.js';import {imageInfo,optimizeImage,verifyImage} from './images.js';import {equal} from './png.js';import {LIMITS} from './limits.js';
const containers={cbr:'rar',cb7:'7z',cbt:'tar',tar:'tar','7z':'7z'};
const protectedMetadata=['mode','uid','gid','uname','gname','mtime','mtimeNs','atime','atimeNs','ctime','ctimeNs','birthtime','birthtimeNs','times'];
export async function openArchiveSession(input,format){
 const container=containers[format.extension],a=await openNativeArchive(input,container);let b=null,output=null,rows=[],closed=false,serial=0,source=input;
 const converted=format.outputExtension!==format.extension,warnings=converted?['Converted to CBZ. Archive-only metadata (such as comments, ownership and timestamps) may differ. Reader-specific page sorting may differ; filenames and entry order are retained.']:[];
 const active=()=>{if(closed)throw Error('File session is closed');};
 let validation;try{validation=await validateCollection(a,format);}catch(e){await a.close();throw e;}const paths=validation.imagePaths;
 return {
  async inspect(){active();const images=[];for(const path of paths){const bytes=await a.read(path);let info;try{info=imageInfo(bytes,path);}catch{info={format:'Unrecognized'};}images.push({path,format:info.format,width:info.width,height:info.height,size:bytes.length});}return {...format,converted,qualityControls:['colors','jpeg-quality'],images,entries:a.entries.length,warnings};},
  async optimize(options={},onProgress=()=>{}){
   active();if(b){await b.close();b=null;}output=null;rows=[];const replacements=new Map();let done=0;
   for(const path of paths){const src=await a.read(path),r=await optimizeImage(src,path,{},options);rows.push({path,status:r.status,reason:r.reason,perceptual:!!r.perceptual,before:src.length,after:r.bytes.length});if(r.status==='optimized')replacements.set(path,r.bytes);onProgress({done:++done,total:paths.length,path});}
   if(converted||replacements.size){
    const candidate=await a.rewrite(replacements,converted?'zip':container);
    if(converted||candidate.length<source.length){
     b=converted?await readArchive(candidate,{input:LIMITS.total}):await openNativeArchive(candidate,container,{input:LIMITS.total});
     try{
      await validateCollection(b,{...format,extension:format.outputExtension});
      if(a.entries.length!==b.entries.length||a.entries.some((e,i)=>e.name!==b.entries[i].name||e.directory!==b.entries[i].directory))throw Error('Output archive entries or ordering changed');
      for(let i=0;i<a.entries.length;i++){
       const e=a.entries[i],f=b.entries[i];if(!converted)for(const key of protectedMetadata)if(e.metadata[key]!==f.metadata[key])throw Error('Output changed archive metadata: '+key);
       const src=await a.read(e.name),out=await b.read(e.name);
       if(replacements.has(e.name)){if(!equal(out,replacements.get(e.name)))throw Error('Output image mismatch');await verifyImage(src,out,e.name,rows.find(r=>r.path===e.name)?.perceptual?{mode:'colors'}:{});}else if(!equal(src,out))throw Error('Output changed a protected archive entry');
      }
      output=candidate;
     }catch(e){await b.close();b=null;throw e;}
    }
   }
   if(!output){output=source;rows=rows.map(r=>({...r,perceptual:false,status:r.status==='optimized'?'efficient':r.status,reason:r.status==='optimized'?'Original retained: complete archive did not shrink':r.reason,after:r.before}));}
   rows=rows.map(r=>({...r,previewable:r.status==='optimized',previewId:r.status==='optimized'?'archive-image-'+(++serial):undefined}));
   const changed=output!==source;return {...format,extension:format.outputExtension,mime:format.outputMime,label:format.outputLabel,bytes:output,changed,converted,downloadAvailable:changed||converted,images:rows,warnings};
  },
  async preview(id){active();const row=rows.find(r=>r.previewId===id&&r.previewable);if(!row||!b)throw Error('No changed archive image available for preview');return {before:await a.read(row.path),after:await b.read(row.path),mime:/\.png$/i.test(row.path)?'image/png':'image/jpeg',perceptual:row.perceptual};},
  async close(){if(closed)return;closed=true;await a.close();if(b)await b.close();b=null;source=null;output=null;rows=[];}
 };
}
