// Versioned separately from the old whole-thread translation cache.
export const TRANSLATION_PREFIX='latest-v1:';
const blockTags=new Set(['DIV','P','BR','LI','TR','H1','H2','H3','H4','PRE','TABLE','SECTION','HR']);
function htmlLatest(html,parseHTML){
 const {document}=parseHTML('<html><body>'+html+'</body></html>');let text='',quoted=false;
 function visit(node){
  if(quoted)return;
  if(node.nodeType===3){text+=node.textContent;return;}
  if(node.nodeType!==1)return;
  if(node.matches('script,style,head,noscript,[hidden]'))return;
  if(node.matches('blockquote,.gmail_quote,.yahoo_quoted,.protonmail_quote,.moz-cite-prefix,#divRplyFwdMsg,#appendonsend,[name="quote"],[data-marker="__QUOTED_TEXT__"]')){quoted=true;return;}
  const block=blockTags.has(node.tagName);if(block)text+='\n';
  for(const child of node.childNodes)visit(child);
  if(block)text+='\n';
 }
 visit(document.body);return {text:text.replace(/\n[\t ]*\n(?:[\t ]*\n)+/g,'\n\n'),quoted};
}
export function stripMailHistory(value){
 const lines=String(value||'').replace(/\r\n?/g,'\n').split('\n'),kept=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],near=lines.slice(i,i+7).join('\n');
  if(/^\s*(?:[-_]{2,}\s*(?:Original Message|Forwarded message|原始邮件|转发邮件)|Begin forwarded message\s*:|[-_]{3,}\s*$)/i.test(line)&&(/Original Message|Forwarded message|原始邮件|转发邮件|Begin forwarded message/i.test(line)||/^\s*(?:From|发件人)\s*[:：]/im.test(near)))break;
  // Reply introductions are often wrapped across several lines by mail clients.
  if(/^\s*(?:On\s|在\s*\d|于\s*\d)/i.test(line)&&[1,2,3,4,5].some(n=>/^(?:On\s[\s\S]+?wrote\s*:|[在于][\s\S]+?写道\s*[:：])\s*$/i.test(lines.slice(i,i+n).join(' ').trim())))break;
  if(/^\s*(?:On\s.+\bwrote\s*:|[在于].+写道\s*[:：])\s*$/i.test(line))break;
  // A standalone "From:" in the latest message is not enough to cut off content.
  if(/^\s*(?:From|发件人)\s*[:：]/i.test(line)&&/^\s*(?:Sent|Date|To|发送时间|发送日期|日期|收件人)\s*[:：]/im.test(near)&&/^\s*(?:Subject|主题)\s*[:：]/im.test(near))break;
  if(!/^\s*>/.test(line))kept.push(line);
 }
 return kept.join('\n').replace(/\u0000/g,'').toWellFormed().trim();
}
export function latestMailText(message,parseHTML){
 const plain=String(message.text_body||'');
 // HTML quote containers can identify history that has lost its markers in text/plain.
 if(message.html_body){const html=htmlLatest(message.html_body,parseHTML);if(html.quoted||!plain.trim())return stripMailHistory(html.text);}
 return stripMailHistory(plain);
}
export function translationChunks(text,size=1200){
 const chunks=[];let start=0;
 while(start<text.length){
  let end=Math.min(start+size,text.length);
  if(end<text.length){const section=text.slice(start,end),breakAt=Math.max(section.lastIndexOf('\n'),section.lastIndexOf('. '),section.lastIndexOf('。'),section.lastIndexOf(' '));if(breakAt>size/2)end=start+breakAt+1;if(/[\uD800-\uDBFF]/.test(text[end-1]))end--;}
  chunks.push(text.slice(start,end));start=end;
 }
 return chunks;
}
function stateFrom(raw,source,total){try{const s=JSON.parse(raw);return s.version===1&&s.source===source&&s.total===total&&Array.isArray(s.parts)&&s.parts.length<=total&&s.parts.every(p=>typeof p==='string'&&p.trim())?s:null;}catch{return null;}}
export async function translationSource(message,language,parseHTML,hash){const text=latestMailText(message,parseHTML);return {text,source:await hash(JSON.stringify({version:1,subject:message.subject,language,text}))};}
export async function savedLatestTranslations(rows,message,parseHTML,hash){
 const result={};for(const row of rows){if(!row.language.startsWith(TRANSLATION_PREFIX))continue;const language=row.language.slice(TRANSLATION_PREFIX.length),{text,source}=await translationSource(message,language,parseHTML,hash),total=translationChunks(text).length,s=stateFrom(row.content,source,total);if(s&&total&&s.parts.length===total)result[language]=s.parts.join('\n\n');}return result;
}
export async function translateLatestStep({message,language,parseHTML,hash,read,write,translate}){
 const {text,source}=await translationSource(message,language,parseHTML,hash);
 if(!text)throw Error('未找到可翻译的最新正文，邮件可能仅包含引用的历史内容');
 const chunks=translationChunks(text),previous=await read(),state=stateFrom(previous,source,chunks.length)||{version:1,source,total:chunks.length,parts:[]};
 const response=(s,cached)=>({content:s.parts.join('\n\n'),completed:s.parts.length,total:s.total,done:s.parts.length===s.total,cached});
 if(state.parts.length===chunks.length)return response(state,true);
 const index=state.parts.length,part=await translate(chunks[index],{index,total:chunks.length,continuation:index>0});
 if(typeof part!=='string'||!part.trim())throw Error('模型未返回完整译文，请重试');
 state.parts.push(part.replace(/\u0000/g,'').toWellFormed().trim());
 if(!await write(JSON.stringify(state),previous)){
  // Another tab advanced the same cache; never overwrite its newer progress.
  const current=stateFrom(await read(),source,chunks.length);if(current)return response(current,true);
  throw Error('翻译进度已更新，请重试');
 }
 return response(state,false);
}
