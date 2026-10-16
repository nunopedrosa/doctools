export const LIMITS=Object.freeze({input:100*1024*1024,total:250*1024*1024,entries:5000,entry:50*1024*1024});
export function checkLimit(value,max,label){if(!Number.isSafeInteger(value)||value<0||value>max)throw Error(label+' limit exceeded');}
