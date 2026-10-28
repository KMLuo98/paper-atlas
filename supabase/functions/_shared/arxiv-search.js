import {htmlText} from './web-evidence.js';
import {sameAuthor} from './author-identity.js';
const canonical=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const doi=value=>String(value||'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').trim().toLowerCase();
export function arxivLink(value){try{const u=new URL(value);if(!['arxiv.org','www.arxiv.org','export.arxiv.org'].includes(u.hostname))return '';const id=u.pathname.match(/^\/(?:abs|pdf)\/(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?(?:\.pdf)?$/i)?.[1];return id?'https://arxiv.org/abs/'+id:'';}catch{return '';}}
export function parseArxivEntries(xml){return [...String(xml).matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(([,entry])=>{
 const field=tag=>htmlText(entry.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>','i'))?.[1]||'').trim();
 return {url:arxivLink(field('id')),title:field('title'),doi:doi(field('arxiv:doi')),authors:[...entry.matchAll(/<author\b[^>]*>[\s\S]*?<name(?:\s[^>]*)?>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)].map(m=>htmlText(m[1]).trim())};
}).filter(row=>row.url&&row.title);}
export function matchArxiv(result,entries){
 const linked=entries.filter(row=>result.doi&&doi(result.doi)===row.doi);
 const candidates=linked.length?linked:entries.filter(row=>canonical(row.title)===canonical(result.title)&&(result.authors||[]).some(a=>row.authors.some(b=>sameAuthor({name:a},{name:b}))));
 const urls=[...new Set(candidates.map(row=>row.url))];return urls.length===1?urls[0]:'';
}
const caches=new WeakMap();
export function dataciteArxivEntries(data){return (Array.isArray(data?.data)?data.data:[]).flatMap(item=>{
 const a=item.attributes||{},url=arxivLink(a.url)||arxivLink('https://arxiv.org/abs/'+String(item.id||'').replace(/^10\.48550\/arxiv\./i,''));if(!url)return [];
 const authors=(a.creators||[]).map(person=>[person.givenName,person.familyName].filter(Boolean).join(' ')||String(person.name||'').split(',').reverse().join(' ').trim()),linked=(a.relatedIdentifiers||[]).filter(r=>r.relatedIdentifierType==='DOI'&&['IsVersionOf','IsPreprintOf','IsIdenticalTo'].includes(r.relationType));
 return (a.titles||[]).flatMap(t=>(linked.length?linked:[{}]).map(r=>({url,title:t.title,authors,doi:doi(r.relatedIdentifier)})));
});}
export async function enrichArxivResults(results,fetcher=fetch){
 let cache=caches.get(fetcher);if(!cache){cache=new Map();caches.set(fetcher,cache);}const now=Date.now(),key=row=>doi(row.doi)+'|'+canonical(row.title)+'|'+(row.authors||[]).join('|');
 let pending=results.filter(row=>!arxivLink(row.url)&&(!cache.has(key(row))||cache.get(key(row)).expires<now));
 let unavailable=false;
 // arXiv registers its DOIs with DataCite, whose title and creator records
 // remain searchable even when the arXiv API is throttled or a journal DOI changed.
 if(pending.length)try{
  const url=new URL('https://api.datacite.org/dois');url.searchParams.set('prefix','10.48550');url.searchParams.set('page[size]','100');url.searchParams.set('query',pending.map(row=>'titles.title:"'+String(row.title).replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,350)+'"').join(' OR '));
  const response=await fetcher(url,{headers:{Accept:'application/vnd.api+json'},signal:AbortSignal.timeout(9000)});if(!response.ok)throw Error('DataCite unavailable');const data=await response.json();if(!Array.isArray(data.data))throw Error('Invalid DOI records');const entries=dataciteArxivEntries(data);
  for(const row of pending){const match=matchArxiv(row,entries);if(match)cache.set(key(row),{url:match,expires:now+3600000});}
  pending=pending.filter(row=>!cache.get(key(row))?.url);
 }catch{/* Continue with arXiv and publication DOI mappings. */}
 if(pending.length)try{
  // One batched request per result page; no request per individual paper.
  const url=new URL('https://export.arxiv.org/api/query');url.searchParams.set('search_query',pending.map(row=>'ti:"'+String(row.title).replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,350)+'"').join(' OR '));url.searchParams.set('max_results','100');
  const response=await fetcher(url,{headers:{Accept:'application/atom+xml','User-Agent':'PaperAtlas/1.2 (+https://kmluo98.github.io/paper-atlas/)'},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error('arXiv unavailable');const xml=await response.text();if(xml.length>2000000||!/<feed\b/i.test(xml)||/<id>[^<]*api\/errors/i.test(xml))throw Error('Invalid arXiv feed');
  const entries=parseArxivEntries(xml);for(const row of pending)cache.set(key(row),{url:matchArxiv(row,entries),expires:now+3600000});while(cache.size>1000)cache.delete(cache.keys().next().value);
 }catch{unavailable=true;}
 // Semantic Scholar's public DOI-to-external-ID mapping is a fallback when
 // the arXiv metadata endpoint is throttled or has not found a title revision.
 const unresolved=pending.filter(row=>row.doi&&!cache.get(key(row))?.url);
 if(unresolved.length)try{
  const response=await fetcher(new URL('https://api.semanticscholar.org/graph/v1/paper/batch?fields=title,externalIds'),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({ids:unresolved.map(row=>'DOI:'+doi(row.doi))}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Mapping unavailable');const data=await response.json();if(!Array.isArray(data)||data.length!==unresolved.length)throw Error('Invalid mapping');
  data.forEach((paper,index)=>{const row=unresolved[index],ids=paper?.externalIds,url=arxivLink('https://arxiv.org/abs/'+String(ids?.ArXiv||''));if(url&&doi(ids?.DOI)===doi(row.doi))cache.set(key(row),{url,expires:now+3600000});});
  if(unresolved.every(row=>cache.get(key(row))?.url))unavailable=false;
 }catch{/* Preserve all original search results and retry a failed lookup later. */}
 return {results:results.map(row=>({...row,arxiv_url:arxivLink(row.url)||cache.get(key(row))?.url||''})),arxiv_status:unavailable?'unavailable':'checked'};
}
