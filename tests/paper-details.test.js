import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeKeywordPairs, keywordFields, validKeywordHierarchy, journalShort} from '../supabase/functions/_shared/paper-details.js';
import {validateAnalysis} from '../supabase/functions/_shared/analysis.js';
import {filename, exportCitations, searchPapers} from '../src/core.js';
import {removeUserFiles} from '../supabase/functions/_shared/account.js';
const pairs = [
  {zh:'复杂网络', en:'complex networks', kind:'domain', importance:100}, {zh:'同步', en:'synchronization', kind:'topic', importance:95},
  {zh:'混沌', en:'chaos', kind:'topic', importance:90}, {zh:'振荡器', en:'oscillators', kind:'topic', importance:80},
  {zh:'谱分析', en:'spectral analysis', kind:'method', importance:80}, {zh:'数值模拟', en:'numerical simulation', kind:'method', importance:75},
  {zh:'稳定性', en:'stability', kind:'phenomenon', importance:95}, {zh:'相变', en:'phase transition', kind:'conclusion', importance:80}
];
test('keywords are Chinese for display, bilingual for search, broad-to-specific and ranked within levels', () => {
  const fields = keywordFields([...pairs].reverse()); assert.deepEqual(fields.keywords.slice(0, 3), ['复杂网络','同步','混沌']);
  assert(fields.search_terms.includes('spectral analysis')); assert(validKeywordHierarchy(fields.keyword_pairs));
  const p = {title:'中文论文', ...fields}; assert.equal(searchPapers([p], 'spectral analysis').length, 1); assert.equal(searchPapers([p], '谱分析').length, 1);
});
test('Chinese unpublished manuscripts remain analyzable without a journal, DOI or publication date', () => {
  const p = validateAnalysis({title:'复杂网络中的同步现象', publication_status:'unpublished', journal:'目标期刊', published_at:'2026-01-01', keyword_pairs:pairs, summary:'研究问题：研究同步。方法：数值模拟。主要结论/现象：观察同步。局限与待核验：未发表稿件。'});
  assert.equal(p.journal,''); assert.equal(p.published_at,null); assert.equal(p.keywords.length,8); assert.match(filename(p), /^\[未发表\]/);
  assert.match(exportCitations([{id:'x',...p}], 'bibtex'), /^@unpublished/); assert.equal(JSON.parse(exportCitations([{id:'x',...p}], 'csl'))[0].type,'manuscript');
});
test('missing keywords do not discard otherwise useful analysis metadata', () => {
  const p = validateAnalysis({title:'中文初稿', publication_status:'unknown', summary:'待核验', keyword_pairs:[]}); assert.equal(p.title,'中文初稿'); assert.deepEqual(p.keywords,[]);
});
test('invalid dates are not fabricated and duplicate/English-only keyword labels are discarded', () => {
  assert.equal(validateAnalysis({title:'x', published_at:'2026-02-31'}).published_at,null);
  assert.equal(normalizeKeywordPairs([...pairs,pairs[0],{zh:'English only',en:'English',kind:'domain'}]).length,8);
});
test('citation nodes use the shortest established journal abbreviation', () => {
  for(const [journal, expected] of [['Nature Communications','NC'],['Physical Review E','PRE'],['Nature Human Behaviour','NHB']]) assert.equal(journalShort({journal}),expected);
  assert.equal(journalShort({journal_abbr:'Nat. Commun.'}),'NC'); assert.equal(journalShort({publication_status:'unpublished'}),'未发表');
});
test('account file cleanup paginates and only deletes objects under the authenticated user folder', async () => {
  const buckets = {papers:Array.from({length:205},(_,i)=>({id:String(i),name:`${i}.pdf`})),avatars:[{id:'a',name:'a.webp'}],'chat-files':[]}, removed=[];
  const service={storage:{from(bucket){return {async list(prefix,{limit}){assert.equal(prefix,'user-a');return {data:buckets[bucket].slice(0,limit)};},async remove(paths){assert(paths.every(p=>p.startsWith('user-a/')));removed.push(...paths);buckets[bucket].splice(0,paths.length);return {error:null};}};}}};
  await removeUserFiles(service,'user-a'); assert.equal(removed.length,206); assert.equal(buckets.papers.length,0);
});
test('account cleanup stops on storage errors and never expands to another user folder', async () => {
  const service={storage:{from(){return {list:async()=>({data:[{id:'x',name:'../other/file.pdf'}]}),remove:async()=>{throw new Error('must not remove');}};}}};
  await assert.rejects(removeUserFiles(service,'user-a'),/路径异常/);
});
