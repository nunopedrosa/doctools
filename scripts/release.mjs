import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
async function walk(dir,prefix=''){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=prefix+e.name;if(e.name.startsWith('.'))continue;if(e.isDirectory())result.push(...await walk(dir+'/'+e.name,p+'/'));else result.push(p);}return result;}
const ASSETS=(await walk('web')).filter(n=>n!=='release.js').concat('release.js').sort();
const HASHES={};for(const n of ASSETS)if(n!=='release.js')HASHES[n]=createHash('sha256').update(await readFile('web/'+n)).digest('hex');
const VERSION=(process.argv[2]||'2026.10.16.1')+'-'+createHash('sha256').update(JSON.stringify(HASHES)).digest('hex').slice(0,12);
await writeFile('web/release.js',`export const VERSION=${JSON.stringify(VERSION)};\nexport const ASSETS=${JSON.stringify(ASSETS)};\nexport const HASHES=${JSON.stringify(HASHES)};\n`);
console.log('Release '+VERSION+': '+ASSETS.length+' offline assets');

// Deployment sidecar covers the complete public release, including .htaccess,
// which intentionally does not enter service-worker Cache Storage.
const publicFiles=ASSETS.concat('.htaccess').sort();
const deploymentHashes=[];
for(const file of publicFiles){deploymentHashes.push(createHash('sha256').update(await readFile('web/'+file)).digest('hex')+' '+file);}
await mkdir('scripts',{recursive:true});
await writeFile('scripts/deploy-hashes.txt',deploymentHashes.join('\n')+'\n');
let profile;try{profile=await readFile('scripts/deploy-profile.sh','utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
if(profile){
 const block="PUBLIC_FILES=$(cat <<'PUBLIC_FILES'\n"+publicFiles.join('\n')+"\nPUBLIC_FILES\n)";
 const next=profile.replace(/PUBLIC_FILES=\$\(cat <<'PUBLIC_FILES'[\s\S]*?\nPUBLIC_FILES\n\)/,()=>block);
 if(next===profile&&!profile.includes(block))throw Error('Deployment profile inventory block not found');
 await writeFile('scripts/deploy-profile.sh',next);
}
