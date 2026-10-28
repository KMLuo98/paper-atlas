import test from 'node:test';import assert from 'node:assert/strict';
import {arxivLink,parseArxivEntries,matchArxiv,enrichArxivResults} from '../supabase/functions/_shared/arxiv-search.js';
const xml='<feed xmlns:arxiv="http://arxiv.org/schemas/atom"><entry><id>http://arxiv.org/abs/2401.12345v2</id><title>Synchronization &amp; complex networks</title><author><name>Alice Smith</name></author><arxiv:doi>10.1234/paper</arxiv:doi></entry></feed>';
test('arXiv matches exact publication DOI or title plus author and returns canonical links',()=>{
 const entries=parseArxivEntries(xml);assert.equal(entries[0].title,'Synchronization & complex networks');assert.equal(matchArxiv({doi:'10.1234/PAPER',title:'Renamed paper'},entries),'https://arxiv.org/abs/2401.12345');assert.equal(matchArxiv({title:'Synchronization & complex networks',authors:['Alice Smith']},entries),'https://arxiv.org/abs/2401.12345');assert.equal(matchArxiv({title:'Synchronization & complex networks',authors:['Bob Jones']},entries),'');assert.equal(matchArxiv({title:'Similar networks',authors:['Alice Smith']},entries),'');assert.equal(arxivLink('https://arxiv.org.evil.test/abs/2401.12345'),'');assert.equal(arxivLink('https://arxiv.org/pdf/hep-th/9901001v3.pdf'),'https://arxiv.org/abs/hep-th/9901001');
});
test('result pages use one batched lookup and reuse cached matches',async()=>{
 let calls=0;const fetcher=async url=>{calls++;assert.equal(url.hostname,'export.arxiv.org');assert(url.searchParams.get('search_query').includes(' OR '));return new Response(xml);},rows=[{title:'Synchronization & complex networks',authors:['Alice Smith']},{title:'Another study',authors:['Bob Jones']}];
 const first=await enrichArxivResults(rows,fetcher);assert.equal(first.results[0].arxiv_url,'https://arxiv.org/abs/2401.12345');assert.equal(first.results[1].arxiv_url,'');assert.equal((await enrichArxivResults(rows,fetcher)).arxiv_status,'checked');assert.equal(calls,1);
});
test('arXiv outage preserves results, does not cache failures, and direct arXiv links need no lookup',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('timeout');},rows=[{title:'Paper',authors:['Alice Smith']}];const data=await enrichArxivResults(rows,fetcher);assert.equal(data.arxiv_status,'unavailable');assert.equal(data.results[0].title,'Paper');await enrichArxivResults(rows,fetcher);assert.equal(calls,2);const direct=await enrichArxivResults([{title:'Preprint',url:'https://arxiv.org/abs/2401.12345v1'}],fetcher);assert.equal(direct.results[0].arxiv_url,'https://arxiv.org/abs/2401.12345');assert.equal(calls,2);
});
test('DOI mapping fallback links arXiv only when the returned DOI also matches',async()=>{
 const fetcher=async(url,options)=>{if(url.hostname==='export.arxiv.org')return new Response('Rate exceeded',{status:429});assert.equal(options.method,'POST');return Response.json([{externalIds:{DOI:'10.1234/paper',ArXiv:'2401.12345'}},{externalIds:{DOI:'10.9999/wrong',ArXiv:'2401.11111'}}]);};
 const data=await enrichArxivResults([{title:'First paper',doi:'10.1234/paper'},{title:'Second paper',doi:'10.1234/second'}],fetcher);assert.equal(data.results[0].arxiv_url,'https://arxiv.org/abs/2401.12345');assert.equal(data.results[1].arxiv_url,'');
});
