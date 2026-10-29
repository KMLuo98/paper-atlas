import test from 'node:test';import assert from 'node:assert/strict';
import {authorInformationPatch} from '../supabase/functions/_shared/author-information.js';
import {authorSearchNames} from '../supabase/functions/_shared/author-photos.js';
const url='https://example.edu/alice',id='0000-0002-1825-0097',sources=[{url,text:`Alice Smith 王丽 Example University alice@example.edu https://orcid.org/${id}`}],field=value=>({value,source:url});
test('author information accepts sourced values and keeps existing manual fields',()=>{
 const raw={aliases:[field('王丽'),field('Invented Name')],email:field('alice@example.edu'),orcid:field(id),profile_url:field(url),institution:field('Example University')};
 const patch=authorInformationPatch({aliases:['Alice Smith']},{email:'manual@example.com'},raw,sources);
 assert.equal(patch.email,undefined);assert.equal(patch.orcid,id);assert.equal(patch.profile_url,url);assert.equal(patch.institution,'Example University');assert.equal(patch.aliases,undefined);
 assert.equal(authorInformationPatch({orcid:id},{},raw,sources).orcid,undefined);
 assert.deepEqual(authorInformationPatch({},{},{email:{value:'alice@example.edu',source:'https://evil.org'}},sources),{});
});
test('only missing academic metrics are filled and existing zero values and profile links survive',()=>{
 const source='https://scholar.google.com/citations?user=Alice123',base={scholar_url:source,academic_metrics:{sources:[],best:{citations:{value:0,provider:'scholar',url:source,checked_at:'2026-01-01'},publications:{value:25,provider:'orcid',url:'https://orcid.org/'+id}}}};
 const patch=authorInformationPatch({},base,{},[{url:source,text:'Alice Smith',academic:{provider:'scholar',url:source,checked_at:'2026-10-28',metrics:{citations:999,publications:100,h_index:12,i10_index:18}}}]);
 assert.equal(patch.scholar_url,undefined);assert.equal(patch.academic_metrics.best.citations.value,0);assert.equal(patch.academic_metrics.best.publications.value,25);assert.equal(patch.academic_metrics.best.h_index.value,12);assert.equal(patch.academic_metrics.best.i10_index.value,18);assert.equal(patch.academic_metrics.best.citations.checked_at,'2026-01-01');
});
test('photo name queries cover every known spelling, deduplicate and prioritize Chinese',()=>{
 const names=authorSearchNames({name:'Jun-an Lu',aliases:['Junan Lu','陆君安','Lu Jun-An','Jun-an Lu']});
 assert.equal(names[0],'陆君安');assert.equal(names.length,4);assert(names.includes('Lu Jun-An'));assert(names.includes('Junan Lu'));
});
test('academic searches include German umlaut transliterations',()=>{assert(authorSearchNames({name:'Jürgen Kurths',aliases:[]}).includes('Juergen Kurths'));});
test('AI profile and metrics extraction requires verifiable source text and metric labels',()=>{
 const source='https://scholar.google.com/citations?user=Alice123',rows=[{url:source,text:'Alice Smith Citations 1,234 h-index 18'}];
 const patch=authorInformationPatch({},{},{scholar_url:{value:source,source},metrics:[{provider:'scholar',source,evidence:'Citations 1,234',field:'citations',value:1234},{provider:'scholar',source,evidence:'h-index 18',field:'h_index',value:18},{provider:'scholar',source,evidence:'h-index 18',field:'publications',value:18}]},rows);
 assert.equal(patch.scholar_url,source);assert.equal(patch.academic_metrics.best.citations.value,1234);assert.equal(patch.academic_metrics.best.h_index.value,18);assert.equal(patch.academic_metrics.best.publications,undefined);
});
test('verified public snapshots can supply h and i10 without turning the snapshot page into a Scholar profile',()=>{
 const source='https://example.edu/alice',evidence='Google Scholar h-index 18 i10-index 22',rows=[{url:source,text:'Alice Smith Example University '+evidence}];
 const patch=authorInformationPatch({},{},{metrics:[{provider:'scholar',source,evidence,field:'h_index',value:18},{provider:'scholar',source,evidence,field:'i10_index',value:22}]},rows);
 assert.equal(patch.academic_metrics.best.h_index.value,18);assert.equal(patch.academic_metrics.best.i10_index.value,22);assert.equal(patch.academic_metrics.best.h_index.url,source);assert.equal(patch.academic_metrics.best.h_index.method,'public_snapshot');assert.equal(patch.scholar_url,undefined);
});
