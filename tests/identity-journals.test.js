import test from 'node:test';
import assert from 'node:assert/strict';
import {authorNetwork,journalFull,journalShort} from '../src/core.js';
import {authorIdentity,sameAuthor} from '../supabase/functions/_shared/author-identity.js';
test('ORCID URLs, prefixes, hyphens and case identify the same author regardless of name',()=>{
  const a={name:'姓名甲',orcid:'https://orcid.org/0000-0002-1825-009X'},b={name:'Other spelling',orcid:'ORCID: 000000021825009x'};
  assert.equal(authorIdentity(a),authorIdentity(b));assert(sameAuthor(a,b));assert.equal(authorNetwork([{id:'a',authors:[a]},{id:'b',authors:[b]}]).nodes.length,1);
  assert(!sameAuthor(a,{name:a.name,orcid:'0000-0001-5109-3700'}));
});
test('journal aliases share an official title without merging unrelated full titles',()=>{
  for(const journal of ['PRE','Physical Review E','Phys. Rev. E'])assert.equal(journalFull({journal}),'Physical Review E');
  for(const journal of ['Chaos, Solitons and Fractals','CSF','Chaos, Solitons & Fractals'])assert.equal(journalFull({journal}),'Chaos, Solitons & Fractals');
  assert.equal(journalFull({journal:'Chaos'}),'Chaos: An Interdisciplinary Journal of Nonlinear Science');
  assert.equal(journalFull({journal:'Acta Phys. Sin.'}),'物理学报');assert.equal(journalFull({journal:'Neural Computation',journal_abbr:'NC'}),'Neural Computation');
  assert.equal(journalShort({journal:'Nature Communications'}),'NC');assert.equal(journalFull({publication_status:'unpublished',journal:'Chaos'}),'');
});
test('bilingual source aliases, hyphenated names and repeated entries count each shared paper once',()=>{
  const papers=[{id:'cn',authors:[{name:'罗恺明',aliases:['Luo Kai-Ming']},{name:'管曙光',aliases:['Guan Shu-Guang']},{name:'管曙光',aliases:['Guan Shu-Guang']}]},{id:'en',authors:[{name:'Kaiming Luo'},{name:'Shuguang Guan'}]}];
  const n=authorNetwork([...papers,papers[0]]);assert.equal(n.nodes.length,2);assert.equal(n.edges.length,1);assert.equal(n.edges[0].weight,2);assert.deepEqual(n.edges[0].papers,['cn','en']);
});
test('an incomplete same-name author record cannot bridge two different ORCIDs',()=>{
  const n=authorNetwork([{id:'a',authors:[{name:'Same Name',orcid:'1'},{name:'Same Name',orcid:'2'}]},{id:'b',authors:[{name:'Same Name'}]}]);
  assert.equal(n.nodes.length,3);assert.equal(n.edges.length,1);
});
