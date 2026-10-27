import {COLUMN_LIMITS,defaultMailLayout,readMailLayout,writeMailLayout,resizeMailColumn,mailLayoutStyle} from '../src/mail-layout.js';
import {contactEmails,contactLetter,sortedContacts,MailListCache} from '../src/contact-workflow.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {esc,initials,fmtDate,bytes,fuzzy,countRows} from '../src/core.js';
import {categorySignature} from '../../supabase/functions/mail-api/classification.js';
import {scheduledDraftAt} from '../src/draft-schedule.js';
import {localizedOrganization} from '../../supabase/functions/mail-api/contact-enrichment.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function harness(){const context={localizedOrganization,scheduledDraftAt,COLUMN_LIMITS,defaultMailLayout,readMailLayout,writeMailLayout,resizeMailColumn,mailLayoutStyle,contactEmails,contactLetter,sortedContacts,MailListCache,sessionStorage:null,esc,initials,fmtDate,bytes,fuzzy,countRows,Set,crypto,document:{},window:{scrollTo(){}},createIcons(){}};const code=source.slice(0,source.indexOf("document.addEventListener('click'")).replace(/^import .*;\r?\n/gm,'').replace(/^const icons=.*;\r?\n/m,'');vm.runInNewContext(code+'\nglobalThis.state=S;globalThis.views={sidebar,mailListHTML,draftsHTML,readerHTML,contactsHTML};',context);return context;}

test('scheduled remote drafts show a clock and Beijing delivery time in the list and reader',()=>{
 const h=harness(),s=h.state;s.view='drafts';s.accounts=[{id:'a',provider:'imap',email:'me@example.edu',label:'学校',color:'#638b82',config:{imap_host:'imap.exmail.qq.com'}}];
 const date=new Date(Date.now()+7*86400000);date.setUTCHours(14,0,0,0);
 const scheduled={id:'scheduled',folder:'drafts',account_id:'a',from_email:'me@example.edu',to_list:[{address:'recipient@example.edu'}],subject:'Synthetic scheduled draft',received_at:date.toISOString(),preview:'Scheduled body',is_read:true};
 s.messages=[scheduled,{...scheduled,id:'ordinary',subject:'Ordinary draft',received_at:'2020-01-01T00:00:00Z'}];
 const list=h.views.draftsHTML();assert.equal((list.match(/role="note"/g)||[]).length,1);assert.match(list,/定时发送/);assert.match(list,/22:00（北京时间）/);assert.match(list,/data-lucide="clock-3"/);
 s.view='reader';s.current=scheduled;assert.match(h.views.readerHTML(),/定时发送/);
 s.current={...scheduled,folder:'sent'};assert.doesNotMatch(h.views.readerHTML(),/定时发送/);
});
test('sent list shows recipients and imported drafts appear beside local drafts',()=>{
 const h=harness(),s=h.state;s.accounts=[{id:'a',label:'学校',color:'#638b82',email:'me@example.edu'}];s.view='sent';s.messages=[{id:'m',folder:'sent',account_id:'a',from_email:'me@example.edu',from_name:'Me',to_list:[{address:'recipient@example.edu',name:'Recipient'}],received_at:'2026-10-21T00:00:00Z',subject:'Fixture',preview:'',is_read:true}];assert.match(h.views.mailListHTML(),/收件人/);assert.match(h.views.mailListHTML(),/Recipient/);
 s.view='drafts';s.total=1;assert.match(h.views.draftsHTML(),/原邮箱草稿 · 1 封/);assert.match(h.views.draftsHTML(),/Fixture/);
});
test('sidebar omits original mailbox folders while retaining standard folders and accounts',()=>{
 const h=harness();h.state.accounts=[{id:'a',label:'学校',color:'#638b82',email:'me@example.edu',sync_state:{folders:[{kind:'custom',name:'Research',path:'Projects/Research & reports'}]}}];const html=h.views.sidebar();assert.doesNotMatch(html,/data-action="remote-folder"|原邮箱文件夹|Projects\/Research/);assert.match(html,/data-action="account" data-id="a"/);assert.match(html,/垃圾邮件/);
});
test('category cache changes for semantic edits, not ordering or color edits',()=>{
 const cats=[{id:'b',name:'广告',description:'推广'},{id:'a',name:'论文投稿',description:''}];assert.equal(categorySignature(cats),categorySignature([...cats].reverse()));assert.equal(categorySignature(cats),categorySignature(cats.map(c=>({...c,color:'#ffffff'}))));assert.notEqual(categorySignature(cats),categorySignature([...cats,{id:'c',name:'论文审稿'}]));assert.notEqual(categorySignature(cats),categorySignature(cats.map(c=>({...c,description:'新规则'}))));
});
