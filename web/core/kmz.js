import {assertZipPackageKind} from './zip-package-kind.js';
import {parseXml} from './xml.js';
export async function validateKmz(archive,format){
 await assertZipPackageKind(archive,format);
 const kml=archive.entries.filter(e=>!e.directory&&/\.kml$/i.test(e.name));if(!kml.length)throw Error('Invalid KMZ: missing KML document');
 for(const e of kml){const root=parseXml(await archive.read(e.name)).documentElement;if(root.localName!=='kml'||!['http://www.opengis.net/kml/2.2','http://earth.google.com/kml/2.0','http://earth.google.com/kml/2.1','http://earth.google.com/kml/2.2'].includes(root.namespaceURI))throw Error('Invalid KML document');}
 return {imagePaths:archive.entries.filter(e=>!e.directory&&/\.(png|jpe?g)$/i.test(e.name)).map(e=>e.name),warnings:[]};
}
