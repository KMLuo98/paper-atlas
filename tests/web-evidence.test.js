import test from 'node:test';import assert from 'node:assert/strict';
import {publicURL,parseSearchRSS,collectPublicEvidence} from '../supabase/functions/_shared/web-evidence.js';
import {validateRelationship} from '../supabase/functions/_shared/relationship.js';
test('public evidence rejects credentials, local endpoints and malformed search data',()=>{
  for(const url of ['http://example.com','https://127.0.0.1/a','https://localhost/a','https://user:pass@example.com/a','https://example.com:8443'])assert.equal(publicURL(url),'');
  const items=parseSearchRSS('<rss><item><title>Lab &amp; news</title><link>https://example.edu/news</link><description><![CDATA[<b>Alice</b> joined the lab.]]></description></item></rss>');assert.equal(items[0].excerpt,'Alice joined the lab.');assert.equal(items[0].full_page,false);
});
test('web search includes relevant news and homepage snippets and filters unrelated names',async()=>{
  let requests=0;const result=await collectPublicEvidence([{name:'Alice Example'},{name:'Bob Researcher'}],async()=>{requests++;return new Response('<rss><item><title>Alice Example laboratory news</title><link>https://example.com/news</link><description>Bob Researcher is an academic collaborator.</description></item><item><title>Unrelated name</title><link>https://other.com</link><description>Unrelated topic</description></item></rss>');});assert.equal(requests,3);assert.equal(result.items.length,1);assert(result.items[0].excerpt.includes('collaborator'));
});
test('public-source outages retain an explicit unavailable status instead of invented evidence',async()=>{
  const result=await collectPublicEvidence([{name:'A'},{name:'B'}],async()=>{throw Error('offline');});assert.deepEqual(result.items,[]);assert(result.notices.length);
  const formatted=validateRelationship({result:'只能确认学术合作。',reasons:['共同署名两篇论文。'],limitations:'没有师生关系证据。'});assert(formatted.analysis.startsWith('只能确认学术合作。\n原因：'));assert.throws(()=>validateRelationship({}),/结论/);
});
