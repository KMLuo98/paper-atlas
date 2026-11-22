import assert from 'node:assert/strict';
const engine=process.env.MAIL_TEST_ENGINE||'chromium';
const playwright=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
const mock=`export const db={auth:{getSession:async()=>({data:{session:{user:{id:'startup-owner',email:'qa@example.edu'}}}}),onAuthStateChange(){},signOut:async()=>{}}};export const login=async()=>{};export const register=async()=>{};export async function api(action){if(action==='bootstrap'&&sessionStorage.getItem('slow-bootstrap')==='yes')while(!window.__bootstrapReady)await new Promise(r=>setTimeout(r,20));if(action==='bootstrap')return {profile:{username:'QA'},accounts:[{id:'a',label:'School',email:'qa@example.edu',color:'#638b82',enabled:false}],contacts:[],categories:[],drafts:[],settings:{},counts:[]};if(action==='manuscripts_get'){window.__academicStarted=true;while(!window.__academicReady)await new Promise(r=>setTimeout(r,20));return {enabled:true,manuscripts:[],statistics:[]};}if(action==='manuscripts_refresh'){window.__dailyRefreshes++;return {enabled:true,manuscripts:[],statistics:[]};}if(action==='list')return {messages:[{id:'message',account_id:'a',folder:'inbox',subject:'Inbox is ready',from_name:'Researcher',from_email:'person@example.edu',to_list:[],received_at:'2026-11-21',is_read:true}],total:1};return {ok:true};}`;
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});
  await context.addInitScript(()=>{localStorage.setItem('pa-language','zh');window.__academicReady=false;window.__academicStarted=false;window.__dailyRefreshes=0;});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/cloud.js',route=>route.fulfill({body:mock,contentType:'application/javascript'}));
  const ready=async()=>{await page.locator('.mail-row').waitFor({timeout:5000});await page.locator('#mail-launch').waitFor({state:'detached',timeout:5000});assert.equal(await page.evaluate(()=>window.__academicStarted&&!window.__academicReady),true);};
  await page.goto('http://127.0.0.1:5174/');await ready();
  await page.evaluate(()=>sessionStorage.setItem('slow-bootstrap','yes'));await page.reload();await ready();await page.evaluate(()=>{sessionStorage.removeItem('slow-bootstrap');window.__bootstrapReady=true;}); // a slow manuscript request cannot delay either first entry or refresh
  if(width<700)await page.locator('.mobile-menu').click();
  await page.locator('[data-action=nav][data-view=settings]').click();
  assert.equal(await page.locator('#academic-enabled').isDisabled(),true);
  await page.locator('[name=sync_interval_minutes]').fill('9');
  await page.evaluate(()=>window.__academicReady=true);
  await page.waitForFunction(()=>!document.querySelector('#academic-enabled').disabled);
  assert.equal(await page.locator('#academic-enabled').isChecked(),true);
  assert.equal(await page.locator('[name=sync_interval_minutes]').inputValue(),'9');
  await page.waitForFunction(()=>window.__dailyRefreshes===1);
  assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({width,engine,startupPassed:true}));
 }
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
 await page.addInitScript(()=>{window.__academicReady=false;window.__dailyRefreshes=0;});
 await page.route('**/src/cloud.js',route=>route.fulfill({body:mock,contentType:'application/javascript'}));
 await page.goto('http://127.0.0.1:5174/');await page.locator('#mail-launch').waitFor({state:'detached'});
 await page.locator('[data-action=logout]').click();await page.locator('#auth-form').waitFor();
 await page.evaluate(()=>window.__academicReady=true);await page.waitForTimeout(250);
 assert.equal(await page.locator('.app-shell').count(),0);assert.equal(await page.evaluate(()=>window.__dailyRefreshes),0);
 await context.close();console.log(JSON.stringify({engine,lateResponseAfterLogoutPassed:true}));
}finally{await browser.close();}
