export function safeEntryName(name){if(typeof name!=='string'||!name||name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.split('/').some(p=>p==='..'||p==='.')||/^[A-Za-z]:/.test(name))throw Error('Unsafe archive path');return name;}
export function resolvePackageTarget(base,target){
 let decoded;try{decoded=decodeURIComponent(target.split('#')[0]);}catch{throw Error('Invalid package URI encoding');}
 if(!decoded||decoded.includes('\\')||decoded.includes('\0')||/^[a-z][a-z0-9+.-]*:/i.test(decoded)||decoded.startsWith('//'))throw Error('Invalid internal relationship URI');
 const stack=decoded.startsWith('/')?[]:base.split('/').filter(Boolean);
 for(const p of decoded.split('/')){if(!p||p==='.')continue;if(p==='..'){if(!stack.length)throw Error('Relationship escapes package');stack.pop();}else stack.push(p);}
 const result=stack.join('/');safeEntryName(result);return result;
}
