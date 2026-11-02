const tags=new Set(['P','DIV','SPAN','BR','B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','A','FONT']);
const discard=new Set(['SCRIPT','STYLE','HEAD','TITLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','IMG','VIDEO','AUDIO','LINK','META']);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const plainMailHTML=text=>'<div>'+escape(text||'').replace(/\r\n?|\n/g,'<br>')+'</div>';
function styles(node){
 const output=[];for(const declaration of String(node.getAttribute('style')||'').split(';')){
  const colon=declaration.indexOf(':');if(colon<0)continue;const key=declaration.slice(0,colon).trim().toLowerCase();let value=declaration.slice(colon+1).trim(),valid=false;
  if(key==='font-size')value=({'x-small':'10px',small:'13px',medium:'16px',large:'18px','x-large':'24px','xx-large':'32px','xxx-large':'48px','-webkit-xxx-large':'48px'})[value]||value;
  if(['color','background-color'].includes(key))valid=/^(?:#[\da-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s,.%]+\))$/i.test(value);
  if(key==='font-size'){const m=value.match(/^(\d+(?:\.\d+)?)(px|pt)$/);valid=!!m&&+m[1]>=6&&+m[1]<=96;}
  if(key==='font-family')valid=/^[a-zA-Z\s,'"-]{1,120}$/.test(value);
  if(key==='font-weight')valid=/^(normal|bold|[1-9]00)$/.test(value);
  if(key==='font-style')valid=/^(normal|italic|oblique)$/.test(value);
  if(key==='text-decoration')valid=/^(none|underline|line-through|underline line-through)$/.test(value);
  if(key==='text-align')valid=/^(left|right|center|justify|start|end)$/.test(value);
  if(valid)output.push(key+':'+value);
 }
 if(node.tagName==='FONT'){
  const size=Number(node.getAttribute('size'));if(size>=1&&size<=7)output.push('font-size:'+([0,10,13,16,18,24,32,48][size])+'px');
  const color=node.getAttribute('color');if(color&&/^(#[\da-f]{3,8}|[a-z]{3,20})$/i.test(color))output.push('color:'+color);
  const face=node.getAttribute('face');if(face&&/^[a-zA-Z\s,'"-]{1,120}$/.test(face))output.push('font-family:'+face);
 }
 const align=node.getAttribute('align');if(/^(left|right|center|justify)$/.test(align||''))output.push('text-align:'+align);
 return output.join(';');
}
export function sanitizeMailHTML(raw,parseHTML){
 if(typeof raw!=='string'||!raw.trim())return '';
 if(raw.length>1000000)throw Error('邮件格式内容过大，请精简后重试');
 const {document}=parseHTML('<html><body>'+raw+'</body></html>');
 function nodeHTML(node){
  if(node.nodeType===3)return escape(node.textContent);if(node.nodeType!==1||discard.has(node.tagName))return '';
  const children=[...node.childNodes].map(nodeHTML).join('');if(!tags.has(node.tagName))return children;
  const tag=node.tagName==='FONT'?'span':node.tagName.toLowerCase(),style=styles(node);let attributes=style?' style="'+escape(style)+'"':'';
  if(tag==='a'){const href=String(node.getAttribute('href')||'').trim();if(/^(https?:\/\/|mailto:)/i.test(href)&&!/[\u0000-\u0020]/.test(href))attributes+=' href="'+escape(href)+'" target="_blank" rel="noopener noreferrer"';}
  if(tag==='br')return '<br>';return '<'+tag+attributes+'>'+children+'</'+tag+'>';
 }
 return [...document.body.childNodes].map(nodeHTML).join('');
}
export function mailHTMLText(html,parseHTML){
 const {document}=parseHTML('<html><body>'+html+'</body></html>');let text='';
 function visit(node){if(node.nodeType===3){text+=node.textContent;return;}if(node.nodeType!==1)return;if(node.tagName==='BR'){text+='\n';return;}const block=['P','DIV','UL','OL','LI','BLOCKQUOTE'].includes(node.tagName);if(block&&text&&!text.endsWith('\n'))text+='\n';for(const child of node.childNodes)visit(child);if(block&&!text.endsWith('\n'))text+='\n';}
 for(const child of document.body.childNodes)visit(child);return text.replace(/\u00a0/g,' ').trim();
}
export function formattedMail(body,html,parseHTML){const safe=sanitizeMailHTML(html,parseHTML);return {text:safe?mailHTMLText(safe,parseHTML):String(body||'').trim(),html:safe};}
