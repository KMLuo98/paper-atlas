import {authorAffiliations} from './author-affiliations.js';
import {safeFetch,bounded,text,publicPhotoURL} from '../mail-api/photos.js';
import {engineResults} from '../mail-api/people-search.js';
import {photoIdentityEvidence,authorPhotoIdentity,authorSearchNames,scholarlyNameMatch} from './author-photos.js';
import {normalizeORCID} from './author-identity.js';
export function academicProfileURL(value){
 const safe=publicPhotoURL(value);if(!safe)return null;const u=new URL(safe);
 if(['com','com.hk','com.cn','co.uk','de','fr','es','it','ch','at','nl','ca','com.au','co.in','co.jp','co.kr','com.br'].some(domain=>u.hostname==='scholar.google.'+domain)&&u.pathname==='/citations'&&/^[\w-]{4,80}$/.test(u.searchParams.get('user')||''))return {provider:'scholar',url:'https://scholar.google.com/citations?user='+u.searchParams.get('user')};
 if(/^(?:www\.)?researchgate\.net$/.test(u.hostname)&&/^\/profile\/[^/]+\/?$/.test(u.pathname))return {provider:'researchgate',url:'https://www.researchgate.net'+u.pathname.replace(/\/$/,'')};
 return null;
}
export function wikidataAcademicLinks(entity,person){
 const orcid=normalizeORCID(person.orcid),claims=entity?.claims||{},values=key=>(claims[key]||[]).filter(c=>c.rank!=='deprecated').map(c=>c.mainsnak?.datavalue?.value).filter(v=>typeof v==='string'),names=Object.values(entity?.labels||{}).map(v=>v.value);
 if(!orcid||!values('P496').some(value=>normalizeORCID(value)===orcid)||!names.some(name=>[person.english_name,...(person.aliases||[])].some(known=>scholarlyNameMatch(known,name))))return [];
 return [...values('P1960').map(id=>academicProfileURL('https://scholar.google.com/citations?user='+encodeURIComponent(id))),...values('P2038').map(id=>academicProfileURL('https://www.researchgate.net/profile/'+encodeURIComponent(id)))].filter(Boolean);
}
const count=value=>{const s=String(value||'').trim().replace(/[,\s\u00a0]/g,'');return /^\d+$/.test(s)&&Number.isSafeInteger(Number(s))&&Number(s)<=1e10?Number(s):null;};
export function indexedScholarMetrics(snippet){const match=String(snippet||'').match(/\bCited by\s+([\d,]+)(?=\s|[;|·—]|$)/i),value=match?count(match[1]):null;return value===null?{}:{citations:value};}
export function parseAcademicMetrics(html,provider,parseHTML){
 const {document}=parseHTML(html),metrics={};
 if(provider==='scholar'){
  for(const row of document.querySelectorAll('#gsc_rsb_st tr')){const cells=[...row.querySelectorAll('td')],label=cells[0]?.textContent.trim().toLowerCase(),value=count(cells[1]?.textContent);if(value===null)continue;const field=/^citations$|^引用次数$|^引用$/.test(label)?'citations':/^h[-‐‑– ]?index$|^h指数$/.test(label)?'h_index':/^i10[-‐‑– ]?index$|^i10指数$/.test(label)?'i10_index':null;if(field)metrics[field]=value;}
  const rows=document.querySelectorAll('.gsc_a_tr'),more=document.querySelector('#gsc_bpf_more');
  // A partial Google Scholar page is never presented as the total number of papers.
  if(more?.hasAttribute('disabled'))metrics.publications=rows.length;
 }else if(provider==='researchgate'){
  for(const el of document.querySelectorAll('script,style,nav,footer'))el.remove();
  for(const [field,label] of [['publications','publications'],['citations','citations'],['h_index','h[-‐‑– ]?index']]){
   const number='((?:\\d{1,3}(?:,\\d{3})+|\\d+))',pattern=new RegExp('^(?:'+label+'\\s*[:(]?\\s*'+number+'\\s*\\)?|'+number+'\\s*'+label+')$','i');
   for(const el of document.querySelectorAll('a,span,div,li,section')){const value=el.textContent.trim().replace(/\s+/g,' ');if(value.length>100)continue;const found=value.match(pattern);if(found){const n=count(found[1]||found[2]);if(n!==null){metrics[field]=n;break;}}}
  }
  if(Object.keys(metrics).length)return metrics;
  const root=document.querySelector('main')||document.body||document.documentElement;const body=(root.innerText||root.textContent||'').replace(/\s+/g,' ').slice(0,10000);
  const first=body.match(/\b(?:publications|citations|h[-‐‑– ]?index|reads)\b/i),reverse=!!first&&/(?:^|\s)\d[\d,]*\s*$/.test(body.slice(0,first.index));
  for(const [field,label] of [['publications','publications'],['citations','citations'],['h_index','h[-‐‑– ]?index']]){
   const number='((?:\\d{1,3}(?:,\\d{3})+|\\d+))',patterns=[new RegExp('\\b'+label+'\\s*[:(]?\\s*'+number+'(?=\\s*(?:[A-Za-z)]|$))','i'),new RegExp('(?:^|\\s)'+number+'\\s+'+label+'\\b','i')];
   for(const pattern of [patterns[reverse?1:0]]){const found=body.match(pattern),value=found?count(found[1]):null;if(value!==null){metrics[field]=value;break;}}
  }
 }
 return metrics;
}
export function orcidPublicationCount(data){return (data.group||[]).filter(g=>(g['work-summary']||[]).some(w=>['journal-article','conference-paper','preprint','working-paper','dissertation','review'].includes(w.type))).length;}
export function bestAcademicMetrics(sources){const result={};for(const source of sources||[])if(['scholar','researchgate','orcid'].includes(source.provider))for(const field of ['publications','citations','h_index','i10_index']){const n=source.metrics?.[field];if(Number.isSafeInteger(n)&&n>=0&&(!result[field]||n>result[field].value))result[field]={value:n,provider:source.provider,url:source.url,checked_at:source.metric_dates?.[field]||source.checked_at,method:source.metric_methods?.[field]||'profile_page'};}return result;}
export function academicInformationPatch(base,sources,{missingOnly=false}={}){
 const patch={},observations=sources.map(s=>s.academic).filter(Boolean),byURL=new Map((base.academic_metrics?.sources||[]).map(s=>[s.url,s]));
 for(const row of observations){const old=byURL.get(row.url);if(Object.keys(row.metrics||{}).length)byURL.set(row.url,{...row,metrics:{...(old?.metrics||{}),...row.metrics},metric_methods:{...(old?.metric_methods||{}),...(row.metric_methods||{})},metric_dates:{...(old?.metric_dates||{}),...Object.fromEntries(Object.keys(row.metrics).map(k=>[k,row.checked_at]))}});else if(!old)byURL.set(row.url,row);const field=row.provider==='scholar'?'scholar_url':row.provider==='researchgate'?'researchgate_url':null;if(field&&!base[field])patch[field]=row.url;}
 if(observations.length){let merged=[...byURL.values()];if(missingOnly){const filled=base.academic_metrics?.best||bestAcademicMetrics(base.academic_metrics?.sources||[]);merged=merged.map(row=>({...row,metrics:Object.fromEntries(Object.entries(row.metrics||{}).filter(([field])=>!Number.isSafeInteger(filled[field]?.value)))}));const old=base.academic_metrics?.sources||[];const additions=merged.filter(row=>Object.keys(row.metrics).length);merged=[...old,...additions];const best={...bestAcademicMetrics(additions),...filled};if(additions.length)patch.academic_metrics={sources:merged,best};}else patch.academic_metrics={sources:merged,best:bestAcademicMetrics(merged)};}return patch;
}
export async function discoverAcademicProfiles(person,parseHTML,options={}){
 options={deadline:Date.now()+55000,...options};const identity=authorPhotoIdentity(person);identity.organization_aliases=[...new Set([...(identity.organization_aliases||[]),...authorAffiliations(person).flatMap(r=>[r.school,...(r.aliases||[])])])];const names=authorSearchNames(identity),candidates=new Map(),rows=[],stamp=new Date().toISOString();
 for(const value of [person.scholar_url,person.researchgate_url,person.profile_url]){const p=academicProfileURL(value);if(p)candidates.set(p.url,{...p,explicit:true});}
 const read=async(url,accept='text/html')=>{const result=await safeFetch(url,accept,options);return text(await bounded(result.response,1800000));};
 const best=person.academic_metrics?.best||{},needsMetric=field=>!options.missingOnly||!Number.isSafeInteger(best[field]?.value),needsProvider=provider=>!person[provider==='scholar'?'scholar_url':'researchgate_url']||(provider==='scholar'?['publications','citations','h_index','i10_index']:['publications','citations','h_index']).some(needsMetric);
 const homepageTask=(async()=>{if(!person.profile_url||academicProfileURL(person.profile_url)||!['scholar','researchgate'].some(needsProvider))return;try{const {document}=parseHTML(await read(person.profile_url)),heading=document.querySelector('h1,title')?.textContent||'',body=document.body?.textContent||document.documentElement.textContent||'';if(![identity.name,...identity.aliases].some(n=>scholarlyNameMatch(n,heading))&&!photoIdentityEvidence(identity,{headings:[heading],text:body,orcids:body.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/gi)||[]}))return;for(const link of document.querySelectorAll('a[href]')){let url;try{url=new URL(link.getAttribute('href'),person.profile_url).href;}catch{continue;}const p=academicProfileURL(url);if(p&&needsProvider(p.provider)&&!candidates.has(p.url))candidates.set(p.url,{...p,orcid_linked:true});}}catch{}})();
 const knowledgeTask=(async()=>{if(!person.orcid||!['scholar','researchgate'].some(provider=>!person[provider==='scholar'?'scholar_url':'researchgate_url']))return;try{const u=new URL('https://www.wikidata.org/w/api.php');u.search=new URLSearchParams({action:'wbsearchentities',format:'json',language:'en',search:identity.name,limit:'3'}).toString();const data=JSON.parse(await read(u.href,'application/json'));await Promise.allSettled((data.search||[]).filter(hit=>/^Q\d+$/.test(hit.id)).slice(0,3).map(async hit=>{const data=JSON.parse(await read('https://www.wikidata.org/wiki/Special:EntityData/'+hit.id+'.json','application/json'));for(const p of wikidataAcademicLinks(data.entities?.[hit.id],person)){const existing=person[p.provider==='scholar'?'scholar_url':'researchgate_url'];if(!existing&&!candidates.has(p.url))candidates.set(p.url,{...p,orcid_linked:true});}}));}catch{}})();
 let orcidText='';const orcid=normalizeORCID(person.orcid),orcidTask=(async()=>{if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid))return;try{const personData=JSON.parse(await read(`https://pub.orcid.org/v3.0/${orcid}/person`,'application/json'));orcidText=JSON.stringify(personData);for(const link of personData['researcher-urls']?.['researcher-url']||[]){const p=academicProfileURL(link.url?.value);if(p)candidates.set(p.url,{...p,orcid_linked:true});}}catch{}try{if(!needsMetric('publications'))return;const data=JSON.parse(await read(`https://pub.orcid.org/v3.0/${orcid}/works`,'application/json'));if(Array.isArray(data.group))rows.push({url:'https://orcid.org/'+orcid,title:identity.name,text:identity.name+' '+orcid+' '+orcidText,academic:{provider:'orcid',url:'https://orcid.org/'+orcid,metrics:{publications:orcidPublicationCount(data)},checked_at:stamp}});}catch{}})();
 let next=0;const worker=async()=>{while(next<names.length){const name=names[next++];await Promise.allSettled(['scholar.google.com/citations','researchgate.net/profile/'].filter(site=>{const provider=site.startsWith('scholar')?'scholar':'researchgate';return needsProvider(provider);}).flatMap(site=>{const provider=site.startsWith('scholar')?'scholar':'researchgate',known=academicProfileURL(person[provider==='scholar'?'scholar_url':'researchgate_url'])?.url;const query='site:'+(known||site)+' "'+name+'"';return ['https://www.bing.com/search?'+new URLSearchParams({q:query,format:'rss'}),'https://www.google.com/search?'+new URLSearchParams({q:query,num:'6'})].map(async url=>{const html=await read(url,'text/html,application/rss+xml');for(const hit of engineResults(html,url,parseHTML,{name})){const p=academicProfileURL(hit.url);if(p&&(!known||p.url===known)&&(!candidates.has(p.url)||!candidates.get(p.url).indexed)&&photoIdentityEvidence(identity,{headings:[hit.title],text:hit.snippet,orcids:(hit.snippet||'').match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/gi)||[]}))candidates.set(p.url,{...candidates.get(p.url),...p,indexed:hit});}});}));}};
 await Promise.allSettled([worker(),worker(),orcidTask,homepageTask,knowledgeTask]);
 const choices=[...candidates.values()].filter(p=>needsProvider(p.provider)&&(p.explicit||p.orcid_linked||[...candidates.values()].filter(q=>q.provider===p.provider).length===1));
 await Promise.allSettled(choices.slice(0,8).map(async p=>{
  // A verified search hit or ORCID link can establish the URL even if the page is unavailable.
  const escape=value=>String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const indexed=p.indexed?(p.provider==='scholar'?indexedScholarMetrics(p.indexed.snippet):parseAcademicMetrics('<main>'+escape(p.indexed.snippet)+'</main>',p.provider,parseHTML)):{};
  const entry={url:p.url,title:identity.name,text:identity.name+' '+p.url+' '+(p.indexed?.snippet||''),academic:{provider:p.provider,url:p.url,metrics:indexed,metric_methods:Object.fromEntries(Object.keys(indexed).map(k=>[k,'indexed_snippet'])),checked_at:stamp}};
  try{const html=await read(p.url),{document}=parseHTML(html),heading=document.querySelector('#gsc_prf_in,h1')?.textContent||document.querySelector('title')?.textContent||'',body=document.body?.textContent||document.documentElement.textContent||'';
   if(/captcha|access denied|verify you are human|just a moment/i.test(document.querySelector('title')?.textContent||''))throw Error('Profile unavailable');
   const linked=(p.explicit||p.orcid_linked)&&[identity.name,...identity.aliases].some(name=>scholarlyNameMatch(name,heading));
   if(linked||photoIdentityEvidence(identity,{headings:[heading],text:body,orcids:body.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/gi)||[]})){entry.text=heading+'\n'+body.slice(0,18000);const direct=parseAcademicMetrics(html,p.provider,parseHTML);Object.assign(entry.academic.metrics,direct);for(const key of Object.keys(direct))entry.academic.metric_methods[key]='profile_page';
    if(p.provider==='scholar'&&needsMetric('publications')&&!('publications' in entry.academic.metrics)){
     const countPage=doc=>[...doc.querySelectorAll('.gsc_a_tr')].map(row=>row.querySelector('a.gsc_a_at')?.getAttribute('href')||row.textContent.trim()).filter(Boolean),articles=new Set(countPage(document));let offset=document.querySelectorAll('.gsc_a_tr').length;
     // Publish a total only if the entire public list was successfully traversed.
     try{for(let page=0;page<20&&offset;page++){const u=new URL(p.url);u.searchParams.set('cstart',String(offset));u.searchParams.set('pagesize','100');u.searchParams.set('hl','en');const {document:next}=parseHTML(await read(u.href)),items=countPage(next);if(!items.length)break;const before=articles.size;items.forEach(v=>articles.add(v));if(articles.size===before)break;offset+=items.length;if(next.querySelector('#gsc_bpf_more')?.hasAttribute('disabled')){entry.academic.metrics.publications=articles.size;break;}}}catch{/* Retain citation metrics; never store a partial publication count. */}
    }
   }else if(!p.indexed&&!p.orcid_linked)return;
  }catch{if(!p.indexed&&!p.orcid_linked&&!p.explicit)return;}
  rows.push(entry);
 }));return rows;
}
