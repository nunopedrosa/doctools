// Static format metadata only: parsers and native engines stay in workers.
const rows=[
 ['docx','Word document','office','document','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
 ['dotx','Word template','office','document','application/vnd.openxmlformats-officedocument.wordprocessingml.template'],
 ['pptx','PowerPoint presentation','office','document','application/vnd.openxmlformats-officedocument.presentationml.presentation'],
 ['ppsx','PowerPoint slideshow','office','document','application/vnd.openxmlformats-officedocument.presentationml.slideshow'],
 ['potx','PowerPoint template','office','document','application/vnd.openxmlformats-officedocument.presentationml.template'],
 ['xlsx','Excel workbook','office','document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
 ['xltx','Excel template','office','document','application/vnd.openxmlformats-officedocument.spreadsheetml.template'],
 ['vsdx','Visio drawing','office','document','application/vnd.ms-visio.drawing'],
 ['kmz','Google Earth map','kmz','document','application/vnd.google-earth.kmz'],
 ...['cbz','cbr','cb7','cbt'].map(e=>[e,'Comic archive','comic','comic',e==='cbr'?'application/vnd.comicbook-rar':'application/vnd.comicbook+zip']),
 ...['zip','tar','7z'].map(e=>[e,'Image collection','collection','archive',{'zip':'application/zip','tar':'application/x-tar','7z':'application/x-7z-compressed'}[e]]),
 ...Object.entries({odt:'text',ods:'spreadsheet',odp:'presentation',odg:'graphics',ott:'text-template',ots:'spreadsheet-template',otp:'presentation-template',otg:'graphics-template'}).map(([e,t])=>[e,'OpenDocument '+t,'odf','document','application/vnd.oasis.opendocument.'+t]),
 ['ora','OpenRaster artwork','ora','document','image/openraster'],
 ['epub','EPUB ebook','epub','document','application/epub+zip'],
 ['pdf','PDF document','pdf','document','application/pdf'],
 ['png','PNG image','image','image','image/png'],['jpg','JPEG image','image','image','image/jpeg'],['jpeg','JPEG image','image','image','image/jpeg']
];
const enabled=new Set(['docx','dotx','pptx','ppsx','potx','xlsx','xltx','vsdx','kmz','png','jpg','jpeg']);
export const FORMATS=Object.freeze(rows.map(([extension,label,family,kind,mime])=>Object.freeze({id:extension,extension,label,family,kind,mime,outputExtension:family==='comic'?'cbz':extension,outputMime:family==='comic'?'application/vnd.comicbook+zip':mime,outputLabel:family==='comic'?'CBZ':['jpg','jpeg'].includes(extension)?'JPEG':extension.toUpperCase(),modes:Object.freeze(extension==='ora'?['lossless']:['lossless','colors']),enabled:enabled.has(extension)})));
export function enabledFormats(){return FORMATS.filter(f=>f.enabled);}
export function formatForName(name){const ext=String(name).split('.').pop().toLowerCase(),f=FORMATS.find(f=>f.extension===ext&&f.enabled);if(!f)throw Error('Choose a supported document, archive or image file.');return f;}
