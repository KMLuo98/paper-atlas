// Keep decoded attachments binary while indexing; encode only the requested download.
export function attachmentSize(content){
 if(content instanceof ArrayBuffer||ArrayBuffer.isView(content))return content.byteLength;
 if(typeof content==='string')return Math.floor(content.length*3/4)-(content.endsWith('==')?2:content.endsWith('=')?1:0);
 return 0;
}
export function attachmentBase64(content){
 if(typeof content==='string')return content;
 const bytes=content instanceof ArrayBuffer?new Uint8Array(content):ArrayBuffer.isView(content)?new Uint8Array(content.buffer,content.byteOffset,content.byteLength):new Uint8Array();
 // Bounded chunks avoid both a whole-file binary string and argument-count overflows.
 const parts=[];for(let at=0;at<bytes.length;at+=24576){const chunk=bytes.subarray(at,at+24576);let text='';for(const byte of chunk)text+=String.fromCharCode(byte);parts.push(btoa(text));}
 return parts.join('');
}
