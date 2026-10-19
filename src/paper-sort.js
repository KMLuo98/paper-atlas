export function sortPapers(papers,key='recent',direction='desc'){
 const sign=direction==='asc'?1:-1;
 return [...papers].sort((a,b)=>{
  if(key==='citations'){
   if(a.citation_count==null||b.citation_count==null)return a.citation_count==null?(b.citation_count==null?String(a.id).localeCompare(String(b.id)):1):-1;
   return sign*(a.citation_count-b.citation_count)||String(a.id).localeCompare(String(b.id));
  }
  const field=key==='title'?'title':key==='date'?'published_at':'created_at';
  if(!a[field]||!b[field])return !a[field]?(!b[field]?0:1):-1;
  return sign*String(a[field]).localeCompare(String(b[field]))||String(a.id).localeCompare(String(b.id));
 });
}
