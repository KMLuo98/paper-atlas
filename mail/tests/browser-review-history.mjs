import assert from 'node:assert/strict';
const engine=process.env.MAIL_TEST_ENGINE||'chromium';
const playwright=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
const mock=`export const db={auth:{getSession:async()=>({data:{session:{user:{id:'review-owner',email:'qa@example.edu'}}}}),onAuthStateChange(){}}};export const login=async()=>{};export const register=async()=>{};export async function api(action){if(action==='bootstrap')return structuredClone(window.__fixture);if(action==='list')return {messages:[],total:0};if(action.startsWith('manuscripts_'))return structuredClone(window.__academic);return {ok:true};}`;
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});
  await context.addInitScript(()=>{
   localStorage.setItem('pa-language','zh');
   window.__fixture={profile:{username:'QA'},accounts:[],contacts:[],categories:[],settings:{},counts:[],drafts:[]};
   const metrics={revision:1,reviews_completed:'0',invitations_accepted:'2',invitations_sent:'2',last_review_activity:'2026-11-19T10:16:37Z'};
   window.__academic={enabled:true,statistics:[],manuscripts:[{id:'tracker',publisher:'Elsevier',journal:'Physica D',number:'PHYSD-D-26-01234R1',title:'Review history fixture',authors:'A. Author',status:'under_review',last_checked_at:'2026-11-21T15:15:00Z',events:[{source:'email',source_id:'first',date:'2026-11-16T10:21:00Z',status:'major_revision',raw_status:'Major revision'},{source:'email',source_id:'revised',date:'2026-11-17T10:21:00Z',status:'revised_submitted',number:'PHYSD-D-26-01234R1'}],metric_history:[{date:'2026-11-19T10:16:37Z',metrics},...['13:41','14:58','15:15'].map(time=>({date:'2026-11-21T'+time+':00Z',metric_date:'2026-11-19T10:16:37Z',status:'under_review',metrics}))]}]};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/cloud.js',route=>route.fulfill({body:mock,contentType:'application/javascript'}));
  await page.goto('http://127.0.0.1:5174/');await page.locator('#mail-launch').waitFor({state:'detached'});
  if(width<700)await page.locator('.mobile-menu').click();
  await page.locator('[data-action=nav][data-view=manuscripts]').click();
  await page.locator('[data-ms=detail][data-id=tracker]').click();
  assert.equal(await page.locator('[data-review-kind=metrics]').count(),1);
  assert.equal(await page.locator('[data-review-kind=email]').count(),1);
  assert.match(await page.locator('[data-review-kind=metrics] header time').innerText(),/11月19日/);
  assert.equal(await page.evaluate(()=>window.__academic.manuscripts[0].metric_history.length),4);
  await page.screenshot({path:'test-results/review-history-'+engine+'-'+width+'.png'});
  await page.evaluate(()=>{const item=window.__academic.manuscripts[0];item.metric_history.push({date:'2026-11-22T10:00:00Z',metric_date:'2026-11-22T09:00:00Z',status:'under_review',metrics:{...item.metric_history[0].metrics,invitations_accepted:'3',last_review_activity:'2026-11-22T09:00:00Z'}});});
  await page.locator('[data-ms=refresh]').click();
  await page.locator('[data-ms=refresh][aria-busy=true]').waitFor({state:'detached'});
  assert.equal(await page.locator('[data-review-kind=metrics]').count(),2);
  assert.match(await page.locator('[data-review-kind=metrics] header time').first().innerText(),/11月22日/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({width,engine,passed:true}));
 }
}finally{await browser.close();}
