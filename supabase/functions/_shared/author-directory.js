import {authorNetwork, normalize, searchPapers} from './core.js';
import {sameAuthor, normalizeORCID, authorNameKeys} from './author-identity.js';
const unique = values => [...new Set(values.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))];
export function publishedPaper(p) {
  if (p.publication_status === 'unpublished' || /^arxiv$/i.test(p.journal || '')) return false;
  return p.publication_status === 'published' || !!(p.journal && p.published_at);
}
export function englishName(names) {
  return unique(names).filter(n => /\p{Script=Latin}/u.test(n) && !/\p{Script=Han}/u.test(n))
    .sort((a, b) => b.replace(/[^\p{L}]/gu, '').length - a.replace(/[^\p{L}]/gu, '').length)[0] || '';
}
export function splitAuthorName(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (name.includes(',')) {const [last, ...first] = name.split(','); return {first_name: first.join(' ').trim(), last_name: last.trim()};}
  const parts = name.split(' '); return {first_name: parts.length > 1 ? parts.slice(0, -1).join(' ') : '', last_name: parts.at(-1) || ''};
}
export function formattedAuthorName(author, format = 'given_family') {
  const first = author.first_name || '', last = author.last_name || '';
  if (!first && !last) return author.english_name || '';
  format = author.name_format && author.name_format !== 'default' ? author.name_format : format;
  if (format === 'family_given') return [last, first].filter(Boolean).join(', ');
  if (format === 'initial_family') return [first.split(/\s+/).filter(Boolean).map(part => part.split('-').map(n => [...n][0]?.toUpperCase() + '.').join('-')).join(' '), last].filter(Boolean).join(' ');
  return [first, last].filter(Boolean).join(' ');
}
export function buildAuthorDirectory(papers, profiles = []) {
  papers = [...new Map(papers.filter(p => !p.deleted_at).map(p => [p.id, p])).values()];
  const raw = authorNetwork(papers), paperMap = new Map(papers.map(p => [p.id, p])), grouped = new Map();
  const identityIndex=new Map(),orcidIndex=new Map(),nameIndex=new Map();
  const index=(map,key,profile)=>{if(!key)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(profile);};
  for(const profile of profiles){for(const key of profile.identity_keys||[])index(identityIndex,key,profile);index(orcidIndex,normalizeORCID(profile.orcid),profile);for(const key of authorNameKeys({name:[profile.first_name,profile.last_name].filter(Boolean).join(' '),aliases:profile.aliases||[]}))index(nameIndex,key,profile);}
  for (const person of raw.nodes) {
    const pool=new Set([...(identityIndex.get(person.id)||[]),...(orcidIndex.get(normalizeORCID(person.orcid))||[]),...authorNameKeys(person).flatMap(key=>[...(nameIndex.get(key)||[])])]);
    const candidates = [...pool].filter(p => {
      if (person.orcid && p.orcid && normalizeORCID(person.orcid) !== normalizeORCID(p.orcid)) return false;
      return p.identity_keys?.includes(person.id) || sameAuthor(person, {name: [p.first_name, p.last_name].filter(Boolean).join(' '), orcid: p.orcid, aliases: p.aliases || []});
    });
    const explicit = candidates.filter(p => p.identity_keys?.includes(person.id));
    let eligible = candidates;
    const known = new Set(eligible.map(p => normalizeORCID(p.orcid)).filter(Boolean));
    if (known.size > 1) eligible = explicit.length === 1 ? explicit : [];
    const profile = [...eligible].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || a.id.localeCompare(b.id))[0];
    const key = profile ? 'profile:' + profile.id : person.id;
    if (!grouped.has(key)) grouped.set(key, {key, profile: profile || null, records: []});
    grouped.get(key).records.push(person);
  }
  return [...grouped.values()].map(({key, profile, records}) => {
    const names = unique(records.flatMap(r => [r.name, ...(r.aliases || [])]));
    const inferred = splitAuthorName(englishName(names)), first_name = profile ? profile.first_name : inferred.first_name, last_name = profile ? profile.last_name : inferred.last_name;
    const aliases = unique([...names, ...(profile?.aliases || []), [first_name, last_name].filter(Boolean).join(' ')]);
    const ownPapers = unique(records.flatMap(r => r.papers || [])).map(id => paperMap.get(id)).filter(Boolean).sort((a, b) => String(b.published_at || b.created_at || '').localeCompare(String(a.published_at || a.created_at || '')));
    const institutions = unique([...records.map(r => r.institution), ...ownPapers.flatMap(p => (p.authors || []).filter(a => records.some(r => sameAuthor(a, r))).map(a => a.institution))]);
    return {key, profile, identity_keys: unique([...records.map(r => r.id), ...(profile?.identity_keys || [])]), first_name, last_name, english_name: [first_name, last_name].filter(Boolean).join(' '),
      name_format: profile?.name_format || 'default', aliases, original_names: names, institution: profile?.institution ?? institutions[0] ?? '', institutions,
      email: profile?.email ?? records.find(r => r.email)?.email ?? '', orcid: profile?.orcid || records.find(r => r.orcid)?.orcid || '', profile_url: profile?.profile_url || '',
      papers: ownPapers, paper_count: ownPapers.length, published_count: ownPapers.filter(publishedPaper).length,
      photo_path: profile?.photo_path || '', photo_source: profile?.photo_source || '', photo_source_url: profile?.photo_source_url || '',
      keywords: profile?.keywords || [], research_summary: profile?.research_summary || '', keywords_paper_ids: profile?.keywords_paper_ids || [], keywords_generated_at: profile?.keywords_generated_at || null};
  });
}
export function filterAuthors(authors, query = '', sort = 'name', format = 'given_family') {
  const words = normalize(query).split(' ').filter(Boolean);
  return authors.filter(a => {const names=[a.english_name,...a.aliases],text = normalize([...names,...names.map(n=>n.replace(/[-.]/g,'')), a.institution, ...a.institutions, a.email, a.orcid].join(' '));return words.every(w => text.includes(w) || text.split(' ').some(token => fuzzyAuthorWord(w, token)));})
    .sort((a, b) => (sort === 'papers' ? b.paper_count - a.paper_count : 0) || formattedAuthorName(a, format).localeCompare(formattedAuthorName(b, format), 'en', {sensitivity: 'base'}) || a.key.localeCompare(b.key));
}

function fuzzyAuthorWord(a, b) {
  if (a.length < 3 || b.length < 3 || !/\p{L}/u.test(a)) return false;
  const limit = a.length >= 7 ? 2 : 1;
  if (Math.abs(a.length - b.length) > limit) return false;
  let prev = Array.from({length:b.length+1},(_,i)=>i),older=null;
  for(let i=1;i<=a.length;i++) {const row=[i];for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],older[j-2]+1);}if(Math.min(...row)>limit)return false;older=prev;prev=row;}
  return prev[b.length] <= limit;
}
export function authorInstitutions(person) {
  const lines = value => String(value || '').split(/\r?\n|\s*;\s*|；/).map(v=>v.trim()).filter(Boolean);
  return unique([...(person.institution ? lines(person.institution) : []), ...(person.institutions || []).flatMap(lines)]);
}
export function authorIndexValue(person, sort, format) {
  if (sort === 'papers') return String(person.paper_count);
  const initial = [...formattedAuthorName(person, format).normalize('NFKD').replace(/\p{M}/gu,'')][0]?.toUpperCase();
  return /^[A-Z]$/.test(initial || '') ? initial : '#';
}
export function researchPapers(person) {return person.papers.filter(p=>p.status==='ready'||p.summary||p.keyword_pairs?.length);}
function fingerprint(value) {const str=JSON.stringify(value);let a=2166136261,b=5381;for(let i=0;i<str.length;i++){a=Math.imul(a^str.charCodeAt(i),16777619);b=Math.imul(b,33)^str.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
export function authorEnrichmentKey(person, kind) {
  if(kind==='information')return fingerprint(['author-info-v1',person.first_name,person.last_name,[...(person.aliases||[])].sort(),authorInstitutions(person),person.email||'',person.orcid||'',person.profile_url||'',person.papers.map(p=>[p.id,p.published_at||p.arxiv_date||null]).sort((a,b)=>a[0].localeCompare(b[0]))]);
  if(kind==='photo')return fingerprint(['school-photo-names-v4',person.first_name,person.last_name,person.original_names,authorInstitutions(person),person.profile_url,person.papers.map(p=>[p.id,p.published_at||p.arxiv_date||null]).sort((a,b)=>a[0].localeCompare(b[0]))]);
  return fingerprint(researchPapers(person).map(p=>[p.id,p.title,p.summary||'',p.keyword_pairs||p.keywords||[]]).sort((a,b)=>a[0].localeCompare(b[0])));
}
export function authorPhotoInputsChanged(person,patch){
 const fields=['first_name','last_name','institution','email','orcid','profile_url'];
 if(fields.some(key=>key in patch&&String(patch[key]||'').trim()!==String(person[key]||'').trim()))return true;
 const names=value=>JSON.stringify([...new Set((value||[]).map(n=>String(n).trim()).filter(Boolean))].sort());
 return 'aliases' in patch&&names(patch.aliases)!==names(person.aliases);
}
export function authorEnrichmentTasks(authors,{photosOnly=false,force=false,now=Date.now()}={}) {
 const tasks=[];
 for(const person of authors)for(const kind of photosOnly?['photo']:['photo','keywords']) {
  const p=person.profile||{},key=authorEnrichmentKey(person,kind),prefix=kind==='photo'?'photo_lookup':'keywords_lookup';
  if(kind==='photo'&&person.photo_path)continue;
  if(kind==='keywords'&&(!researchPapers(person).length||p.keywords_manual))continue;
  if(Date.parse(p[prefix+'_lease_until']||'')>now)continue;
  if(!force&&p[prefix+'_key']===key&&p[prefix+'_status']!=='running')continue;
  tasks.push({author_key:person.key,kind,title:person.english_name||person.original_names[0]||'',identity_keys:person.identity_keys});
 }
 return tasks;
}

export function searchAuthorPapers(papers,query=''){
 const matches=searchPapers(papers,query),words=normalize(query).split(' ').filter(Boolean);
 if(!words.length)return matches;
 const match=p=>{const text=normalize([p.title,p.journal,p.published_at,p.arxiv_date,p.summary,...(p.keywords||[]),...(p.keyword_pairs||[]).flatMap(k=>[k.zh,k.en]),...(p.authors||[]).flatMap(a=>[a.name,a.institution])].join(' ')),tokens=text.split(' ');return words.every(word=>words.length>1&&/^[a-z]{1,2}$/i.test(word)?tokens.includes(word):text.includes(word)||tokens.some(token=>fuzzyAuthorWord(word,token)));};
 const ordered=[...new Map([...matches,...papers.filter(match)].map(p=>[p.id,p])).values()];
 return words.length>1?ordered.filter(match):ordered;
}
