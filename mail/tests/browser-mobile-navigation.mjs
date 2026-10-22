// Synthetic mail only. Start the Mail Vite server before running this suite.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
const mock=`
export const db={auth:{getSession:async()=>({data:{session:{user:{id:'navigation-user',email:'qa@example.edu'}}}}),onAuthStateChange(){}}};
export const login=async()=>{};export const register=async()=>{};
export async function api(action,b={}){
 window.__calls.push({action,b});const d=window.__fixture;
 if(action==='bootstrap')return structuredClone(d);
 if(action==='list')return {messages:d.messages,total:d.messages.length};
 if(action==='get')return {message:{...d.messages.find(m=>m.id===b.id),text_body:'Synthetic original email body',cc_list:[],attachments:[]},translations:{}};
 if(action==='draft_save'){
  if(window.__failDraft)throw Error('Synthetic draft save failure');
  window.__draft=structuredClone(b.data);return {id:'saved-draft'};
 }
 return {ok:true,added:0};
}`;
const results=[];
try{
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<700,hasTouch:true});
  await context.addInitScript(()=>{
   window.__calls=[];
   window.__fixture={profile:{username:'qa'},accounts:[{id:'a',label:'School',email:'qa@example.edu',color:'#638b82',enabled:false}],categories:[{id:'research',name:'研究',color:'#638b82'}],contacts:[{id:'person',name:'Alice',email:'alice@example.edu',organization:'学校',photo_url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#638b82"/></svg>')}],settings:{sync_interval_minutes:5},counts:[],drafts:[],messages:Array.from({length:20},(_,i)=>({id:'message-'+i,account_id:'a',folder:'inbox',from_name:i?'Bob':'Alice',from_email:i?'bob@example.edu':'alice@example.edu',to_list:[{address:'qa@example.edu'}],subject:'Navigation fixture '+i,received_at:'2026-10-22T00:00:00Z',preview:'Test mail preview',is_read:true,category_id:'research'}))};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
  await page.route('**/src/cloud.js',r=>r.fulfill({body:mock,contentType:'application/javascript'}));
  await page.goto(process.env.MAIL_TEST_URL||'http://127.0.0.1:5174/');await page.locator('.mail-row').first().waitFor();
  const cdp=await context.newCDPSession(page);
  const swipe=async({x=8,y=210,dx=170,dy=0,cancel=false}={})=>{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/8,y:y+dy*step/8}]});
   await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
   await page.waitForTimeout(450);
  };
  const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // Both photos and initials use the requested 75% diameter.
  const expected=width<700?34.5:39;
  for(const avatar of await page.locator('.mail-row .row-sender .avatar').all()){
   const rect=await avatar.boundingBox();assert.equal(rect.width,expected);assert.equal(rect.height,expected);
  }
  await swipe();assert.equal(await page.locator('.inbox-page').count(),1); // No predecessor: stay in the app.
  await page.locator('#category-filter').selectOption('research');
  await page.locator('#sender-filter').selectOption('alice@example.edu');
  await page.locator('#mail-search').fill('fixture');await page.waitForTimeout(550);
  await page.evaluate(()=>window.scrollTo(0,400));
  // Capture scroll after Playwright has scrolled the chosen row into view.
  await page.locator('[data-open="message-4"]').scrollIntoViewIfNeeded();
  const originalScroll=await page.evaluate(()=>scrollY);
  await page.locator('[data-open="message-4"]').click();await page.locator('.reader-page').waitFor();
  if(width<700){
   await swipe({dx:35});assert.equal(await page.locator('.reader-page').count(),1);
   await swipe({dx:100,cancel:true});assert.equal(await page.locator('.reader-page').count(),1);
   await swipe({x:110,dx:160});assert.equal(await page.locator('.reader-page').count(),1);
   await swipe({dx:15,dy:180});assert.equal(await page.locator('.reader-page').count(),1);
   await page.evaluate(()=>scrollTo(0,0));
   await page.locator('.reader-toolbar [data-action=reply]').click();await page.locator('#compose-body').fill('A reply that must survive back navigation.');
   await page.evaluate(()=>window.__failDraft=true);
   await swipe({y:100});await page.locator('.toast.error').waitFor();assert.equal(await page.locator('#compose-body').inputValue(),'A reply that must survive back navigation.');
   await page.evaluate(()=>window.__failDraft=false);
   await swipe({y:100});await page.locator('.reader-page').waitFor();
   assert.equal(await page.evaluate(()=>window.__draft.body),'A reply that must survive back navigation.');
   assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.action==='send').length),0);
   await swipe();await page.locator('.inbox-page').waitFor();
   assert.equal(await page.locator('#category-filter').inputValue(),'research');
   assert.equal(await page.locator('#sender-filter').inputValue(),'alice@example.edu');
   assert.equal(await page.locator('#mail-search').inputValue(),'fixture');
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-originalScroll)<3);
   await noOverflow();
   // Side navigation is reversible; modal and drawer dismiss before changing pages.
   await page.evaluate(()=>scrollTo(0,0));
   await page.locator('[data-action=toggle-nav]').first().click();await page.locator('[data-action=nav][data-view=contacts]').click();
   await page.locator('.contacts-page').waitFor();
   await page.locator('[data-action=edit-contact]').first().click();await page.locator('#contact-form').waitFor();
   await swipe({y:110});assert.equal(await page.locator('#modal-root .modal').count(),0);assert.equal(await page.locator('.contacts-page').count(),1);
   await page.locator('[data-action=toggle-nav]').first().click();
   await swipe({y:120});assert.equal(await page.locator('.sidebar.open').count(),0);assert.equal(await page.locator('.contacts-page').count(),1);
   await swipe();await page.locator('.inbox-page').waitFor();
  }else{
   await swipe({y:840});assert.equal(await page.locator('.reader-page').count(),1); // Desktop background touch is unchanged.
   await page.locator('[data-action=back]').click();await page.locator('.inbox-page').waitFor();
  }
  assert.deepEqual(errors,[]);await noOverflow();
  await page.screenshot({path:'test-results/mail-mobile-back-'+width+'.png',fullPage:false});
  results.push({width,avatarDiameter:expected,passed:true});await context.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify(results));
