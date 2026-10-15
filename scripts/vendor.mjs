import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
await mkdir('web/vendor/licenses',{recursive:true});
for(const [from,to] of [
 ['@jsquash/oxipng/codec/pkg/squoosh_oxipng.js','oxipng.js'],
 ['@jsquash/png/codec/pkg/squoosh_png.js','png-decode.js'],
 ['@jsquash/png/codec/pkg/squoosh_png_bg.wasm','squoosh_png_bg.wasm'],
 ['@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm','squoosh_oxipng_bg.wasm'],
 ['@zip.js/zip.js/index.js','zip.js']
]){
 if(to==='zip.js') await build({entryPoints:['node_modules/'+from],bundle:true,format:'esm',outfile:'web/vendor/zip.js',minify:true});
 else await copyFile('node_modules/'+from,'web/vendor/'+to);
}
await build({entryPoints:['node_modules/@xmldom/xmldom/lib/index.js'],bundle:true,format:'esm',outfile:'web/vendor/xml.js',minify:true});
await build({entryPoints:['node_modules/upng-js/UPNG.js'],bundle:true,format:'esm',outfile:'web/vendor/upng.js',minify:true});
await copyFile('node_modules/upng-js/LICENSE','web/vendor/licenses/upng.txt');
await copyFile('node_modules/pako/LICENSE','web/vendor/licenses/pako.txt');
for(const [pkg,name] of [['@jsquash/oxipng','oxipng'],['@jsquash/png','png'],['@zip.js/zip.js','zip'],['@xmldom/xmldom','xml']]){
 for(const filename of ['LICENSE','LICENSE.md','LICENSE.txt']){try{await copyFile('node_modules/'+pkg+'/'+filename,'web/vendor/licenses/'+name+'.txt');break;}catch{}}
}
await copyFile('node_modules/@jsquash/png/codec/LICENSE.codec.md','web/vendor/licenses/png-codec.txt');
const files=['upng.js','png-decode.js','squoosh_png_bg.wasm','zip.js','xml.js','oxipng.js','squoosh_oxipng_bg.wasm','jpeg.js','jpeg.wasm'];
const rows=[];for(const name of files){try{const b=await readFile('web/vendor/'+name);rows.push({name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}catch{}}
await writeFile('docs/vendor-manifest.json',JSON.stringify(rows,null,2)+'\n');
