import {imageInfo,optimizeImage} from './images.js';
export async function openImageSession(input,format){
 let source=input,output=null,rows=[],closed=false;
 const active=()=>{if(closed)throw Error('File session is closed');};
 const info=imageInfo(source,'image.'+format.extension);
 if(!info.width||!info.height||info.width*info.height>25000000)throw Error('Single images must be at most 25 megapixels.');
 return {
  async inspect(){active();return {...format,qualityControls:format.extension==='png'?['colors']:['jpeg-quality'],images:[{path:'image.'+format.extension,format:info.format,width:info.width,height:info.height,size:source.length}]};},
  async optimize(options={},onProgress=()=>{}){active();const r=await optimizeImage(source,'image.'+format.extension,{},options);if(r.status==='failed')throw Error(r.reason);output=r.bytes;const changed=r.status==='optimized';rows=[{path:'image.'+format.extension,previewId:changed?'image-0':undefined,status:r.status,reason:r.reason,perceptual:!!r.perceptual,previewable:changed,before:source.length,after:output.length}];onProgress({done:1,total:1,path:rows[0].path});return {...format,extension:format.outputExtension,mime:format.outputMime,label:format.outputLabel,bytes:output,changed,converted:false,downloadAvailable:changed,images:rows,warnings:[]};},
  async preview(id){active();if(!output||!rows.some(r=>r.previewId===id&&r.previewable))throw Error('No image available for preview');return {before:source.slice(),after:output.slice(),mime:format.mime,perceptual:rows[0].perceptual};},
  async close(){closed=true;source=null;output=null;rows=[];}
 };
}
