import {normalizeORCID} from './author-identity.js';
const decode=value=>String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|\d+);/gi,entity=>{
  const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(named[entity])return named[entity];
  const n=entity[2]?.toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):parseInt(entity.slice(2,-1),10);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
});
export function publicURL(value) {
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!u.hostname.includes('.')||/^[\d.]+$|:|(?:^|\.)(?:localhost|local|internal|invalid|test)$/i.test(u.hostname))return '';u.hash='';return u.href;}catch{return '';}
}
export function htmlText(value) {return decode(decode(String(value||'')).replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();}
export function parseSearchRSS(xml) {
  return [...String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(match=>{
    const field=name=>match[1].match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'';
    const url=publicURL(decode(field('link')));return url?[{url,title:htmlText(field('title')).slice(0,350),excerpt:htmlText(field('description')).slice(0,1800),kind:'网页检索摘录',full_page:false}]:[];
  }).slice(0,10);
}
async function boundedText(response,max=200000) {
  if(!response.ok)throw Error('Public source unavailable');const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;const available=max-length;if(available<=0)break;chunks.push(value.slice(0,available));length+=Math.min(value.length,available);if(length>=max)break;}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
const compact=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function mentions(item,person){const text=compact(item.title+' '+item.excerpt);return [person.name,...(Array.isArray(person.aliases)?person.aliases:[])].some(name=>name&&text.includes(compact(name)));}
const trustedPage=host=>/(?:^|\.)(?:edu|edu\.cn|ac\.uk|ac\.cn|ac\.jp|edu\.au|cas\.cn|mpg\.de|cnrs\.fr|nature\.com|science\.org|aip\.org|aps\.org|reuters\.com|apnews\.com|bbc\.com|bbc\.co\.uk|sciencenet\.cn|news\.cn)$/.test(host);
function privateAddress(ip){if(ip.includes(':'))return /^(?:fc|fd|fe[89ab]|::)|:ffff:/i.test(ip);const a=ip.split('.').map(Number);return a[0]===0||a[0]===10||a[0]===127||a[0]>=224||(a[0]===169&&a[1]===254)||(a[0]===172&&a[1]>=16&&a[1]<=31)||(a[0]===192&&a[1]===168)||(a[0]===100&&a[1]>=64&&a[1]<=127)||(a[0]===198&&[18,19].includes(a[1]));}
async function enrich(item,fetcher) {
  const url=new URL(item.url);if(!trustedPage(url.hostname)||!globalThis.Deno?.resolveDns)return item;
  try{
    const addresses=await Promise.allSettled(['A','AAAA'].map(type=>globalThis.Deno.resolveDns(url.hostname,type)));
    const ips=addresses.flatMap(result=>result.status==='fulfilled'?result.value:[]);if(!ips.length||ips.some(privateAddress))return item;
    const response=await fetcher(item.url,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{Accept:'text/html'}});
    if(!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();return item;}
    const text=htmlText(await boundedText(response)).slice(0,10000);return text.length>100?{...item,excerpt:text,kind:'公开新闻或机构/个人主页',full_page:true}:item;
  }catch{return item;}
}
export async function collectPublicEvidence(authors,fetcher=fetch) {
  const [a,b]=authors,searchName=person=>(Array.isArray(person.aliases)?person.aliases:[]).find(name=>/[A-Za-z]/.test(name))||person.name;
  const queries=[`"${a.name}" "${b.name}"`,...authors.map(person=>`"${searchName(person)}" ${person.institution||''} laboratory biography employment ResearchGate 新闻`)],evidence=[],notices=[];
  const searches=await Promise.allSettled(queries.map(async query=>{const url=new URL('https://www.bing.com/search');url.searchParams.set('format','rss');url.searchParams.set('q',query.slice(0,500));return parseSearchRSS(await boundedText(await fetcher(url,{signal:AbortSignal.timeout(8000)})));}));
  searches.forEach(result=>{if(result.status==='fulfilled')evidence.push(...result.value.filter(item=>authors.some(person=>mentions(item,person))));else notices.push('部分公开网页检索不可用');});
  const orcidResults=await Promise.allSettled(authors.map(async person=>{
    const id=normalizeORCID(person.orcid);if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id))return [];
    const response=await fetcher(`https://pub.orcid.org/v3.0/${id}/person`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
    const profile=JSON.parse(await boundedText(response));const jobs=[];
    const activities=await Promise.allSettled(['employments','educations'].map(async kind=>{const r=await fetcher(`https://pub.orcid.org/v3.0/${id}/${kind}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});return JSON.parse(await boundedText(r));}));
    for(const activity of activities){if(activity.status!=='fulfilled')continue;for(const group of activity.value['affiliation-group']||[])for(const summaries of group.summaries||[]){const row=summaries['employment-summary']||summaries['education-summary'];if(!row)continue;const date=d=>d?[d.year?.value,d.month?.value,d.day?.value].filter(Boolean).join('-'):null;jobs.push({institution:row.organization?.name,department:row['department-name'],role:row['role-title'],start:date(row['start-date']),end:date(row['end-date'])});}}
    const items=[{url:`https://orcid.org/${id}`,title:`ORCID · ${person.name}`,excerpt:JSON.stringify({biography:profile.biography?.content||'公开 ORCID 身份记录',affiliations:jobs}),kind:'ORCID 身份资料',full_page:true}];
    for(const item of profile['researcher-urls']?.['researcher-url']||[]){const url=publicURL(item.url?.value);if(url)items.push({url,title:item['url-name']||person.name,excerpt:'该链接由作者在其 ORCID 个人资料中列出。',kind:'ORCID 关联主页',full_page:false});}return items;
  }));
  orcidResults.forEach(result=>{if(result.status==='fulfilled')evidence.push(...result.value);});
  const unique=[...new Map(evidence.map(item=>[item.url,item])).values()].slice(0,8);
  const enriched=await Promise.all(unique.map((item,index)=>index<4?enrich(item,fetcher):item));
  return {items:enriched,notices:[...new Set(notices)],status:`公开检索获得 ${enriched.length} 条相关候选资料；检索摘录与已读取全文分别标注，同名或年龄差本身不能证明关系`};
}
