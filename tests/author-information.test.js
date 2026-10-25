import test from 'node:test';import assert from 'node:assert/strict';
import {authorInformationPatch} from '../supabase/functions/_shared/author-information.js';
import {authorSearchNames} from '../supabase/functions/_shared/author-photos.js';
const url='https://example.edu/alice',id='0000-0002-1825-0097',sources=[{url,text:`Alice Smith 王丽 Example University alice@example.edu https://orcid.org/${id}`}],field=value=>({value,source:url});
test('author information accepts sourced values and keeps existing manual fields',()=>{
 const raw={aliases:[field('王丽'),field('Invented Name')],email:field('alice@example.edu'),orcid:field(id),profile_url:field(url),institution:field('Example University')};
 const patch=authorInformationPatch({aliases:['Alice Smith']},{email:'manual@example.com'},raw,sources);
 assert.equal(patch.email,undefined);assert.equal(patch.orcid,id);assert.equal(patch.profile_url,url);assert.equal(patch.institution,'Example University');assert.deepEqual(patch.aliases,['Alice Smith','王丽']);
 assert.equal(authorInformationPatch({orcid:id},{},raw,sources).orcid,undefined);
 assert.deepEqual(authorInformationPatch({},{},{email:{value:'alice@example.edu',source:'https://evil.org'}},sources),{});
});
test('photo name queries cover every known spelling, deduplicate and prioritize Chinese',()=>{
 const names=authorSearchNames({name:'Jun-an Lu',aliases:['Junan Lu','陆君安','Lu Jun-An','Jun-an Lu']});
 assert.equal(names[0],'陆君安');assert.equal(names.length,4);assert(names.includes('Lu Jun-An'));assert(names.includes('Junan Lu'));
});
