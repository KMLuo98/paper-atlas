import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {TRANSLATION_PREFIX,stripMailHistory,latestMailText,translationChunks,translateLatestStep,savedLatestTranslations} from '../../supabase/functions/mail-api/translation.js';
const hash=async s=>createHash('sha256').update(s).digest('hex');
const message={subject:'Research',text_body:'Latest message.\n\nOn Tue, 27 Oct 2026, Person <p@example.edu> wrote:\n> Old conversation.\nOlder signature'};
function fixture(m=message){let raw=null,calls=[];const options={message:m,language:'简体中文',parseHTML,hash,read:async()=>raw,write:async(s,old)=>{assert.equal(raw,old);raw=s;return true;},translate:async(s,p)=>{calls.push({s,p});return '译文：'+s;}};return {options,calls,get raw(){return raw;},set raw(s){raw=s;}};}
test('latest mail extraction drops common English, wrapped and Chinese reply history',()=>{
 assert.equal(latestMailText(message,parseHTML),'Latest message.');
 assert.equal(stripMailHistory('New reply\nOn Tue, 27 Oct 2026,\nPerson <p@example.edu>\nwrote:\nOld body'),'New reply');
 for(const separator of ['在 2026年10月27日，张三 写道：','于 2026-10-27 写道:','-----Original Message-----','-------- 原始邮件 --------','Begin forwarded message:'])assert.equal(stripMailHistory('最新正文\n'+separator+'\n旧邮件'),'最新正文');
 for(const header of ['From: Person\nSent: Tuesday\nTo: Someone\nSubject: Old','发件人：张三\n发送时间：昨天\n收件人：李四\n主题：旧主题'])assert.equal(stripMailHistory('New\n'+header+'\nOld'),'New');
 assert.equal(stripMailHistory('From: A to B\nAn actual paragraph\nNothing quoted'),'From: A to B\nAn actual paragraph\nNothing quoted');
 assert.equal(stripMailHistory('New\n> Old quotation\nInline answer'),'New\nInline answer');
});
test('HTML-only and HTML-marked replies use rendered text and skip Gmail, Outlook and quoted containers',()=>{
 for(const marker of ['<div class="gmail_quote">Old conversation</div>','<div id="divRplyFwdMsg">From: Old</div><p>Old content</p>','<blockquote type="cite">Old quoted body</blockquote>','<div class="yahoo_quoted">Old</div>']){
  assert.equal(latestMailText({text_body:'New paragraph\nOld without markers',html_body:'<div>New paragraph</div>'+marker},parseHTML),'New paragraph');
 }
 assert.equal(latestMailText({html_body:'<p>Hello &amp; welcome</p><p>Second paragraph</p><script>ignored()</script>'},parseHTML),'Hello & welcome\n\nSecond paragraph');
 assert.equal(latestMailText({text_body:'> Old history only'},parseHTML),'');
});
test('chunking is lossless above prior limits, including unbroken lines and surrogate pairs',()=>{
 for(const text of [('Long mail paragraph.\n').repeat(1500),'x'.repeat(120001),('😀科学测试。').repeat(2500)]){const chunks=translationChunks(text);assert.equal(chunks.join(''),text);assert.ok(chunks.every(s=>s.length<=1200&&s.isWellFormed()));}
});
test('translation caches only latest content, isolates old caches and reuses complete results',async()=>{
 const f=fixture();const result=await translateLatestStep(f.options);assert.equal(result.done,true);assert.equal(result.content,'译文：Latest message.');assert.equal(f.calls.length,1);assert.equal((await translateLatestStep(f.options)).cached,true);assert.equal(f.calls.length,1);
 const rows=[{language:'简体中文',content:'Old whole-thread result'},{language:TRANSLATION_PREFIX+'简体中文',content:f.raw}];
 assert.deepEqual(await savedLatestTranslations(rows,message,parseHTML,hash),{'简体中文':'译文：Latest message.'});
 assert.deepEqual(await savedLatestTranslations(rows,{...message,text_body:'Edited latest message'},parseHTML,hash),{});
 assert.deepEqual(await savedLatestTranslations([{language:TRANSLATION_PREFIX+'简体中文',content:'malformed'}],message,parseHTML,hash),{});
});
test('long mail resumes cached segments after failure without truncating aggregate output',async()=>{
 const f=fixture({subject:'Long mail',text_body:'a'.repeat(26000)});f.options.translate=async(s,p)=>{f.calls.push({s,p});return s.repeat(5);};
 let r=await translateLatestStep(f.options);assert.equal(r.done,false);assert.equal(r.completed,1);const original=f.options.translate;
 f.options.translate=async()=>{throw Error('temporary outage');};await assert.rejects(translateLatestStep(f.options),/temporary outage/);assert.equal(JSON.parse(f.raw).parts.length,1);f.options.translate=original;
 while(!r.done)r=await translateLatestStep(f.options);
 assert.equal(r.content.replaceAll('\n\n',''),'a'.repeat(130000));assert.equal(f.calls.length,Math.ceil(26000/1200));assert.equal(f.calls[0].p.continuation,false);assert.equal(f.calls[1].p.continuation,true);
 assert.equal((await translateLatestStep(f.options)).cached,true);
});
test('partial results are not returned as complete on open and simultaneous tabs keep newer progress',async()=>{
 const f=fixture({subject:'Long',text_body:'a'.repeat(3000)});await translateLatestStep(f.options);
 assert.deepEqual(await savedLatestTranslations([{language:TRANSLATION_PREFIX+'简体中文',content:f.raw}],f.options.message,parseHTML,hash),{});
 let raw=f.raw;const options={...f.options,read:async()=>raw,write:async()=>{const newer=JSON.parse(raw);newer.parts.push('Other tab translation');raw=JSON.stringify(newer);return false;}};
 const r=await translateLatestStep(options);assert.equal(r.completed,2);assert.match(r.content,/Other tab translation/);
});
test('quoted-only bodies never send the old thread for translation',async()=>{
 const f=fixture({subject:'Empty',text_body:'> Old message'});await assert.rejects(translateLatestStep(f.options),/最新正文/);assert.equal(f.calls.length,0);
});
