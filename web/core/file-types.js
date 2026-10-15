export function fileType(name){
 const extension=name.split('.').pop().toLowerCase();
 if(extension==='docx')return {kind:'document',extension,mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
 if(['png','jpg','jpeg'].includes(extension))return {kind:'image',extension,mime:extension==='png'?'image/png':'image/jpeg'};
 throw Error('Choose a DOCX, PNG or JPEG file.');
}
