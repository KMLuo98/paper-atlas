import test from 'node:test';
import assert from 'node:assert/strict';
import {researchNetwork} from '../src/research-network.js';
import {computeNetworkLayout} from '../src/network-physics.js';
import {duplicatePaperGroups} from '../src/paper-duplicates.js';

const papers=[
 {id:'one',title:'Remote synchronization in complex networks',abstract:'Oscillators in a network exhibit remote synchronization.',status:'ready'},
 {id:'copy',title:'[PRE 2026.3] Remote synchronization in complex networks',summary:'A different AI summary',keywords:['unrelated keywords']},
 {id:'sync',title:'Phase synchronization in complex networks',abstract:'Synchronization is observed in coupled oscillators.'},
 {id:'other',title:'Optical spectroscopy of distant galaxies'}
];

test('research map uses invisible affinities and keeps nested topic regions',()=>{
 const graph=researchNetwork(papers);
 assert.deepEqual(graph.edges,[]);
 assert(graph.layoutEdges.some(edge=>edge.source==='one'&&edge.target==='copy'&&edge.weight===1));
 assert.deepEqual(graph.regions.map(region=>region.labels[1]),['Complex networks','Synchronization','Remote synchronization']);
 const [one,copy,,other]=computeNetworkLayout(graph,840,620);
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 assert(distance(one,copy)<distance(one,other));
});

test('duplicate review groups normalized titles and prioritizes the analyzed copy',()=>{
 const groups=duplicatePaperGroups(papers);
 assert.deepEqual(groups.map(group=>group.map(paper=>paper.id)),[['one','copy']]);
});
