import UPNG from '../vendor/upng.js';
import {pngInfo,restorePngMetadata} from './png.js';
import {decodePngRgba} from './png-pixels.js';
export async function reducePngColors(bytes,colors=128){
 if(![32,64,128,256].includes(colors))throw Error('Choose 32, 64, 128 or 256 colors');
 const info=pngInfo(bytes);
 if(info.animated||info.chunks[0].data[8]===16||info.width*info.height>4000000)throw Error('Color reduction supports static 8-bit PNGs up to 4 megapixels');
 const image=await decodePngRgba(bytes),pixels=image.data;
 const encoded=new Uint8Array(UPNG.encode([pixels.buffer.slice(pixels.byteOffset,pixels.byteOffset+pixels.byteLength)],image.width,image.height,colors));
 return restorePngMetadata(bytes,encoded);
}
