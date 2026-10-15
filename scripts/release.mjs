import {readdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
async function walk(dir,prefix=''){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=prefix+e.name;if(e.name.startsWith('.'))continue;if(e.isDirectory())result.push(...await walk(dir+'/'+e.name,p+'/'));else result.push(p);}return result;}
const ASSETS=(await walk('web')).filter(n=>n!=='release.js').concat('release.js').sort();
const HASHES={};for(const n of ASSETS)if(n!=='release.js')HASHES[n]=createHash('sha256').update(await readFile('web/'+n)).digest('hex');
const VERSION=(process.argv[2]||'2026.10.15.1')+'-'+createHash('sha256').update(JSON.stringify(HASHES)).digest('hex').slice(0,12);
await writeFile('web/release.js',`export const VERSION=${JSON.stringify(VERSION)};\nexport const ASSETS=${JSON.stringify(ASSETS)};\nexport const HASHES=${JSON.stringify(HASHES)};\n`);
console.log('Release '+VERSION+': '+ASSETS.length+' offline assets');
