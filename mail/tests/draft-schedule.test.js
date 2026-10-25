import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledDraftAt} from '../src/draft-schedule.js';

const now=Date.parse('2026-10-25T14:00:00Z');
const account={provider:'imap',config:{imap_host:'imap.exmail.qq.com'}};
const draft={folder:'drafts',received_at:'2026-10-27T14:00:00Z'};
test('future Tencent draft dates provide a display-only scheduling hint',()=>{
 assert.equal(scheduledDraftAt(draft,account,now),'2026-10-27T14:00:00.000Z');
 assert.deepEqual(draft,{folder:'drafts',received_at:'2026-10-27T14:00:00Z'});
 for(const host of ['imap.qq.com','hwimap.exmail.qq.com'])assert.ok(scheduledDraftAt(draft,{...account,config:{imap_host:host}},now));
});
test('ordinary drafts, clock tolerance, other folders and unsupported providers are never marked',()=>{
 for(const received_at of ['2026-10-24T14:00:00Z','2026-10-25T14:00:30Z','invalid',null])assert.equal(scheduledDraftAt({...draft,received_at},account,now),null);
 for(const folder of ['inbox','sent','archive','trash'])assert.equal(scheduledDraftAt({...draft,folder},account,now),null);
 for(const other of [undefined,{provider:'outlook'}, {provider:'gmail'}, {provider:'imap',config:{imap_host:'imap.example.edu'}}])assert.equal(scheduledDraftAt(draft,other,now),null);
});
