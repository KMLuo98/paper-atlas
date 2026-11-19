import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverAuthorMetricIndexes} from '../supabase/functions/_shared/author-metric-indexes.js';
import {academicInformationPatch} from '../supabase/functions/_shared/academic-profiles.js';
import {academicSearchIdentity} from '../supabase/functions/_shared/author-information.js';

const workSample = (id, name, raw_orcid, affiliation) => JSON.stringify({results:[
  {authorships:[{author:{id:'https://openalex.org/'+id},raw_author_name:name,raw_orcid,raw_affiliation_strings:affiliation?[affiliation]:[]}]}
]});

test('an exact ORCID still resolves when the OpenAlex list endpoint is limited', async () => {
  const rows=await discoverAuthorMetricIndexes({},identity,async value=>{
    const url=new URL(value);
    if(url.pathname==='/authors/orcid:'+orcid)return JSON.stringify({id:'https://openalex.org/A99',orcid,works_count:246,cited_by_count:7102,summary_stats:{h_index:42,i10_index:156}});
    if(url.searchParams.get('filter')==='author.id:A99')return workSample('A99',identity.name,orcid);
    throw Error('429');
  },stamp);
  const cached={academic_metrics:{sources:[{provider:'Semantic Scholar',url:'https://www.semanticscholar.org/author/1',metrics:{publications:13}}]}};
  assert.equal(academicInformationPatch(cached,rows).academic_metrics.best.publications.value,246);
});

const orcid = '0009-0003-3727-4187';
const identity = {name:'Kaiming Luo', aliases:[], organization:'Fudan University', orcid};
const person = {papers:[{title:'Controlling synchronization dynamics via physics-informed neural networks'}]};
const stamp = '2026-11-17';

test('matches OpenAlex by ORCID and Semantic Scholar by paper, keeping provenance and zero values', async () => {
  const rows = await discoverAuthorMetricIndexes(person, identity, async value => {
    const url = new URL(value);
    if (url.hostname === 'api.openalex.org') {
      if(url.searchParams.get('filter')==='author.id:A1')return workSample('A1',identity.name,orcid);
      assert.equal(url.searchParams.get('filter'), 'orcid:' + orcid);
      return JSON.stringify({results:[{id:'https://openalex.org/A1', orcid, works_count:13, cited_by_count:28, summary_stats:{h_index:4, i10_index:0}}]});
    }
    return JSON.stringify({data:[
      {authorId:'1', name:identity.name, externalIds:{ORCID:'0000-0002-1797-0172'}, citationCount:400, papers:person.papers},
      {authorId:'2', name:identity.name, citationCount:30, hIndex:3, papers:person.papers}
    ]});
  }, stamp);
  const {academic_metrics:{best}} = academicInformationPatch({}, rows);
  assert.equal(best.citations.value, 30);
  assert.equal(best.citations.provider, 'Semantic Scholar');
  assert.equal(best.h_index.provider, 'OpenAlex');
  assert.equal(best.i10_index.value, 0);
  assert.equal(academicInformationPatch({academic_metrics:{best}}, rows, {missingOnly:true}).academic_metrics, undefined);
});

test('rejects ambiguous name matches and isolates an unavailable index', async () => {
  const rows = await discoverAuthorMetricIndexes({}, {...identity, orcid:''}, async value => {
    if (value.includes('semanticscholar.org')) throw Error('429');
    const author = {display_name:identity.name, affiliations:[{institution:{display_name:identity.organization}}], cited_by_count:10};
    return JSON.stringify({results:[{...author,id:'https://openalex.org/A1'},{...author,id:'https://openalex.org/A2'}]});
  }, stamp);
  assert.deepEqual(rows, []);
});

test('finds a better-supported author record by public DOI even outside the name results', async () => {
  const candidate = (id, publications) => ({id:'https://openalex.org/' + id, display_name:identity.name, works_count:publications});
  const dois = ['10.1103/first','10.1103/second'];
  const rows = await discoverAuthorMetricIndexes({papers:dois.map(doi => ({doi}))}, {...identity,orcid:''}, async value => {
    const url = new URL(value);
    if (url.hostname === 'api.semanticscholar.org') throw Error('429');
    if (url.searchParams.get('filter')==='author.id:A2') return workSample('A2',identity.name);
    if (url.pathname === '/works') return JSON.stringify({results:dois.map(doi => ({doi,authorships:[{author:candidate('A2',76)}]}))});
    return JSON.stringify({results:url.searchParams.has('filter') ? [candidate('A2',76)] : [candidate('A1',13)]});
  }, stamp);
  const stale = {provider:'OpenAlex',url:'https://openalex.org/A1',metrics:{publications:200}};
  const {academic_metrics:metrics} = academicInformationPatch({academic_metrics:{sources:[stale]}},rows);
  assert.equal(metrics.best.publications.value,76);
  assert.deepEqual(metrics.sources.map(source => source.url),['https://openalex.org/A2']);
});

test('romanizes a Chinese-only name and re-verifies a stronger profile against ORCID work evidence', async () => {
  const name = academicSearchIdentity({name:'樊京芳',aliases:[],organization:'Beijing Normal University'},()=>['fan','jing','fang']);
  assert.equal(name.name,'jingfang fan');assert(name.aliases.includes('fan jingfang'));
  const candidate={display_name:'Jingfang Fan',affiliations:[{institution:{display_name:'Beijing Normal University'}}]};
  const match='0000-0003-1954-4641', paper={title:'Climate Network Percolation Under Global Warming'};
  const rows = await discoverAuthorMetricIndexes({papers:[paper]},name,async value=>{
    const url=new URL(value);
    if(url.searchParams.get('filter')==='author.id:A11')return workSample('A11','Jingfang Fan',match);
    if(url.hostname==='api.openalex.org')return JSON.stringify({results:[
      {...candidate,id:'https://openalex.org/A10',works_count:1},
      {...candidate,id:'https://openalex.org/A11',orcid:match,works_count:100,summary_stats:{h_index:26,i10_index:40}}
    ]});
    if(url.hostname==='pub.orcid.org')return JSON.stringify({person:{name:{'given-names':{value:'Jingfang'},'family-name':{value:'Fan'}}},'activities-summary':{works:{group:[{'work-summary':[{title:{title:{value:paper.title}}}]}]}}});
    throw Error('429');
  },stamp);
  assert.equal(rows[0].academic.metrics.publications,100);
  assert.equal(rows[0].identity_fields.orcid,match);
});

test('checks publisher metadata for an ORCID whose registry works differ from the library', async () => {
  const name=academicSearchIdentity({name:'Pecora, Louis M.',aliases:[],organization:'Naval Research Laboratory'});
  assert(name.aliases.includes('Louis Pecora'));
  const id='0000-0003-3075-0913', doi='10.1063/1.5081023';
  const rows=await discoverAuthorMetricIndexes({papers:[]},name,async value=>{
    const url=new URL(value);
    if(url.searchParams.get('filter')==='author.id:A1')return workSample('A1','Louis M. Pecora',id);
    if(url.hostname==='api.openalex.org')return JSON.stringify({results:[{id:'https://openalex.org/A1',display_name:'Louis M. Pecora',orcid:id,works_count:195,affiliations:[{institution:{display_name:'United States Naval Research Laboratory'}}]}]});
    if(url.hostname==='pub.orcid.org')return JSON.stringify({person:{name:{'given-names':{value:'Louis'},'family-name':{value:'Pecora'}}},'activities-summary':{works:{group:[{'work-summary':[{'external-ids':{'external-id':[{'external-id-type':'doi','external-id-value':doi,'external-id-relationship':'self'}]}}]}]}}});
    if(url.hostname==='api.crossref.org')return JSON.stringify({message:{DOI:doi,author:[{given:'Louis M.',family:'Pecora',ORCID:id,affiliation:[{name:'Naval Research Laboratory'}]}]}});
    throw Error('429');
  },stamp);
  assert.equal(rows[0].identity_fields.orcid,id);
});

test('a matching DOI does not make a predominantly unrelated OpenAlex profile safe to count', async () => {
  const id='https://openalex.org/A3',doi='10.1103/library-work',sampleIdentity={...identity,orcid:''};
  const candidate={id,display_name:sampleIdentity.name,works_count:67,cited_by_count:2567,affiliations:[{institution:{display_name:sampleIdentity.organization}}]};
  const work=org=>({doi,authorships:[{author:candidate,raw_author_name:sampleIdentity.name,raw_affiliation_strings:[org]}]});
  const other='Unrelated Medical University';
  const rows=await discoverAuthorMetricIndexes({papers:[{doi}]},sampleIdentity,async value=>{
    const url=new URL(value);
    if(url.pathname==='/authors')return JSON.stringify({results:[candidate]});
    if(url.searchParams.get('filter')==='author.id:A3')return JSON.stringify({results:[work(other),work(other),work(other),work(sampleIdentity.organization)]});
    if(url.pathname==='/works')return JSON.stringify({results:[work(sampleIdentity.organization)]});
    throw Error('429');
  },stamp);
  assert.equal(rows[0].academic.identity_status,'ambiguous');
  const reliable={provider:'Semantic Scholar',url:'https://www.semanticscholar.org/author/9',metrics:{publications:41}};
  const stale={provider:'OpenAlex',url:id,metrics:{publications:67,citations:2567}};
  const base={academic_metrics:{sources:[stale,reliable],best:{
    publications:{value:67,provider:'OpenAlex',url:id},citations:{value:2567,provider:'OpenAlex',url:id}
  }}};
  for(const missingOnly of [true,false]){
    const {academic_metrics}=academicInformationPatch(base,rows,{missingOnly});
    assert.deepEqual(academic_metrics.sources,[reliable]);
    assert.equal(academic_metrics.best.publications.value,41);
    assert.equal(academic_metrics.best.citations,undefined);
  }
});

test('the raw publisher ORCID can invalidate an OpenAlex profile with a matching projected ORCID', async () => {
  const rows=await discoverAuthorMetricIndexes({},identity,async value=>{
    const url=new URL(value);
    if(url.pathname==='/authors')return JSON.stringify({results:[{id:'https://openalex.org/A1',display_name:identity.name,orcid,works_count:17}]});
    if(url.searchParams.get('filter')==='author.id:A1')return workSample('A1',identity.name,'0000-0002-1797-0172',identity.organization);
    throw Error('429');
  },stamp);
  assert.equal(rows[0].academic.identity_status,'ambiguous');
  assert.deepEqual(rows[0].academic.metrics,{});
});
