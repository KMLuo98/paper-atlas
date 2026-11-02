import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import {parseHTML} from 'linkedom';
import {formattedMail} from '../../supabase/functions/mail-api/formatted-mail.js';import {clean,addresses,uuid} from '../../supabase/functions/mail-api/core.js';
const source=fs.readFileSync(new URL('../../supabase/functions/mail-api/index.ts',import.meta.url),'utf8');
test('the draft endpoint saves sanitized HTML and the corresponding plain-text body together',async()=>{
 let saved;const line=source.split('\n').find(s=>s.includes("if(action==='draft_save')")),context={action:'draft_save',b:{data:{to:'person@example.edu',subject:'Draft',body:'stale',body_html:'<p><b>Hello</b></p><script>bad()</script>'}},user:'owner',formattedMail,parseHTML,clean,uuid,crypto,json:x=>x,checked:async p=>p,service:{from:()=>({upsert:async data=>{saved=data;}})}};
 await vm.runInNewContext('(async()=>{'+line+'})()',context);assert.equal(saved.user_id,'owner');assert.equal(saved.data.body,'Hello');assert.equal(saved.data.body_html,'<p><b>Hello</b></p>');
});
test('the send endpoint supplies sanitized HTML and a plain alternative to MIME composition',async()=>{
 const start=source.indexOf(" if(action==='send'){"),end=source.indexOf(' const locked=',start),code=source.slice(start,end)+'return opts;}',context={action:'send',b:{account_id:'a',key:'3c141586-aea4-49dd-b3d1-c735d493f2f3',to:'person@example.edu',body:'stale',body_html:'<p><b style="font-size:24px">Hello</b> scientist</p>',subject:'Test'},user:'owner',formattedMail,parseHTML,clean,uuid,addresses,rate:async()=>{},own:async()=>({email:'qa@example.edu',label:'School',provider:'imap'}),credentials:async()=>({}),service:{},composeRaw:async()=>new Uint8Array()};
 const opts=await vm.runInNewContext(stripTypeScriptTypes('(async()=>{'+code+'})()',{mode:'transform'}),context);assert.equal(opts.text,'Hello scientist');assert.match(opts.html,/font-size:24px/);assert.match(opts.html,/<b/);assert.deepEqual(Array.from(opts.to),['person@example.edu']);
});
