import {createPdfPreview} from './pdf-preview.js';
import {resultPresentation} from './result-view.js';
import {enabledFormats} from './core/formats.js';
import {setupFormatHelp} from './format-help.js';
import {setupOffline} from './offline.js';
import {createJobClient} from './job-client.js';
import {createPreview} from './preview.js';
const $=id=>document.getElementById(id);
let file=null,url=null,busy=false,locked=false,lockedControls=null,resultReady=false,inspected=false,fileKind='document',fileExtension='docx',fileModes=['lossless','colors'],qualityControls=['colors','jpeg-quality'];
const preview=createPreview(),pdfPreview=createPdfPreview();
const formats=enabledFormats();
setupFormatHelp({formats,container:$('format-list'),dialog:$('format-dialog')});
$('file').accept=formats.map(f=>'.'+f.extension).join(',');
const bytes=n=>n<1024?n+' B':n<1024*1024?(n/1024).toFixed(1)+' KiB':(n/1024/1024).toFixed(2)+' MiB';
function release(){pdfPreview.clear();preview.clear();resultReady=false;if(url)URL.revokeObjectURL(url);url=null;$('download-slot').replaceChildren();$('result').hidden=true;$('report').hidden=true;$('images').replaceChildren();}
function setBusy(value){busy=value;$('cancel').hidden=!value;$('clear').disabled=value||locked;$('optimize').disabled=value||locked||resultReady||!file;for(const id of ['mode','colors','jpeg-quality'])$(id).disabled=value||locked;for(const button of $('images').querySelectorAll('button'))button.disabled=value||locked;document.dispatchEvent(new CustomEvent('doctools-busy',{detail:value}));}
function status(message){$('status').textContent=message;}
function error(message){inspected=false;setBusy(false);$('progress').hidden=true;$('error').textContent=message;$('error').hidden=false;$('optimize').disabled=true;status('Choose another file to continue.');}
const jobs=createJobClient(data=>{
 if(data.type==='page-preview'){setBusy(false);pdfPreview.show(data);return;}
 if(data.type==='preview'||data.type==='preview-error'){setBusy(false);if(data.type==='preview')preview.show(data);else preview.error(data.message);status('Finished. Your original file is unchanged.');return;}
 if(data.type==='error'){error(data.message);return;}
 if(data.type==='inspected'){
  inspected=true;
  fileKind=data.summary.kind;fileExtension=data.summary.extension;fileModes=data.summary.modes;qualityControls=data.summary.qualityControls;renderSettings();
  const image=data.summary.images[0];
  $('progress').hidden=true;setBusy(false);$('summary').textContent=bytes(file.size)+' / '+(fileKind!=='image'?data.summary.images.length+' embedded images'+(data.summary.pages?' / '+data.summary.pages+' pages':''):image.format+' / '+image.width+' × '+image.height+' pixels');
  status('File checked. Ready to optimize.');
 }else if(data.type==='progress'){
  $('progress').max=data.total;$('progress').value=data.done;status('Optimizing image '+data.done+' of '+data.total+'…');
 }else if(data.type==='result'){
  resultReady=true;
  setBusy(false);$('progress').hidden=true;$('result').hidden=false;$('optimize').disabled=true;
  const r=data.result,view=resultPresentation(file.name,file.size,r);
  $('pdf-pages').hidden=fileExtension!=='pdf';
  $('result-title').textContent=view.title;
  $('savings').textContent=view.savings;
  $('result-warnings').textContent=(r.warnings||[]).join(' ');$('result-warnings').hidden=!r.warnings?.length;
  $('sizes').textContent=bytes(file.size)+' original / '+bytes(r.bytes.length)+' result';
  if(r.downloadAvailable){
   url=URL.createObjectURL(new Blob([r.bytes],{type:r.mime}));
   const link=document.createElement('a');link.className='download';link.href=url;link.download=view.filename;link.textContent=view.downloadLabel;$('download-slot').append(link);
  }
  const labels={optimized:'Optimized',efficient:'Already efficient',unsupported:'Kept unchanged',failed:'Kept unchanged'};
  for(const image of r.images){
   const row=document.createElement('tr');
   for(const text of [image.path.replace('word/media/',''),labels[image.status],bytes(image.before),bytes(image.after)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
   const reason=document.createElement('small');reason.textContent=image.reason;row.children[1].append(reason);$('images').append(row);
   if(image.perceptual||image.previewable){const button=document.createElement('button');button.type='button';button.textContent='Preview';button.setAttribute('aria-label','Preview '+image.path.replace('word/media/',''));button.addEventListener('click',()=>{if(busy||locked)return;preview.loading(image.path);setBusy(true);status('Loading image preview…');jobs.preview(image.previewId);});row.children[1].append(button);}
  }
  $('report').hidden=!r.images.length;status('Finished. Your original file is unchanged.');
 }
});
function select(selected){
 if(!selected||locked)return;inspected=false;file=selected;release();$('error').hidden=true;$('document').hidden=false;$('dropzone').hidden=true;$('filename').textContent=file.name;$('summary').textContent=bytes(file.size);$('progress').hidden=false;$('progress').removeAttribute('value');setBusy(true);status('Checking file…');jobs.inspect(file);
}
$('file').addEventListener('change',e=>select(e.target.files[0]));
$('optimize').addEventListener('click',()=>{if(busy||locked||!inspected)return;release();setBusy(true);$('progress').hidden=false;$('progress').removeAttribute('value');status('Optimizing images…');jobs.optimize({mode:$('mode').value,colors:Number($('colors').value),jpegQuality:Number($('jpeg-quality').value)});});
$('pdf-pages').addEventListener('click',()=>{if(busy||locked)return;pdfPreview.loading();setBusy(true);jobs.pagePreview();});
$('cancel').addEventListener('click',()=>clearDocument('Cancelled. Select a file to start again.'));
function renderSettings(){
 $('mode').querySelector('option[value="colors"]').disabled=!fileModes.includes('colors');
 if(!fileModes.includes($('mode').value))$('mode').value='lossless';
 const smaller=$('mode').value==='colors';$('color-controls').hidden=!smaller||!qualityControls.includes('colors');$('jpeg-controls').hidden=!smaller||!qualityControls.includes('jpeg-quality');
 const target=[qualityControls.includes('colors')?'PNG colors':null,qualityControls.includes('jpeg-quality')?'JPEG quality':null].filter(Boolean).join(' and ');
 $('mode-policy').textContent=smaller?'Reduces '+target+' without resizing. Colors and fine detail may change visibly. Review the before/after preview before downloading.':(fileModes.includes('colors')?'Preserves original image quality, dimensions and metadata.':'OpenRaster supports exact lossless optimization only, preserving layers and the stored composite.');
 $('optimize').textContent=smaller?'Optimize for smaller file':'Optimize without quality loss';
 $('optimize').disabled=busy||locked||!inspected;$('optimize').hidden=false;
}
function settingsChanged(){
 release();renderSettings();
 if(inspected)status('Settings changed. Optimize again to update the result.');
}
for(const id of ['mode','colors','jpeg-quality'])$(id).addEventListener('change',settingsChanged);
function clearDocument(message='Ready when you are.',focus=false){jobs.clear();release();file=null;inspected=false;setBusy(false);$('file').value='';$('document').hidden=true;$('error').hidden=true;$('dropzone').hidden=false;$('progress').hidden=true;$('optimize').disabled=true;status(message);if(focus)$('file').focus();}
$('clear').addEventListener('click',()=>clearDocument('Ready when you are.',true));
for(const type of ['dragenter','dragover'])$('dropzone').addEventListener(type,e=>{e.preventDefault();$('dropzone').classList.add('drag');});
$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('drag'));
$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('drag');select(e.dataTransfer.files[0]);});
window.addEventListener('pagehide',()=>clearDocument('Select a file to start again.'));
window.addEventListener('pageshow',event=>{if(event.persisted)clearDocument('Select a file to start again.');});

setupOffline({isBusy:()=>busy||pdfPreview.isBusy(),setLocked:value=>{if(value&&!locked)lockedControls=['file','optimize','clear','mode','colors','jpeg-quality'].map(id=>[id,$(id).disabled]);locked=value;if(value)for(const id of ['file','optimize','clear','mode','colors','jpeg-quality'])$(id).disabled=true;else if(lockedControls){for(const [id,disabled] of lockedControls)$(id).disabled=disabled;lockedControls=null;}},status:$('offline-status'),updateButton:$('update')});
