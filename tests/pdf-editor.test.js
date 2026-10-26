import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {cleanPDFMarks,markHistory,highlightsFromRects} from '../src/pdf-marks.js';
import {mountPDFEditor} from '../src/pdf-editor.js';
import {annotationStore,clearAnnotationDrafts} from '../src/pdf-annotation-store.js';
test('annotation history supports undo/redo and normalizes safe page coordinates and Unicode notes',()=>{
 const marks=cleanPDFMarks([{id:'a',type:'note',page:1,x:2,y:-1,size:.02,text:'中文\u0000备注',color:'javascript:bad',points:[null,[.2,.3]]}]);assert.equal(marks[0].x,1);assert.equal(marks[0].y,0);assert.equal(marks[0].text,'中文备注');assert.equal(marks[0].color,'#2454a4');assert.equal(marks[0].points.length,1);
 const h=markHistory();h.change(marks);assert(h.canUndo());h.undo();assert.equal(h.get().length,0);h.redo();assert.equal(h.get()[0].text,'中文备注');
 const selected=highlightsFromRects([{left:20,right:120,top:40,bottom:54,width:100,height:14}],[{page:2,left:0,top:0,width:500,height:700}]);assert.equal(selected[0].page,2);assert.equal(selected[0].points[0][0],.04);assert.equal(selected[0].size,.028);
});
test('PDF editing draws, saves, restores notes and collapses tools when moved to the right',async()=>{
 const {document,window}=parseHTML('<html><body><div id="pdf"><div class="paged-pdf-reader"><div class="pdf-canvas-host"><div class="pdf-page-slot" data-page="1" data-aspect="1.4"><canvas style="width:500px;height:700px"></canvas></div></div></div></div></body></html>');const old=globalThis.MutationObserver;globalThis.MutationObserver=window.MutationObserver;
 try{const container=document.querySelector('#pdf'),canvas=container.querySelector('canvas'),slot=container.querySelector('.pdf-page-slot');canvas.getBoundingClientRect=()=>({left:10,top:20,width:500,height:700});slot.getBoundingClientRect=()=>({left:0,top:0});let saved,kept;
 const store={load:async()=>({marks:[],version:0}),draft:()=>null,keep:value=>kept=value,clear:()=>kept=null,save:async(marks,version)=>{saved={marks,version};return {marks,version:version+1};}};
 const editor=mountPDFEditor(container,{store,url:'https://example.edu/paper.pdf'});await editor.ready;const layer=container.querySelector('.pdf-annotation-layer');layer.getBoundingClientRect=()=>({left:10,top:20,width:500,height:700});const click=tool=>container.querySelector(`[data-pdf-tool="${tool}"]`).onclick();
 await click('ink');layer.onpointerdown({button:0,pointerId:1,clientX:110,clientY:160,preventDefault(){}});layer.onpointermove({clientX:210,clientY:230,preventDefault(){}});layer.onpointerup();assert.equal(editor.getMarks().length,1);assert.equal(editor.getMarks()[0].points[0][0],.2);assert(kept);
 await click('undo');assert.equal(editor.getMarks().length,0);await click('redo');assert.equal(editor.getMarks().length,1);await click('save');assert.equal(saved.version,0);assert.equal(saved.marks.length,1);assert.equal(kept,null);
 await click('note');layer.onpointerdown({button:0,pointerId:2,clientX:130,clientY:230,preventDefault(){}});container.querySelector('.pdf-text-entry textarea').value='中文备注 <script>';container.querySelector('.pdf-text-entry button').onclick();assert.equal(editor.getMarks().at(-1).text,'中文备注 <script>');assert.equal(container.querySelectorAll('script').length,0);
 editor.setCompact(true);const bar=container.querySelector('.pdf-edit-bar');assert(bar.classList.contains('compact'));bar.querySelector('.pdf-edit-menu').onclick();assert(bar.classList.contains('tools-open'));editor.setCompact(false);assert(!bar.classList.contains('compact'));editor.destroy();assert(kept);
 }finally{if(old===undefined)delete globalThis.MutationObserver;else globalThis.MutationObserver=old;}
});
test('annotation storage scopes cloud reads and supports an idempotent save response after a network error',async()=>{
 const marks=[{id:'a',type:'text',page:1,text:'A',x:.2,y:.2}],row={marks,version:2};let args;
 const db={from:table=>{assert.equal(table,'pdf_annotations');return {select(){return this;},eq(k,v){assert(['user_id','file_path'].includes(k));return this;},maybeSingle:async()=>({data:row})};},rpc:async(name,value)=>{assert.equal(name,'save_pdf_annotations');args=value;return {error:Error('network')};}};
 const store=annotationStore(db,'owner','owner/a.pdf');store.keep({marks,version:1});assert.equal((await store.save(marks,1)).version,2);assert.equal(args.p_file_path,'owner/a.pdf');assert.equal(store.draft(),undefined);clearAnnotationDrafts('owner');
});
