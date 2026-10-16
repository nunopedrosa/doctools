import {validateOpc} from './opc.js';import {parseXml} from './xml.js';
const O='application/vnd.openxmlformats-officedocument.',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',S='http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument',V='http://schemas.microsoft.com/visio/2010/relationships/document';
const W=['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main'],P=['http://schemas.openxmlformats.org/presentationml/2006/main','http://purl.oclc.org/ooxml/presentationml/main'],X=['http://schemas.openxmlformats.org/spreadsheetml/2006/main','http://purl.oclc.org/ooxml/spreadsheetml/main'];
const mainTypes={docx:[O+'wordprocessingml.document.main+xml','document',W],dotx:[O+'wordprocessingml.template.main+xml','document',W],pptx:[O+'presentationml.presentation.main+xml','presentation',P],ppsx:[O+'presentationml.slideshow.main+xml','presentation',P],potx:[O+'presentationml.template.main+xml','presentation',P],xlsx:[O+'spreadsheetml.sheet.main+xml','workbook',X],xltx:[O+'spreadsheetml.template.main+xml','workbook',X],vsdx:['application/vnd.ms-visio.drawing.main+xml','VisioDocument',['http://schemas.microsoft.com/office/visio/2012/main','http://schemas.microsoft.com/office/visio/2011/1/core']]};
export async function validateOffice(archive,format){
 const {types,relationships}=await validateOpc(archive),expected=mainTypes[format.extension];if(!expected)throw Error('Unsupported Office format');
 const roots=relationships.filter(r=>r.source===null&&[R,S,V].includes(r.type));
 if(roots.length!==1||roots[0].external||!(format.extension==='vsdx'?[V]:[R,S]).includes(roots[0].type))throw Error('Invalid main document relationship');
 const mainPath=roots[0].target;if(types.get(mainPath)!==expected[0])throw Error('Unsupported document content type');
 const root=parseXml(await archive.read(mainPath)).documentElement;if(root.localName!==expected[1]||!expected[2].includes(root.namespaceURI))throw Error('Invalid main document XML');
 const images=new Set([...types].filter(([,t])=>t.startsWith('image/')).map(([p])=>p));
 for(const r of relationships)if(!r.external&&r.type.endsWith('/image'))images.add(r.target);
 return {imagePaths:archive.entries.filter(e=>!e.directory&&images.has(e.name)).map(e=>e.name),warnings:[]};
}
