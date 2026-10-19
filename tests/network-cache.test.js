import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedCitationNetwork,cachedNetwork,cachedCollaborationGroups,networkLayouts} from '../src/network-cache.js';
import {citationNetwork,authorNetwork} from '../src/core.js';
import {collaborationGroups} from '../supabase/functions/_shared/collaboration.js';

test('indexed citation matching preserves DOI/title fallback, duplicate targets and no self citations', () => {
  const papers=[
    {id:'a',title:'Source',doi:'10.1/a',references:[{doi:'https://doi.org/10.1/B',title:'Alternative title'},{title:'Same title'},{doi:'10.1/a'},{title:'Target'}]},
    {id:'b',title:'Target',doi:'10.1/b'},
    {id:'c',title:'Alternative title',doi:'10.1/c'},
    {id:'d',title:'Same title',doi:'10.1/d'},
    {id:'e',title:'Same title',doi:'10.1/d'}
  ];
  const expected=citationNetwork(papers),actual=indexedCitationNetwork(papers);
  assert.deepEqual(actual.edges,expected.edges);
  assert.deepEqual(actual.nodes,expected.nodes.map(({paper,...node})=>node));
});
test('network caches invalidate on graph edits, scope changes and account changes without caching full text', () => {
  const papers=[{id:'a',title:'A',doi:'10/a',full_text:'private text',summary:'summary',references:[]},{id:'b',title:'B',doi:'10/b'}];
  const first=cachedNetwork('citations',papers,'owner-a');
  assert.equal(first,cachedNetwork('citations',structuredClone(papers),'owner-a'));
  papers[0].summary='new summary';assert.equal(first,cachedNetwork('citations',papers,'owner-a'));
  papers[0].references=[{doi:'10/b'}];const changed=cachedNetwork('citations',papers,'owner-a');assert.notEqual(first,changed);assert.equal(changed.edges.length,1);
  assert(!JSON.stringify(changed).includes('private text'));assert(!JSON.stringify(changed).includes('new summary'));
  assert.notEqual(changed,cachedNetwork('citations',papers.slice(0,1),'owner-a'));
  networkLayouts.set('layout',[{id:'a',x:1,y:2}]);
  assert.notEqual(changed,cachedNetwork('citations',papers,'owner-b'));assert.equal(networkLayouts.get('layout'),undefined);
});
test('author identity edits rebuild cached data and pair rankings reuse exactly counted shared papers', () => {
  const papers=[{id:'p1',authors:[{name:'Alice'},{name:'Bob'},{name:'Carol'}]},{id:'p2',authors:[{name:'Alice'},{name:'Bob'}]}];
  const network=cachedNetwork('authors',papers,'owner');
  const pairs=cachedCollaborationGroups(network,2);
  assert.deepEqual(pairs,collaborationGroups(network,2));assert.equal(pairs,cachedCollaborationGroups(network,2));
  assert.deepEqual(cachedCollaborationGroups(network,3),collaborationGroups(network,3));
  papers[0].authors[0].orcid='0000-0002-1825-0097';
  const updated=cachedNetwork('authors',papers,'owner');assert.notEqual(network,updated);assert.deepEqual(updated,authorNetwork(papers));
});
test('layout cache evicts older entries to keep memory bounded', () => {
  networkLayouts.clear();for(let i=0;i<12;i++)networkLayouts.set(String(i),[{id:String(i),x:i,y:i}]);
  assert.equal(networkLayouts.get('0'),undefined);assert.equal(networkLayouts.get('11')[0].x,11);
});
