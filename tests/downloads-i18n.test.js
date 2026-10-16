import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {mergePaperPDFs} from '../src/paper-downloads.js';
import {translateText} from '../src/i18n.js';
test('combined download preserves page order and skips one corrupt PDF without losing others', async () => {
  async function pdf(width) {const doc=await PDFDocument.create();doc.addPage([width,500]);return doc.save();}
  const docs={a:await pdf(200),b:new Uint8Array([1,2,3]),c:await pdf(300)};
  const result=await mergePaperPDFs([{id:'a',title:'A'},{id:'b',title:'B'},{id:'c',title:'C'}],async p=>docs[p.id]);
  assert.equal(result.failures.length,1);assert.equal(result.pages,2);
  const merged=await PDFDocument.load(result.bytes);assert.deepEqual(merged.getPages().map(p=>p.getWidth()),[200,300]);
});
test('unmergeable PDFs report a useful error instead of creating an empty download', async () => {
  await assert.rejects(mergePaperPDFs([{title:'bad'}],async()=>new Uint8Array([1,2])),/逐个下载/);
});
test('interface translation covers account management, selection and pagination', () => {
  assert.equal(translateText('个人设置','en'),'Personal settings');
  assert.equal(translateText('注销账户','en'),'Delete account');
  assert.equal(translateText('已选 12 篇','en'),'12 selected');
  assert.equal(translateText('第 3 页','en'),'Page 3');
  assert.equal(translateText('个人设置.','en'),'Personal settings.');
  assert.equal(translateText('论文标题','zh'),'论文标题');
});
