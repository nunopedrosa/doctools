import createModule from '../vendor/pdf.js';
let ready;async function initialize(){if(!ready)ready=(async()=>{const url=new URL('../vendor/pdf.wasm',import.meta.url),binary=url.protocol==='file:'?new Uint8Array(await(await import('node:fs/promises')).readFile(url)):new Uint8Array(await(await fetch(url)).arrayBuffer());return createModule({wasmBinary:binary,print:()=>{},printErr:()=>{}});})();return ready;}
export async function openPdf(bytes,limits={}){
 if(bytes.length>100*1024*1024)throw Error('PDF input limit exceeded');
 const m=await initialize(),decoder=new TextDecoder(),encoder=new TextEncoder();let handle=0,closed=false;
 const string=p=>{if(!p)return '';let end=p;while(end<m.HEAPU8.length&&end-p<=32*1024*1024&&m.HEAPU8[end])end++;if(end-p>32*1024*1024)throw Error('PDF response size limit');return decoder.decode(m.HEAPU8.subarray(p,end));};
 const err=()=>Error(string(m._ds_pdf_error())||'PDF processing failed');
 function alloc(b){const p=m._malloc(Math.max(1,b.length));if(!p)throw Error('PDF memory limit exceeded');m.HEAPU8.set(b,p);return p;}
 const active=()=>{if(closed||!handle)throw Error('PDF handle is closed');};
 const json=fn=>{active();const p=fn(handle);if(!p)throw err();return JSON.parse(string(p));};
 const result=()=>{const n=m._ds_pdf_size(handle),p=m._ds_pdf_data(handle);if(n>250*1024*1024||(!p&&n))throw Error('PDF output limit exceeded');return m.HEAPU8.slice(p,p+n);};
 function keyCall(id,fn){const p=alloc(encoder.encode(id+'\0'));try{return fn(p);}finally{m._free(p);}}
 const p=alloc(bytes);try{handle=m._ds_pdf_open(p,bytes.length,limits.objects??50000,limits.pages??1000,limits.decoded??250*1024*1024);if(!handle)throw err();}finally{m._free(p);}
 return {
  async inspect(){return json(m._ds_pdf_inspect);},async snapshot(){return json(m._ds_pdf_snapshot);},
  async readImage(id){active();if(!keyCall(id,p=>m._ds_pdf_image(handle,p)))throw err();return result();},
  async write(replacements=new Map()){
   active();for(const [id,b] of replacements){const p=alloc(b);try{if(!keyCall(id,k=>m._ds_pdf_replace(handle,k,p,b.length)))throw err();}finally{m._free(p);}}
   if(!m._ds_pdf_write(handle))throw err();return {bytes:result(),mapping:json(m._ds_pdf_mapping)};
  },
  async close(){if(closed)return;closed=true;if(handle)m._ds_pdf_close(handle);handle=0;}
 };
}
