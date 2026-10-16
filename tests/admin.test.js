import test from 'node:test';
import assert from 'node:assert/strict';
import {adminAction} from '../supabase/functions/_shared/admin.js';
class HTTPError extends Error {constructor(status,message){super(message);this.status=status;}}
function fixture(role={must_change_password:false}) {
  const calls=[], docs=new Map([['paper-a',{id:'paper-a',file_path:'owner-a/paper-a.pdf'}],['paper-b',{id:'paper-b',file_path:'owner-b/paper-b.pdf'}]]);
  const service={from(table){let selected;return {select(){return this;},eq(key,value){selected=value;return this;},async maybeSingle(){return {data:table==='admin_users'?(selected==='admin-id'?role:null):docs.get(selected),error:null};},delete(){return {async eq(key,id){calls.push(['delete-record',id]);docs.delete(id);return {error:null};}};}};},auth:{admin:{getUserById:async()=>({data:{user:{email:'qa@example.invalid'}}}),deleteUser:async id=>{calls.push(['delete-user',id]);return {error:null};}}},storage:{from(bucket){return {list:async prefix=>{calls.push(['list',bucket,prefix]);return {data:[]};},remove:async paths=>{calls.push(['remove-files',...paths]);return {error:null};}};}}};
  return {service,calls,docs,createAuth:()=>({auth:{signInWithPassword:async({password})=>password==='qa-password'?{data:{user:{id:'admin-id'}},error:null}:{data:{user:null},error:new Error('bad password')},signOut:async()=>({error:null})}})};
}
const run=(f,body)=>adminAction({...f,userId:'admin-id',action:body.action,body,limit:async()=>{},HTTPError});
test('non-admin users cannot gain management access through request fields',async()=>{
  const f=fixture(null);await assert.rejects(run(f,{action:'admin_delete_paper',is_admin:true,confirmation:'DELETE_PAPER',password:'qa-password',paper_id:'paper-a'}),error=>error.status===403);assert.deepEqual(f.calls,[]);
});
test('the initial password requirement blocks management before any destructive action',async()=>{
  const f=fixture({must_change_password:true});await assert.rejects(run(f,{action:'admin_delete_paper',confirmation:'DELETE_PAPER',password:'qa-password',paper_id:'paper-a'}),error=>error.status===403);assert.deepEqual(f.calls,[]);
});
test('admin deletion reauthenticates and removes only the explicitly selected paper',async()=>{
  const f=fixture();assert.deepEqual(await run(f,{action:'admin_delete_paper',confirmation:'DELETE_PAPER',password:'qa-password',paper_id:'paper-a'}),{ok:true});
  assert(f.docs.has('paper-b'));assert(!f.docs.has('paper-a'));assert.deepEqual(f.calls,[['remove-files','owner-a/paper-a.pdf'],['delete-record','paper-a']]);
});
test('wrong admin password and missing confirmation leave all records intact',async()=>{
  for(const body of [{confirmation:'DELETE_PAPER',password:'wrong'},{confirmation:'',password:'qa-password'}]){const f=fixture();await assert.rejects(run(f,{action:'admin_delete_paper',paper_id:'paper-a',...body}));assert.equal(f.docs.size,2);assert.deepEqual(f.calls,[]);}
});
test('administrator user deletion is restricted to the chosen non-admin target',async()=>{
  const f=fixture(), target='12345678-1234-1234-1234-123456789012';await run(f,{action:'admin_delete_user',user_id:target,confirmation:'DELETE_USER',password:'qa-password'});
  assert.deepEqual(f.calls,[['list','papers',target],['list','avatars',target],['delete-user',target]]);
});
