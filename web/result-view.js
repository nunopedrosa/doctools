const size=n=>n<1024?n+' B':n<1024*1024?(n/1024).toFixed(1)+' KiB':(n/1024/1024).toFixed(2)+' MiB';
export function resultPresentation(inputName,inputSize,result){
 const saved=inputSize-result.bytes.length,stem=inputName.replace(/\.[^.]*$/,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_');
 const title=result.converted?'Converted to '+result.label:result.changed?'Ready to download':'No reduction needed';
 let savings='This file could not be made smaller with the selected settings.';
 if(saved>0)savings=size(saved)+' saved ('+(saved/Math.max(1,inputSize)*100).toFixed(1)+'%).';
 else if(saved<0)savings=size(-saved)+' larger ('+(-saved/Math.max(1,inputSize)*100).toFixed(1)+'%).'+(result.converted?' Format conversion is still available.':'');
 else if(result.converted)savings='Converted file has the same size as the original.';
 return {title,savings,filename:stem+(result.converted?'-converted.':'-compressed.')+result.extension,downloadLabel:'Download '+result.label};
}
