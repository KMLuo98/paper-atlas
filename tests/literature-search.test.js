import test from 'node:test';import assert from 'node:assert/strict';
import {literatureSearch} from '../supabase/functions/_shared/literature-search.js';
test('onsite Crossref results retain actual metadata, source and pagination',async()=>{
 const result=await literatureSearch({query:'complex networks',offset:0},async url=>{assert.equal(url.hostname,'api.crossref.org');assert.equal(url.searchParams.get('query.bibliographic'),'complex networks');assert.equal(url.searchParams.get('rows'),'10');return Response.json({message:{'total-results':13,items:[{DOI:'10.1234/example',title:['<b>Complex networks</b>'],author:[{given:'Alice',family:'Example'}],'container-title':['Phys. Rev. E'],'published-online':{'date-parts':[[2020,5,2]]},'is-referenced-by-count':0,abstract:'<jats:p>Real abstract.</jats:p>'}]}});});assert.equal(result.results[0].title,'Complex networks');assert.equal(result.results[0].journal,'Physical Review E');assert.equal(result.results[0].citation_count,0);assert.equal(result.results[0].date,'2020-05-02');assert.equal(result.results[0].excerpt,'Real abstract.');assert.equal(result.source,'Crossref');assert.equal(result.has_more,true);
});
test('Bing public RSS renders actual source links without fabricating paper metadata',async()=>{
 const result=await literatureSearch({engine:'bing',query:'synchronization'},async url=>{assert.equal(url.hostname,'www.bing.com');assert.equal(url.searchParams.get('format'),'rss');return new Response('<rss><item><title>Research news</title><link>https://example.edu/research</link><description>Synchronization &amp; networks.</description></item></rss>');});assert.equal(result.source,'Bing');assert.equal(result.results[0].url,'https://example.edu/research');assert.deepEqual(result.results[0].authors,[]);assert.equal(result.results[0].citation_count,null);assert.equal(result.has_more,false);
});
test('invalid engines and upstream failures cannot silently become fake results',async()=>{
 for(const request of [{engine:'google',query:'test'},{query:''},{query:'test',offset:-10}])await assert.rejects(()=>literatureSearch(request,()=>{throw Error('must not fetch');}));
 await assert.rejects(()=>literatureSearch({engine:'bing',query:'test'},async()=>new Response('<html>Verify your browser</html>')),/Bing/);
 await assert.rejects(()=>literatureSearch({query:'test'},async()=>new Response('unavailable',{status:503})),/503/);
});
