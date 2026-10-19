import test from 'node:test';import assert from 'node:assert/strict';
import {buildLibraryContext} from '../supabase/functions/_shared/library-context.js';
const papers=Array.from({length:75},(_,i)=>({id:'paper-'+i,title:'Paper '+i,authors:[{name:'Author '+i}],keyword_pairs:[{zh:'复杂网络',en:'complex networks'}],summary:'Finding '+i}));
test('library context includes every paper and its saved AI metadata beyond eighteen records',async()=>{
 const result=JSON.parse(await buildLibraryContext({papers,question:'概述文献库',complete:()=>{throw Error('No extra model call needed');},service:{from(){throw Error('Do not load full text for a general question');}}}));assert.equal(result.library_size,75);assert.equal(result.metadata.length,75);assert.equal(result.metadata.at(-1).summary,'Finding 74');assert.equal(result.coverage.metadata_records,75);
});
test('large metadata is processed in full batches without silently dropping later papers',async()=>{
 const large=papers.map(p=>({...p,summary:'Research '.repeat(550)})),seen=[];
 const result=JSON.parse(await buildLibraryContext({papers:large,question:'概述所有研究',complete:async messages=>{const data=JSON.parse(messages[1].content);seen.push(...data.records.map(p=>p.id));return 'Evidence batch';},service:{from(){throw Error('No full text required');}}}));assert.equal(new Set(seen).size,75);assert.equal(result.catalog.length,75);assert(result.coverage.batches>2);
});
test('deep reading plans relevant full texts and retains all text chunks rather than three excerpts',async()=>{
 const fetched=[];const service={from:()=>({select(){return this;},eq(){return this;},is(){return this;},async in(_key,ids){fetched.push(...ids);return {data:ids.map(id=>({id,full_text:'All details of '+id}))};}})};
 const result=JSON.parse(await buildLibraryContext({papers,question:'详细比较这些论文',service,userId:'owner',complete:async()=>JSON.stringify({ids:papers.slice(0,8).map(p=>p.id)})}));assert.equal(fetched.length,8);assert.equal(result.full_text.length,8);assert.equal(result.full_text.at(-1).text,'All details of paper-7');
});
