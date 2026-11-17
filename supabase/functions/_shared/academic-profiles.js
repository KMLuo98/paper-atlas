import {authorAffiliations} from './author-affiliations.js';
import {safeFetch,bounded,text,publicPhotoURL} from '../mail-api/photos.js';
import {engineResults} from '../mail-api/people-search.js';
import {photoIdentityEvidence,authorPhotoIdentity,authorSearchNames,scholarlyNameMatch} from './author-photos.js';
import {normalizeORCID} from './author-identity.js';
import {discoverAuthorMetricIndexes} from './author-metric-indexes.js';
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
export function indexedScholarMetrics(snippet){
 const metrics={};
 for(const [field,label] of [['citations','Cited by|Citations|被引次数'],['h_index','h[-‐‑– ]?index|h指数'],['i10_index','i10[-‐‑– ]?index|i10指数']]){
  const match=String(snippet||'').match(new RegExp('(?:'+label+')\\s*[:：]?\\s*([\\d,]+)(?=\\s|[;|·—]|$)','i'));
  const value=match?count(match[1]):null;
  if(value!==null)metrics[field]=value;
 }
 return metrics;
}
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
export function bestAcademicMetrics(sources){const result={};for(const source of sources||[])if(['scholar','researchgate','orcid','OpenAlex','Semantic Scholar'].includes(source.provider))for(const field of ['publications','citations','h_index','i10_index']){const n=source.metrics?.[field];if(Number.isSafeInteger(n)&&n>=0&&(!result[field]||n>result[field].value))result[field]={value:n,provider:source.provider,url:source.url,checked_at:source.metric_dates?.[field]||source.checked_at,method:source.metric_methods?.[field]||'profile_page'};}return result;}
export function academicInformationPatch(base,sources,{missingOnly=false}={}){
 const patch={},observations=sources.map(s=>s.academic).filter(Boolean),byURL=new Map((base.academic_metrics?.sources||[]).map(s=>[s.url,s]));
 for(const row of observations){
  if(!missingOnly&&['OpenAlex','Semantic Scholar'].includes(row.provider)&&Object.keys(row.metrics||{}).length){
   for(const [url,prior] of byURL)if(url!==row.url&&prior.provider===row.provider)byURL.delete(url);
  }
  const old=byURL.get(row.url);
  const metrics={...old?.metrics},metric_methods={...old?.metric_methods},metric_dates={...old?.metric_dates};
  for(const [field,value] of Object.entries(row.metrics||{})){
   const method=row.metric_methods?.[field]||'profile_page';
   const priorMethod=metric_methods[field]||'profile_page';
   if(Number.isSafeInteger(metrics[field])&&['profile_page','manual_snapshot'].includes(priorMethod)&&method!=='profile_page')continue;
   if(method==='indexed_snippet'&&priorMethod===method&&metrics[field]===value)continue;
   metrics[field]=value;metric_methods[field]=method;metric_dates[field]=row.metric_dates?.[field]||row.checked_at;
  }
  byURL.set(row.url,{...old,...row,metrics,metric_methods,metric_dates});
  const field=row.provider==='scholar'?'scholar_url':row.provider==='researchgate'?'researchgate_url':null;
  if(field&&!base[field]&&academicProfileURL(row.url)?.provider===row.provider)patch[field]=row.url;
 }
 if(observations.some(row=>Object.keys(row.metrics||{}).length)){let merged=[...byURL.values()];if(missingOnly){const filled=base.academic_metrics?.best||bestAcademicMetrics(base.academic_metrics?.sources||[]);merged=merged.map(row=>({...row,metrics:Object.fromEntries(Object.entries(row.metrics||{}).filter(([field])=>!Number.isSafeInteger(filled[field]?.value)))}));const old=base.academic_metrics?.sources||[];const additions=merged.filter(row=>Object.keys(row.metrics).length);merged=[...old,...additions];const best={...bestAcademicMetrics(additions),...filled};if(additions.length)patch.academic_metrics={sources:merged,best};}else patch.academic_metrics={sources:merged,best:bestAcademicMetrics(merged)};}return patch;
}
export async function discoverAcademicProfiles(person,parseHTML,options={}){
 options={deadline:Date.now()+55000,...options};const identity={...(options.identity||authorPhotoIdentity(person)),orcid:person.orcid||''};identity.organization_aliases=[...new Set([...(identity.organization_aliases||[]),...authorAffiliations(person).flatMap(r=>[r.school,...(r.aliases||[])])])];const names=authorSearchNames(identity),candidates=new Map(),rows=[],stamp=new Date().toISOString();
 for(const value of [person.scholar_url,person.researchgate_url,person.profile_url]){const p=academicProfileURL(value);if(p)candidates.set(p.url,{...p,explicit:true});}
 const diagnostics=new Map();const read=async(url,accept='text/html')=>{const host=new URL(url).hostname,entry=diagnostics.get(host)||{host,readable:0,blocked:0,failed:0};diagnostics.set(host,entry);try{const result=await safeFetch(url,accept,options);if(!result.response.ok){if([401,403,429].includes(result.response.status))entry.blocked++;else entry.failed++;await result.response.body?.cancel();throw Error('Public source unavailable');}const body=text(await bounded(result.response,1800000));if(/<title[^>]*>[^<]*(?:captcha|access denied|just a moment|temporarily unavailable|sign in)/i.test(body)){entry.blocked++;throw Error('Public source restricted');}entry.readable++;return body;}catch(error){if(!entry.blocked&&!entry.failed)entry.failed++;throw error;}};
 const best=person.academic_metrics?.best||{},needsMetric=field=>!options.missingOnly||!Number.isSafeInteger(best[field]?.value),needsProvider=provider=>!person[provider==='scholar'?'scholar_url':'researchgate_url']||(provider==='scholar'?['publications','citations','h_index','i10_index']:['publications','citations','h_index']).some(needsMetric);
 const scholarDirectoryTask=(async()=>{
  if(!needsProvider('scholar')||person.scholar_url||!identity.name)return;
  const queries=[...new Set([identity.name,...names])].slice(0,3);
  await Promise.allSettled(queries.map(async name=>{
   const url=new URL('https://scholar.google.com/citations');
   url.search=new URLSearchParams({view_op:'search_authors',mauthors:name,hl:'en'});
   const {document}=parseHTML(await read(url.href));
   for(const result of document.querySelectorAll('.gsc_1usr')){
    const link=result.querySelector('.gs_ai_name a,.gsc_oai_name a');
    if(!link||!photoIdentityEvidence(identity,{headings:[link.textContent],text:result.textContent}))continue;
    const profile=academicProfileURL(new URL(link.getAttribute('href'),url).href);
    if(profile?.provider==='scholar'&&!candidates.has(profile.url))candidates.set(profile.url,profile);
   }
  }));
 })();
 const homepageTask=(async()=>{
  if(!['scholar','researchgate'].some(needsProvider))return;
  const homepage=person.profile_url||await options.homepageHint;
  if(!homepage||academicProfileURL(homepage))return;
  const {document}=parseHTML(await read(homepage));
  const headings=[...document.querySelectorAll('h1,h2,title')].map(el=>el.textContent);
  const body=document.body?.textContent||document.documentElement.textContent||'';
  if(!headings.some(heading=>[identity.name,...identity.aliases].some(name=>scholarlyNameMatch(name,heading)))&&!photoIdentityEvidence(identity,{headings,text:body,orcids:body.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/gi)||[]}))return;
  for(const link of document.querySelectorAll('a[href]')){
   let url;try{url=new URL(link.getAttribute('href'),homepage).href;}catch{continue;}
   const p=academicProfileURL(url);
   if(p&&needsProvider(p.provider)&&!candidates.has(p.url))candidates.set(p.url,{...p,orcid_linked:true});
  }
 })();
 const knowledgeTask=(async()=>{if(!person.orcid||!['scholar','researchgate'].some(provider=>!person[provider==='scholar'?'scholar_url':'researchgate_url']))return;try{const u=new URL('https://www.wikidata.org/w/api.php');u.search=new URLSearchParams({action:'wbsearchentities',format:'json',language:'en',search:identity.name,limit:'3'}).toString();const data=JSON.parse(await read(u.href,'application/json'));await Promise.allSettled((data.search||[]).filter(hit=>/^Q\d+$/.test(hit.id)).slice(0,3).map(async hit=>{const data=JSON.parse(await read('https://www.wikidata.org/wiki/Special:EntityData/'+hit.id+'.json','application/json'));for(const p of wikidataAcademicLinks(data.entities?.[hit.id],person)){const existing=person[p.provider==='scholar'?'scholar_url':'researchgate_url'];if(!existing&&!candidates.has(p.url))candidates.set(p.url,{...p,orcid_linked:true});}}));}catch{}})();
 let orcidText='';const orcid=normalizeORCID(person.orcid),orcidTask=(async()=>{if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid))return;try{const personData=JSON.parse(await read(`https://pub.orcid.org/v3.0/${orcid}/person`,'application/json'));orcidText=JSON.stringify(personData);for(const link of personData['researcher-urls']?.['researcher-url']||[]){const p=academicProfileURL(link.url?.value);if(p)candidates.set(p.url,{...p,orcid_linked:true});}}catch{}try{if(!needsMetric('publications'))return;const data=JSON.parse(await read(`https://pub.orcid.org/v3.0/${orcid}/works`,'application/json'));if(Array.isArray(data.group))rows.push({url:'https://orcid.org/'+orcid,title:identity.name,text:identity.name+' '+orcid+' '+orcidText,academic:{provider:'orcid',url:'https://orcid.org/'+orcid,metrics:{publications:orcidPublicationCount(data)},checked_at:stamp}});}catch{}})();
 const variants=names.slice(0,5);
 let next=0;
 const worker=async()=>{
  while(next<variants.length){
   const name=variants[next++];
   await Promise.allSettled(['scholar','researchgate'].filter(needsProvider).flatMap(provider=>{
    const site=provider==='scholar'?'scholar.google.com/citations':'researchgate.net/profile/';
    const known=academicProfileURL(person[provider==='scholar'?'scholar_url':'researchgate_url'])?.url;
    const quoted='site:'+(known||site)+' "'+name+'"';
    const fuzzy='site:'+(known||site)+' '+name+' '+identity.organization;
    const chinese=/\p{Script=Han}/u.test(name);
    const bing=new URLSearchParams({q:fuzzy,mkt:chinese?'zh-CN':'en-US',setlang:chinese?'zh-Hans':'en'});
    const acceptProfile=url=>academicProfileURL(url)?.provider===provider;
    return [
     'https://www.bing.com/search?'+bing,
     'https://www.bing.com/search?'+new URLSearchParams({...Object.fromEntries(bing),format:'rss'}),
     'https://www.google.com/search?'+new URLSearchParams({q:quoted,num:'6'})
    ].map(async url=>{
     const html=await read(url,'text/html,application/rss+xml');
     for(const hit of engineResults(html,url,parseHTML,{name,matchName:()=>true,acceptSearchHost:acceptProfile,acceptResultURL:acceptProfile})){
      const profile=academicProfileURL(hit.url);
      if(profile?.provider!==provider||(known&&profile.url!==known))continue;
      const verified=photoIdentityEvidence(identity,{headings:[hit.title],text:hit.snippet,orcids:(hit.snippet||'').match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/gi)||[]});
      const prior=candidates.get(profile.url);
      if(verified&&!prior?.indexed)candidates.set(profile.url,{...prior,...profile,indexed:hit});
      else if(!prior)candidates.set(profile.url,profile);
     }
    });
   }));
  }
 };
 const indexTask = identity.name && ['publications','citations','h_index','i10_index'].some(needsMetric)
   ? discoverAuthorMetricIndexes(person,identity,read,stamp).then(found => rows.push(...found)) : null;
 await Promise.allSettled([worker(),worker(),orcidTask,homepageTask,knowledgeTask,scholarDirectoryTask,indexTask]);
 if(needsProvider('researchgate')&&!person.researchgate_url&&![...candidates.values()].some(p=>p.provider==='researchgate'&&(p.indexed||p.orcid_linked))){
  const slugs=[...new Set([identity.name,...names].filter(name=>/^[\p{Script=Latin} .’'\-]+$/u.test(name))
   .map(name=>{const parts=name.trim().split(/\s+/);return parts.length>1?[parts[0],parts.at(-1)].join('-'):'';}).filter(Boolean))].slice(0,2);
  for(const slug of slugs){const profile=academicProfileURL('https://www.researchgate.net/profile/'+encodeURIComponent(slug));if(profile&&!candidates.has(profile.url))candidates.set(profile.url,profile);}
 }
 const priority=p=>p.explicit?3:p.orcid_linked?2:p.indexed?1:0;
 const choices=[...candidates.values()].filter(p=>needsProvider(p.provider)).sort((a,b)=>priority(b)-priority(a));
 const verifiedProfiles=[];
 await Promise.allSettled([...choices.filter(p=>p.provider==='scholar').slice(0,4),...choices.filter(p=>p.provider==='researchgate').slice(0,4)].map(async p=>{
  // A verified search hit or ORCID link can establish the URL even if the page is unavailable.
  const escape=value=>String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const indexed=p.indexed?(p.provider==='scholar'?indexedScholarMetrics(p.indexed.snippet):parseAcademicMetrics('<main>'+escape(p.indexed.snippet)+'</main>',p.provider,parseHTML)):{};
  const entry={url:p.url,title:identity.name,text:identity.name+' '+p.url+' '+(p.indexed?.snippet||''),academic:{provider:p.provider,url:p.url,metrics:indexed,metric_methods:Object.fromEntries(Object.keys(indexed).map(k=>[k,'indexed_snippet'])),checked_at:stamp}};
  try{const html=await read(p.url),{document}=parseHTML(html),heading=document.querySelector('#gsc_prf_in,h1')?.textContent||document.querySelector('title')?.textContent||'',body=document.body?.textContent||document.documentElement.textContent||'';
   const diagnostic=diagnostics.get(new URL(p.url).hostname);if(diagnostic){diagnostic.profile_heading=heading.slice(0,160);diagnostic.metrics_table_rows=document.querySelectorAll('#gsc_rsb_st tr').length;}
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
  verifiedProfiles.push({entry,priority:priority(p)>=2?priority(p):0});
 }));
 for(const provider of ['scholar','researchgate']){
  const candidates=verifiedProfiles.filter(row=>row.entry.academic.provider===provider);
  if(!candidates.length)continue;
  const highest=Math.max(...candidates.map(row=>row.priority));
  const matches=candidates.filter(row=>row.priority===highest);
  if(matches.length===1)rows.push(matches[0].entry);
 }
 rows.diagnostics=[...diagnostics.values()];return rows;
}
