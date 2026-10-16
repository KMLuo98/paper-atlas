export function normalizeORCID(value) {
  const raw=String(value||'').normalize('NFKC').trim().replace(/^https?:\/\/(?:www\.)?orcid\.org\//i,'').replace(/^orcid\s*:?\s*/i,'').replace(/[?#].*$/,'').replace(/[\s-]/g,'').toUpperCase();
  return /^[0-9]{15}[0-9X]$/.test(raw) ? raw.match(/.{4}/g).join('-') : raw;
}
export function authorIdentity(author) {
  const orcid=normalizeORCID(author.orcid);
  return orcid?'orcid:'+orcid:'name:'+String(author.name||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
export function sameAuthor(a,b) {
  const x=normalizeORCID(a.orcid),y=normalizeORCID(b.orcid);
  if(x&&y)return x===y;
  return nameKeys(a).some(key=>nameKeys(b).includes(key));
}

function nameKeys(author) {
  return [...new Set([author.name,...(Array.isArray(author.aliases)?author.aliases:[])].filter(v=>typeof v==='string'&&v.trim()).flatMap(value=>{
    const name=value.normalize('NFKC').toLowerCase().trim();
    if(/[\p{Script=Han}]/u.test(name))return [name.replace(/\s/g,'')];
    const words=name.split(/\s+/).map(word=>word.replace(/[^\p{L}\p{N}]/gu,'')).filter(Boolean);
    return [words.join(''),...(words.length>1&&words.every(word=>word.length>1)?[words.slice(1).concat(words[0]).join('')]:[])];
  }))];
}
export function resolveAuthorRecords(papers) {
  const records=papers.flatMap(p=>(p.authors||[]).filter(a=>a&&(a.name||a.orcid)).map(author=>({paperId:p.id,author,orcid:normalizeORCID(author.orcid),names:nameKeys(author),email:String(author.email||'').trim().toLowerCase()})));
  const parents=records.map((_,i)=>i),orcids=records.map(r=>new Set(r.orcid?[r.orcid]:[]));
  const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
  function union(a,b){a=find(a);b=find(b);if(a===b)return;const ids=new Set([...orcids[a],...orcids[b]]);if(ids.size>1)return;parents[b]=a;orcids[a]=ids;}
  function group(keyFn) {const groups=new Map();records.forEach((r,i)=>keyFn(r).forEach(key=>{if(!key)return;const list=groups.get(key)||[];list.push(i);groups.set(key,list);}));return groups;}
  const byOrcid=group(r=>[r.orcid]),byEmail=group(r=>[r.email]),byName=group(r=>r.names);
  for(const members of byOrcid.values())members.slice(1).forEach(i=>union(members[0],i));
  for(const groups of [byEmail,byName])for(const members of groups.values()){
    const known=new Set(members.flatMap(i=>[...orcids[find(i)]]));
    // A name shared by different ORCIDs cannot assign an unidentified record to either.
    if(known.size>1)continue;
    members.slice(1).forEach(i=>union(members[0],i));
  }
  const groups=new Map();records.forEach((record,i)=>{const root=find(i),list=groups.get(root)||[];list.push(record);groups.set(root,list);});
  return [...groups.values()].map(members=>{
    const orcid=members.find(r=>r.orcid)?.orcid||'';
    const keys=[...new Set(members.flatMap(r=>r.names))].sort();
    return {id:orcid?'orcid:'+orcid:'name:'+keys[0],orcid,members};
  });
}
