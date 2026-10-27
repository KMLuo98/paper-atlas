// Synthetic mail only. Vite must be running on port 5174.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
const mock=`export const db={auth:{getSession:async()=>({data:{session:{user:{id:'unread-fixture',email:'qa@example.edu'}}}}),onAuthStateChange(){}}};export const login=async()=>{};export const register=async()=>{};export async function api(action,b={}){window.__calls.push({action,b});const d=window.__fixture;if(action==='bootstrap')return structuredClone(d);if(action==='list'){let rows=d.messages.filter(m=>b.folder==='category_all'?['inbox','archive','sent'].includes(m.folder):m.folder===b.folder);if(b.account_id)rows=rows.filter(m=>m.account_id===b.account_id);if(b.category_id)rows=rows.filter(m=>m.category_id===b.category_id);else if(b.hide_ads)rows=rows.filter(m=>m.category_id!=='ad');if(b.direction)rows=rows.filter(m=>m.direction===b.direction);if(b.unread)rows=rows.filter(m=>!m.is_read);return {messages:rows.slice(b.offset||0,(b.offset||0)+(b.limit||50)),total:rows.length};}return {ok:true,added:0};}`;
const results=[];
try{for(const width of [320,390,1440]){
 const context=await browser.newContext({viewport:{width,height:950},isMobile:width<700,hasTouch:width<700,reducedMotion:width===390?'reduce':'no-preference'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{
  window.__calls=[];
  const message=(id,extra={})=>({id,account_id:'a',folder:'inbox',direction:'received',from_email:'sender@example.edu',to_list:[{address:'qa@example.edu'}],from_name:'Sender',subject:'Synthetic '+id,category_id:'notice',received_at:'2026-10-27T00:00:00Z',preview:'Synthetic preview',is_read:true,...extra});
  window.__fixture={profile:{username:'QA'},accounts:[{id:'a',email:'qa@example.edu',label:'School',color:'#638b82',enabled:false},{id:'b',email:'qa@example.com',label:'Personal',color:'#bca363',enabled:false}],settings:{sync_interval_minutes:5},contacts:[],drafts:[],categories:[{id:'ad',name:'广告',color:'#d6ad57'},{id:'notice',name:'机构通知',color:'#638b82'}],counts:[{folder:'inbox',category_id:'ad',account_id:'a',total:1,is_read:false,direction:'received'},{folder:'inbox',category_id:'notice',account_id:'b',total:60,is_read:false,direction:'received'},{folder:'archive',category_id:'notice',account_id:'a',total:1,is_read:false,direction:'received'}],messages:[message('hidden-ad',{category_id:'ad',is_read:false}),...Array.from({length:64},(_,i)=>message('read-'+i)),...Array.from({length:60},(_,i)=>message('unread-'+i,{account_id:'b',is_read:false})),message('archive-unread',{folder:'archive',is_read:false})]};
 });
 await page.route('**/src/cloud.js',r=>r.fulfill({body:mock,contentType:'application/javascript'}));
 await page.goto(process.env.MAIL_TEST_URL||'http://127.0.0.1:5174/');await page.locator('.mail-row').first().waitFor();
 assert.equal(await page.locator('[data-open="unread-0"]').count(),0,'unread lies beyond the normal first page');
 const openNav=async()=>{if(width<700)await page.locator('.mobile-menu').click();};
 const located=async(id)=>{
  const row=page.locator('[data-open="'+id+'"]');await row.waitFor();
  assert.equal(await row.evaluate(el=>el.classList.contains('unread-located')),true);
  assert.equal(await row.evaluate(el=>el===document.activeElement),true);
  await page.waitForTimeout(500);
  assert.ok(await row.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  await page.screenshot({path:'test-results/mail-unread-jump-'+width+'.png'});
  assert.equal(await page.locator('.sidebar.open').count(),0);
  assert.equal(await page.evaluate(()=>window.__calls.some(c=>['get','message_patch','bulk_read'].includes(c.action))),false,'locating never opens or reads a mail');
  await page.waitForFunction(()=>!document.querySelector('.unread-located'));
  assert.equal(await row.evaluate(el=>el.classList.contains('unread')),true);
 };
 // The inbox counter covers every account and clears narrower account/search filters.
 await openNav();await page.locator('[data-action=account][data-id=a]').click();await openNav();
 const badge=page.locator('[data-action=jump-unread]');assert.equal(await badge.innerText(),'60');
 await badge.focus();await page.keyboard.press('Enter');await located('unread-0');
 assert.equal(await page.locator('.mail-row').count(),50);assert.match(await page.locator('.pagination').innerText(),/60/);
 let query=await page.evaluate(()=>window.__calls.filter(c=>c.action==='list').at(-1).b);assert.equal(query.unread,true);assert.equal(query.offset,0);assert.equal(query.account_id,null);assert.equal(query.hide_ads,true);
 // Explicit category unread counts include archived messages and preserve the category.
 await openNav();await page.locator('[data-action=nav][data-view=categories]').click();
 await page.locator('[data-action=category-metric][data-id=notice][data-metric=unread]').click();await located('unread-0');
 query=await page.evaluate(()=>window.__calls.filter(c=>c.action==='list').at(-1).b);assert.equal(query.folder,'category_all');assert.equal(query.category_id,'notice');assert.equal(query.direction,'received');
 assert.equal(await page.locator('.mail-row').count(),50);assert.match(await page.locator('.pagination').innerText(),/61/);
 // A stale badge must fetch fresh data instead of reusing the previous unread cache.
 await page.evaluate(()=>window.__fixture.messages.forEach(m=>m.is_read=true));
 const callsBefore=await page.evaluate(()=>window.__calls.filter(c=>c.action==='list').length);
 await openNav();await badge.click();await page.waitForFunction(()=>window.__calls.filter(c=>c.action==='list').at(-1).b.folder==='inbox');
 assert.equal(await page.locator('.mail-row').count(),0);assert.equal(await page.locator('.unread-located').count(),0);
 assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.action==='list').length),callsBefore+1);await page.getByText('当前没有未读邮件',{exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 results.push({width,reducedMotion:width===390,passed:true});await context.close();
}}finally{await browser.close();}
console.log(JSON.stringify(results));
