import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {manualKeywordPatch,openKeywordEditor} from '../src/keyword-editor.js';
import {searchPapers} from '../src/core.js';
const pairs=Array.from({length:12},(_,i)=>({zh:'研究词'+i,en:'research-term-'+i,kind:i?'topic':'domain',importance:100-i}));
test('manual keywords retain more than ten bilingual entries and refresh stale search terms',()=>{
 const paper={id:'p',title:'Paper',keyword_pairs:pairs,keywords:pairs.map(p=>p.zh),search_terms:[...pairs.flatMap(k=>[k.zh,k.en]),'keep-extra']};
 const patch=manualKeywordPatch(paper,pairs.slice(1).map((p,i)=>i?{...p}:{...p,zh:'修改词',en:'modified-term'}));assert.equal(patch.keyword_pairs.length,11);assert(patch.search_terms.includes('keep-extra'));assert(!patch.search_terms.includes('research-term-0'));assert(!patch.search_terms.includes('research-term-1'));assert(patch.search_terms.includes('modified-term'));assert.equal(searchPapers([{...paper,...patch}],'modified-term').length,1);
 assert.deepEqual(manualKeywordPatch(paper,[]).keyword_pairs,[]);assert.throws(()=>manualKeywordPatch(paper,[{zh:'中文',en:'',importance:50}]));assert.throws(()=>manualKeywordPatch(paper,[pairs[0],pairs[0]]));
});
test('keyword editor supports edits and additions, and only updates the paper after cloud save',async()=>{
 const {document}=parseHTML('<html><body></body></html>');document.defaultView.HTMLElement.prototype.focus=()=>{};let saved;const paper={id:'p',keyword_pairs:pairs};
 const modal=(_title,body)=>{const el=document.createElement('div');el.innerHTML=body;document.body.append(el);return {el,close:()=>el.remove()};};
 const d=openKeywordEditor(paper,{modal,save:async(id,patch)=>{assert.equal(id,'p');saved=patch;}});assert.equal(d.el.querySelectorAll('[data-keyword-row]').length,12);
 d.el.querySelector('[name=zh]').value='更新领域';d.el.querySelector('[data-keyword-remove="1"]').onclick();d.el.querySelector('#keyword-add').onclick();const last=d.el.querySelector('[data-keyword-row]:last-child');last.querySelector('[name=zh]').value='新增现象';last.querySelector('[name=en]').value='new phenomenon';
 await d.el.querySelector('form').onsubmit({preventDefault(){}});assert.equal(saved.keyword_pairs.length,12);assert(saved.keyword_pairs.some(k=>k.zh==='更新领域'));assert(!saved.keyword_pairs.some(k=>k.zh==='研究词1'));assert.equal(paper.keyword_pairs.length,12);assert(paper.keywords_edited_at);assert(!d.el.isConnected);
});
test('failed keyword saves keep the editor and original paper intact',async()=>{const {document}=parseHTML('<html><body></body></html>');const paper={id:'p',keyword_pairs:pairs};const d=openKeywordEditor(paper,{modal:(_title,body)=>{const el=document.createElement('div');el.innerHTML=body;document.body.append(el);return {el,close:()=>el.remove()};},save:async()=>{throw Error('Network unavailable');}});d.el.querySelector('[name=zh]').value='未保存词';await d.el.querySelector('form').onsubmit({preventDefault(){}});assert.equal(paper.keyword_pairs[0].zh,'研究词0');assert.match(d.el.querySelector('[role=alert]').textContent,/Network unavailable/);assert(!d.el.querySelector('[type=submit]').disabled);});
