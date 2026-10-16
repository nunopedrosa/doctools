import {enabledFormats} from './core/formats.js';
import {setupFormatHelp} from './format-help.js';
import {setupOffline} from './offline.js';
import {createJobClient} from './job-client.js';
import {createPreview} from './preview.js';
const $=id=>document.getElementById(id);
let file=null,url=null,busy=false,locked=false,lockedControls=null,resultReady=false,inspected=false,fileKind='document',fileExtension='docx';
const preview=createPreview();
setupFormatHelp({formats:enabledFormats(),container:$('format-list'),dialog:$('format-dialog')});
const bytes=n=>n<1024?n+' B':n<1024*1024?(n/1024).toFixed(1)+' KiB':(n/1024/1024).toFixed(2)+' MiB';
function release(){preview.clear();resultReady=false;if(url)URL.revokeObjectURL(url);url=null;$('download-slot').replaceChildren();$('result').hidden=true;$('report').hidden=true;$('images').replaceChildren();}
function setBusy(value){busy=value;$('cancel').hidden=!value;$('clear').disabled=value||locked;$('optimize').disabled=value||locked||resultReady||!file;for(const id of ['mode','colors','jpeg-quality'])$(id).disabled=value||locked;for(const button of $('images').querySelectorAll('button'))button.disabled=value||locked;document.dispatchEvent(new CustomEvent('doctools-busy',{detail:value}));}
function status(message){$('status').textContent=message;}
function error(message){inspected=false;setBusy(false);$('progress').hidden=true;$('error').textContent=message;$('error').hidden=false;$('optimize').disabled=true;status('Choose another file to continue.');}
const jobs=createJobClient(data=>{
 if(data.type==='preview'||data.type==='preview-error'){setBusy(false);if(data.type==='preview')preview.show(data);else preview.error(data.message);status('Finished. Your original file is unchanged.');return;}
 if(data.type==='error'){error(data.message);return;}
 if(data.type==='inspected'){
  inspected=true;
  fileKind=data.summary.kind;fileExtension=data.summary.extension;renderSettings();
  const image=data.summary.images[0];
  $('progress').hidden=true;setBusy(false);$('summary').textContent=bytes(file.size)+' / '+(fileKind==='document'?data.summary.images.length+' embedded images':image.format+' / '+image.width+' × '+image.height+' pixels');
  status('File checked. Ready to optimize.');
 }else if(data.type==='progress'){
  $('progress').max=data.total;$('progress').value=data.done;status('Optimizing image '+data.done+' of '+data.total+'…');
 }else if(data.type==='result'){
  resultReady=true;
  setBusy(false);$('progress').hidden=true;$('result').hidden=false;$('optimize').disabled=true;
  const r=data.result,saved=file.size-r.bytes.length;
  $('result-title').textContent=r.changed?'Ready to download':'No reduction needed';
  $('savings').textContent=r.changed?bytes(saved)+' saved ('+(saved/file.size*100).toFixed(1)+'%).':'This file could not be made smaller with the selected settings.';
  $('sizes').textContent=bytes(file.size)+' original / '+bytes(r.bytes.length)+' result';
  if(r.changed){
   url=URL.createObjectURL(new Blob([r.bytes],{type:r.mime}));
   const link=document.createElement('a');link.className='download';link.href=url;link.download=file.name.replace(/\.(docx|png|jpe?g)$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')+'-compressed.'+r.extension;link.textContent='Download '+(r.kind==='document'?'DOCX':r.extension==='png'?'PNG':'JPEG');$('download-slot').append(link);
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
$('cancel').addEventListener('click',()=>clearDocument('Cancelled. Select a file to start again.'));
function renderSettings(){
 const smaller=$('mode').value==='colors';$('color-controls').hidden=!smaller||fileKind==='image'&&fileExtension!=='png';$('jpeg-controls').hidden=!smaller||fileKind==='image'&&fileExtension==='png';
 const target=fileKind==='document'?'PNG colors and JPEG quality':fileExtension==='png'?'PNG colors':'JPEG quality';
 $('mode-policy').textContent=smaller?'Reduces '+target+' without resizing. Colors and fine detail may change visibly. Review the before/after preview before downloading.':'Preserves original image quality, dimensions and metadata.';
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

setupOffline({isBusy:()=>busy,setLocked:value=>{if(value&&!locked)lockedControls=['file','optimize','clear','mode','colors','jpeg-quality'].map(id=>[id,$(id).disabled]);locked=value;if(value)for(const id of ['file','optimize','clear','mode','colors','jpeg-quality'])$(id).disabled=true;else if(lockedControls){for(const [id,disabled] of lockedControls)$(id).disabled=disabled;lockedControls=null;}},status:$('offline-status'),updateButton:$('update')});
