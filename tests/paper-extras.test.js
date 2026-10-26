import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {supplementType,mountPaperSupplements,referencesMarkup} from '../src/paper-extras.js';
import {validateAnalysis} from '../supabase/functions/_shared/analysis.js';
test('SM uploads register an owner-scoped private file and update the paper only after cloud association',async()=>{
 const {document}=parseHTML('<div id="root"><div data-sm-list></div><button data-sm-add></button><input data-sm-input></div>'),root=document.querySelector('#root'),input=root.querySelector('input'),paper={id:'paper',supplementary_files:[]},calls=[];const file={name:'补充材料.pdf',size:100,lastModified:123};Object.defineProperty(input,'files',{value:[file]});
 const db={storage:{from:bucket=>({upload:async(path,body,options)=>{calls.push({bucket,path,body,options});return {};}})},rpc:async(name,args)=>{assert.equal(name,'append_paper_supplement');assert.equal(args.paper_id,paper.id);assert.match(args.object_name,/^owner\/sm-[0-9a-f-]+\.pdf$/);return {data:{id:paper.id,supplementary_files:[{path:args.object_name,name:args.display_name,type:'application/pdf'}]}};}};
 let updated=0;mountPaperSupplements(root,paper,{db,userId:'owner',ensureStorageSpace:async size=>assert.equal(size,100),afterSave:()=>updated++,toast(){}});await input.onchange();assert.equal(calls.length,1);assert.equal(calls[0].bucket,'papers');assert.equal(calls[0].options.upsert,false);assert.equal(updated,1);assert.equal(paper.supplementary_files.length,1);assert.equal(root.querySelector('[data-sm-file] span').textContent,'PDF');assert(root.querySelector('[data-sm-delete]'));assert.match(root.querySelector('[data-sm-file]').title,/SM/);
 assert.equal(supplementType({name:'data.zip',size:100}).type,'application/zip');assert.throws(()=>supplementType({name:'unsafe.html',size:20}));
});
test('reference badges link exact library papers and DOI sources with escaped titles; manual references survive analysis',()=>{
 const refs=[{title:'Internal <Paper>',doi:'10.1234/a'},{title:'Other study',doi:'10.5678/b'}],paper={id:'one',references:refs,references_edited_at:'2026-10-26'};
 const html=referencesMarkup(paper,[{id:'two',title:'Internal <Paper>',doi:'10.1234/a'}]);assert(html.includes('#/paper/two'));assert(html.includes('https://doi.org/10.5678%2Fb'));assert(html.includes('&lt;Paper&gt;'));
 const result=validateAnalysis({title:'Current paper',references:[{title:'AI replacement'}]},paper);assert.deepEqual(result.references,refs);
});
