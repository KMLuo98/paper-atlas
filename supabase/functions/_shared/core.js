import {journalShort} from './paper-details.js';
import {resolveAuthorRecords} from './author-identity.js';
export {journalFull,normalizePaperJournal} from './journals.js';
export {journalShort, normalizeKeywordPairs, keywordFields} from './paper-details.js';
export const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function filename(p) {
  if(p.publication_status==='unpublished'&&!p.arxiv_id&&!/^arxiv$/i.test(p.journal||''))return `[未发表] ${p.title||'未命名论文'}`.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim().slice(0,210)+'.pdf';
  const date = p.published_at || '';
  const stamp = date ? `${date.slice(0,4)}.${Number(date.slice(5,7)) || 1}` : '日期待补充';
  return `[${p.journal_abbr || p.journal || '期刊待补充'} ${stamp}] ${p.title || '未命名论文'}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0,210)+'.pdf';
}
const bibEscape = s => String(s || '').replace(/[\\{}%&#_$]/g, c => `\\${c}`);
const year = p => p.published_at?.slice(0,4) || 'n.d.';
const names = p => (p.authors || []).map(a => a.name);
export function exportCitations(papers, format) {
  if (format === 'bibtex') return papers.map((p,i) => `@${p.publication_status==='unpublished'?'unpublished':'article'}{paper${p.id.replace(/[^a-z0-9]/gi,'') || i},\n  title = {${bibEscape(p.title)}},\n  author = {${names(p).map(bibEscape).join(' and ')}},\n  journal = {${bibEscape(p.journal)}},\n  year = {${year(p)}},\n  month = {${Number(p.published_at?.slice(5,7)) || ''}},\n  volume = {${bibEscape(p.volume)}},\n  number = {${bibEscape(p.issue)}},\n  pages = {${bibEscape(p.pages)}},\n  doi = {${bibEscape(p.doi)}}\n}`).join('\n\n');
  if (format === 'ris') return papers.map(p => [p.publication_status==='unpublished'?'TY  - UNPB':'TY  - JOUR',`TI  - ${p.title}`,...names(p).map(n => `AU  - ${n}`),`JO  - ${p.journal || ''}`,`PY  - ${year(p)}`,`DA  - ${p.published_at || ''}`,`VL  - ${p.volume || ''}`,`IS  - ${p.issue || ''}`,`SP  - ${p.pages || ''}`,`DO  - ${p.doi || ''}`,'ER  - '].join('\r\n')).join('\r\n\r\n');
  if (format === 'csl') return JSON.stringify(papers.map(p => ({id:p.id,type:p.publication_status==='unpublished'?'manuscript':'article-journal',title:p.title,author:(p.authors||[]).map(a=>({literal:a.name})),'container-title':p.journal,issued:p.published_at?{'date-parts':[p.published_at.split('-').map(Number)]}:undefined,DOI:p.doi,volume:p.volume,issue:p.issue,page:p.pages})),null,2);
  return papers.map((p,i) => format === 'gbt' ? `[${i+1}] ${names(p).join(', ')}. ${p.title}[J]. ${p.journal || ''}, ${year(p)}${p.volume ? `, ${p.volume}` : ''}${p.issue ? `(${p.issue})` : ''}${p.pages ? `: ${p.pages}` : ''}.${p.doi ? ` DOI: ${p.doi}.` : ''}` : `${names(p).join(', ')} (${year(p)}). ${p.title}. ${p.journal || ''}${p.volume ? `, ${p.volume}` : ''}${p.issue ? `(${p.issue})` : ''}${p.pages ? `, ${p.pages}` : ''}.${p.doi ? ` https://doi.org/${p.doi}` : ''}`).join('\n\n');
}
export function normalize(s='') { return String(s).normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(); }
const lexicon = [['同步','synchronization','synchronisation','synchrony'],['网络','network','networks'],['振荡','oscillation','oscillator','oscillators'],['变分','variational','variation'],['量子','quantum'],['相变','phase transition'],['混沌','chaos','chaotic'],['机器学习','machine learning'],['动力学','dynamics','dynamical'],['神经','neural','neuron'],['远程','remote'],['耦合','coupling','coupled'],['集体','collective']];
export function queryTerms(query) {
  const q = normalize(query);
  const terms = new Set([q]);
  lexicon.forEach(group => { if(group.some(t=>q.includes(t))) group.forEach(t=>terms.add(t)); });
  return [...terms].filter(Boolean);
}
function editDistance(a,b) {
  const d = Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let prev=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const old=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}
  return d[b.length];
}
export function searchPapers(papers, query) {
  if (!query.trim()) return papers;
  const original=normalize(query), terms=queryTerms(query);
  return papers.map(p=>{
    const content=normalize([p.title,p.journal,p.doi,p.summary,...(p.keywords||[]),...(p.keyword_pairs||[]).flatMap(k=>[k.zh,k.en]),...(p.tags||[]),...(p.search_terms||[]),...(p.authors||[]).flatMap(a=>[a.name,a.institution])].join(' '));
    let score=content.includes(original)?100:0;
    if(!score){ const tokens=original.split(' ');if(tokens.length>1&&tokens.every(t=>content.includes(t)))score=80; }
    terms.forEach(t=>{if(content.includes(t)) score+=3;});
    if(!score&&original.length>=4&&original.length<=32&&!original.includes(' ')) if(content.split(' ').some(w=>Math.abs(w.length-original.length)<=2&&editDistance(w,original)<=Math.floor(original.length/5)))score=1;
    return {p,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.p);
}
export function citationNetwork(papers) {
  const normDoi=s=>String(s||'').toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//,'').trim();
  const edges=[];
  for(const p of papers) for(const ref of p.references||[]){
    const target=papers.find(q=>q.id!==p.id&&((ref.doi&&q.doi&&normDoi(ref.doi)===normDoi(q.doi))||(ref.title&&normalize(ref.title)===normalize(q.title))));
    if(target&&!edges.some(e=>e.source===p.id&&e.target===target.id))edges.push({source:p.id,target:target.id,weight:1});
  }
  return {nodes:papers.map(p=>({id:p.id,label:p.title,short_label:journalShort(p),paper:p})),edges};
}
export function authorNetwork(papers) {
  const authors=new Map(),pairs=new Map(),unique=[...new Map(papers.map(p=>[p.id,p])).values()],paperAuthors=new Map();
  for(const {id,orcid,members} of resolveAuthorRecords(unique)){
    const aliases=[...new Set(members.flatMap(r=>[r.author.name,...(Array.isArray(r.author.aliases)?r.author.aliases:[])]).filter(Boolean))];
    const a=members[0].author;
    authors.set(id,{...a,id,orcid,aliases,label:a.name,institution:members.find(r=>r.author.institution)?.author.institution||'',email:members.find(r=>r.author.email)?.author.email||'',papers:[...new Set(members.map(r=>r.paperId))]});
    members.forEach(r=>{const ids=paperAuthors.get(r.paperId)||new Set();ids.add(id);paperAuthors.set(r.paperId,ids);});
  }
  for(const p of unique){
    const seen=paperAuthors.get(p.id)||new Set();
    const ids=[...seen].sort();
    for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++){
      const key=JSON.stringify([ids[i],ids[j]]); const pair=pairs.get(key)||{source:ids[i],target:ids[j],weight:0,papers:[]};pair.weight++;pair.papers.push(p.id);pairs.set(key,pair);
    }
  }
  return {nodes:[...authors.values()],edges:[...pairs.values()].sort((a,b)=>b.weight-a.weight)};
}
export function safeURL(url) { try {const u=new URL(url);return u.protocol==='https:'?u.href:'';}catch{return '';}}
