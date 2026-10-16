import XML from '../vendor/xml.js';
export function parseXml(bytes){
 const encoding=bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8';
 const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML declarations with entities or DTDs are not supported');
 const errors=[];const doc=new XML.DOMParser({onError:(level,message)=>{if(level!=='warning')errors.push(message);}}).parseFromString(text,'application/xml');
 if(errors.length||!doc.documentElement)throw Error('Malformed package XML');return doc;
}
