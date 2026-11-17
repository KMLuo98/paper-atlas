import assert from 'node:assert/strict';
const { chromium } = await import(process.env.MAIL_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless:true,
  // Intercept the synthetic HTTPS response inside the sandboxed iframe.
  args:['--disable-site-isolation-trials'],
  ...(process.env.MAIL_BROWSER_CHANNEL ? {channel:process.env.MAIL_BROWSER_CHANNEL} : {})
});
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jdk8AAAAASUVORK5CYII=';
const mock = `
export const db={auth:{getSession:async()=>({data:{session:{user:{id:'image-qa',email:'qa@example.edu'}}}}),onAuthStateChange(){}}};
export const login=async()=>{};
export const register=async()=>{};
export async function api(action,params={}){
  const data=window.__fixture;
  if(action==='bootstrap')return structuredClone(data);
  if(action==='list')return {messages:data.messages.filter(m=>m.folder===(params.folder||'inbox')),total:2};
  if(action==='get')return {message:data.messages.find(m=>m.id===params.id),translations:{}};
  if(action==='attachment'){
    window.__attachmentIndexes.push(params.index);
    return {mime_type:'image/png',content:'${pixel}'};
  }
  return {ok:true,added:0};
}`;

try {
  for (const width of [320,1440]) {
    const context = await browser.newContext({viewport:{width,height:850},isMobile:width<700,hasTouch:width<700});
    await context.addInitScript(pixel => {
      const photo = 'data:image/png;base64,'+pixel;
      const base={account_id:'a',from_email:'qa@example.edu',is_read:true,received_at:'2026-11-17',text_body:'Photo test'};
      const one={address:'one@example.edu',name:'One'};
      const two={address:'two@example.edu',name:'Two'};
      const three={address:'three@example.edu',name:'Three'};
      window.__attachmentIndexes=[];
      window.__fixture={
        profile:{username:'QA',photo_url:photo},accounts:[{id:'a',email:'qa@example.edu',label:'School',enabled:false}],
        contacts:[{id:'one',name:'Contact One',email:one.address,photo_url:photo},{id:'two',name:'Contact Two',email:two.address,photo_url:photo}],
        categories:[],settings:{},drafts:[],counts:[],
        messages:[
          {...base,id:'in',folder:'inbox',subject:'Pictures',from_email:one.address,
            html_body:'<p>Inline images</p><img id="cid-one" src="cid:inline%40example.edu"><img id="cid-two" src="cid:inline@example.edu"><img id="remote" src="https://images.example.edu/remote.png">',
            attachments:[{index:0,filename:'embedded.png',mime_type:'image/png',size:100,content_id:'<inline@example.edu>'},{index:1,filename:'extra.png',mime_type:'image/png',size:100,content_id:'<unused@example.edu>'}]},
          {...base,id:'one',folder:'sent',direction:'sent',subject:'One person',to_list:[one]},
          {...base,id:'group',folder:'sent',direction:'sent',subject:'Three people',to_list:[one,two,three]}
        ]
      };
    },pixel);
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/src/cloud.js',route=>route.fulfill({body:mock,contentType:'application/javascript'}));
    let requestCount=0;
    await context.route('https://images.example.edu/remote.png',async route=>{
      assert.equal(route.request().headers().referer,undefined);
      requestCount++;
      await route.fulfill({contentType:'image/png',body:Buffer.from(pixel,'base64')});
    });
    await page.goto(process.env.MAIL_TEST_URL||'http://127.0.0.1:5174/');
    await page.locator('#mail-launch').waitFor({state:'detached'});
    await page.locator('[data-open=in]').click();
    const frame=page.frameLocator('#email-frame');
    for (const id of ['cid-one','cid-two','remote']) {
      const image=frame.locator('#'+id+(id.startsWith('cid')?'[src^=data]:visible':':visible'));
      await image.waitFor();
      await image.evaluate(image=>image.decode());
      assert.ok(await image.evaluate(image=>image.naturalWidth>0));
    }
    assert.deepEqual(await page.evaluate(()=>window.__attachmentIndexes),[0]);
    assert.equal(requestCount,1);
    await page.locator('.reader-toolbar [data-action=back]').click();
    if(width<700)await page.locator('.mobile-menu').click();
    await page.locator('[data-action=nav][data-view=sent]').click();
    const single=page.locator('[data-open=one] .row-sender');
    const group=page.locator('[data-open=group] .row-sender');
    assert.equal(await single.locator('strong').innerText(),'Contact One');
    assert.equal(await single.locator('img').getAttribute('alt'),'Contact One');
    assert.deepEqual(await group.locator('strong').allTextContents(),['Contact One','Contact Two']);
    assert.deepEqual(await group.locator('img').evaluateAll(images=>images.map(image=>image.alt)),['Contact One','Contact Two']);
    assert.equal(await group.locator('.row-recipient-more').innerText(),'…');
    const avatarWidth=await single.locator('.avatar').evaluate(avatar=>avatar.offsetWidth);
    assert.ok(await group.locator('.avatar').first().evaluate((avatar,single)=>avatar.offsetWidth<single,avatarWidth));
    assert.ok(await group.locator('.row-recipient').evaluateAll(rows=>rows[0].getBoundingClientRect().bottom<=rows[1].getBoundingClientRect().top));
    assert.deepEqual(errors,[]);
    await context.close();
    console.log(JSON.stringify({width,passed:true}));
  }
} finally {
  await browser.close();
}
