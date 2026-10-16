export {parseXml} from './xml.js';
import {validateOffice} from './office.js';
export async function validatePackage(archive){const r=await validateOffice(archive,{extension:'docx'});return {...r,mediaPaths:r.imagePaths};}
