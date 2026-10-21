export const COLUMN_LIMITS={account:[60,360],time:[85,250],sender:[90,500],subject:[130,900],gap:[4,32]};
export function defaultMailLayout(mobile=false){return {account:mobile?80:110,time:mobile?100:115,sender:mobile?140:170,subject:mobile?210:180,gap:mobile?8:12,mode:mobile?'compact':'table'};}
export function cleanMailLayout(value,mobile=false){const result=defaultMailLayout(mobile);for(const [key,[min,max]] of Object.entries(COLUMN_LIMITS)){const n=Number(value?.[key]);if(Number.isFinite(n))result[key]=Math.max(min,Math.min(max,Math.round(n)));}result.mode=mobile&&value?.mode!=='table'?'compact':'table';return result;}
export const mailLayoutKey=(user,mobile)=>'mail-column-layout:'+user+':'+(mobile?'mobile':'desktop');
export function readMailLayout(storage,user,mobile=false){try{return cleanMailLayout(JSON.parse(storage?.getItem(mailLayoutKey(user,mobile))||'null'),mobile);}catch{return defaultMailLayout(mobile);}}
export function writeMailLayout(storage,user,mobile,value){const result=cleanMailLayout(value,mobile);storage?.setItem(mailLayoutKey(user,mobile),JSON.stringify(result));return result;}
export function resizeMailColumn(layout,key,delta,mobile=false){return cleanMailLayout({...layout,[key]:Number(layout[key])+delta},mobile);}
export function mailLayoutStyle(layout){return Object.keys(COLUMN_LIMITS).map(key=>'--mail-'+key+':'+layout[key]+'px').join(';');}
