import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {applyObservation,reconcileManuscripts,publisherForJournal,submissionRound,acceptedBefore,recordMetrics,ruleExtract,rawStatistics} from '../../supabase/functions/manuscripts-api/core.js';
import {parsePublisherHistory,fetchElsevierStatus} from '../../supabase/functions/manuscripts-api/publishers.js';

test('APS promotes a temporary code to its formal code without adding a submission',()=>{
 const data={manuscripts:[],tombstones:[],stats_offsets:{}};
 const base={publisher:'APS',journal:'Physical Review E',title:'A long title about coupled network dynamics',authors:'A. Author',lookup_author:'Author',status:'submitted',date:'2026-11-02',source:'email',source_id:'temporary'};
 applyObservation(data,{...base,number:'es2026nov01_123'});
 applyObservation(data,{...base,number:'LA12345',source_id:'formal',date:'2026-11-03'});
 assert.equal(data.manuscripts.length,1);
 assert.equal(data.manuscripts[0].number,'LA12345');
 assert.equal(data.manuscripts[0].events[0].number,'es2026nov01_123');
 assert.equal(data.manuscripts[0].number_history.length,2);
 assert.match(data.manuscripts[0].tracking_url,/accode=LA12345/);
 applyObservation(data,{...base,number:'es2026nov01_123',date:'2026-11-04',source_id:'old-code'});
 assert.equal(data.manuscripts[0].number,'LA12345');
});
test('existing duplicate APS entries are reconciled without merging different formal codes',()=>{
 const base={publisher:'APS',journal:'Physical Review E',title:'A long title about coupled network dynamics',created_at:'2026-11-01',events:[]};
 const data={manuscripts:[{...base,id:'temp',number:'es2026nov01_123'},{...base,id:'formal',number:'LA12345'},{...base,id:'another',number:'LA54321'}]};
 reconcileManuscripts(data);
 assert.equal(data.manuscripts.length,2);
 assert.equal(data.manuscripts.find(item=>item.id==='formal').number_history.length,2);
});
test('publisher identification distinguishes AIP Chaos from Elsevier Chaos Solitons and Fractals',()=>{
 assert.equal(publisherForJournal('Chaos: An Interdisciplinary Journal of Nonlinear Science','Elsevier'),'AIP Publishing');
 assert.equal(publisherForJournal('Chaos, Solitons and Fractals','Elsevier'),'Elsevier');
 const result=ruleExtract({from_email:'cha-edoffice@aip.org',subject:'Receipt of manuscript'},'Manuscript number: CHA26-AR-12345\nUpdate ORCID https://chaos.peerx-press.org/cgi-bin/main.plex?el=orcid\nCheck Manuscript Status link at the following URL:\nhttps://chaos.peerx-press.org/cgi-bin/main.plex?el=status');
 assert.match(result.tracking_url,/el=status$/);
});
test('APS table retains both date columns and rows with an empty closing date',()=>{
 const html='<html><body><dl><dt>Status:</dt><dd>With author(s)</dd></dl><table id="history-table"><tr><th>Open</th><th>Closed</th><th>Description</th></tr><tr><td>10Nov2026</td><td></td><td>Editorial decision sent to author</td></tr></table></body></html>';
 const result=parsePublisherHistory(html,parseHTML);
 assert.deepEqual(result.tables[0].headers,['Open','Closed','Description']);
 assert.deepEqual(result.tables[0].rows[0],['10Nov2026','','Editorial decision sent to author']);
 assert.equal(result.status_text,'With author(s)');
 assert.equal(result.events[0].status,'decision_sent');
});
test('Elsevier official tracker response preserves all four review metrics and revision',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert.ok(String(url).startsWith('https://tnlkuelk67.execute-api.us-east-1.amazonaws.com/tracker/'));
  return Response.json({Status:3,LastUpdated:1795083397,LatestRevisionNumber:1,ReviewSummary:{ReviewsCompleted:'0',ReviewInvitationsAccepted:'2+',ReviewInvitationsSent:'3'}});
 };
 try{
  const result=await fetchElsevierStatus('https://track.authorhub.elsevier.com/?uuid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(result.metrics.invitations_accepted,'2+');
  assert.equal(result.metrics.reviews_completed,'0');
  assert.equal(result.metrics.invitations_sent,'3');
  assert.ok(result.metrics.last_review_activity);
  const item={number:'PHYSA-D-26-12345R1',events:[]};
  recordMetrics(item,result.metrics,result.metric_date);
  recordMetrics(item,result.metrics,result.metric_date);
  assert.equal(item.metric_history.length,1);
  assert.equal(submissionRound(item),2);
 }finally{globalThis.fetch=original;}
});
test('post-acceptance production counts as accepted and retains archive congratulations eligibility',()=>{
 const item={journal:'Physical Review E',status:'copyediting',events:[{status:'accepted'}],number:'LA12345'};
 assert.equal(acceptedBefore(item),true);
 assert.equal(rawStatistics({manuscripts:[item]})['Physical Review E'].accepted,1);
 assert.equal(submissionRound({number:'PHYSA-D-26-12345R2',events:[]}),3);
});
