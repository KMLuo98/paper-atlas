// Synthetic API only. No real messages or credentials.
import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
let mock=fs.readFileSync('mail/tests/browser-translation.mjs','utf8').split('const mock=`')[1].split('`;')[0];
mock=mock.replace("if(action==='list')","if(action==='send'){while(!window.__sendReady)await new Promise(r=>setTimeout(r,20));if(window.__sendFail)throw Error('Synthetic send failure');return {ok:true};}if(action==='list')");
const results=[];
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__calls=[];window.__translations={};window.__sendReady=false;window.__sendFail=false;window.__fixture={profile:{username:'QA'},accounts:[{id:'a',email:'qa@example.edu',label:'School',enabled:false}],settings:{},contacts:[],drafts:[],categories:[],counts:[],messages:[]};});
 await page.route('**/src/cloud.js',r=>r.fulfill({body:mock,contentType:'application/javascript'}));await page.goto('http://127.0.0.1:5174/');await page.locator('#mail-launch').waitFor({state:'detached'});
 assert.equal(await page.locator('[data-action=ai-classify] svg').getAttribute('data-lucide'),'sparkles');
 assert.equal(await page.locator('.head-actions [data-action=export] svg').getAttribute('data-lucide'),'download');
 if(width<700)await page.locator('.mobile-menu').click();await page.locator('[data-action=compose]').click();
 assert.equal(await page.locator('#compose-form .compose-bottom>button.primary svg').getAttribute('data-lucide'),'send');
 assert.equal(await page.locator('[data-action=save-draft] svg').getAttribute('data-lucide'),'save');
 await page.locator('[name=to]').fill('recipient@example.edu');await page.locator('[name=subject]').fill('Animation fixture');await page.locator('#compose-body').fill('A synthetic letter for animation verification.');
 await page.locator('#compose-form .compose-bottom>button.primary').click();await page.locator('[data-action=confirm-send]').click();await page.locator('.mail-send-stage').waitFor();
 const scene=page.locator('.mail-send-stage');
 const opened=await scene.evaluate(stage=>{
  const flap=stage.querySelector('.send-envelope-flap');
  const seal=stage.querySelector('.send-wax-seal');
  const animations=stage.getAnimations({subtree:true});
  for(const animation of animations){animation.pause();animation.currentTime=400;}
  const state={flapBelowLetter:Number(getComputedStyle(flap).zIndex)<Number(getComputedStyle(stage.querySelector('.send-letter-pocket')).zIndex),sealOpacity:getComputedStyle(seal).opacity};
  for(const animation of animations)animation.play();
  return state;
 });
 assert.deepEqual(opened,{flapBelowLetter:true,sealOpacity:'0'});
 await page.waitForFunction(()=>{
  const stage=document.querySelector('.mail-send-stage');
  return stage&&getComputedStyle(stage.querySelector('.send-wax-seal')).opacity==='1';
 });
 const packed=await scene.evaluate(stage=>{
  const rect=selector=>stage.querySelector(selector).getBoundingClientRect();
  const letter=rect('.send-letter'),envelope=rect('.send-envelope'),seal=rect('.send-wax-seal');
  return {paperInside:letter.top>envelope.top&&letter.bottom<envelope.bottom,sealCentered:Math.abs(seal.left+seal.width/2-envelope.left-envelope.width/2)<1};
 });
 assert.deepEqual(packed,{paperInside:true,sealCentered:true});
 assert.equal(await page.locator('.is-departing').count(),0);
 assert.match(await page.locator('.send-letter').innerText(),/Animation fixture/);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.mail-send-stage').count(),1);
 await page.evaluate(()=>document.querySelector('[data-action=confirm-send]').click());assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.action==='send').length),1);
 await page.screenshot({path:'test-results/send-packed-'+width+'.png'});
 // Failure restores the original confirmation and keeps the editable draft.
 await page.evaluate(()=>{window.__sendFail=true;window.__sendReady=true;});await page.locator('.mail-send-stage').waitFor({state:'detached'});assert.equal(await page.locator('#compose-body').innerText(),'A synthetic letter for animation verification.');assert.equal(await page.locator('[data-action=confirm-send]').isVisible(),true);
 await page.evaluate(()=>{window.__sendReady=false;window.__sendFail=false;});await page.locator('[data-action=confirm-send]').click();await page.locator('.mail-send-stage').waitFor();await page.evaluate(()=>window.__sendReady=true);await page.locator('.is-departing').waitFor();await page.screenshot({path:'test-results/send-depart-'+width+'.png'});await page.locator('.mail-send-stage').waitFor({state:'detached'});await page.locator('[data-view=sent].active').waitFor();assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.action==='send').length),2);assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));results.push({width,passed:true});await page.close();
}}finally{await browser.close();}console.log(JSON.stringify(results));
