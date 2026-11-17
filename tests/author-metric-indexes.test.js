import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverAuthorMetricIndexes} from '../supabase/functions/_shared/author-metric-indexes.js';
import {academicInformationPatch} from '../supabase/functions/_shared/academic-profiles.js';
import {academicSearchIdentity} from '../supabase/functions/_shared/author-information.js';

const orcid = '0009-0003-3727-4187';
const identity = {name:'Kaiming Luo', aliases:[], organization:'Fudan University', orcid};
const person = {papers:[{title:'Controlling synchronization dynamics via physics-informed neural networks'}]};
const stamp = '2026-11-17';

test('matches OpenAlex by ORCID and Semantic Scholar by paper, keeping provenance and zero values', async () => {
  const rows = await discoverAuthorMetricIndexes(person, identity, async value => {
    const url = new URL(value);
    if (url.hostname === 'api.openalex.org') {
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
