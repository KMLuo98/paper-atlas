import test from 'node:test';
import assert from 'node:assert/strict';
import {collaborationGroups} from '../supabase/functions/_shared/collaboration.js';
import {authorNetwork} from '../src/core.js';
import {journalOptions,filterPapers} from '../src/filters.js';
import {arxivID,exactPublishedMatch,lookupPublication} from '../supabase/functions/_shared/publication.js';
import {passwordError} from '../supabase/functions/_shared/password.js';
import {validChatAttachment,chatAction} from '../supabase/functions/_shared/chat.js';
test('collaboration groups count distinct papers for pairs, triples and larger groups',()=>{
 const papers=[{id:'1',authors:[{name:'Alice'},{name:'Bob'},{name:'Carol'},{name:'Alice'}]},{id:'2',authors:[{name:'Alice'},{name:'Bob'},{name:'Carol'}]},{id:'3',authors:[{name:'Alice'},{name:'Bob'},{name:'Dave'}]}];const net=authorNetwork([...papers,papers[0]]);
 const pairs=collaborationGroups(net,2).groups;assert.equal(pairs[0].weight,3);assert.equal(new Set(pairs.map(g=>g.members.join('|'))).size,pairs.length);assert.equal(collaborationGroups(net,3).groups[0].weight,2);assert.equal(collaborationGroups(net,4).groups.length,0);assert(collaborationGroups(net,2,{budget:1}).truncated);
});
test('journal filters are canonical, alphabetical, multiselect and year-bound',()=>{
 const papers=[{id:'1',journal:'PRE',published_at:'2020-01-01',title:'同步 network'},{id:'2',journal:'Nature Communications',published_at:'2022-01-01',title:'network'},{id:'3',journal:'Physical Review E',title:'unknown date'},{id:'4',journal:'Chaos',published_at:'2024-01-01',title:'network'}];assert.deepEqual(journalOptions(papers),['Chaos: An Interdisciplinary Journal of Nonlinear Science','Nature Communications','Physical Review E']);assert.deepEqual(filterPapers(papers,{journals:['Physical Review E','Nature Communications'],years:[2020,2022]}).map(p=>p.id),['1','2']);assert.equal(filterPapers(papers,{years:null}).length,4);assert.equal(filterPapers(papers,{query:'同步'}).length,1);
});
const paper={title:'Synchronization of complex networks',authors:[{name:'Alice Example',orcid:'0000-0002-1825-0097'}],publication_status:'unpublished',full_text:'arXiv:2401.01234v2'};
const work={type:'journal-article',title:[paper.title],author:[{given:'Alice',family:'Example',ORCID:'https://orcid.org/0000-0002-1825-0097'}],DOI:'10.1234/paper','container-title':['Phys. Rev. E'],'published-online':{'date-parts':[[2025,6,3]]},'is-referenced-by-count':7};
test('arXiv matching requires exact normalized title and matching author identity',()=>{
 assert.equal(arxivID(paper),'2401.01234');assert(exactPublishedMatch(paper,work));assert(!exactPublishedMatch(paper,{...work,title:['Related synchronization of complex networks']}));assert(!exactPublishedMatch(paper,{...work,author:[{given:'Alice',family:'Example',ORCID:'0000-0001-0000-0001'}]}));assert(!exactPublishedMatch(paper,{...work,type:'posted-content'}));
});
test('verified arXiv publication adopts official journal/date and indexed citation count',async()=>{
 const result=await lookupPublication(paper,async url=>String(url).includes('arxiv.org')?new Response('<feed><entry><published>2024-01-04T00:00:00Z</published></entry></feed>'):Response.json({message:{items:[work]}}));assert.equal(result.journal,'Physical Review E');assert.equal(result.published_at,'2025-06-03');assert.equal(result.arxiv_date,'2024-01-04');assert.equal(result.citation_count,7);assert.equal(result.publication_status,'published');
});
test('unmatched arXiv keeps posting metadata and an outage does not block the paper',async()=>{
 const result=await lookupPublication(paper,async url=>String(url).includes('arxiv.org')?new Response('<feed><published>2024-01-04T00:00:00Z</published></feed>'):Response.json({message:{items:[]}}));assert.equal(result.journal,'arXiv');assert.equal(result.published_at,'2024-01-04');assert.equal(result.publication_status,'unpublished');assert.equal(result.citation_count,undefined);
 const failed=await lookupPublication(paper,async()=>{throw Error('offline');});assert.equal(failed.title,paper.title);assert.equal(failed.publication_lookup_status,'service_unavailable');
});
test('password form rejects weak, repeated and mismatched passwords without submitting credentials',()=>{
 assert(passwordError('oldpass1','12345678','12345678'));assert(passwordError('oldpass1','password','password'));assert(passwordError('oldpass1','oldpass1','oldpass1'));assert(passwordError('oldpass1','newpass2','newpass3'));assert.equal(passwordError('oldpass1','newpass2','newpass2'),'');
});
const user='12345678-1234-1234-1234-123456789012',conv='23456789-1234-1234-1234-123456789012';
test('chat attachment paths cannot cross account folders or fetch arbitrary URLs',()=>{
 assert(validChatAttachment({path:user+'/'+conv+'.txt',name:'notes',kind:'text',text:'hello'},user));for(const path of ['other/'+conv+'.txt',user+'/../other.txt','https://evil.example/file',user+'/folder/'+conv+'.txt'])assert(!validChatAttachment({path,name:'notes',kind:'text'},user));assert(!validChatAttachment({path:user+'/'+conv+'.svg',name:'script',kind:'image',type:'image/svg+xml'},user));
});
test('chat refuses a conversation outside the verified user before accessing any data or model',async()=>{
 class HTTPError extends Error{constructor(status,message){super(message);this.status=status;}}
 let modelCalls=0;const service={from(table){assert.equal(table,'conversations');return {select(){return this;},eq(k,v){if(k==='user_id')assert.equal(v,user);return this;},async maybeSingle(){return {data:null};}};}};
 await assert.rejects(()=>chatAction({service,userId:user,body:{conversation_id:conv},complete:()=>modelCalls++,allPapers:()=>{throw Error('must not read');},HTTPError}),error=>error.status===404);assert.equal(modelCalls,0);
});
