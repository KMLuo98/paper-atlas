export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const initials=s=>Array.from(String(s||'?').replace(/@.*$/,'')).slice(0,2).join('').toUpperCase();
export const fmtDate=(value,full=false)=>{const d=new Date(value);if(!Number.isFinite(+d))return '—';return new Intl.DateTimeFormat('zh-CN',full?{dateStyle:'medium',timeStyle:'short'}:{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);};
export const bytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB';
export function fuzzy(text,query){text=String(text).toLowerCase();query=String(query).toLowerCase().trim();if(text.includes(query))return true;let at=0;for(const c of text)if(c===query[at])at++;return at===query.length;}
export function csvCell(v){let s=String(v??'');if(/^[\s]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function exportCSV(messages,accounts,categories){return '\ufeff'+[['邮箱标签','时间','发件人','发件邮箱','主题','分类','正文'],...messages.map(m=>[accounts.find(a=>a.id===m.account_id)?.label||'',m.received_at,m.from_name,m.from_email,m.subject,categories.find(c=>c.id===m.category_id)?.name||'未分类',m.text_body])].map(r=>r.map(csvCell).join(',')).join('\r\n');}
export function mboxEntry(raw){return 'From MAILER-DAEMON '+new Date().toUTCString()+'\n'+raw.replace(/\r?\n/g,'\n').replace(/^From /gm,'>From ').replace(/\n*$/,'\n\n');}
export function countRows(rows,predicate){return rows.filter(predicate).reduce((n,r)=>n+(Number(r.total)||1),0);}
