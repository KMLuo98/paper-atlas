import {contactEmails,contactLetter,sortedContacts,MailListCache} from '../src/contact-workflow.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {esc,initials,fmtDate,bytes,fuzzy,countRows} from '../src/core.js';
import {CATEGORY_ICONS,CATEGORY_COLORS,categoryIcon,moveCategory} from '../../supabase/functions/mail-api/category-options.js';
import {replyHeaders} from '../../supabase/functions/mail-api/reply-headers.js';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function fixture(customAPI){const calls=[];const context={contactEmails,contactLetter,sortedContacts,MailListCache,sessionStorage:null,CATEGORY_ICONS,CATEGORY_COLORS,categoryIcon,moveCategory,esc,initials,fmtDate,bytes,fuzzy,countRows,Set,crypto,document:{querySelector(){return {focus(){}};}},window:{scrollTo(){}},createIcons(){},api:async(action,payload)=>{calls.push({action,payload:JSON.parse(JSON.stringify(payload))});return customAPI?customAPI(action,payload):{messages:[],total:0};}};const code=source.slice(0,source.indexOf("document.addEventListener('click'")).replace(/^import .*;\r?\n/gm,'').replace(/^const icons=.*;\r?\n/m,'');vm.runInNewContext(code+'\nrender=()=>{};bootstrap=async()=>{};syncAll=async()=>{};toast=()=>{};modal=()=>{};globalThis.qa={saveCategoryOrder,S,categoryMetrics,categoriesHTML,handleAction,moveCategoryUI,matchPhotos};',context);return {...context.qa,calls};}
test('category numbers separate received, sent, unread and unanswered messages',()=>{
 const f=fixture();f.S.categories=[{id:'c',name:'学术',color:'#638b82',icon:'book-open'}];f.S.counts=[{category_id:'c',account_id:'a',folder:'inbox',direction:'received',total:4,is_read:false,is_replied:false},{category_id:'c',account_id:'a',folder:'archive',direction:'received',total:2,is_read:true,is_replied:true},{category_id:'c',account_id:'a',folder:'sent',direction:'sent',total:3},{category_id:'c',account_id:'a',folder:'drafts',total:9},{category_id:'c',account_id:'b',folder:'inbox',direction:'received',total:1,is_read:true,is_replied:false}];
 assert.deepEqual(JSON.parse(JSON.stringify(f.categoryMetrics('c'))),{all:10,received:7,sent:3,unanswered:5,unread:4});f.S.account='a';assert.equal(f.categoryMetrics('c').received,6);const html=f.categoriesHTML();for(const metric of ['all','received','sent','unanswered','unread'])assert.match(html,new RegExp('data-metric="'+metric+'"'));assert.match(html,/data-lucide="book-open"/);
});
test('each category metric opens the corresponding mail filters',async()=>{
 for(const [metric,direction,unanswered,unread] of [['all','',false,false],['sent','sent',false,false],['received','received',false,false],['unanswered','received',true,false],['unread','received',false,true]]){const f=fixture();f.S.user={id:'fixture'};await f.handleAction('category-metric',{dataset:{id:'c',metric}});const q=f.calls.find(x=>x.action==='list').payload;assert.equal(q.folder,'category_all');assert.equal(q.category_id,'c');assert.equal(q.direction,direction);assert.equal(q.unanswered,unanswered);assert.equal(q.unread,unread);}
});
test('moving categories stays local until explicit save and preserves metadata',async()=>{
 const f=fixture();f.S.categories=[{id:'a',icon:'star'},{id:'b',icon:'mail'},{id:'c',icon:'folder'}];await f.moveCategoryUI('c',0);assert.deepEqual([...f.S.categories.map(c=>c.id)],['c','a','b']);assert.equal(f.calls.length,0);assert.equal(f.S.categoryDirty,true);await f.saveCategoryOrder();assert.equal(f.S.categoryDirty,false);assert.deepEqual([...f.calls[0].payload.ids],['c','a','b']);assert.equal(f.calls[0].action,'category_reorder');assert.equal(f.S.categories[1].icon,'star');assert.equal(f.S.sortBusy,false);
 assert.deepEqual(moveCategory(['a','b'],'a',-1),['a','b']);assert.equal(categoryIcon('<svg>'),'folder');assert.equal(CATEGORY_ICONS.length,16);
});
test('reply headers link exact messages and do not infer replies from matching subjects',()=>{
 const result=replyHeaders({inReplyTo:'<original@example.edu>',references:'<ancestor@example.edu> <original@example.edu>',subject:'Re: meeting'});assert.equal(result.in_reply_to,'<original@example.edu>');assert.deepEqual(result.reference_ids,['<ancestor@example.edu>','<original@example.edu>']);assert.equal(result.reply_headers_loaded,true);assert.equal(replyHeaders({subject:'Re: meeting'}).in_reply_to,'');assert.equal(replyHeaders({headers:[{key:'In-Reply-To',value:'<header@example.edu>'}]}).in_reply_to,'<header@example.edu>');
});
test('automatic avatar matching continues through every batch and reports saved or unmatched outcomes',async()=>{
 const outcomes=['found','not_found','unavailable'];let index=0;const f=fixture(async action=>{assert.equal(action,'contact_photos');const n=index++;return {results:[{id:'id-'+n,name:'Person '+n,status:outcomes[n]}],remaining:2-n,has_more:n<2};});await f.matchPhotos();assert.equal(f.calls.length,3);assert.equal(f.S.photoJob.found,1);assert.equal(f.S.photoJob.notFound,1);assert.equal(f.S.photoJob.unavailable,1);assert.equal(f.S.photoJob.running,false);assert.deepEqual(f.calls[2].payload.exclude_ids,['id-0','id-1']);
});
