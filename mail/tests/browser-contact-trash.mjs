// Synthetic contacts only. Run with the Mail Vite dev server.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MAIL_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.MAIL_BROWSER_CHANNEL?{channel:process.env.MAIL_BROWSER_CHANNEL}:{})});
const mock=`export const db={auth:{getSession:async()=>({data:{session:{user:{id:'trash-qa',email:'qa@example.edu'}}}}),onAuthStateChange(){}}};export const login=async()=>{};export const register=async()=>{};
const photo='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#638b82"/></svg>');
let people=JSON.parse(localStorage.getItem('trash-fixture')||'null')||[{id:'person-a',email:'a@example.edu',emails:['a@example.edu','alias@example.edu','third@example.edu'],name:'Alice <test>',organization:'Example University',phone:'123',notes:'Keep my notes',group_name:'Friends',photo_path:'stored-photo',photo_url:photo},{id:'person-b',email:'b@example.edu',name:'Bob',group_name:'Friends'}];
export async function api(action,b={}){window.__calls.push({action,b});if(action==='bootstrap')return {profile:{username:'qa'},accounts:[],categories:[],drafts:[],counts:[],settings:{contact_groups:['Friends']},contacts:structuredClone(people.filter(c=>!c.deleted_at))};if(action==='list')return {messages:[],total:0};if(action==='contact_delete'||action==='contact_restore'){if(window.__fail){window.__fail=false;throw Error('Synthetic network failure');}people.find(c=>c.id===b.id).deleted_at=action==='contact_delete'?new Date().toISOString():null;localStorage.setItem('trash-fixture',JSON.stringify(people));return {id:b.id};}if(action==='contact_trash_list')return {contacts:structuredClone(people.filter(c=>c.deleted_at)),has_more:false};return {ok:true};}`;
const results=[];
for(const width of [320,390,1440]){
 const context=await browser.newContext({viewport:{width,height:850},isMobile:width<700,hasTouch:width<700});
 await context.addInitScript(()=>{window.__calls=[];});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.route('**/src/cloud.js',r=>r.fulfill({body:mock,contentType:'application/javascript'}));
 await page.goto(process.env.MAIL_TEST_URL||'http://127.0.0.1:5174/');await page.locator('.app-shell').waitFor();
 const nav=async view=>{if(width<700)await page.locator('[data-action=toggle-nav]').first().click();await page.locator('[data-action=nav][data-view='+view+']').click();};
 const fit=async()=>{const r=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,scale:visualViewport.scale}));assert.ok(r.scroll<=r.w+1,JSON.stringify(r));assert.equal(r.scale,1);};
 await nav('contacts');assert.equal(await page.locator('.contact-card').count(),2);assert.equal(await page.locator('.contact-card [data-action=find-photo]').count(),0);
 const launcher=page.getByRole('button',{name:'联系人垃圾箱',exact:true}),box=await launcher.boundingBox();assert.ok(box.x+box.width<=width);assert.ok(box.y+box.height<=850);assert.ok(box.x>width-100);assert.ok(box.y>700);
 await launcher.click();await page.getByText('垃圾箱是空的').waitFor();await page.locator('#modal-root [data-action=close-modal]').click();
 // A failed deletion must leave the visible contact intact.
 await page.evaluate(()=>window.__fail=true);await page.locator('[data-action=delete-contact][data-id=person-a]').click();await page.getByText('Synthetic network failure').waitFor();assert.equal(await page.locator('.contact-card').count(),2);
 await page.locator('[data-action=delete-contact][data-id=person-a]').click();await page.locator('[data-contact-card=person-a]').waitFor({state:'detached'});assert.equal(await page.locator('.contact-card').count(),1);
 await page.reload();await page.locator('.app-shell').waitFor();await nav('contacts');assert.equal(await page.locator('.contact-card').count(),1);
 await page.getByRole('button',{name:'联系人垃圾箱',exact:true}).click();await page.locator('.contact-trash-row').waitFor();assert.equal(await page.locator('.contact-trash-row strong').textContent(),'Alice <test>');assert.match(await page.locator('.contact-trash-info').textContent(),/third@example.edu/);assert.equal(await page.locator('.contact-trash-row img').count(),1);await fit();
 await page.screenshot({path:'test-results/mail-contact-trash-'+width+'.png',fullPage:true});
 // Failed restore keeps the item available for retry.
 await page.evaluate(()=>window.__fail=true);await page.locator('[data-action=restore-contact]').click();assert.equal(await page.locator('.contact-trash-row').count(),1);
 await page.locator('[data-action=restore-contact]').click();await page.getByText('垃圾箱是空的').waitFor();await page.locator('#modal-root [data-action=close-modal]').click();
 const card=page.locator('[data-contact-card=person-a]');await card.waitFor();assert.equal(await card.locator('img').count(),1);assert.match(await card.textContent(),/alias@example.edu/);assert.match(await card.textContent(),/third@example.edu/);
 await page.locator('[data-action=contact-layout]').click();await card.locator('[data-action=delete-contact]').click();await card.waitFor({state:'detached'});await fit();await page.getByRole('button',{name:'联系人垃圾箱',exact:true}).click();await page.locator('[data-action=restore-contact]').click();await page.getByText('垃圾箱是空的').waitFor();await page.locator('#modal-root [data-action=close-modal]').click();
 await page.locator('[data-action=edit-contact][data-id=person-a]').click();assert.equal(await page.locator('input[name=phone]').inputValue(),'123');assert.equal(await page.locator('textarea[name=notes]').inputValue(),'Keep my notes');assert.equal(await page.locator('input[name=contact_email]').count(),3);await page.locator('#modal-root [data-action=close-modal]').click();
 await nav('inbox');assert.equal(await page.locator('[data-action=contact-trash]').count(),0);assert.deepEqual(errors,[]);results.push({width,passed:true});await context.close();
}
await browser.close();console.log(JSON.stringify(results));
