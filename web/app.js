import {setupOffline} from './offline.js';
import {createJobClient} from './job-client.js';
const $=id=>document.getElementById(id);
let file=null,url=null,busy=false,locked=false,lockedControls=null;
const bytes=n=>n<1024?n+' B':n<1024*1024?(n/1024).toFixed(1)+' KiB':(n/1024/1024).toFixed(2)+' MiB';
function release(){if(url)URL.revokeObjectURL(url);url=null;$('download-slot').replaceChildren();$('result').hidden=true;$('report').hidden=true;$('images').replaceChildren();}
function setBusy(value){busy=value;$('cancel').hidden=!value;$('clear').disabled=value;$('optimize').disabled=value;document.dispatchEvent(new CustomEvent('doctools-busy',{detail:value}));}
function status(message){$('status').textContent=message;}
function error(message){setBusy(false);$('progress').hidden=true;$('error').textContent=message;$('error').hidden=false;$('optimize').disabled=true;status('Choose another document to continue.');}
const jobs=createJobClient(data=>{
 if(data.type==='error'){error(data.message);return;}
 if(data.type==='inspected'){
  $('progress').hidden=true;setBusy(false);$('summary').textContent=bytes(file.size)+' / '+data.summary.images.length+' embedded images';
  status('Document checked. Ready to optimize.');
 }else if(data.type==='progress'){
  $('progress').max=data.total;$('progress').value=data.done;status('Optimizing image '+data.done+' of '+data.total+'…');
 }else if(data.type==='result'){
  setBusy(false);$('progress').hidden=true;$('result').hidden=false;$('optimize').disabled=true;
  const r=data.result,saved=file.size-r.bytes.length;
  $('result-title').textContent=r.changed?'Ready to download':'No reduction needed';
  $('savings').textContent=r.changed?bytes(saved)+' saved ('+(saved/file.size*100).toFixed(1)+'%).':'This document could not be made smaller with lossless optimization.';
  $('sizes').textContent=bytes(file.size)+' original / '+bytes(r.bytes.length)+' result';
  if(r.changed){
   url=URL.createObjectURL(new Blob([r.bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
   const link=document.createElement('a');link.className='download';link.href=url;link.download=file.name.replace(/\.docx$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')+'-compressed.docx';link.textContent='Download DOCX';$('download-slot').append(link);
  }
  const labels={optimized:'Optimized',efficient:'Already efficient',unsupported:'Kept unchanged',failed:'Kept unchanged'};
  for(const image of r.images){
   const row=document.createElement('tr');
   for(const text of [image.path.replace('word/media/',''),labels[image.status],bytes(image.before),bytes(image.after)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
   const reason=document.createElement('small');reason.textContent=image.reason;row.children[1].append(reason);$('images').append(row);
  }
  $('report').hidden=!r.images.length;status('Finished. Your original document is unchanged.');
 }
});
function select(selected){
 if(!selected||locked)return;file=selected;release();$('error').hidden=true;$('document').hidden=false;$('dropzone').hidden=true;$('filename').textContent=file.name;$('summary').textContent=bytes(file.size);$('progress').hidden=false;$('progress').removeAttribute('value');setBusy(true);status('Checking document…');jobs.inspect(file);
}
$('file').addEventListener('change',e=>select(e.target.files[0]));
$('optimize').addEventListener('click',()=>{if(busy||locked||!file)return;release();setBusy(true);$('progress').hidden=false;$('progress').removeAttribute('value');status('Optimizing images…');jobs.optimize();});
$('cancel').addEventListener('click',()=>{jobs.cancel();$('file').value='';setBusy(false);$('optimize').disabled=true;$('progress').hidden=true;$('dropzone').hidden=false;status('Cancelled. Select a document to start again.');});
$('clear').addEventListener('click',()=>{jobs.clear();release();file=null;setBusy(false);$('file').value='';$('document').hidden=true;$('error').hidden=true;$('dropzone').hidden=false;status('Ready when you are.');$('file').focus();});
for(const type of ['dragenter','dragover'])$('dropzone').addEventListener(type,e=>{e.preventDefault();$('dropzone').classList.add('drag');});
$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('drag'));
$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('drag');select(e.dataTransfer.files[0]);});
window.addEventListener('pagehide',()=>{jobs.clear();release();});

setupOffline({isBusy:()=>busy,setLocked:value=>{if(value&&!locked)lockedControls=['file','optimize','clear'].map(id=>[id,$(id).disabled]);locked=value;if(value)for(const id of ['file','optimize','clear'])$(id).disabled=true;else if(lockedControls){for(const [id,disabled] of lockedControls)$(id).disabled=disabled;lockedControls=null;}},status:$('offline-status'),updateButton:$('update')});
