const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function plainTextMailHTML(text){
 const input=String(text||'（此邮件没有正文）');let result='',at=0;
 for(const match of input.matchAll(/https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)){
  const raw=match[0],value=raw.replace(/[.,;!?，。；！？）)]+$/u,''),href=/^https?:/i.test(value)?value:'mailto:'+value;
  result+=escape(input.slice(at,match.index))+'<a href="'+escape(href)+'" target="_blank" rel="noopener noreferrer">'+escape(value)+'</a>'+escape(raw.slice(value.length));at=match.index+raw.length;
 }
 return '<div style="white-space:pre-wrap">'+result+escape(input.slice(at))+'</div>';
}
