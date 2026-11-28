import test from 'node:test';import assert from 'node:assert/strict';
import {literatureSearch} from '../supabase/functions/_shared/literature-search.js';
test('onsite Crossref results retain actual metadata, source and pagination',async()=>{
 const result=await literatureSearch({query:'complex networks',offset:0},async url=>{assert.equal(url.hostname,'api.crossref.org');assert.equal(url.searchParams.get('query.bibliographic'),'complex networks');assert.equal(url.searchParams.get('rows'),'50');return Response.json({message:{'total-results':13,items:[{DOI:'10.1234/example',title:['<b>Complex networks</b>'],author:[{given:'Alice',family:'Example'}],'container-title':['Phys. Rev. E'],'published-online':{'date-parts':[[2020,5,2]]},'is-referenced-by-count':0,abstract:'<jats:p>Real abstract.</jats:p>'}]}});});assert.equal(result.results[0].title,'Complex networks');assert.equal(result.results[0].journal,'Physical Review E');assert.equal(result.results[0].citation_count,0);assert.equal(result.results[0].date,'2020-05-02');assert.equal(result.results[0].excerpt,'Real abstract.');assert.equal(result.source,'Crossref');assert.equal(result.has_more,true);
});
const research = (n,title,type='journal-article')=>({DOI:'10.1234/paper-'+n,title:[title],type});
function emptyPreprints(url){
 if(url.hostname==='api.datacite.org')return Response.json({data:[]});
 if(url.hostname==='export.arxiv.org')return new Response('<feed></feed>');
 if(url.hostname==='api.semanticscholar.org')return Response.json([]);
 throw Error('Unexpected URL '+url);
}
test('an exact journal title outranks a reprint and matches a separately deposited subtitle',async()=>{
 const query='Collective dynamics: small world networks';
 const items=[
  research(1,'Collective dynamics: small-world networks','book-chapter'),
  research(2,'Collective dynamics of networks'),
  ...Array.from({length:11},(_,i)=>research(i+3,'Unrelated work '+i)),
  {...research(14,'Collective dynamics'),subtitle:['Small–world networks']}
 ];
 const fetcher=async url=>{
  if(url.hostname!=='api.crossref.org')return emptyPreprints(url);
  assert.equal(url.searchParams.has('filter'),false);
  return Response.json({message:{items,'total-results':items.length}});
 };
 const first=await literatureSearch({query},fetcher);
 assert.deepEqual(first.results.slice(0,2).map(r=>r.id),['10.1234/paper-14','10.1234/paper-1']);
 assert.equal(first.results[0].title,'Collective dynamics: Small–world networks');
 const next=await literatureSearch({query,offset:10},fetcher);
 assert.equal(next.has_more,false);
 assert.equal(new Set([...first.results,...next.results].map(row=>row.id)).size,items.length);
});

test('an exact article found outside the first source block can be promoted without duplicating it on later pages',async()=>{
 const query='Complex networks: structure and dynamics',article=research(53,'Complex networks: Structure and dynamics');
 const all=Array.from({length:60},(_,i)=>i===52?article:research(i+1,'General overview '+i));
 const requests=[];
 const fetcher=async url=>{
  if(url.hostname!=='api.crossref.org')return emptyPreprints(url);
  requests.push(url);
  const start=Number(url.searchParams.get('offset'));
  return Response.json({message:{items:url.searchParams.has('filter')?[article]:all.slice(start,start+50),'total-results':all.length}});
 };
 const first=await literatureSearch({query},fetcher);
 assert.equal(first.results[0].id,article.DOI);
 const seen=first.results.map(row=>row.id);
 for(let offset=10;offset<=60;offset+=10){
  const result=await literatureSearch({query,offset,promotedDOI:first.promoted_doi},fetcher);
  seen.push(...result.results.map(row=>row.id));
  assert.equal(result.has_more,offset<60);
 }
 assert.equal(seen.length,all.length);
 assert.deepEqual(new Set(seen),new Set(all.map(row=>row.DOI)));
 assert.equal(requests.filter(url=>url.searchParams.has('filter')).length,1);
});

test('Bing orders an exact title ahead of a headline that only shares a few words',async()=>{
 const query='Physics informed neural networks';
 const response=await literatureSearch({engine:'bing',query},async url=>url.hostname!=='www.bing.com'?emptyPreprints(url):new Response('<rss><item><title>New studies of neural networks</title><link>https://example.edu/news</link></item><item><title>Physics-informed neural networks</title><link>https://journals.example.edu/paper</link></item></rss>'));
 assert.equal(response.results[0].title,'Physics-informed neural networks');
});
test('Bing public RSS renders actual source links without fabricating paper metadata',async()=>{
 const result=await literatureSearch({engine:'bing',query:'synchronization'},async url=>{assert.equal(url.hostname,'www.bing.com');assert.equal(url.searchParams.get('format'),'rss');return new Response('<rss><item><title>Research news</title><link>https://example.edu/research</link><description>Synchronization &amp; networks.</description></item></rss>');});assert.equal(result.source,'Bing');assert.equal(result.results[0].url,'https://example.edu/research');assert.deepEqual(result.results[0].authors,[]);assert.equal(result.results[0].citation_count,null);assert.equal(result.has_more,false);
});
test('invalid engines and upstream failures cannot silently become fake results',async()=>{
 for(const request of [{engine:'google',query:'test'},{query:''},{query:'test',offset:-10}])await assert.rejects(()=>literatureSearch(request,()=>{throw Error('must not fetch');}));
 await assert.rejects(()=>literatureSearch({engine:'bing',query:'test'},async()=>new Response('<html>Verify your browser</html>')),/Bing/);
 await assert.rejects(()=>literatureSearch({query:'test'},async()=>new Response('unavailable',{status:503})),/503/);
});
