import test from 'node:test';
import assert from 'node:assert/strict';
import {parseModelJSON, requestModelJSON, ModelJSONError} from '../supabase/functions/_shared/model-json.js';
const response=(content,finish_reason='stop')=>({choices:[{message:{content},finish_reason}]});
test('model JSON supports fences and Unicode without evaluating untrusted text', () => {
  assert.deepEqual(parseModelJSON(response('```json\n{"title":"中文\\u0000稿件"}\n```').choices[0]),{title:'中文稿件'});
  for(const content of ['[]','null','42','{"title":"unfinished','(()=>process.exit())()'])assert.throws(()=>parseModelJSON(response(content).choices[0]),ModelJSONError);
});
test('truncated long output is retried with a concise schema instruction', async () => {
  const prompts=[];const result=await requestModelJSON(async (system,attempt)=>{prompts.push(system);return attempt?response('{"title":"未发表稿件","publication_status":"unpublished"}'):response('{"title":"paper","references":[','length');},'Only source-grounded JSON.');
  assert.equal(result.publication_status,'unpublished');assert.equal(prompts.length,2);assert(prompts[1].includes('references 最多保留20条'));
});
test('malformed JSON retries once and never fabricates partial metadata', async () => {
  let calls=0;await assert.rejects(requestModelJSON(async()=>{calls++;return response('{"title":');},'schema'),ModelJSONError);assert.equal(calls,2);
});
test('network failures and upstream errors do not trigger paid automatic retries', async () => {
  let calls=0;await assert.rejects(requestModelJSON(async()=>{calls++;throw new Error('upstream timeout');},'schema'),/timeout/);assert.equal(calls,1);
});

test('safe syntax repair preserves paper text and fixes only escapes, control characters and trailing commas', () => {
  const malformed = '{"title":"paper","summary":"line one\nline two and '+String.raw`\alpha`+'","references":[{"title":"source",},],}';
  const parsed = parseModelJSON(response(malformed).choices[0]);
  assert.equal(parsed.summary, 'line one\nline two and '+String.raw`\alpha`);
  assert.deepEqual(parsed.references,[{title:'source'}]);
  const valid={summary:String.raw`\alpha and \beta`,title:'研究',references:[]};
  assert.deepEqual(parseModelJSON(response(JSON.stringify(valid)).choices[0]),valid);
});
test('invalid responses report content-free diagnostics and empty replies recover automatically', async () => {
  const logs=[];const result=await requestModelJSON(async(_,attempt)=>attempt?response('{"title":"paper"}'):response(''),'schema',{onInvalid:d=>logs.push(d)});
  assert.equal(result.title,'paper');assert.equal(logs.length,1);assert.equal(logs[0].reason,'empty');assert.equal(logs[0].content_chars,0);assert(!JSON.stringify(logs).includes('paper'));
});
test('syntax repair never completes truncated metadata or accepts executable text', () => {
  for(const text of ['{"title":"paper"','{"title":"broken\n','{"x":undefined}','{"x":process.exit()}'])assert.throws(()=>parseModelJSON(response(text).choices[0]),ModelJSONError);
  assert.throws(()=>parseModelJSON(response('{"title":"paper"}','length').choices[0]),e=>e.truncated);
});
