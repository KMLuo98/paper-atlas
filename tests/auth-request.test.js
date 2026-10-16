import test from 'node:test';
import assert from 'node:assert/strict';
import {invokeWithSessionRetry} from '../src/auth-request.js';
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
