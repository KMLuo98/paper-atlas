import assert from 'node:assert/strict';
const engine=process.env.MAIL_TEST_ENGINE||'chromium';
const playwright=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
const mock=`export const db={auth:{getSession:async()=>({data:{session:{user:{id:'motion-user',email:'qa@example.edu'}}}}),onAuthStateChange(){}}};export const login=async()=>{};export const register=async()=>{};export async function api(action){if(action==='bootstrap')return {profile:{username:'QA'},accounts:[{id:'school',label:'School',email:'qa@example.edu',color:'#638b82',enabled:false}],categories:[],drafts:[],counts:[],settings:{},contacts:[{id:'alice',name:'Alice',email:'alice@example.edu'},{id:'bob',name:'Bob',email:'bob@example.edu'}]};if(action.startsWith('manuscripts_'))return {enabled:true,manuscripts:[],statistics:[]};return {messages:[],total:0};}`;

async function sidebarSlide(page,collapse){
 const result=await page.evaluate(async()=>{
  const sidebar=document.querySelector('.sidebar'),nodes=[...sidebar.querySelectorAll('.sidebar-glyph,.profile-chip>.icon-btn')],label=sidebar.querySelector('.brand>.sidebar-label');
  const box=()=>({width:sidebar.getBoundingClientRect().width,opacity:parseFloat(getComputedStyle(label).opacity),icons:nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})});
  const before=box(),samples=[];document.querySelector('.sidebar-toggle').click();
  const fadeStarted=label.getAnimations().some(animation=>animation.transitionProperty==='opacity'&&animation.playState==='running');
  let sameNode=true;const end=performance.now()+340;
  await new Promise(resolve=>{function frame(){sameNode&&=document.querySelector('.sidebar')===sidebar;samples.push(box());if(performance.now()<end)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
  return {before,final:box(),samples,sameNode,fadeStarted};
 });
 assert.equal(result.sameNode,true,'Resize the existing sidebar, without replacing it');
 assert.ok(Math.abs(result.final.width-(collapse?76:232))<.1);
 assert.ok(result.samples.some(row=>row.width>80&&row.width<228),'Sidebar passes through intermediate widths');
 for(const row of result.samples){
  row.icons.forEach((icon,index)=>{
   const first=result.before.icons[index],last=result.final.icons[index];
   assert.ok(Math.abs(icon.y-first.y)<1,'Icon Y position stays fixed throughout the animation');
   assert.ok(icon.x>=Math.min(first.x,last.x)-1&&icon.x<=Math.max(first.x,last.x)+1,JSON.stringify({collapse,index,first,last,icon,width:row.width}));
  });
  assert.ok(row.width>=75.9&&row.width<=232.1);
 }
 assert.ok(result.fadeStarted||result.samples.some(row=>row.opacity>.05&&row.opacity<.95),'Label opacity has an active fade transition');
}

async function slide(page,groupSelector,targetSelector,reverse=false){
 const result=await page.evaluate(async({groupSelector,targetSelector,reverse})=>{
  const ui=await import('/src/responsive-ui.js');
  const group=()=>document.querySelector(groupSelector);
  const box=()=>{const g=group(),t=g.querySelector('.switch-thumb'),r=t.getBoundingClientRect(),p=g.getBoundingClientRect();return {x:r.left-p.left,y:r.top-p.top,width:r.width};};
  const original=group().querySelector('[aria-pressed="true"]');
  const originalIndex=[...group().querySelectorAll('button')].indexOf(original);
  const before=box(),samples=[];
  group().querySelector(targetSelector).click();
  const immediate=box();
  let refreshed=false,reversed=false,continuity=0;
  const started=performance.now();
  await new Promise(resolve=>{
   function frame(timestamp){
    const elapsed=performance.now()-started;
    samples.push({...box(),t:timestamp,reversed});
    if(elapsed>60&&!refreshed){
     const prior=box();
     ui.prepareResponsiveUI();ui.prepareResponsiveUI();
     group().querySelector('[aria-pressed="true"]').click();
     continuity=Math.max(continuity,Math.abs(box().x-prior.x));refreshed=true;
    }
    if(reverse&&elapsed>110&&!reversed){
     const prior=box();group().querySelectorAll('button')[originalIndex].click();
     continuity=Math.max(continuity,Math.abs(box().x-prior.x));reversed=true;
    }
    if(elapsed<500)requestAnimationFrame(frame);else resolve();
   }
   requestAnimationFrame(frame);
  });
  const final=box(),g=group(),selected=g.querySelector('[aria-pressed="true"]').getBoundingClientRect(),parent=g.getBoundingClientRect();
  return {before,immediate,samples,continuity,final,target:selected.left-parent.left};
 },{groupSelector,targetSelector,reverse});
 assert.ok(Math.abs(result.before.x-result.immediate.x)<.75,'Slide starts at its visible position');
 assert.ok(result.continuity<.75,JSON.stringify({groupSelector,targetSelector,continuity:result.continuity}));
 assert.ok(Math.abs(result.final.x-result.target)<.75,JSON.stringify({groupSelector,targetSelector,final:result.final,target:result.target}));
 const distance=Math.max(...result.samples.map(row=>row.x))-Math.min(...result.samples.map(row=>row.x));
 assert.ok(distance>5,'Thumb travels through intermediate positions');
 for(let i=1;i<result.samples.length;i++){
  const previous=result.samples[i-1],next=result.samples[i];
  assert.ok(Math.abs(next.x-previous.x)<=Math.max(32,distance)*4*(next.t-previous.t)/240+1.5,JSON.stringify({groupSelector,targetSelector,previous,next,distance,samples:result.samples}));
 }
}

try{
 for(const theme of (process.env.MAIL_TEST_THEME?[process.env.MAIL_TEST_THEME]:['classic','glass']))for(const width of (process.env.MAIL_TEST_WIDTH?[+process.env.MAIL_TEST_WIDTH]:[390,1024,1440])){
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width<=700,hasTouch:width<=700});
  await context.addInitScript(theme=>{localStorage.setItem('pa-appearance',theme);localStorage.setItem('mail-sidebar','collapsed');},theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/cloud.js',route=>route.fulfill({body:mock,contentType:'application/javascript'}));
  await page.goto('http://127.0.0.1:5174/');await page.locator('#mail-launch').waitFor({state:'detached'});
  const nav=async view=>{if(width<=700)await page.locator('.mobile-menu').click();await page.locator('[data-action=nav][data-view='+view+']').click();};
  if(width>700){
   const before=await page.locator('.sidebar .nav-item,.sidebar .mailbox-link').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().y));
   for(const view of ['contacts','sent','categories','contacts']){
    await page.evaluate(()=>{
     window.__widths=[];window.__expanded=false;
     const observer=new MutationObserver(records=>{if(records.some(record=>record.oldValue==='expanded'))window.__expanded=true;});
     observer.observe(document.documentElement,{attributes:true,attributeOldValue:true,attributeFilter:['data-mail-sidebar']});
     window.__sampling=new Promise(resolve=>{const end=performance.now()+300;function frame(){window.__widths.push(document.querySelector('.sidebar').getBoundingClientRect().width);if(performance.now()<end)requestAnimationFrame(frame);else{observer.disconnect();resolve();}}requestAnimationFrame(frame);});
    });
    await nav(view);await page.evaluate(()=>window.__sampling);
    assert.equal(await page.evaluate(()=>window.__expanded),false,'Navigation never changes the live sidebar to expanded');
    assert.ok((await page.evaluate(()=>window.__widths)).every(width=>Math.abs(width-76)<.1),'Collapsed sidebar never flashes wide');
   }
   const after=await page.locator('.sidebar .nav-item,.sidebar .mailbox-link').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().y));
   assert.ok(before.every((y,index)=>Math.abs(y-after[index])<1),JSON.stringify({before,after}));
   await page.reload();await page.locator('#mail-launch').waitFor({state:'detached'});
   assert.ok(Math.abs((await page.locator('.sidebar').boundingBox()).width-76)<.1,'Collapsed state survives reload');
   await sidebarSlide(page,false);await sidebarSlide(page,true);
  }
  await nav('contacts');
  await slide(page,'.contacts-toolbar .contact-layout-switch','[data-layout=list]');
  await slide(page,'.contacts-toolbar .contact-layout-switch','[data-layout=grid]',true);
  await slide(page,'.mail-language-switch','[data-language-choice=en]');
  await slide(page,'.mail-language-switch','[data-language-choice=zh]',true);
  if(width>1100){await nav('manuscripts');await slide(page,'.submission-toolbar .contact-layout-switch','[data-layout=list]');await slide(page,'.submission-toolbar .contact-layout-switch','[data-layout=grid]',true);}
  await nav('settings');await slide(page,'.mail-appearance-options',theme==='glass'?'[data-mail-appearance=classic]':'[data-mail-appearance=glass]');
  assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({engine,width,theme,motionPassed:true}));
 }
 const context=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'}),page=await context.newPage();
 await page.route('**/src/cloud.js',route=>route.fulfill({body:mock,contentType:'application/javascript'}));
 await page.goto('http://127.0.0.1:5174/');await page.locator('#mail-launch').waitFor({state:'detached'});
 await page.locator('[data-action=nav][data-view=contacts]').click();
 await page.locator('[data-action=contact-layout][data-layout=list]').click();
 assert.equal(await page.locator('.contacts-toolbar .switch-thumb').evaluate(node=>node.getAnimations().length),0);
 assert.equal(await page.locator('.app-shell').evaluate(node=>getComputedStyle(node).transitionDuration),'0s');
 await context.close();console.log(JSON.stringify({engine,reducedMotionPassed:true}));
}finally{await browser.close();}
