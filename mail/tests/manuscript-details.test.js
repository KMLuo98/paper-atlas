import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {applyObservation,reconcileManuscripts,publisherForJournal,submissionRound,acceptedBefore,recordMetrics,ruleExtract,rawStatistics,statistics,manuscriptKey,canonicalNumber,applyPublisherMetadata,bulkManuscriptAction} from '../../supabase/functions/manuscripts-api/core.js';
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
  return Response.json({Status:3,LastUpdated:1795083397,LatestRevisionNumber:1,PubdNumber:'PHYSA-D-26-12345',FirstAuthor:'A. Author',CorrespondingAuthor:'B. Author',ReviewSummary:{ReviewsCompleted:'0',ReviewInvitationsAccepted:'2+',ReviewInvitationsSent:'3'}});
 };
 try{
  const result=await fetchElsevierStatus('https://track.authorhub.elsevier.com/?uuid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(result.metrics.invitations_accepted,'2+');
  assert.equal(result.metrics.reviews_completed,'0');
  assert.equal(result.metrics.invitations_sent,'3');
  assert.ok(result.metrics.last_review_activity);
  assert.equal(result.authors,'A. Author, B. Author');
  const metadata={publisher:'Elsevier',number:'PHYSA-D-26-12345R1',authors:''};
  applyPublisherMetadata(metadata,result);
  assert.equal(metadata.authors,'A. Author, B. Author');
  assert.equal(metadata.authors_partial,true);
  metadata.manual_fields=['authors'];metadata.authors='Edited author';
  applyPublisherMetadata(metadata,result);assert.equal(metadata.authors,'Edited author');
  const other={publisher:'Elsevier',number:'PHYSA-D-26-54321',authors:''};
  applyPublisherMetadata(other,result);assert.equal(other.authors,'');
  const item={number:'PHYSA-D-26-12345R1',events:[]};
  recordMetrics(item,result.metrics,result.metric_date);
  recordMetrics(item,result.metrics,result.metric_date);
  assert.equal(item.metric_history.length,1);
  assert.equal(submissionRound(item),2);
 }finally{globalThis.fetch=original;}
});

test('Chaos aliases and bare-R revisions reconcile four legacy rows and keep their full history',()=>{
 const base={publisher:'AIP Publishing',title:'Functional network relaxation',manual_fields:[],created_at:'2026-10-01',events:[]};
 const data={stats_offsets:{Chaos:{total:2,active:1}},tombstones:[],manuscripts:[
  {...base,id:'original-short',journal:'Chaos',number:'CHA26-AR-01234',status:'under_review',status_at:'2026-10-02',events:[{source_id:'original',source:'email',date:'2026-10-02',status:'under_review',raw_status:'Review'}]},
  {...base,id:'original-full',journal:'Chaos: An Interdisciplinary Journal of Nonlinear Science',number:'CHA26-AR-01234',status:'major_revision',status_at:'2026-10-05',events:[{source_id:'decision',source:'email',date:'2026-10-05',status:'major_revision',raw_status:'Major revision'}]},
  {...base,id:'revised-full',journal:'Chaos: An Interdisciplinary Journal of Nonlinear Science',number:'CHA26-AR-01234R',authors:'A. Author, B. Author',status:'submitted',status_at:'2026-10-06',events:[{source_id:'revision',source:'email',date:'2026-10-06',status:'submitted',raw_status:'Received'}]},
  {...base,id:'revised-short',journal:'Chaos',number:'CHA26-AR-01234R',authors:'A. Author, B. Author',status:'revised_submitted',status_at:'2026-10-07',events:[{source_id:'confirmation',source:'email',date:'2026-10-07',status:'revised_submitted',raw_status:'Receipt of Revised MS'}]},
  {...base,id:'erratum',journal:'Chaos',number:'CHA26-ER-01234',status:'accepted'},
  {...base,id:'other-journal',publisher:'Elsevier',journal:'Chaos, Solitons and Fractals',number:'CHA26-AR-01234',status:'rejected'}
 ]};
 reconcileManuscripts(data);
 assert.equal(data.manuscripts.length,3);
 const item=data.manuscripts.find(item=>item.number==='CHA26-AR-01234R');
 assert.equal(item.events.length,4);assert.equal(item.status,'revised_submitted');
 assert.equal(item.authors,'A. Author, B. Author');assert.equal(submissionRound(item),2);
 assert.equal(item.merged_ids.length,3);assert.equal(statistics(data).length,2);
 assert.equal(statistics(data).find(row=>row.journal.startsWith('Chaos:')).total,4); // two real records plus the saved adjustment
 const stable=JSON.stringify(data);reconcileManuscripts(data);assert.equal(JSON.stringify(data),stable);
 applyObservation(data,{...base,journal:'Chaos',number:'CHA26-AR-01234',date:'2026-10-08',status:'under_review',source:'email',source_id:'new-update'});
 assert.equal(data.manuscripts.length,3);assert.equal(item.number,'CHA26-AR-01234R');
 assert.equal(canonicalNumber('CHA26-AR-01234R2','AIP Publishing'),'CHA26-AR-01234');
});

test('journal aliases cannot revive a permanently deleted revision and merging preserves manual edits',()=>{
 const journal='Chaos: An Interdisciplinary Journal of Nonlinear Science';
 const data={tombstones:['aip publishing|chaos|CHA26-AR-01234R'],stats_offsets:{},manuscripts:[]};
 reconcileManuscripts(data);
 applyObservation(data,{publisher:'AIP Publishing',journal,number:'CHA26-AR-01234',date:'2026-11-01',status:'submitted'});
 assert.equal(data.manuscripts.length,0);
 const base={publisher:'AIP Publishing',number:'CHA26-AR-54321',created_at:'2026-10-01',events:[]};
 data.manuscripts=[{...base,id:'manual',journal:'Chaos',authors:'My corrected authors',title:'Correct title',manual_fields:['authors','title'],archived_at:'2026-11-01'},
 {...base,id:'automatic',journal,number:'CHA26-AR-54321R',title:'Automatic title',authors:'Incomplete',status_at:'2026-11-02'}];
 reconcileManuscripts(data);assert.equal(data.manuscripts.length,1);
 assert.equal(data.manuscripts[0].id,'manual');assert.equal(data.manuscripts[0].authors,'My corrected authors');
 assert.ok(data.manuscripts[0].archived_at);assert.equal(data.manuscripts[0].key,manuscriptKey(data.manuscripts[0]));
});

test('batch restore handles archive and trash atomically and resumes future updates',()=>{
 const data={cursor:{id:'old'},last_day:'2026-11-21',manuscripts:[{id:'a',archived_at:'2026-11-01'},{id:'b',archived_at:'2026-11-02'},{id:'c',deleted_at:'2026-11-03'},{id:'active'}]};
 const before=JSON.stringify(data);
 assert.throws(()=>bulkManuscriptAction(data,'restore',['a','c'],'archived'));assert.equal(JSON.stringify(data),before);
 assert.throws(()=>bulkManuscriptAction(data,'restore',['a','missing'],'archived'));assert.equal(JSON.stringify(data),before);
 bulkManuscriptAction(data,'restore',['a','b'],'archived');
 assert.ok(data.manuscripts.slice(0,2).every(item=>!item.archived_at&&!item.deleted_at&&item.last_checked_day===''));
 assert.equal(data.cursor,null);assert.equal(data.last_day,'');
 bulkManuscriptAction(data,'restore',['c'],'trash');assert.equal(data.manuscripts[2].deleted_at,null);
 assert.throws(()=>bulkManuscriptAction(data,'restore',['active'],'trash'));
});
test('post-acceptance production counts as accepted and retains archive congratulations eligibility',()=>{
 const item={journal:'Physical Review E',status:'copyediting',events:[{status:'accepted'}],number:'LA12345'};
 assert.equal(acceptedBefore(item),true);
 assert.equal(rawStatistics({manuscripts:[item]})['Physical Review E'].accepted,1);
 assert.equal(submissionRound({number:'PHYSA-D-26-12345R2',events:[]}),3);
});
