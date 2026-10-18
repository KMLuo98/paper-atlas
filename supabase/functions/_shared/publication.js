import {normalizePaperJournal} from './journals.js';
import {sameAuthor} from './author-identity.js';
const canonical=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function arxivID(p){const text=[p.arxiv_id,p.doi,p.preprint_url,p.original_filename,(p.full_text||'').slice(0,10000)].join(' ');return text.match(/(?:arxiv[:\s/]*|10\.48550\/arxiv\.)(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?/i)?.[1]||(/^(\d{4}\.\d{4,5})/.exec(p.original_filename||'')?.[1]||'');}
export function exactPublishedMatch(p,work){
 if(work?.type!=='journal-article'||!work['container-title']?.[0]||!work.DOI||canonical(work.title?.[0])!==canonical(p.title))return false;
 const authors=Array.isArray(work.author)?work.author:[];
 return (p.authors||[]).some(a=>authors.some(b=>sameAuthor(a,{name:`${b.given||''} ${b.family||''}`.trim(),orcid:b.ORCID})));
}
export function workDate(work){for(const kind of ['published-online','published-print','published','issued']){const d=work[kind]?.['date-parts']?.[0];if(d?.[0]>1000)return `${d[0]}-${String(d[1]||1).padStart(2,'0')}-${String(d[2]||1).padStart(2,'0')}`;}return null;}
export async function lookupPublication(p,fetcher=fetch){
 const checked=new Date().toISOString(),id=arxivID(p),patch={publication_lookup_at:checked,publication_lookup_status:'not_found'};let work=null,arxivDate=p.arxiv_date||null,doi=String(p.doi||'').replace(/^https?:\/\/doi\.org\//,'');
 const request=async url=>{const r=await fetcher(url,{headers:{'User-Agent':'PaperAtlas/1.2 (private research library)'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Metadata service unavailable');return r;};
 const notes=[];
 if(id){patch.arxiv_id=id;patch.preprint_url=`https://arxiv.org/abs/${id}`;
  try{const xml=await(await request(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`)).text();arxivDate=xml.match(/<published>(\d{4}-\d{2}-\d{2})/)?.[1]||arxivDate;const arxivDOI=xml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/)?.[1]?.trim();if(arxivDOI)doi=arxivDOI;}catch{notes.push('arXiv 暂不可用');}
  patch.arxiv_date=arxivDate;
 }
 try{
  if(doi&&!/^10\.48550\/arxiv\./i.test(doi)){const result=await(await request('https://api.crossref.org/works/'+encodeURIComponent(doi))).json();if(exactPublishedMatch(p,result.message))work=result.message;}
  if(!work&&p.title){const url=new URL('https://api.crossref.org/works');url.searchParams.set('query.title',p.title);url.searchParams.set('rows','8');const result=await(await request(url)).json();work=(result.message?.items||[]).find(w=>exactPublishedMatch(p,w))||null;}
 }catch{notes.push('Crossref 暂不可用');}
 if(work){const date=workDate(work);Object.assign(patch,{publication_lookup_status:'matched',doi:work.DOI,citation_count:Number.isInteger(work['is-referenced-by-count'])?work['is-referenced-by-count']:null,citation_source:'Crossref',citation_url:'https://api.crossref.org/works/'+encodeURIComponent(work.DOI),citation_checked_at:checked});
  // An arXiv record is promoted only after exact title and author identity checks.
  Object.assign(patch,{publication_status:'published',journal:work['container-title'][0],published_at:date,volume:work.volume||p.volume||'',issue:work.issue||p.issue||'',pages:work.page||work['article-number']||p.pages||''});
 }else if(id){Object.assign(patch,{publication_status:'unpublished',journal:'arXiv',journal_abbr:'arXiv',published_at:arxivDate});}
 if(notes.length)patch.publication_lookup_status=work?'matched_partial':'service_unavailable';
 return {...normalizePaperJournal({...p,...patch}),publication_lookup_note:notes.join('；')};
}
