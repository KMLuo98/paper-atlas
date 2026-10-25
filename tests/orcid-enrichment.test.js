import test from 'node:test';import assert from 'node:assert/strict';
import {pdfORCIDLinks} from '../src/pdf-orcid.js';
import {publicationAuthorORCIDs,lookupPublication} from '../supabase/functions/_shared/publication.js';
import {buildAuthorDirectory} from '../supabase/functions/_shared/author-directory.js';
const id='0000-0002-1825-0097',alice={name:'Alice Smith',institution:'Example University',email:'alice@example.edu'},work={DOI:'10.1234/test',title:['A study'],type:'journal-article','container-title':['Physical Review E'],author:[{given:'Alice',family:'Smith',ORCID:'https://orcid.org/'+id}]};
test('publication metadata fills only unambiguous author ORCIDs and preserves manual identifiers',()=>{
 assert.deepEqual(publicationAuthorORCIDs([alice],work),[{...alice,orcid:id}]);
 assert.equal(publicationAuthorORCIDs([{...alice,orcid:'0000-0001-0000-0001'}],work)[0].orcid,'0000-0001-0000-0001');
 assert(!publicationAuthorORCIDs([alice],{author:[...work.author,...work.author]})[0].orcid);
 assert(!publicationAuthorORCIDs([alice,{...alice}],work)[0].orcid);
 assert(!publicationAuthorORCIDs([{name:'Bob Jones'}],work)[0].orcid);
});
test('verified publication ORCID appears in author details even with an older empty saved profile',async()=>{
 const p={id:'a',title:'A study',doi:work.DOI,authors:[alice]},updated=await lookupPublication(p,async()=>Response.json({message:work}));
 assert.equal(updated.authors[0].orcid,id);
 const people=buildAuthorDirectory([updated],[{id:'profile',first_name:'Alice',last_name:'Smith',orcid:'',identity_keys:['name:alicesmith']}]);
 assert.equal(people.length,1);assert.equal(people[0].orcid,id);assert.equal(people[0].profile.id,'profile');
});
test('PDF icon annotations retain public ORCID targets and nearby text without claiming identity',()=>{
 const a={url:'https://orcid.org/'+id,rect:[90,100,100,110]},items=[{str:'Alice Smith',transform:[1,0,0,1,10,104]}];
 const result=pdfORCIDLinks([a],items);assert(result.includes(id));assert(result.includes('Alice Smith'));assert(result.includes('not a confirmed author assignment'));
 assert.equal(pdfORCIDLinks([{...a,url:'https://orcid.org.evil.org/'+id},{...a,url:'javascript:alert(1)'}],items),'');
 assert.equal(pdfORCIDLinks([{...a,url:'https://orcid.org/'+id,rect:null}],items),'');
});
