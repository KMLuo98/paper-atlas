import test from 'node:test';
import assert from 'node:assert/strict';
import {applyObservation,applyPublisherStatus,resolveManuscriptStatus,progressUpdatedAt} from '../../supabase/functions/manuscripts-api/core.js';

const event=(status,date,source='email',number='PHYSD-D-26-00001')=>({status,date,source,number,source_id:source+status+date});
const item=(events,status='unknown')=>({publisher:'Elsevier',journal:'Physica D',number:'PHYSD-D-26-00001',status,events});
const portal=(status,date)=>({current_status:status,status_text:status,events:date?[event(status,date,'website')]:[],fetched_at:'2099-01-01T00:00:00Z'});

test('a recent decision email wins over an older publisher response, regardless of query time',()=>{
 const manuscript=item([event('under_review','2026-11-01','website'),event('major_revision','2026-11-20')]);
 applyPublisherStatus(manuscript,portal('under_review','2026-11-19'));
 assert.equal(manuscript.status,'major_revision');assert.equal(manuscript.status_source,'email');
 assert.equal(manuscript.status_at,'2026-11-20');
 assert.equal(progressUpdatedAt(manuscript),'2026-11-20T00:00:00.000Z');
});
test('a website checked after a decision cannot replace that decision with generic text from the same round',()=>{
 for(const status of ['major_revision','minor_revision','rejected','accepted'])for(const generic of ['with_author','decision_sent','under_review']){
  const manuscript=item([event(status,'2026-11-20')]);
  applyPublisherStatus(manuscript,portal(generic,'2026-11-21'));
  assert.equal(manuscript.status,status,status+' / '+generic);
 }
});
test('a genuine revised submission allows the next round to progress on the publisher site',()=>{
 const manuscript=item([event('major_revision','2026-11-10'),event('revised_submitted','2026-11-18','email','PHYSD-D-26-00001R1')]);
 applyPublisherStatus(manuscript,{...portal('under_review','2026-11-21'),metrics:{revision:1}});
 assert.equal(manuscript.status,'under_review');assert.equal(manuscript.status_source,'website');
 assert.equal(manuscript.status_at,'2026-11-21T00:00:00.000Z');
});
test('later dated publisher decisions and later decision emails are both eligible',()=>{
 const manuscript=item([event('under_review','2026-11-10')]);
 applyPublisherStatus(manuscript,portal('accepted','2026-11-21'));
 assert.equal(manuscript.status,'accepted');
 manuscript.events.push(event('proofs','2026-11-22'));
 resolveManuscriptStatus(manuscript);assert.equal(manuscript.status,'proofs');assert.equal(manuscript.status_source,'email');
});
test('equal timestamps prefer explicit email decisions, with a deliberate manual edit taking precedence',()=>{
 const manuscript=item([event('with_author','2026-11-21','website'),event('minor_revision','2026-11-21')]);
 applyPublisherStatus(manuscript,portal('with_author','2026-11-21'));assert.equal(manuscript.status,'minor_revision');
 manuscript.events.push(event('under_review','2026-11-21','manual'));
 resolveManuscriptStatus(manuscript);assert.equal(manuscript.status,'under_review');assert.equal(manuscript.status_source,'manual');
});
test('undated portal text cannot override email decisions, but a clear forward stage can still be shown',()=>{
 const manuscript=item([event('rejected','2026-11-21')]);
 applyPublisherStatus(manuscript,portal('under_review'));assert.equal(manuscript.status,'rejected');
 const fresh=item([event('submitted','2026-11-21')]);applyPublisherStatus(fresh,portal('with_editor'));
 assert.equal(fresh.status,'with_editor');assert.equal(progressUpdatedAt(fresh),'2026-11-21T00:00:00.000Z');
 const decided=item([event('under_review','2026-11-21')]);applyPublisherStatus(decided,portal('accepted'));
 assert.equal(decided.status,'accepted');assert.equal(decided.status_at,'');
});
test('unknown notifications stay in history without erasing a known decision',()=>{
 const manuscript=item([event('major_revision','2026-11-20')]),data={manuscripts:[manuscript]};
 applyObservation(data,{...manuscript,status:'unknown',date:'2026-11-22',source:'email',source_id:'generic-notification'});
 assert.equal(manuscript.status,'major_revision');assert.equal(manuscript.events.length,2);
 applyPublisherStatus(manuscript,{current_status:'unknown',fetched_at:'2099-01-01'});
 assert.equal(manuscript.status,'major_revision');
});
test('re-resolving persisted history repairs a status previously overwritten by the portal',()=>{
 const manuscript=item([event('under_review','2026-11-10','website'),event('rejected','2026-11-21')],'under_review');
 resolveManuscriptStatus(manuscript);assert.equal(manuscript.status,'rejected');assert.equal(manuscript.status_source,'email');
});
