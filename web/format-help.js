import {FORMAT_HELP} from './format-help-data.js';
export function setupFormatHelp({formats,container,dialog}){
 const title=dialog.querySelector('[data-format-title]'),description=dialog.querySelector('[data-format-description]'),applications=dialog.querySelector('[data-format-applications]'),policy=dialog.querySelector('[data-format-policy]'),closeButton=dialog.querySelector('[data-format-close]');
 const native=typeof dialog.showModal==='function';let opener=null,background=[];
 function restore(){for(const [el,inert] of background)el.inert=inert;background=[];const button=opener;opener=null;if(button?.isConnected)button.focus();}
 function close(){if(native&&dialog.open)dialog.close();else{dialog.removeAttribute('open');dialog.hidden=true;}restore();}
 function show(format,button){
  const entry=FORMAT_HELP[format.id];if(!entry)return;
  title.textContent=entry.title;description.textContent=entry.description;policy.textContent=entry.policy;applications.replaceChildren();for(const text of entry.applications){const li=document.createElement('li');li.textContent=text;applications.append(li);}
  opener=button;dialog.hidden=false;
  if(native)dialog.showModal();else{background=Array.from(document.body.children).filter(el=>el!==dialog&&el.tagName!=='SCRIPT').map(el=>[el,el.inert]);for(const [el] of background)el.inert=true;dialog.setAttribute('open','');}
  closeButton.focus();
 }
 closeButton.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',restore);
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){
  const focusable=Array.from(dialog.querySelectorAll('button,a[href],input,select,[tabindex="0"]')).filter(el=>!el.disabled&&!el.hidden);if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }});
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');if(!native)dialog.hidden=true;
 container.replaceChildren();for(const format of formats){const button=document.createElement('button');button.type='button';button.className='format-button';button.textContent='.'+format.extension;button.setAttribute('aria-label','About .'+format.extension);button.addEventListener('click',()=>show(format,button));container.append(button);}
 return {close};
}
