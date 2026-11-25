import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledTime,deliverScheduled} from '../../supabase/functions/scheduled-mail/queue.js';

test('scheduling requires an explicit timezone and a future time, with a one-year bound',()=>{
 const now=Date.parse('2026-11-26T00:00:00Z');
 assert.equal(scheduledTime('2026-11-26T09:00:00+08:00',now),'2026-11-26T01:00:00.000Z');
 for(const value of ['2026-11-26T00:00','2026-11-26T00:00:59Z','invalid','2028-01-01T00:00:00Z'])assert.throws(()=>scheduledTime(value,now));
});
function fixture(fail){
 const calls=[];return {calls,io:{
  prepare:async()=>{calls.push('prepare');if(fail==='prepare')throw Error('Authorization expired');return {raw:'durable MIME with attachments'};},
  begin:async()=>{calls.push('begin');return fail!=='claim';},
  send:async prepared=>{assert.match(prepared.raw,/attachments/);calls.push('send');if(fail==='send')throw Error('Lost SMTP response');return {accepted:['synthetic@example.org']};},
  finish:async(_row,status)=>calls.push(status),
  saveCopy:async()=>{calls.push('copy');if(fail==='copy')throw Error('Storage down');},
  warning:async()=>calls.push('warning')
 }};
}
test('background delivery records acceptance before saving its sent copy',async()=>{
 const h=fixture();assert.equal((await deliverScheduled({},h.io)).status,'sent');assert.deepEqual(h.calls,['prepare','begin','send','sent','copy']);
});
test('a cancelled or reclaimed job never crosses the delivery boundary',async()=>{
 const h=fixture('claim');assert.equal((await deliverScheduled({},h.io)).status,'changed');assert.deepEqual(h.calls,['prepare','begin']);
});
test('expired credentials fail before SMTP; an uncertain SMTP response never triggers a retry',async()=>{
 const before=fixture('prepare');await deliverScheduled({},before.io);assert.deepEqual(before.calls,['prepare','failed']);
 const after=fixture('send');await deliverScheduled({},after.io);assert.deepEqual(after.calls,['prepare','begin','send','uncertain']);
});
test('a failed local copy cannot change acceptance or send the message again',async()=>{
 const h=fixture('copy');assert.equal((await deliverScheduled({},h.io)).status,'sent');assert.deepEqual(h.calls,['prepare','begin','send','sent','copy','warning']);
});
