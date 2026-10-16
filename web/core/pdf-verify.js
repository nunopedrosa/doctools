// Compare the entire logical graph using the writer's explicit renumbering map.
// References are mapped bijectively; rendering alone cannot establish preservation.
export function verifyPdfSnapshots(before,after,replacements=new Map(),mapping={}){
 const fail=message=>{throw Error('PDF preservation check failed: '+message);};
 const ids=Object.keys(before.objects),dest=ids.map(id=>mapping[id]);
 if(dest.some(id=>!id||!Object.hasOwn(after.objects,id))||new Set(dest).size!==dest.length||dest.length!==Object.keys(after.objects).length)fail('object inventory or aliasing changed');
 function walk(a,b){
  if(a&&typeof a==='object'&&Object.hasOwn(a,'ref')){if(!b||b.ref!==mapping[a.ref])fail('reference changed');return;}
  if(a===null||typeof a!=='object'){if(a!==b)fail('protected scalar changed');return;}
  if(!b||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))fail('object type changed');
  const keys=Object.keys(a);if(keys.length!==Object.keys(b).length||keys.some(k=>!Object.hasOwn(b,k)))fail('dictionary or array changed');for(const k of keys)walk(a[k],b[k]);
 }
 function streamValue(s){const v=structuredClone(s.value);delete v.dict['/Length'];if(s.decoded){delete v.dict['/Filter'];delete v.dict['/DecodeParms'];}return v;}
 for(const id of ids){const a=before.objects[id],b=after.objects[mapping[id]];
  if(Object.hasOwn(a,'stream')){if(!Object.hasOwn(b,'stream'))fail('stream removed');walk(streamValue(a),streamValue(b));const r=replacements.get(id);if(b.stream!==(r?r.hash:a.stream))fail('protected stream data changed');}
  else walk(a,b);
 }
 function trailer(s){const d=structuredClone(s.trailer);for(const k of ['/Size','/Prev','/XRefStm','/ID','/Type','/W','/Index','/Length','/Filter','/DecodeParms'])delete d.dict[k];return d;}
 walk(trailer(before),trailer(after));
 if(before.trailer.dict['/ID']){const old=before.trailer.dict['/ID'].array?.[0],fresh=after.trailer.dict['/ID']?.array?.[0];walk(old,fresh);}
 return true;
}
