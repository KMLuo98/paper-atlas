import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {photoEligible,photoKey,profilePhotos,publicPhotoURL,privateIP,imageMime,personName,samePersonName,institutionDomain,findContactPhoto} from '../../supabase/functions/mail-api/photos.js';
const person={name:'林明',email:'mlin@physics.example.edu',organization:'Example University'};
const url='https://physics.example.edu/people/mlin';
const page=(body)=>'<html><head><title>林明</title></head><body><h1>林明</h1>'+body+'</body></html>';
test('portrait requires exact name, official host and corroborating email',()=>{
 const html=page('<p>mlin@physics.example.edu</p><img alt="林明" src="/photos/mlin.jpg">');assert.deepEqual(profilePhotos(html,url,person,parseHTML),['https://physics.example.edu/photos/mlin.jpg']);
 assert.deepEqual(profilePhotos(html,'https://unrelated.example.com/people',person,parseHTML),[]);
 assert.deepEqual(profilePhotos(html.replace('mlin@physics.example.edu','another@example.edu'),url,person,parseHTML),[]);
 assert.deepEqual(profilePhotos(html.replace('alt="林明"','alt="林明和其他同事"'),url,person,parseHTML),[]);
});
test('unlabelled logos, ambiguous portraits and same-name people leave the avatar empty',()=>{
 assert.deepEqual(profilePhotos(page('<p>mlin@physics.example.edu</p><img src="/logo.png">'),url,person,parseHTML),[]);
 assert.deepEqual(profilePhotos(page('<p>mlin@physics.example.edu</p><img alt="林明" src="/one.jpg"><img alt="林明" src="/two.jpg">'),url,person,parseHTML),[]);
 assert.deepEqual(profilePhotos(page('<p>mlin@physics.example.edu</p><img alt="李明" src="/portrait.jpg">'),url,person,parseHTML),[]);
});
test('verified Person structured data can identify an official portrait',()=>{
 const html=page('<p>mlin@physics.example.edu</p><script type="application/ld+json">'+JSON.stringify({'@type':'Person',name:'林明',image:{url:'/portrait.png'}})+'</script>');assert.deepEqual(profilePhotos(html,url,person,parseHTML),['https://physics.example.edu/portrait.png']);
});
test('lookup fingerprints survive reloads and change only with identity details',()=>{
 assert.equal(photoEligible(person),true);assert.equal(photoEligible({...person,email:'mlin@gmail.com'}),true);assert.equal(photoEligible({...person,name:'编辑部'}),false);assert.equal(photoEligible({...person,photo_path:'saved/avatar'}),false);
 assert.equal(photoKey(person),photoKey({...person,group_name:'其他',notes:'edited'}));assert.notEqual(photoKey(person),photoKey({...person,name:'李明'}));
});
test('external source guards reject local URLs and non-image payloads',()=>{
 for(const u of ['http://example.edu/a','https://127.0.0.1/a','https://local.test/a','https://user:password@example.edu/a'])assert.equal(publicPhotoURL(u),'');
 for(const ip of ['127.0.0.1','10.1.2.3','192.168.1.2','::1','fd00::1','169.254.169.254'])assert.equal(privateIP(ip),true);
 assert.equal(privateIP('8.8.8.8'),false);assert.equal(imageMime(new TextEncoder().encode('<svg onload="alert(1)">')),'');assert.equal(imageMime(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
});
test('reversed names, accents and different official institution subdomains can match',()=>{
 assert.equal(personName('Sompolinsky, Haim'),'Haim Sompolinsky');assert.equal(samePersonName('Prof. Dr. Florian Dörfler','Dörfler  Florian'),true);assert.equal(institutionDomain('x@engineering.upenn.edu'),'upenn.edu');assert.equal(institutionDomain('x@isi.imi.i.u-tokyo.ac.jp'),'u-tokyo.ac.jp');assert.equal(institutionDomain('x@gmail.com'),'');
 const c={name:'Sompolinsky, Haim',email:'haim@mcb.example.edu'},html='<html><body><h1>Haim Sompolinsky</h1><p>Professor, Department of Neuroscience</p><img src="/haim-sompolinsky.jpg" alt="Haim Sompolinsky"></body></html>';assert.deepEqual(profilePhotos(html,'https://brain.example.edu/people/haim',c,parseHTML),['https://brain.example.edu/haim-sompolinsky.jpg']);assert.deepEqual(profilePhotos(html,'https://brain.example.edu/news/haim',c,parseHTML),[]);
});
test('an exact email avatar is saved while the provider must return 404 for missing photos',async()=>{
 const bytes=new Uint8Array(1100);bytes.set([255,216,255]);const requests=[],resolve=async(host,type)=>type==='A'?['8.8.8.8']:[];
 const result=await findContactPhoto({...person,email:'mlin@gmail.com'},parseHTML,{resolve,fetcher:async url=>{requests.push(url);return new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});}});assert.equal(result.status,'found');assert.equal(result.provider,'Gravatar');assert.match(requests[0],/d=404/);
 const absent=await findContactPhoto(person,parseHTML,{resolve,fetcher:async url=>url.includes('gravatar.com')?new Response(null,{status:404}):url.includes('wikipedia.org')?new Response('{"query":{"pages":[]}}',{headers:{'Content-Type':'application/json'}}):new Response('<rss><channel></channel></rss>',{headers:{'Content-Type':'application/rss+xml'}})});assert.equal(absent.status,'not_found');assert.equal(absent.bytes,undefined);
});
test('an unlabelled unique photo in the matching personal bio can be used without adopting navigation images',()=>{
 const html='<html><head><title>Lin Ming</title></head><body><nav><img src="/site-home.jpg" aria-label="Site home"></nav><section><h1>Prof. Lin Ming</h1><p>Professor, Department of Physics · lin@example.edu</p><img src="https://images.example.edu/opaque-picture.jpg"></section></body></html>',c={name:'Ming, Lin',email:'lin@example.edu'};
 assert.deepEqual(profilePhotos(html,'https://people.example.edu/',c,parseHTML),['https://images.example.edu/opaque-picture.jpg']);assert.deepEqual(profilePhotos(html.replace('<img src="https://images.example.edu/opaque-picture.jpg">','<img src="https://images.example.edu/opaque-picture.jpg"><img src="/another-person.jpg">'),'https://people.example.edu/',c,parseHTML),[]);
 assert.deepEqual(profilePhotos('<html><body><h1>林明</h1><p>mlin@physics.example.edu</p><script type="application/ld+json">{"@type":"Person","name":"林明"}</script></body></html>',url,person,parseHTML),[]);
});
