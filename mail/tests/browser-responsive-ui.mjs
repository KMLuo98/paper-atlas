import assert from 'node:assert/strict';
const engine=process.env.MAIL_TEST_ENGINE||'chromium';
const playwright=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
const mock=`export const db={auth:{getSession:async()=>({data:{session:{user:{id:'responsive-user',email:'qa@example.edu'}}}}),onAuthStateChange(){}}};export const login=async()=>{};export const register=async()=>{};export async function api(action){if(action==='bootstrap')return {profile:{username:'qa'},accounts:[],categories:[{id:'notice',name:'机构通知',color:'#638b82',icon:'mail'},{id:'advertising',name:'广告',color:'#ba765e',icon:'mail'}],drafts:[],counts:[],settings:{contact_groups:['Research']},contacts:[{id:'alice',name:'Alice',email:'alice@example.edu',organization:'University of Sydney',group_name:'Research'},{id:'bob',name:'Bob With A Much Longer Name',email:'bob@example.edu',emails:['bob@example.edu','another-long-address@example.edu'],organization:'A long institution name with a laboratory and department',group_name:'Research'},{id:'carol',name:'Carol',email:'carol@example.edu',group_name:'未分类'}]};return {messages:[],total:0};}`;
try {
 for(const theme of ['classic','glass'])for(const width of (process.env.MAIL_TEST_WIDTH?[+process.env.MAIL_TEST_WIDTH]:[320,390,820,1024,1440])) {
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width<=700,hasTouch:width<=700});
  await context.addInitScript(theme=>localStorage.setItem('pa-appearance',theme),theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/cloud.js',route=>route.fulfill({body:mock,contentType:'application/javascript'}));
  await page.goto('http://127.0.0.1:5174/');await page.locator('#mail-launch').waitFor({state:'detached'});
  const nav=async view=>{if(width<=700)await page.locator('.mobile-menu').click();await page.locator('[data-action=nav][data-view='+view+']').click();};
  const controls=await page.locator('.inbox-page .list-actions').evaluate(row=>[...row.querySelectorAll('.check,.inbox-filter summary,.filter-controls>button,[data-action=mail-columns],[data-action=sync]')].map(el=>el.getBoundingClientRect()).filter(rect=>rect.width&&rect.height).map(rect=>({top:rect.top,bottom:rect.bottom})));
  assert.ok(Math.max(...controls.map(rect=>rect.top))<Math.min(...controls.map(rect=>rect.bottom)),JSON.stringify({width,theme,controls}));
  if(width>700) {
   await page.locator('.sidebar-toggle').click();
   await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width<78);
   assert.equal(await page.locator('.sidebar .brand>.sidebar-label').isVisible(),false);
   assert.equal(await page.evaluate(()=>localStorage.getItem('mail-sidebar')),'collapsed');
   await page.locator('.sidebar-toggle').click();
   await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width>230);
  } else {
   await page.locator('.mobile-menu').click();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.sidebar')).transform==='none');
   const icons=page.locator('.sidebar [data-action=nav] svg,.sidebar .compose-btn svg,.sidebar .brand svg,.sidebar .mailbox-link svg');
   assert.ok(await icons.count()>10);
   for(const icon of await icons.all()){
    assert.equal(await icon.isVisible(),true,'Every mobile sidebar icon remains visible');
    const box=await icon.boundingBox();assert.ok(box.width>0&&box.x>=0&&box.x+box.width<=72);
   }
   assert.equal(await page.locator('.app-shell').getAttribute('data-nav-open'),'');
   assert.notEqual(await page.locator('.sidebar').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   await page.locator('.nav-scrim').click({position:{x:200,y:300}});
   assert.equal(await page.locator('.app-shell').getAttribute('data-nav-open'),null);
  }
  await page.locator('[data-language-choice=en]').click();
  await page.waitForFunction(()=>document.querySelector('[data-language-choice=en]').getAttribute('aria-pressed')==='true');
  assert.ok(await page.locator('.mail-language-switch .switch-thumb').evaluate(el=>el.getAnimations().some(animation=>animation.playState==='running')),'Language thumb slides');
  await page.locator('[data-language-choice=zh]').click();
  await nav('categories');
  assert.equal(await page.locator('.category-board .lucide-menu,.category-number>svg').count(),0);
  await nav('contacts');
  if(width<=700) {
   const heading=await page.locator('.contacts-page h1').boundingBox(),count=await page.locator('.contacts-count').boundingBox();
   assert.ok(count.y>=heading.y+heading.height);
   const group=await page.locator('#contact-group-filter').boundingBox(),toggle=await page.locator('.contacts-toolbar>.contact-layout-switch').boundingBox();
   assert.ok(Math.abs(group.y+group.height/2-toggle.y-toggle.height/2)<2);
   assert.ok(toggle.width<80);
  }
  const cards=await page.locator('[data-contact-card]').evaluateAll(rows=>rows.map(row=>row.getBoundingClientRect().height));
  assert.ok(Math.max(...cards)-Math.min(...cards)<1,'Contact cards have equal heights');
  if(width<=1100) {
   const group=await page.locator('[data-contact-card=alice] .contact-group').boundingBox(),actions=await page.locator('[data-contact-card=alice] .contact-card-actions').boundingBox();
   assert.ok(Math.abs(group.y+group.height/2-actions.y-actions.height/2)<2);
  }
  await page.locator('[data-action=contact-layout][data-layout=list]').click();
  assert.ok(await page.locator('.contacts-toolbar .switch-thumb').evaluate(el=>el.getAnimations().some(animation=>animation.playState==='running')),'View thumb slides across rerender');
  if(width<=1100) {
   const card=await page.locator('[data-contact-card=alice]').boundingBox(),edit=await page.locator('[data-contact-card=alice] .contact-top-actions').boundingBox();
   assert.ok(edit.y-card.y<15&&card.x+card.width-edit.x-edit.width<15);
   const group=await page.locator('[data-contact-card=alice] .contact-group').boundingBox(),actions=await page.locator('[data-contact-card=alice] .contact-card-actions').boundingBox();
   assert.ok(Math.abs(group.y+group.height/2-actions.y-actions.height/2)<2);
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'test-results/responsive-ui-'+engine+'-'+theme+'-'+width+'.png'});
  if(width<=700)await page.locator('.mobile-menu').click();
  await page.locator('[data-action=nav][data-view=settings]').click();
  const appearance=page.locator('.mail-appearance-options'),frame=await appearance.boundingBox();
  assert.equal(await appearance.locator('.lucide-menu').count(),0);
  for(const button of await appearance.locator('button').all()){
   assert.equal(await button.locator('svg').isVisible(),true);
   assert.equal(await button.locator('.appearance-label').isVisible(),width>700);
   if(width<=700){const box=await button.boundingBox();assert.equal(box.width,44);assert.equal(box.height,44);}
  }
  assert.ok(frame.width<=(width<=700?98:320));
  await appearance.locator('[aria-pressed=false]').click();
  await page.waitForFunction(()=>{const group=document.querySelector('.mail-appearance-options'),thumb=group.querySelector('.switch-thumb').getBoundingClientRect(),selected=group.querySelector('[aria-pressed=true]').getBoundingClientRect();return Math.abs(thumb.x-selected.x)<.5&&Math.abs(thumb.width-selected.width)<.5;});
  await page.screenshot({path:'test-results/appearance-controls-'+engine+'-'+theme+'-'+width+'.png'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,width,theme,passed:true}));await context.close();
 }
} finally {await browser.close();}
