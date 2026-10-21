export const clean=(v,max=1000)=>typeof v==='string'?v.replace(/\u0000/g,'').toWellFormed().trim().slice(0,max):'';
export const email=v=>{const s=clean(v,254).toLowerCase();if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(s))throw Error('邮箱地址无效');return s;};
export const uuid=v=>{if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v))throw Error('记录编号无效');return v;};
export const addresses=v=>{const a=Array.isArray(v)?v:String(v||'').split(/[,;，；]/);if(a.length>50)throw Error('每封邮件最多50位收件人');return a.filter(x=>String(x).trim()).map(email);};
export function validColor(v){if(!/^#[0-9a-f]{6}$/i.test(v||''))throw Error('请选择有效颜色');return v;}
export function publicIPv4(ip){const p=ip.split('.').map(Number);return p.length===4&&p.every(x=>Number.isInteger(x)&&x>=0&&x<=255)&&!(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&[0,168].includes(p[1])||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]===198&&[18,19,51].includes(p[1])||p[0]===203&&p[1]===0);}
export function hostname(v){const h=clean(v,253).toLowerCase();if(!/^(?=.{4,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(h)||h.endsWith('.local')||h.endsWith('.internal')||h.includes('..'))throw Error('服务器须为公网域名');return h;}
export function accountConfig(b){return {imap_host:hostname(b.imap_host),imap_port:993,smtp_host:hostname(b.smtp_host),smtp_port:465,username:clean(b.username,254)||email(b.email)};}
export function safeFilename(s){return clean(s,150).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')||'email';}
export function categoryResult(result,allowed){if(!Array.isArray(result?.items))throw Error('分类结果格式无效');return result.items.filter(x=>typeof x.id==='string'&&(x.category_id===null||allowed.has(x.category_id)));}
export const LIST_COLUMNS='id,account_id,from_email,from_name,subject,received_at,preview,is_read,starred,category_id,category_source,folder,attachments,ai_error';
export function modelText(value){const text=clean(value,100000);const s=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');if(s.startsWith('{'))try{const o=JSON.parse(s);for(const k of ['translation','content','body','text'])if(typeof o[k]==='string')return clean(o[k],100000);}catch{}return text;}
