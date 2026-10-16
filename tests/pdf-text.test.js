import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocumentText } from '../src/pdf-text.js';

function fixture(pages) {
  const task = {destroyed: false, async destroy() {this.destroyed = true;}};
  // The PDF.js 6 document has no destroy() method.
  task.promise = Promise.resolve({numPages: pages.length, async getPage(n) {
    return {async getTextContent() {return {items: [{str: pages[n - 1], hasEOL: true}]};}};
  }});
  return task;
}

test('extracted text survives PDF.js 6 worker cleanup and keeps page references', async () => {
  const task = fixture(['Research question and methods. '.repeat(10), 'Results and limitations. '.repeat(10)]);
  const text = await extractDocumentText(task);
  assert.match(text, /\[Page 1\]\nResearch question/);
  assert.match(text, /\[Page 2\]\nResults/);
  assert.equal(task.destroyed, true);
});

test('scan-only PDF reports the OCR requirement rather than a missing destroy method', async () => {
  const task = fixture(['']);
  await assert.rejects(extractDocumentText(task), /扫描版 PDF 请先做 OCR/);
  assert.equal(task.destroyed, true);
});

test('oversized extracted text is rejected and still releases the worker', async () => {
  const task = fixture(['x'.repeat(600001)]);
  await assert.rejects(extractDocumentText(task), /全文超过 60 万字符/);
  assert.equal(task.destroyed, true);
});

test('failed PDF loading releases the task and preserves the loading error', async () => {
  const task = fixture([]);
  task.promise = Promise.reject(new Error('Invalid PDF structure'));
  await assert.rejects(extractDocumentText(task), /Invalid PDF structure/);
  assert.equal(task.destroyed, true);
});

test('many blank pages cannot bypass the minimum text check through page markers', async () => {
  const task = fixture(Array(30).fill(''));
  await assert.rejects(extractDocumentText(task), /OCR/);
  assert.equal(task.destroyed, true);
});

test('Chinese glyph spacing is normalized without joining English words', async () => {
  const task = fixture(['复 杂 网 络 同 步 '.repeat(20) + 'Spectral analysis']);
  const text = await extractDocumentText(task);
  assert(text.includes('复杂网络同步')); assert(text.includes('Spectral analysis'));
});
