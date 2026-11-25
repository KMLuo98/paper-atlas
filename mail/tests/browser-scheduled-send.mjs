// Synthetic queue and mail data only. No real email is sent or scheduled.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const playwright=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.MAIL_TEST_ENGINE||'chromium';
const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
let mock=fs.readFileSync('mail/tests/browser-translation.mjs','utf8').split('const mock=`')[1].split('`;')[0];
mock=mock.replace("if(action==='list')",`if(action.startsWith('scheduled_')){let items=JSON.parse(localStorage.getItem('test-scheduled-items')||'[]');if(action==='scheduled_create'){while(!window.__scheduleReady)await new Promise(resolve=>setTimeout(resolve,20));if(window.__scheduleFail)throw Error('Synthetic schedule failure');const row={...b,id:b.key,status:'pending'};items.push(row);localStorage.setItem('test-scheduled-items',JSON.stringify(items));return row;}if(action==='scheduled_list')return {items};const row=items.find(x=>x.id===b.id);if(action==='scheduled_cancel')row.status='cancelled';if(action==='scheduled_get')return {data:structuredClone(row)};if(action==='scheduled_delete')items=items.filter(x=>x.id!==b.id);localStorage.setItem('test-scheduled-items',JSON.stringify(items));return {ok:true};}if(action==='list')`);
const widths=process.env.MAIL_TEST_WIDTH?[Number(process.env.MAIL_TEST_WIDTH)]:[320,390,768,1024,1280,1440];
const results=[];
try{for(const width of widths){
 const context=await browser.newContext({viewport:{width,height:1000},isMobile:width<700,hasTouch:width<700,timezoneId:'Asia/Shanghai',reducedMotion:process.env.MAIL_TEST_REDUCED_MOTION||'no-preference'});
 await context.addInitScript(()=>{if(window.top!==window)return;window.__calls=[];window.__translations={};window.__scheduleReady=false;window.__scheduleFail=false;localStorage.setItem('mail-sidebar','collapsed');window.__fixture={profile:{username:'QA'},accounts:[{id:'a',email:'qa@example.edu',label:'School',color:'#638b82',enabled:false}],settings:{},contacts:[],drafts:[],categories:[],counts:[],messages:[{id:'original',account_id:'a',folder:'inbox',from_email:'sender@example.edu',to_list:[{address:'qa@example.edu'}],from_name:'Sender',subject:'Synthetic original',received_at:'2026-11-26T00:00:00Z',text_body:'Hello Kaiming,\nA synthetic original message.',is_read:true,attachments:[]}]};});
 await context.route('**/src/cloud.js',r=>r.fulfill({body:mock,contentType:'application/javascript'}));
 let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174/');await page.locator('[data-open=original]').click();await page.locator('.reader-toolbar [data-action=reply]').click();
 for(const theme of ['classic','glass']){
  await page.evaluate(theme=>{document.documentElement.dataset.appearance=theme;},theme);
  await page.waitForTimeout(180);
  const positions=await page.locator('.compose-bottom').evaluate(row=>[...row.children].filter(x=>!x.hidden).map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y+r.height/2,right:r.right,width:r.width};}));
  assert.ok(positions.every(p=>Math.abs(p.y-positions[0].y)<2),JSON.stringify({width,theme,positions}));
  const attachment=await page.locator('.compose-bottom .file-button').evaluate(el=>({direction:getComputedStyle(el).flexDirection,width:el.getBoundingClientRect().width,scroll:el.scrollWidth}));
  assert.equal(attachment.direction,'row');assert.ok(attachment.scroll<=attachment.width+1,JSON.stringify(attachment));
 }
 await page.frameLocator('#original-frame').locator('body').waitFor();
 assert.equal(await page.frameLocator('#original-frame').locator('body').evaluate(el=>getComputedStyle(el).fontSize),await page.locator('#recipient-to').evaluate(el=>getComputedStyle(el).fontSize));
 await page.locator('#compose-body').fill('Synthetic scheduled reply');
 await page.locator('#compose-file').setInputFiles({name:'qa.txt',mimeType:'text/plain',buffer:Buffer.from('qa attachment')});await page.locator('.attachment-name').waitFor();
 if(width===1280){await page.locator('.compose-bottom').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/mail-compose-actions-'+engine+'.png'});}
 await page.locator('[data-action=schedule-send]').click();await page.locator('#schedule-form').waitFor();
 const planned=new Date(Date.now()+3600000).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16).replace(' ','T');
 await page.locator('#schedule-form [name=send_at]').fill(planned);await page.locator('#schedule-form button[type=submit]').click();
 await page.locator('.mail-scheduled-stage').waitFor();
 assert.equal(await page.locator('.mail-send-stage,.is-departing').count(),0);
 assert.equal(await page.locator('#app').evaluate(el=>el.inert),true);
 await page.waitForTimeout(1250);
 assert.equal(await page.locator('.is-queued').count(),0);
 assert.equal(await page.locator('.scheduled-clock-seal').evaluate(el=>getComputedStyle(el).opacity),'0');
 assert.equal(await page.locator('.scheduled-animation-status').innerText(),'正在封存定时邮件…');
 const packed=await page.locator('.scheduled-scene').evaluate(scene=>{const box=scene.querySelector('.scheduled-envelope').getBoundingClientRect(),paper=scene.querySelector('.scheduled-letter').getBoundingClientRect();return paper.top>box.top&&paper.bottom<box.bottom;});assert.ok(packed);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.mail-scheduled-stage').count(),1);
 await page.evaluate(()=>document.querySelector('#schedule-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(await page.evaluate(()=>window.__calls.filter(x=>x.action==='scheduled_create').length),1);
 if(width===widths[0]){
  await page.evaluate(()=>{window.__scheduleFail=true;window.__scheduleReady=true;});await page.locator('.mail-scheduled-stage').waitFor({state:'detached'});
  assert.equal(await page.locator('#schedule-form .form-error').innerText(),'Synthetic schedule failure');
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
  assert.equal(await page.locator('#compose-body').textContent(),'Synthetic scheduled reply');
  assert.equal(await page.locator('#schedule-form button[type=submit]').isDisabled(),false);
  await page.evaluate(()=>{window.__scheduleReady=false;window.__scheduleFail=false;});await page.locator('#schedule-form button[type=submit]').click();await page.locator('.mail-scheduled-stage').waitFor();
 }
 await page.evaluate(()=>window.__scheduleReady=true);
 if(process.env.MAIL_TEST_REDUCED_MOTION!=='reduce'){
  await page.locator('.mail-scheduled-stage.is-queued').waitFor();
  await page.waitForTimeout(380);
  assert.equal(await page.locator('.scheduled-animation-status').innerText(),'已保存，等待预约时间');
  assert.ok(Number(await page.locator('.scheduled-clock-seal').evaluate(el=>getComputedStyle(el).opacity))>.5);
  assert.equal(await page.locator('.scheduled-envelope').evaluate(el=>getComputedStyle(el).animationName),'scheduled-dock');
  assert.equal(await page.locator('.is-departing').count(),0);
  await page.screenshot({path:'test-results/mail-scheduled-animation-'+engine+'-'+width+'.png'});
 }
 await page.locator('.scheduled-list article').waitFor();
 assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
 assert.equal(await page.locator('.modal[aria-busy=true]').count(),0);
 const payload=await page.evaluate(()=>window.__calls.find(x=>x.action==='scheduled_create').b);
 assert.equal(payload.body,'Synthetic scheduled reply');assert.equal(payload.attachments.length,1);assert.equal(Buffer.from(payload.attachments[0].content,'base64').toString(),'qa attachment');
 assert.match(payload.send_at,/Z$/);assert.equal(await page.evaluate(()=>window.__calls.some(x=>x.action==='send')),false);
 // Closing and reopening the page retains the queued record; it is not an in-page timer.
 await page.close();page=await context.newPage();await page.goto('http://127.0.0.1:5174/');
 if(width<700)await page.locator('.mobile-menu').click();await page.locator('[data-action=nav][data-view=drafts]').click();await page.locator('.scheduled-list article').waitFor();
 await page.locator('[data-action=cancel-scheduled]').click();await page.locator('[data-action=confirm-cancel-scheduled]').click();await page.locator('[data-status=cancelled]').waitFor();
 await page.locator('[data-action=edit-scheduled]').click();assert.equal(await page.locator('#compose-body').innerText(),'Synthetic scheduled reply');assert.equal((await page.locator('.attachment-name').textContent()).trim(),'qa.txt');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/mail-scheduled-'+engine+'-'+width+'.png'});results.push({engine,width,passed:true});await context.close();
}}finally{await browser.close();}
console.log(JSON.stringify(results));
