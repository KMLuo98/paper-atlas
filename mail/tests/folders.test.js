import test from 'node:test';
import assert from 'node:assert/strict';
import {folderKey,imapFolders,priorFolderState,selectSyncFolders,syncImapFolder} from '../../supabase/functions/mail-api/folders.js';

test('remote folder discovery recognizes system flags and Chinese names without selecting parent containers',()=>{
 const list=imapFolders([{path:'INBOX',name:'Inbox'},{path:'已发送',name:'已发送'},{path:'Server/Drafts',name:'Drafts',specialUse:'\\Drafts'},{path:'垃圾邮件',name:'垃圾邮件'},{path:'Trash',specialUse:'\\Trash'},{path:'Projects',flags:new Set(['\\Noselect'])},{path:'Projects/Research',name:'Research'},{path:'[Gmail]/All Mail',specialUse:'\\All'}]);
 assert.deepEqual(list.map(f=>f.kind),['inbox','sent','drafts','spam','trash','custom','custom']);assert.ok(!list.some(f=>f.path==='Projects'));
});
test('background sync prioritizes sent mail and rotates other folders, with independent inbox migration',()=>{
 const f=imapFolders([{path:'INBOX'},{path:'Sent',specialUse:'\\Sent'},{path:'Drafts',specialUse:'\\Drafts'}]);const legacy={uid_validity:'99',last_uid:1285,oldest_uid:1254,has_older:true};
 assert.equal(priorFolderState(legacy,f[0]).last_uid,1285);assert.deepEqual(priorFolderState(legacy,f[1]),{});assert.deepEqual(selectSyncFolders(f,legacy).map(x=>x.kind),['inbox','sent']);
 const state={folder_states:{[folderKey('Sent')]:{last_sync:'2026-10-21T00:00:00Z'}}};assert.deepEqual(selectSyncFolders(f,state).map(x=>x.kind),['inbox','drafts']);assert.deepEqual(selectSyncFolders(f,state,'sent').map(x=>x.path),['Sent']);
});
function clientFor(messages){const events=[];return {events,mailbox:{uidValidity:123n,exists:messages.length},async getMailboxLock(path,options){events.push(['open',path,options]);return{release(){events.push(['release']);}};},async search(query){events.push(['search',query]);if(query.all)return messages.map(m=>m.uid);const [lo,hi]=query.uid.split(':');return messages.filter(m=>m.uid>=Number(lo)&&(hi==='*'||m.uid<=Number(hi))).map(m=>m.uid);},async fetchOne(id,query){const m=messages.find(m=>m.uid===id);return query.size?{size:100}:m;},async*fetch(){for(const m of messages)yield m;}};}
test('sent mail is fetched from its actual remote path and classified as sent rather than inbox',async()=>{
 const c=clientFor([{uid:7,source:new Uint8Array([65]),flags:new Set(['\\Seen'])},{uid:8,source:new Uint8Array([66]),flags:new Set(['\\Flagged'])}]);const accepted=[];
 const result=await syncImapFolder(c,{path:'已发送',kind:'sent'}, {},async(...args)=>accepted.push(args));assert.equal(c.events[0][1],'已发送');assert.equal(c.events[0][2].readOnly,true);assert.equal(accepted.length,2);assert.equal(accepted[0][0],'已发送|123:7');assert.equal(accepted[0][3],'已发送');assert.equal(accepted[0][4],'sent');assert.equal(accepted[0][2].read,true);assert.equal(result.last_uid,8);assert.equal(result.oldest_uid,7);assert.equal(c.events.at(-1)[0],'release');
});
test('older-mail loading uses the selected folder cursor and keeps its newest UID',async()=>{
 const c=clientFor([1,2,3,4,10].map(uid=>({uid,source:new Uint8Array([65]),flags:new Set()})));const accepted=[];const state={uid_validity:'123',last_uid:10,oldest_uid:5};const result=await syncImapFolder(c,{path:'Sent',kind:'sent'},state,async(id)=>accepted.push(id),{older:true,limit:2});assert.deepEqual(accepted,['Sent|123:4','Sent|123:3']);assert.equal(result.last_uid,10);assert.equal(result.oldest_uid,3);assert.equal(result.has_older,true);
});
test('a failed message save releases the mailbox and does not advance beyond saved messages',async()=>{
 const c=clientFor([1,2].map(uid=>({uid,source:new Uint8Array([65]),flags:new Set()})));const state={};await assert.rejects(syncImapFolder(c,{path:'Sent',kind:'sent'},state,async(id)=>{if(id.endsWith(':2'))throw Error('storage unavailable');}),/storage unavailable/);assert.equal(state.last_uid,1);assert.equal(c.events.at(-1)[0],'release');
});
