import {recognizeZipPackage} from './zip-package-kind.js';
export async function validateCollection(archive,format){
 if(['zip','cbz'].includes(format.extension)){
  const kind=await recognizeZipPackage(archive);if(kind)throw Error('This is a '+kind+' package. Select it with its actual supported document extension.');
 }
 for(const e of archive.entries){const md=e.metadata||{},type=(md.unixMode||0)&0xf000;if(md.symlink||type&&![0x8000,0x4000].includes(type))throw Error('Archive links and special files are not supported');if(e.directory&&e.size)throw Error('Directory entries containing data are not supported');}
 return {imagePaths:archive.entries.filter(e=>!e.directory&&/\.(png|jpe?g|gif|webp|avif|tiff?|bmp|svg|jp2)$/i.test(e.name)).map(e=>e.name),warnings:[]};
}
