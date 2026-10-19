import test from 'node:test';
import assert from 'node:assert/strict';
import {ZipWriter, BlobWriter, TextReader} from '@zip.js/zip.js';
import {collectImports, runImportBatch, runAnalysisQueue, analysisConcurrency, safeImportPath} from '../src/imports.js';

test('more than ten PDFs upload completely before the first analysis, despite failures', async () => {
  const events = [], items = Array.from({length: 27}, (_, n) => ({name: `paper-${n}`}));
  const result = await runImportBatch(items, {async upload(item) {events.push(`upload:${item.name}`); if (item.name === 'paper-2') throw new Error('bad upload'); return {title: item.name};}, async analyze(p) {events.push(`analyze:${p.title}`); if (p.title === 'paper-5') throw new Error('bad analysis');}});
  assert.equal(result.saved.length, 26); assert.equal(result.failures.length, 2);
  assert.equal(events.findIndex(e => e.startsWith('analyze:')), 27);
  assert.equal(events.at(-1), 'analyze:paper-26');
});
test('upload-only mode makes no analysis calls', async () => {
  const stages = []; await runImportBatch([{name: 'paper'}], {upload: async () => ({title: 'paper'}), onProgress: p => stages.push(p.phase)});
  assert.deepEqual(stages, ['upload']);
});
test('real ZIP import reads nested PDFs lazily and ignores non-PDFs and unsafe paths', async () => {
  const writer = new ZipWriter(new BlobWriter('application/zip'), {useWebWorkers: false});
  await writer.add('研究/中文稿件.pdf', new TextReader('%PDF-1.4 fixture'));
  await writer.add('notes.txt', new TextReader('ignored'));
  await writer.add('../unsafe.pdf', new TextReader('%PDF-unsafe'));
  const zip = new File([await writer.close()], 'library.zip', {type: 'application/zip'});
  const pack = await collectImports([zip]);
  try {assert.equal(pack.items.length, 1); assert.equal(pack.errors.length, 1); assert.match(pack.items[0].name, /中文稿件.pdf/); const pdf = await pack.items[0].getFile(); assert.equal(await pdf.text(), '%PDF-1.4 fixture');} finally {await pack.close();}
});
test('a corrupt ZIP does not block another PDF in the same batch', async () => {
  const pack = await collectImports([new File(['broken'], 'broken.zip'), new File(['%PDF-1.4'], 'good.pdf')]);
  assert.equal(pack.items.length, 1); assert.equal(pack.errors.length, 1); await pack.close();
});
test('import paths reject traversal, absolute paths and hidden OS metadata', () => {
  for (const name of ['../x.pdf', 'a/../../x.pdf', '/x.pdf', 'C:\\x.pdf', '__MACOSX/a.pdf']) assert.equal(safeImportPath(name), '');
  assert.equal(safeImportPath('论文/中文.pdf'), '论文/中文.pdf');
});

test('analysis runs three papers concurrently and replaces finished or failed jobs without stopping', async () => {
  const papers = Array.from({length: 7}, (_, id) => ({id, title: String(id)}));
  const releases = new Map(), started = [], progress = [];
  let active = 0, peak = 0;
  const running = runAnalysisQueue(papers, async paper => {
    started.push(paper.id); active++; peak = Math.max(peak, active);
    await new Promise(resolve => releases.set(paper.id, resolve));
    active--;
    if (paper.id === 1) throw new Error('one failed');
  }, {concurrency: 3, onProgress: p => progress.push(p.index)});
  assert.deepEqual(started, [0, 1, 2]);
  releases.get(1)();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2, 3]);
  releases.get(0)(); releases.get(2)(); releases.get(3)();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2, 3, 4, 5, 6]);
  releases.get(6)(); releases.get(4)(); releases.get(5)();
  const failures = await running;
  assert.equal(peak, 3); assert.equal(active, 0);
  assert.deepEqual(failures, [{phase: 'analyze', name: '1', message: 'one failed'}]);
  assert.deepEqual(progress, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('mobile layouts use three workers and desktop layouts use ten workers', async () => {
  for (const mobile of [true, false]) {
    const limit = analysisConcurrency(query => {
      assert.equal(query, '(max-width: 850px)'); return {matches: mobile};
    });
    assert.equal(limit, mobile ? 3 : 10);
    let active = 0, peak = 0;
    await runAnalysisQueue(Array.from({length: 24}, (_, title) => ({title})), async () => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setImmediate(resolve)); active--;
    }, {concurrency: limit});
    assert.equal(peak, limit); assert.equal(active, 0);
  }
});
