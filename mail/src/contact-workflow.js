export function contactEmails(c={}){c=c||{};return [...new Set([c.email,...(c.emails||[]),c.second_email].map(x=>String(x||'').trim().toLowerCase()).filter(Boolean))];}
export function contactLetter(c){const name=String(c.name||c.email||'').trim();const initial=name[0]?.toUpperCase()||'#';if(/^[A-Z]$/.test(initial))return initial;const boundaries='阿八嚓搭蛾发旮哈击喀垃妈拿哦啪期然撒塌挖昔压匝';const letters='ABCDEFGHJKLMNOPQRSTWXYZ';if(/\p{Script=Han}/u.test(initial)){let result='A';for(let i=0;i<boundaries.length;i++){if(initial.localeCompare(boundaries[i],'zh-CN-u-co-pinyin')>=0)result=letters[i]||'Z';}return result;}return '#';}
export function sortedContacts(people){return [...people].sort((a,b)=>contactLetter(a).localeCompare(contactLetter(b))||String(a.name||a.email).localeCompare(String(b.name||b.email),'zh-CN-u-co-pinyin'));}
// Only mail indexes live here. Bodies and credentials never enter the cache.
export class MailListCache{
 constructor(storage=null,key='mail-list-cache'){this.storage=storage;this.key=key;this.rows=new Map();try{const rows=JSON.parse(storage?.getItem(key)||'[]');for(const [k,v] of rows)if(Date.now()-v.at<1800000)this.rows.set(k,v);}catch{}}
 get(query){return this.rows.get(JSON.stringify(query));}
 set(query,data){const key=JSON.stringify(query);this.rows.delete(key);this.rows.set(key,{at:Date.now(),data});while(this.rows.size>20)this.rows.delete(this.rows.keys().next().value);try{this.storage?.setItem(this.key,JSON.stringify([...this.rows]));}catch{}}
 clear(){this.rows.clear();try{this.storage?.removeItem(this.key);}catch{}}
}
