import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function openMail(id)'),source.indexOf('\nasync function patchMessage'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(){
 const patch=deferred(),get=deferred(),messages=[{id:'a',is_read:false},{id:'b',is_read:false}];
 const S={user:{id:'owner'},view:'inbox',current:null,messages,language:'zh'},toasts=[],errors=[];
 let bootstraps=0,clears=0,renders=0;
 const deps={S,api:async(action)=>action==='get'?get.promise:patch.promise,pageSnapshot:()=>({state:{...S}}),pageKey:state=>state.view+':'+(state.current?.id||''),rememberPage(){},render(){renders++;},window:{scrollTo(){}},toast:message=>toasts.push(message),cache:()=>({clear(){clears++;}}),bootstrap:async()=>{bootstraps++;if(deps.bootstrapError)throw deps.bootstrapError;},error:error=>errors.push(error)};
 const open=new Function('deps','const {S,api,pageSnapshot,pageKey,rememberPage,render,window,toast,cache,bootstrap,error}=deps;let mailOpenRequest=0;return '+code)(deps);
 return {S,patch,get,open,toasts,errors,deps,counts:()=>({bootstraps,clears,renders})};
}
async function opened(h){
 const running=h.open('a');h.get.resolve({message:{id:'a',is_read:false},translations:{}});
 await new Promise(resolve=>setImmediate(resolve));return {running,mail:h.S.current};
}

test('returning to the list during read synchronization does not access a cleared current message',async()=>{
 const h=harness(),{running,mail}=await opened(h);
 h.S.current=null;h.S.view='inbox';h.patch.resolve({ok:true});await running;
 assert.equal(h.S.current,null);assert.equal(mail.is_read,true);assert.equal(h.S.messages[0].is_read,true);
 assert.deepEqual(h.toasts,[]);assert.deepEqual(h.errors,[]);assert.equal(h.counts().clears,1);
});
test('a delayed read acknowledgement updates the opened message without marking another message read',async()=>{
 const h=harness(),{running}=await opened(h);
 h.S.current={id:'b',is_read:false};h.patch.resolve({ok:true});await running;
 assert.equal(h.S.current.is_read,false);assert.equal(h.S.messages[0].is_read,true);assert.equal(h.S.messages[1].is_read,false);
 assert.deepEqual(h.toasts,[]);
});
test('logout or account switching discards late read acknowledgements',async()=>{
 for(const user of [null,{id:'another-owner'}]){
  const h=harness(),{running}=await opened(h);h.S.user=user;h.S.current=null;
  h.patch.resolve({ok:true});await running;
  assert.equal(h.counts().bootstraps,0);assert.equal(h.counts().clears,0);assert.deepEqual(h.toasts,[]);
 }
});
test('late mail bodies cannot reopen a page after navigation or logout',async()=>{
 for(const leave of [h=>{h.S.view='contacts';},h=>{h.S.user=null;}]){
  const h=harness(),running=h.open('a');leave(h);
  h.get.resolve({message:{id:'a',is_read:false}});await running;
  assert.equal(h.counts().renders,0);assert.equal(h.S.current,null);
 }
});
test('metadata refresh errors do not produce a false read synchronization failure',async()=>{
 const h=harness(),{running}=await opened(h);h.deps.bootstrapError=new Error('Metadata unavailable');
 h.patch.resolve({ok:true});await running;
 assert.equal(h.S.current.is_read,true);assert.deepEqual(h.toasts,[]);assert.equal(h.errors.length,1);
});
test('genuine read API failures still show the server error and preserve unread state',async()=>{
 const h=harness(),{running}=await opened(h);h.patch.reject(new Error('IMAP error'));await running;
 assert.equal(h.S.current.is_read,false);assert.equal(h.toasts.length,1);assert.match(h.toasts[0],/IMAP error/);
 assert.equal(h.counts().bootstraps,0);
});
