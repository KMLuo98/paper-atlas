import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthSessionStorage,invokeWithSessionRetry,apiFailure} from '../src/auth-request.js';

function storage(entries=[]) {
  const items = new Map(entries);
  return {getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key)};
}

test('a remembered session survives reopening even when the old shared preference was off', () => {
  const key='sb-project-auth-token',remembered=storage([['pa-remember','false']]);
  createAuthSessionStorage(remembered,storage(),key).setItem(key,'remembered-token');
  const reopened=createAuthSessionStorage(remembered,storage(),key);
  assert.equal(reopened.getItem(key),'remembered-token');
  reopened.removeItem(key);
  assert.equal(createAuthSessionStorage(remembered,storage(),key).getItem(key),null);
});

test('an unchecked login stays in its own tab and cannot erase another tab’s remembered session', () => {
  const key='sb-project-auth-token',remembered=storage([[key,'remembered-token']]),tab=storage([[key,'legacy-tab-token']]);
  const current=createAuthSessionStorage(remembered,tab,key);
  assert.equal(current.getItem(key),'legacy-tab-token');
  current.remember(false);
  current.setItem(key,'tab-token');
  assert.equal(createAuthSessionStorage(remembered,tab,key).getItem(key),'tab-token');
  current.removeItem(key);
  assert.equal(current.getItem(key),null);
  assert.equal(createAuthSessionStorage(remembered,storage(),key).getItem(key),'remembered-token');
  current.remember(true);
  assert.equal(current.getItem(key),'remembered-token');
});
function client(status, session = {}, refreshed = {data:{session:{}}}) {
  const calls=[];
  return {calls,functions:{async invoke(name, options){calls.push('invoke');assert.equal(options.body.action,'analyze');return calls.filter(x=>x==='invoke').length===1?{error:{context:{status}}}:{data:{paper:{status:'ready'}}};}},auth:{async getSession(){calls.push('session');return {data:{session}};},async refreshSession(){calls.push('refresh');return refreshed;}}};
}
test('a rejected stale session is refreshed once before retrying AI', async () => {
  const db=client(401);assert.equal((await invokeWithSessionRetry(db,{body:{action:'analyze'}})).data.paper.status,'ready');
  assert.deepEqual(db.calls,['invoke','session','refresh','invoke']);
});
test('anonymous rejections never refresh or replay a request', async () => {
  const db=client(401,null);await invokeWithSessionRetry(db,{body:{action:'analyze'}});assert.deepEqual(db.calls,['invoke','session']);
});
test('revoked refresh tokens require a new login instead of replaying AI', async () => {
  const db=client(401,{}, {data:{session:null},error:new Error('revoked')});await assert.rejects(invokeWithSessionRetry(db,{body:{action:'analyze'}}),/重新登录/);assert.deepEqual(db.calls,['invoke','session','refresh']);
});
test('permission, rate limit and upstream errors do not repeat AI requests', async () => {
  for(const status of [403,429,502,504]){const db=client(status);await invokeWithSessionRetry(db,{body:{action:'analyze'}});assert.deepEqual(db.calls,['invoke']);}
});

test('API errors preserve explicit rate-limit status and cooldown for the batch queue', async () => {
  const error=await apiFailure({message:'HTTP error',context:Response.json({error:'Please wait'},{status:429,headers:{'Retry-After':'17'}})});
  assert.equal(error.status,429);assert.equal(error.retryAfter,17);assert.equal(error.message,'Please wait');
  const unknown=await apiFailure({message:'Network failure'});assert.equal(unknown.status,undefined);assert.equal(unknown.message,'Network failure');
});
