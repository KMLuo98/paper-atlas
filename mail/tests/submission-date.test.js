import test from 'node:test';
import assert from 'node:assert/strict';
import {submissionDate} from '../src/submission-date.js';

test('uses the first submission, preserving it through revision and review updates',()=>{
  assert.equal(submissionDate({publisher:'Elsevier',events:[
    {status:'submitted',date:'2026-11-08',number:'PHYSD-D-26-00001R1'},
    {status:'submitted',date:'2026-10-01',number:'PHYSD-D-26-00001'},
    {status:'under_review',date:'2026-11-10'}
  ]}),'2026-10-01T00:00:00.000Z');
});
test('reads the original APS received date from the Open column, not Closed',()=>{
  assert.equal(submissionDate({publisher:'APS',events:[{status:'submitted',date:'2026-11-02'}],publisher_history:{tables:[
    {headers:['Open','Closed','Description'],rows:[['01Nov2026','02Nov2026','Manuscript received'],['10Nov2026','11Nov2026','Revised manuscript received']]}
  ]}}),'2026-11-01T00:00:00.000Z');
});
test('does not mistake a revision, review, query or creation timestamp for submission',()=>{
  assert.equal(submissionDate({publisher:'Elsevier',created_at:'2026-01-01',last_checked_at:'2026-11-21',events:[
    {status:'submitted',raw_status:'Revised manuscript submitted',date:'2026-10-01'},
    {status:'under_review',date:'2026-11-01'}
  ]}),'');
  assert.equal(submissionDate({publisher:'AIP Publishing',events:[{status:'submitted',number:'CHA26-AR-02425R',date:'2026-11-01'}]}),'');
});
test('keeps the earliest valid documented date and ignores invalid values',()=>{
  assert.equal(submissionDate({submitted_at:'invalid',submission_date:'2026-09-01',events:[{status:'submitted',date:'2026-09-02'}]}),'2026-09-01T00:00:00.000Z');
  assert.equal(submissionDate({}),'');
});
