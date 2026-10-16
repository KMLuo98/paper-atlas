import test from 'node:test';
import assert from 'node:assert/strict';
import {ZipWriter, BlobWriter, TextReader} from '@zip.js/zip.js';
import {collectImports, runImportBatch, safeImportPath} from '../src/imports.js';

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
