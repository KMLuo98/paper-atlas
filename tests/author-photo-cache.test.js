import test from 'node:test';import assert from 'node:assert/strict';
import {cachedAuthorPhotos,clearAuthorPhotoCache} from '../src/author-photo-cache.js';
test('author photos reuse signed URLs and downloaded blobs across views and concurrent requests',async()=>{
 const owner='cache-owner',path=owner+'/a.jpg';clearAuthorPhotoCache(owner);let signs=0,downloads=0;
 const db={storage:{from:()=>({createSignedUrls:async paths=>{signs++;return {data:paths.map(path=>({path,signedUrl:'https://storage.example/'+path}))};}})}};
 const options={fetcher:async()=>{downloads++;return new Response(new Uint8Array(500),{headers:{'Content-Type':'image/jpeg'}});}};
 const [a,b]=await Promise.all([cachedAuthorPhotos(db,owner,[path],options),cachedAuthorPhotos(db,owner,[path],options)]);assert.match(a.get(path),/^blob:/);assert.equal(a.get(path),b.get(path));
 const next=await cachedAuthorPhotos(db,owner,[path],options);assert.equal(next.get(path),a.get(path));assert.equal(signs,1);assert.equal(downloads,1);
 await cachedAuthorPhotos(db,owner,[path,owner+'/new.jpg'],options);assert.equal(signs,2);assert.equal(downloads,2);
 assert.equal((await cachedAuthorPhotos(db,'other',[path],options)).size,0);
 clearAuthorPhotoCache(owner);const renewed=await cachedAuthorPhotos(db,owner,[path],options);assert.notEqual(renewed.get(path),a.get(path));assert.equal(signs,3);clearAuthorPhotoCache(owner);clearAuthorPhotoCache('other');
});
test('photo download failures reuse the signed URL instead of repeatedly fetching on view switches',async()=>{
 const owner='fallback-owner',path=owner+'/a.jpg';let calls=0;const db={storage:{from:()=>({createSignedUrls:async()=>({data:[{path,signedUrl:'https://storage.example/a.jpg'}]})})}},options={fetcher:async()=>{calls++;throw Error('offline');}};
 assert.equal((await cachedAuthorPhotos(db,owner,[path],options)).get(path),'https://storage.example/a.jpg');await cachedAuthorPhotos(db,owner,[path],options);assert.equal(calls,1);clearAuthorPhotoCache(owner);
});
