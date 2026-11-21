import assert from 'node:assert/strict';
const engine=process.env.MAIL_TEST_ENGINE||'chromium';
const playwright=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
const mock=`
export const db={auth:{getSession:async()=>({data:{session:{user:{id:'academic-user',email:'qa@example.edu'}}}}),onAuthStateChange(){}}};
export const login=async()=>{};export const register=async()=>{};
export async function api(action,b={}){
 const d=window.__fixture,academic=window.__academic;
 if(action==='bootstrap')return structuredClone(d);
 if(action==='list')return {messages:[],total:0};
 if(action==='manuscripts_toggle')academic.enabled=b.enabled;
 if(action==='manuscripts_refresh'){window.__refreshes++;academic.last_updated_at='2026-11-21T09:00:00Z';}
 if(action==='manuscripts_save'){
  const old=academic.manuscripts.find(item=>item.id===b.id),item={...b,id:b.id||'manual',events:old?.events||[],created_at:'2026-11-21',updated_at:'2026-11-21'};
  if(old)academic.manuscripts.splice(academic.manuscripts.indexOf(old),1,item);else academic.manuscripts.push(item);
 }
 if(['manuscripts_archive','manuscripts_trash','manuscripts_restore'].includes(action)){
  const item=academic.manuscripts.find(item=>item.id===b.id);
  if(action==='manuscripts_archive')item.archived_at='2026-11-21';
  if(action==='manuscripts_trash')item.deleted_at='2026-11-21';
  if(action==='manuscripts_restore'){item.archived_at=null;item.deleted_at=null;}
 }
 if(action==='manuscripts_bulk_archive'||action==='manuscripts_bulk_trash'){for(const item of academic.manuscripts)if(b.ids.includes(item.id))item[action.endsWith('archive')?'archived_at':'deleted_at']='2026-11-21';}
 if(action==='manuscripts_purge')academic.manuscripts=academic.manuscripts.filter(item=>item.id!==b.id);
 if(action==='manuscripts_statistics'){
  if(b.reset)academic.statistics=[{journal:'Physical Review E',total:2,active:1,completed:1,accepted:1,rejected:0}];
  else academic.statistics=(b.rows||[b]).map(row=>({...row,total:+row.total,active:+row.active,completed:+row.completed,accepted:+row.accepted,rejected:+row.rejected}));
 }
 if(action.startsWith('manuscripts_'))return structuredClone(academic);
 return {ok:true};
}`;
try{
 for(const width of (process.env.MAIL_TEST_WIDTH?[+process.env.MAIL_TEST_WIDTH]:[320,390,900,1440])){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});
  await context.addInitScript(()=>{
   localStorage.setItem('pa-language','zh');window.__refreshes=0;
   window.__fixture={profile:{username:'qa'},accounts:[],contacts:[],drafts:[],categories:[],settings:{},counts:[]};
   const base={publisher:'APS',journal:'Physical Review E',authors:'A. Author, B. Author',number:'LA12345',title:'Network manuscript',status:'accepted',status_at:'2026-11-20',publisher_history:{tables:[{headers:['Open','Closed','Description'],rows:[['20Nov2026','','Accepted for publication']]}]},created_at:'2026-11-01',updated_at:'2026-11-21',tracking_url:'https://authors.aps.org/Submissions/status?accode=LA12345&author=Author'};
   window.__academic={enabled:false,manuscripts:[
    {...base,id:'accepted',events:[{date:'2026-11-01',status:'submitted',raw_status:'Manuscript received',source:'email',source_id:'email-one',message_ref:'mail-id'},{date:'2026-11-20',status:'accepted',raw_status:'Accepted for publication',source:'website',source_url:base.tracking_url}]},
    {...base,id:'review',number:'LA54321',title:'Reviewing dynamics',status:'under_review',events:[]}
   ],statistics:[{journal:'Physical Review E',total:2,active:1,completed:1,accepted:1,rejected:0}]};
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/cloud.js',route=>route.fulfill({body:mock,contentType:'application/javascript'}));
  await page.goto('http://127.0.0.1:5174/');
  await page.locator('#mail-launch').waitFor({state:'detached'});
  const nav=async view=>{if(width<700)await page.locator('.mobile-menu').click();await page.locator('[data-action=nav][data-view='+view+']').click();};
  await nav('settings');
  await page.locator('#academic-enabled').check();
  await page.waitForFunction(()=>window.__refreshes===1);
  await nav('manuscripts');
  await page.locator('.submission-card').first().waitFor();
  assert.equal(await page.locator('.submission-card').count(),2);
  const results=await page.locator('.submission-results').boundingBox(),stats=await page.locator('.submission-statistics').boundingBox();
  if(width>=1380)assert.ok(stats.x>results.x+results.width);else assert.ok(stats.y>results.y);
  assert.equal(await page.locator('.submission-vault').evaluate(node=>getComputedStyle(node).position),'static');
  assert.match(await page.locator('.submission-last-update').first().innerText(),/2026/);
  await page.locator('[data-ms=layout][data-layout=list]').click();
  await page.locator('.submission-list').waitFor();
  await page.locator('#submission-search').fill('network');
  assert.equal(await page.locator('.submission-card').count(),1);
  await page.locator('.submission-card').click();
  assert.equal(await page.locator('.submission-mail-records .submission-timeline li').count(),1);
  assert.equal(await page.locator('.publisher-history-table tbody tr').count(),1);
  await page.goBack();await page.locator('.submission-card').first().waitFor();
  await page.goForward();await page.locator('.submission-history-columns').waitFor();
  const back=await page.locator('.manuscripts-page .reader-toolbar').boundingBox();
  const heading=await page.locator('.manuscripts-page .page-head').boundingBox();assert.ok(back.y<heading.y);
  await page.locator('[data-ms=archive]').click();
  await page.locator('.submission-celebration').waitFor();
  assert.equal(await page.locator('.firework-burst').count(),3);
  assert.match(await page.locator('.submission-celebration h2').innerText(),/恭喜发表/);
  await page.locator('.submission-celebration button').click();
  await page.locator('[data-ms=scope-archived]').click();
  await page.locator('.submission-card').click();
  await page.locator('[data-ms=restore]').click();
  await page.locator('[data-ms=scope-active]').click();
  await page.locator('[data-ms=add]').click();
  await page.locator('#submission-form [name=publisher]').fill('A custom academic publisher');
  await page.locator('#submission-form [name=journal]').fill('Physica A');
  await page.locator('#submission-form [name=title]').fill('Manually tracked');
  await page.locator('#submission-form [name=number]').fill('PHYSA-D-26-00123');
  await page.locator('#submission-form [type=submit]').click();
  await page.locator('#submission-form').waitFor({state:'detached'});
  await page.locator('[data-ms=detail][data-id=manual]').click();
  await page.locator('[data-ms=trash]').click();
  await page.locator('[data-ms=scope-trash]').click();
  await page.locator('.submission-card').click();
  await page.locator('[data-ms=purge]').click();
  await page.locator('#submission-confirm').click();
  await page.locator('#submission-confirm').waitFor({state:'detached'});
  assert.equal(await page.locator('[data-id=manual]').count(),0);
  await page.locator('[data-ms=scope-active]').click();
  await page.locator('[data-ms=stats-edit]').click();
  await page.locator('#submission-stats-form [data-stat=total]').fill('10');
  await page.locator('#submission-stats-form [type=submit]').click();
  await page.locator('#submission-stats-form').waitFor({state:'detached'});
  assert.equal(await page.locator('.submission-stats-scroll tbody td').first().innerText(),'10');
  await page.locator('[data-ms=stats-reset]').click();
  await page.locator('#submission-confirm').click();
  await page.locator('#submission-confirm').waitFor({state:'detached'});
  assert.equal(await page.locator('.submission-stats-scroll tbody td').first().innerText(),'2');
  await page.locator('[data-ms=stats-add]').click();
  await page.locator('[data-ms=stats-row-add]').click();
  const added=page.locator('.stats-editor-row').last();
  await added.locator('[data-stat=journal]').fill('Chaos');
  await added.locator('[data-stat=total]').fill('1');
  await added.locator('[data-stat=active]').fill('1');
  await page.locator('#submission-stats-form [type=submit]').click();
  await page.locator('#submission-stats-form').waitFor({state:'detached'});
  assert.equal(await page.locator('.stats-journal[title=Chaos]').count(),1);
  await nav('contacts');await nav('manuscripts');
  assert.equal(await page.evaluate(()=>window.__refreshes),3); // daily check + restored tracker + reset scan
  await page.locator('[data-ms=refresh]').click();
  await page.waitForFunction(()=>window.__refreshes===4);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('[data-language-choice=en]').click();
  await page.getByRole('heading',{name:'Submissions',exact:true}).waitFor();
  await page.locator('[data-ms=detail][data-id=accepted]').click();
  await page.locator('[data-ms=archive]').click();
  await page.getByRole('heading',{name:'Congratulations!',exact:true}).waitFor();
  await page.locator('.submission-celebration button').click();
  await page.locator('[data-ms=scope-archived]').click();
  await page.locator('[data-ms=detail][data-id=accepted]').click();
  await page.locator('[data-ms=restore]').click();
  await page.locator('[data-ms=scope-active]').click();
  await page.locator('[data-ms=detail][data-id=review]').click();
  await page.locator('[data-ms=edit]').click();
  await page.locator('#submission-form [name=status]').selectOption('rejected');
  await page.locator('#submission-form [type=submit]').click();
  await page.locator('#submission-form').waitFor({state:'detached'});
  await page.locator('[data-ms=detail][data-id=review]').click();
  await page.locator('[data-ms=trash]').click();
  await page.locator('.reassurance-scene').waitFor();
  assert.equal(await page.locator('.firework-burst').count(),0);
  await page.locator('.submission-celebration button').click();
  await page.locator('[data-language-choice=zh]').click();
  await page.getByRole('heading',{name:'投稿信息',exact:true}).waitFor();
  await page.locator('[data-ms=select-archive]').click();
  await page.locator('[data-ms-select-all]').check();
  await page.locator('[data-ms=bulk-apply]').click();
  assert.equal(await page.locator('.submission-celebration').count(),0);
  await page.screenshot({path:'test-results/manuscripts-'+engine+'-'+width+'.png'});
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(JSON.stringify({width,engine,passed:true}));
 }
}finally{await browser.close();}
