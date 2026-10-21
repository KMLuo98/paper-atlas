import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {publicPagePhotos,publicationLogos,sanitizeLogoSVG,wikiImageCandidate,searchPageLinks} from '../../supabase/functions/mail-api/photo-sources.js';
import {photoEligible,publicationIdentity,findContactPhoto} from '../../supabase/functions/mail-api/photos.js';
const contact={name:'Lin Ming',email:'lin@example.edu',organization:'Example University'};
test('a news interview photo may match outside official domains when identity and caption agree',()=>{
 const html='<html><head><title>Interview with Lin Ming</title></head><body><h1>Interview with Lin Ming</h1><p>Lin Ming is a physicist at Example University.</p><figure><img src="/interview.jpg"><figcaption>Lin Ming during the interview</figcaption></figure></body></html>';
 assert.deepEqual(publicPagePhotos(html,'https://news.example.com/interview',contact,parseHTML),['https://news.example.com/interview.jpg']);
 assert.deepEqual(publicPagePhotos(html.replace('Example University','Unrelated College'),'https://news.example.com/interview',contact,parseHTML),[]);
 assert.deepEqual(publicPagePhotos(html.replace('Lin Ming during the interview','A group of scientists'),'https://news.example.com/interview',contact,parseHTML),[]);
 assert.deepEqual(publicPagePhotos(html.replace('Lin Ming during the interview','Li Wang during the interview'),'https://news.example.com/interview',contact,parseHTML),[]);
});
test('Baidu encyclopedia and Google/Baidu discovery links are accepted as source pages',()=>{
 const html='<html><body><h1>Lin Ming</h1><p>Example University professor</p><figure><img src="https://images.example.com/lin.jpg" alt="Lin Ming"></figure></body></html>';assert.deepEqual(publicPagePhotos(html,'https://baike.baidu.com/item/LinMing',contact,parseHTML),['https://images.example.com/lin.jpg']);
 const links=searchPageLinks('<a href="/url?q=https%3A%2F%2Fnews.example.com%2Finterview&amp;sa=U">Interview with Lin Ming</a><a href="/preferences">Preferences</a>','https://www.google.com/search',parseHTML,contact);assert.deepEqual(links,['https://news.example.com/interview']);
 assert.deepEqual(searchPageLinks('<a href="https://www.baidu.com/link?url=verified-result">Lin Ming interview</a>','https://www.baidu.com/s',parseHTML,contact),['https://www.baidu.com/link?url=verified-result']);
});
test('Wikipedia thumbnails require a matching individual and reject disambiguation or other institutions',()=>{
 const page={title:'Lin Ming',extract:'Lin Ming is a physicist at Example University.',fullurl:'https://en.wikipedia.org/wiki/Lin_Ming',thumbnail:{source:'https://upload.wikimedia.org/lin.jpg'},pageimage:'Lin_Ming.jpg'};assert.equal(wikiImageCandidate(page,contact).provider,'维基百科');assert.equal(wikiImageCandidate({...page,pageprops:{disambiguation:''}},contact),null);assert.equal(wikiImageCandidate({...page,extract:'A football player at another club.'},contact),null);assert.equal(wikiImageCandidate({...page,title:'Li Wang'},contact),null);
});
test('journal senders get publication logos while named staff retain person matching',()=>{
 const publisher={name:'Frontiers in Physics Editorial Office',email:'physics@frontiersin.org'};assert.equal(photoEligible(publisher),true);assert.equal(photoEligible({name:'',email:'production@aps.org'}),true);assert.equal(publicationIdentity({...publisher,name:'Andrea Warner'}),null);
 const html='<html><head><title>Frontiers in Physics</title></head><body><header><img alt="Frontiers logo" src="/brand/logo.svg"></header><p>Frontiers in Physics</p><img alt="Facebook logo" src="/social/facebook.png"></body></html>';assert.equal(publicationLogos(html,'https://www.frontiersin.org/journals/physics',publisher,parseHTML)[0].url,'https://www.frontiersin.org/brand/logo.svg');assert.deepEqual(publicationLogos(html,'https://unrelated.example.com/',publisher,parseHTML),[]);
 const wiki={title:'Frontiers (publisher)',extract:'An academic publisher',fullurl:'https://en.wikipedia.org/wiki/Frontiers_(publisher)',thumbnail:{source:'https://upload.wikimedia.org/logo.png'},pageimage:'Frontiers_logo.png',extlinks:[{url:'https://www.frontiersin.org/'}]};assert.ok(wikiImageCandidate(wiki,publisher));assert.equal(wikiImageCandidate({...wiki,extlinks:[{url:'https://unrelated.example.com/'}]},publisher),null);assert.equal(wikiImageCandidate({...wiki,pageimage:'Journal_issue_cover.jpg'},publisher),null);
});
test('static SVG logos are cleaned and reject scripts, event handlers and external references',()=>{
 const enc=s=>new TextEncoder().encode(s),svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0h20v20H0z" fill="#123456"/></svg>';assert.match(new TextDecoder().decode(sanitizeLogoSVG(enc(svg),parseHTML)),/<path/);
 for(const payload of ['<svg><script>alert(1)</script><path d="M0 0"/></svg>','<svg onload="alert(1)"><path d="M0 0"/></svg>','<svg><use href="https://private.example/logo.svg#x"/></svg>','<svg><path fill="url(https://private.example/x)" d="M0 0"/></svg>'])assert.equal(sanitizeLogoSVG(enc(payload),parseHTML),null);
});
test('publication avatar lookup can fetch a verified Wikipedia logo and store real bytes',async()=>{
 const c={name:'Frontiers in Physics Editorial Office',email:'physics@frontiersin.org'},bytes=new Uint8Array(1000);bytes.set([137,80,78,71,13,10,26,10]);const requests=[];
 const result=await findContactPhoto(c,parseHTML,{resolve:async(h,t)=>t==='A'?['8.8.8.8']:[],fetcher:async url=>{requests.push(url);if(url.includes('wikipedia.org/w/api.php'))return new Response(JSON.stringify({query:{pages:[{title:'Frontiers (publisher)',extract:'Frontiers scientific publisher',fullurl:'https://en.wikipedia.org/wiki/Frontiers_(publisher)',thumbnail:{source:'https://upload.wikimedia.org/frontiers.png'},pageimage:'Frontiers_logo.png',extlinks:[{url:'https://www.frontiersin.org/'}]}]}}),{headers:{'Content-Type':'application/json'}});return new Response(bytes,{headers:{'Content-Type':'image/png'}});}});assert.equal(result.status,'found');assert.equal(result.mime,'image/png');assert.equal(result.provider,'维基百科');assert.equal(requests.some(u=>u.includes('gravatar.com')),false);
});
