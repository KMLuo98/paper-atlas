import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {photoKey} from '../../supabase/functions/mail-api/photos.js';
const source=readFileSync(new URL('../../supabase/functions/mail-api/index.ts',import.meta.url),'utf8');
const code=stripTypeScriptTypes(source.slice(source.indexOf('async function lookupPhoto('),source.indexOf('async function autoPhoto(')));
function harness(contact,result){let searches=0,uploads=0;const writes=[];
 const service={from(){let patch;const q={update(p){patch=p;return q;},eq(){return q;},or(){return q;},select:async()=>{writes.push(patch);Object.assign(contact,patch);return [{id:contact.id}];},then(resolve){writes.push(patch);Object.assign(contact,patch);resolve({data:null,error:null});}};return q;},storage:{from(){return{upload:async()=>{uploads++;return {error:null};},remove:async()=>({error:null})};}}};
 const context={service,photoKey,parseHTML(){},findContactPhoto:async()=>{searches++;return result;},checked:async p=>{const r=await p;return Array.isArray(r)?r:r.data;},Date,crypto,HTTPError:Error};vm.runInNewContext(code+'\nglobalThis.lookup=lookupPhoto;',context);
 return {lookup:retry=>context.lookup('owner',contact,retry),writes,counts:()=>({searches,uploads})};
}
test('a failed portrait match persists and is reused on the next request',async()=>{
 const c={id:'c',name:'林明',email:'mlin@example.edu',organization:'University',photo_path:''};const h=harness(c,{status:'not_found'});await h.lookup();assert.equal(c.photo_lookup_status,'not_found');assert.equal(c.photo_lookup_key,photoKey(c));assert.ok(c.photo_lookup_at);assert.equal((await h.lookup()).cached,true);assert.equal(h.counts().searches,1);assert.equal(h.counts().uploads,0);await h.lookup(true);assert.equal(h.counts().searches,2);
});
test('a positive portrait match uploads once and reuses the saved avatar',async()=>{
 const c={id:'c',name:'林明',email:'mlin@example.edu',organization:'University',photo_path:''};const h=harness(c,{status:'found',bytes:new Uint8Array([1]),mime:'image/jpeg',source:'https://example.edu/people/mlin'});await h.lookup();assert.match(c.photo_path,/owner\/avatars\/c\//);assert.equal(c.photo_source_url,'https://example.edu/people/mlin');await h.lookup();assert.deepEqual(h.counts(),{searches:1,uploads:1});
});
test('manually uploaded portraits are never overwritten by automatic lookup',async()=>{
 const c={id:'c',name:'林明',email:'mlin@example.edu',organization:'University',photo_path:'manual/upload',photo_source:'manual'};const h=harness(c,{status:'found'});assert.equal((await h.lookup(true)).status,'saved');assert.deepEqual(h.counts(),{searches:0,uploads:0});assert.equal(h.writes.length,0);
});
