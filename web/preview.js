export function createPreview(){
 const $=id=>document.getElementById(id);let urls=[];
 function clear(){for(const url of urls)URL.revokeObjectURL(url);urls=[];for(const id of ['preview-before','preview-after'])$(id).removeAttribute('src');$('preview').hidden=true;$('preview-pair').hidden=true;$('close-preview').disabled=false;}
 $('close-preview').addEventListener('click',clear);
 $('preview-zoom').addEventListener('change',()=>$('preview-pair').classList.toggle('actual-size',$('preview-zoom').value==='actual'));
 const left=$('before-scroll'),right=$('after-scroll');
 for(const [a,b] of [[left,right],[right,left]])a.addEventListener('scroll',()=>{if(b.scrollTop!==a.scrollTop)b.scrollTop=a.scrollTop;if(b.scrollLeft!==a.scrollLeft)b.scrollLeft=a.scrollLeft;});
 return {
  clear,
  loading(path){clear();$('preview-title').textContent=path.replace('word/media/','');$('preview-message').textContent='Loading original and result…';$('preview').hidden=false;$('close-preview').disabled=true;},
  show({before,after,mime='image/png',perceptual=true}){
   for(const [id,bytes] of [['preview-before',before],['preview-after',after]]){const url=URL.createObjectURL(new Blob([bytes],{type:mime}));urls.push(url);$(id).src=url;}
   $('preview-message').textContent=perceptual?'Same dimensions. Quality reduction can change colors and fine detail; inspect text, textures and gradients before downloading.':'Same dimensions and original image quality. This result uses exact lossless optimization.';
   $('preview-pair').hidden=false;$('close-preview').disabled=false;$('preview').scrollIntoView({block:'start'});$('preview-zoom').focus({preventScroll:true});
  },
  error(message){$('preview-message').textContent='Preview unavailable: '+message;$('close-preview').disabled=false;}
 };
}
