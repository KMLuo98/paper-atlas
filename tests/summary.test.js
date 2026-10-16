import test from 'node:test';
import assert from 'node:assert/strict';
import {summarySections,renderSummary} from '../src/summary.js';
import {cleanResearchSummary} from '../supabase/functions/_shared/summary-content.js';
test('existing summaries become heading-and-body blocks without changing their content',()=>{
  const sections=summarySections('研究问题：重构网络。[Page 1]\n\n方法：变分模型与数值模拟。\n主要结论/现象：可恢复隐含网络。\n局限与待核验：未发表稿件。');
  assert.deepEqual(sections.map(s=>s.heading),['问题','模型与方法','结论与现象','局限与待核验']);assert.equal(sections[0].text,'重构网络。[Page 1]');
  const html=renderSummary('问题：<script>alert(1)</script>\n模型：已有模型');assert(html.includes('<h4'));assert(html.includes('<p>'));assert(!html.includes('<script>'));
});

test('editorial dates are omitted while scientific dates, findings and unpublished status stay',()=>{
  const text='问题：使用2024年的实验数据重构网络。\n方法：变分模型。\n结论：能够恢复网络。\n局限与待核验：未发表稿件。收稿日期为2026年4月1日。修回日期尚未提供。';
  const sections=summarySections(text);assert(sections[0].text.includes('2024年的实验数据'));assert.equal(sections.at(-1).text,'未发表稿件。');assert(!renderSummary(text).includes('收稿日期'));assert(!renderSummary(text).includes('修回日期'));
  assert.equal(cleanResearchSummary('Received 15 April 2026; Scientific result.'),'Scientific result.');
});
test('inline and markdown section headings work while unstructured notes are preserved',()=>{
  assert.equal(summarySections('问题：一个问题。方法：一个方法。结论：一个结论。').length,3);
  assert.deepEqual(summarySections('## **研究问题：**\n具体问题\n\n**模型**：\n具体模型').map(s=>s.heading),['问题','模型']);
  assert.deepEqual(summarySections('An existing unstructured summary.'),[{heading:'',text:'An existing unstructured summary.'}]);
});
