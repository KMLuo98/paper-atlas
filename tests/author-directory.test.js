import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuthorDirectory,formattedAuthorName,publishedPaper,filterAuthors} from '../supabase/functions/_shared/author-directory.js';
import {validateAuthorPatch,authorAction} from '../supabase/functions/_shared/author-actions.js';
const orcid='0000-0002-1825-0097',other='0000-0001-5109-3700';
const papers=[{id:'p1',title:'Network research',publication_status:'published',journal:'Physical Review E',published_at:'2020-01-01',authors:[{name:'Jun-an Lu',institution:'Institute One',email:'lu@example.edu',orcid},{name:'Alice Smith'}]}, {id:'p2',title:'Synchronization',publication_status:'published',authors:[{name:'Lu Jun-An',institution:'Institute Two',orcid}]}, {id:'p3',title:'Preprint',publication_status:'unpublished',authors:[{name:'陆君安',orcid}]}, {id:'p4',title:'Different identity',publication_status:'published',authors:[{name:'Jun-an Lu',orcid:other}]}];
test('author directory unites ORCID variants, keeps distinct identities apart and counts distinct published papers',()=>{
 const authors=buildAuthorDirectory([...papers,papers[0]]),lu=authors.find(a=>a.orcid===orcid);
 assert.equal(authors.length,3);assert.equal(lu.paper_count,3);assert.equal(lu.published_count,2);assert(lu.aliases.includes('陆君安'));
 assert.deepEqual(lu.institutions,['Institute One','Institute Two']);assert(!publishedPaper(papers[2]));assert.equal(authors.filter(a=>a.orcid&&a.english_name==='Jun-an Lu').length,2);
});
test('all name formats keep the canonical full name and initials do not modify identity',()=>{
 const a={first_name:'Jun-an',last_name:'Lu',name_format:'default'};
 assert.equal(formattedAuthorName(a),'Jun-an Lu');assert.equal(formattedAuthorName(a,'family_given'),'Lu, Jun-an');assert.equal(formattedAuthorName(a,'initial_family'),'J.-A. Lu');
 assert.equal(formattedAuthorName({...a,name_format:'family_given'},'given_family'),'Lu, Jun-an');
});
test('explicit saved aliases unite separate name variants without rewriting paper metadata',()=>{
 const original=[{id:'a',publication_status:'published',authors:[{name:'Jun-an Lu',institution:'Wuhan University'}]},{id:'b',publication_status:'published',authors:[{name:'Junan Lu'}]}];
 const snapshot=structuredClone(original),profile={id:'saved',user_id:'owner',identity_keys:['name:junanlu'],first_name:'Jun-an',last_name:'Lu',aliases:['Junan Lu','Jun-an Lu'],institution:'Edited institute',email:'edited@example.org',updated_at:'2026-10-25T00:00:00Z'};
 const directory=buildAuthorDirectory(original,[profile]);assert.equal(directory.length,1);assert.equal(directory[0].published_count,2);assert.equal(directory[0].institution,'Edited institute');assert.equal(directory[0].email,'edited@example.org');assert.deepEqual(original,snapshot);
});
test('search covers original aliases and institutions, and both sorting modes work',()=>{
 const directory=buildAuthorDirectory(papers);
 assert.equal(filterAuthors(directory,'Institute Two')[0].orcid,orcid);assert.equal(filterAuthors(directory,'陆君安')[0].orcid,orcid);
 assert.equal(filterAuthors(directory,'','name')[0].last_name,'Smith');assert.equal(filterAuthors(directory,'','papers')[0].published_count,2);
});
test('edited author fields validate email, public homepages, ORCID and owner-specific photo paths',()=>{
 const person=buildAuthorDirectory(papers).find(a=>a.orcid===orcid),owner='12345678-1234-1234-1234-123456789012';
 const patch={first_name:'Jun-an',last_name:'Lu',name_format:'given_family',aliases:['陆君安'],email:'new@example.edu',orcid,photo_path:owner+'/12345678-1234-1234-1234-123456789012.jpg'};
 assert.equal(validateAuthorPatch(patch,person,owner).email,'new@example.edu');
 for(const extra of [{email:'bad'},{profile_url:'https://127.0.0.1/private'},{photo_path:'someone-else/photo.jpg'},{orcid:other},{name_format:'invalid'}])assert.throws(()=>validateAuthorPatch({...patch,...extra},person,owner));
});
test('author services deny an out-of-library identity before model or photo lookup',async()=>{
 let calls=0;const service={from:()=>({select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:[]})})};class HTTPError extends Error{constructor(status,message){super(message);this.status=status;}}
 await assert.rejects(authorAction({service,userId:'owner',body:{action:'author_keywords',author_key:'unowned'},allPapers:async()=>papers,model:async()=>{calls++;},discoverPhotos:async()=>{calls++;},HTTPError}),e=>e.status===404);assert.equal(calls,0);
});

test('author keyword generation covers all owned published papers and saves ten bilingual topics',async()=>{
 const rows=[],writes=[],inputs=[];
 const service={from:table=>{assert.equal(table,'author_profiles');return {select(){return this;},eq(key,value){assert.equal(key,'user_id');assert.equal(value,'owner');return this;},order(){return this;},range:async()=>({data:rows}),upsert(row){writes.push(row);return {select:()=>({single:async()=>({data:row})})};}};}};
 class HTTPError extends Error{constructor(status,message){super(message);this.status=status;}}
 const result=await authorAction({service,userId:'owner',body:{action:'author_keywords',author_key:'orcid:'+orcid},allPapers:async()=>papers,limit:async()=>{},model:async(prompt,input,json)=>{assert(json);inputs.push(input);return {keywords:Array.from({length:10},(_,i)=>({zh:'研究词'+i,en:'topic '+i})),summary:'复杂网络与同步研究'};},HTTPError});
 assert.deepEqual(inputs[0].papers.map(p=>p.id).sort(),['p1','p2']);assert.equal(result.profile.keywords.length,10);assert.equal(writes[0].user_id,'owner');assert.deepEqual(writes[0].keywords_paper_ids.sort(),['p1','p2']);
});
test('photo matching sends only public identity clues, without paper text or email',async()=>{
 let identity;
 const service={from:()=>({select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:[]})})};class HTTPError extends Error{constructor(status,message){super(message);this.status=status;}}
 await authorAction({service,userId:'owner',body:{action:'author_photo_candidates',author_key:'orcid:'+orcid},allPapers:async()=>papers,limit:async()=>{},discoverPhotos:async person=>{identity=person;return {items:[],unavailable:false};},HTTPError});
 assert.equal(identity.email,'');assert(identity.name.includes('Lu'));assert.equal(identity.organization,'Institute One');assert(!('papers'in identity));assert(!('summary'in identity));
});
