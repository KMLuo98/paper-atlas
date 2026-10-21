import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {photoEligible,photoKey,profilePhotos,publicPhotoURL,privateIP,imageMime} from '../../supabase/functions/mail-api/photos.js';
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
 assert.equal(photoEligible(person),true);assert.equal(photoEligible({...person,email:'mlin@gmail.com'}),false);assert.equal(photoEligible({...person,name:'编辑部'}),false);assert.equal(photoEligible({...person,photo_path:'saved/avatar'}),false);
 assert.equal(photoKey(person),photoKey({...person,group_name:'其他',notes:'edited'}));assert.notEqual(photoKey(person),photoKey({...person,name:'李明'}));
});
test('external source guards reject local URLs and non-image payloads',()=>{
 for(const u of ['http://example.edu/a','https://127.0.0.1/a','https://local.test/a','https://user:password@example.edu/a'])assert.equal(publicPhotoURL(u),'');
 for(const ip of ['127.0.0.1','10.1.2.3','192.168.1.2','::1','fd00::1','169.254.169.254'])assert.equal(privateIP(ip),true);
 assert.equal(privateIP('8.8.8.8'),false);assert.equal(imageMime(new TextEncoder().encode('<svg onload="alert(1)">')),'');assert.equal(imageMime(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
});
