import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseText, databaseJSON} from '../supabase/functions/_shared/text.js';
import {validateAnalysis} from '../supabase/functions/_shared/analysis.js';

test('database text preserves valid CJK, math, astral characters and literal escape text', () => {
  const source = '未发表稿件\t∂ρ/∂t = −∇·J\n𠀀 😀 \\u0000';
  assert.equal(databaseText(source), source);
  assert.equal(databaseText('中\u0000文\ud800A\udc00'), '中文\ufffdA\ufffd');
});

test('nested metadata is cleaned without changing nulls, numbers or the source object', () => {
  const source = {title:'中文\u0000论文', authors:[{name:'作\ud800者'}], date:null, importance:95, done:false};
  const cleaned = databaseJSON(source);
  assert.deepEqual(cleaned, {title:'中文论文', authors:[{name:'作\ufffd者'}], date:null, importance:95, done:false});
  assert(source.title.includes('\u0000'));
  assert.equal(databaseText(cleaned.authors[0].name), cleaned.authors[0].name);
});

test('model Unicode artifacts do not discard Chinese unpublished metadata or keywords', () => {
  const paper = validateAnalysis({title:'未发表\u0000论文',publication_status:'unpublished',authors:[{name:'中文\u0000作者'}],keyword_pairs:[{zh:'复杂\u0000网络',en:'complex networks',kind:'domain',importance:100}],summary:'方法：数值模拟\ud800。'});
  assert.equal(paper.title,'未发表论文');
  assert.equal(paper.authors[0].name,'中文作者');
  assert.equal(paper.keyword_pairs[0].zh,'复杂网络');
  assert.equal(paper.publication_status,'unpublished');
  assert.equal(paper.published_at,null);
  assert.equal(paper.summary.isWellFormed(),true);
});
