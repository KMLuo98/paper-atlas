import test from 'node:test';
import assert from 'node:assert/strict';
import {researchNetwork} from '../src/research-network.js';
import {computeNetworkLayout} from '../src/network-physics.js';

test('research graph links bilingual related papers and keeps unrelated papers locatable',()=>{
 const papers=[
  {id:'en',title:'Synchronization on complex networks',keyword_pairs:[{zh:'复杂网络',en:'complex networks'},{zh:'同步',en:'synchronization'}]},
  {id:'zh',title:'复杂网络中的同步动力学',keywords:['复杂网络','同步']},
  {id:'other',title:'Optical spectroscopy of distant galaxies',keywords:['galaxy evolution']}
 ];
 const graph=researchNetwork(papers);
 assert.deepEqual(graph.nodes.map(node=>node.id),['en','zh','other']);
 assert.equal(graph.edges.length,1);
 assert.equal(graph.edges[0].source,'en');
 assert.equal(graph.edges[0].target,'zh');
 const [en,zh,other]=computeNetworkLayout(graph,840,620);
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 assert(distance(en,zh)<distance(en,other));
});
