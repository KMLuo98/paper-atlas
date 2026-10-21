import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const submitSource=main.slice(main.indexOf("document.addEventListener('submit',"),main.indexOf("\nwindow.addEventListener('beforeunload',"));

function harness(formId,values,{provider='school',failAction=''}={}){
 const calls=[],feedback=[],button={disabled:false,isConnected:true},message={textContent:'',isConnected:true};
 // Native HTMLFormElement named properties can shadow inherited properties such as id.
 const form={id:{tagName:'INPUT',name:'id'},getAttribute:key=>key==='id'?formId:null,entries:Object.entries(values),elements:{photo_file:{files:[]}}};
 let handler;
 const context={
  document:{addEventListener:(event,fn)=>{if(event==='submit')handler=fn;}},
  $:selector=>selector==='#provider-select'?{value:provider}:selector==='.form-error'?message:button,
  FormData:class{constructor(f){this.entries=f.entries;}[Symbol.iterator](){return this.entries[Symbol.iterator]();}},
  api:async(action,data)=>{calls.push({action,data});if(action===failAction)throw Error('连接验证失败');return {id:'saved-mailbox-id'};},
  closeModal:()=>{},bootstrap:async()=>{},navigate:async()=>{},syncAll:async()=>{},render:()=>{},
  toast:text=>feedback.push(text),error:e=>feedback.push(e.message),S:{authBusy:false}
 };
 vm.runInNewContext(submitSource,context);
 return {calls,feedback,button,message,submit:()=>handler({target:form,preventDefault(){}})};
}

test('school mailbox form saves and tests the connection even when its id property is a hidden input',async()=>{
 const h=harness('account-form',{id:'',email:'student@m.fudan.edu.cn',label:'学校',color:'#4f7a6f',password:'synthetic-only',imap_host:'imap.exmail.qq.com',smtp_host:'smtp.exmail.qq.com'});
 await h.submit();assert.deepEqual(h.calls.map(c=>c.action),['account_save','account_test']);assert.equal(h.calls[0].data.provider,'imap');assert.equal(h.calls[0].data.imap_host,'imap.exmail.qq.com');assert.equal(h.button.disabled,false);assert.ok(h.feedback.includes('邮箱连接已保存'));
});
test('QQ mailbox form submits the preset servers',async()=>{
 const h=harness('account-form',{id:'',email:'fixture@qq.com',label:'私人',color:'#4f7a6f',password:'synthetic-only'},{provider:'qq'});await h.submit();assert.equal(h.calls[0].action,'account_save');assert.equal(h.calls[0].data.imap_host,'imap.qq.com');assert.equal(h.calls[0].data.smtp_host,'smtp.qq.com');
});
test('contact and category forms dispatch their save actions despite named id controls',async()=>{
 for(const [form,action]of [['contact-form','contact_save'],['category-form','category_save']]){const h=harness(form,{id:'fixture-id',name:'Fixture'});await h.submit();assert.equal(h.calls[0]?.action,action);assert.equal(h.calls[0]?.data.id,'fixture-id');assert.equal(h.button.disabled,false);}
});
test('failed account saves keep the error visible and allow retry',async()=>{
 const h=harness('account-form',{id:'',email:'fixture@qq.com',password:'synthetic-only'},{provider:'qq',failAction:'account_save'});await h.submit();assert.equal(h.message.textContent,'连接验证失败');assert.equal(h.button.disabled,false);assert.equal(h.calls.length,1);
});
