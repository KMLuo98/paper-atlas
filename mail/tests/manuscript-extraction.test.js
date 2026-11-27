import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ruleExtract,normalizeStatus,applyObservation,unknownMailRetries,MAIL_EXTRACTION_VERSION,publisherForJournal,publisherOf,text,canonicalJournal,STATUSES,extractReviewMetrics,apsURL,cleanManuscriptNumber} from '../../supabase/functions/manuscripts-api/core.js';

const mail={id:'decision-mail',message_id:'decision-message-id',subject:'Chaos: MS #CHA26-AR-12345R Decision Letter',from_email:'cha-edoffice@aip.org',received_at:'2026-11-23T02:38:05Z'};
const body=`Your manuscript has been reviewed for publication in Chaos.
"A synthetic network manuscript"
It has been determined, however, that further review and revision may be necessary.
The revised manuscript is due no later than 10-Dec-2026.
Please use the URL below to submit your revision.
Sincerely,
Editorial Office
Manuscript #CHA26-AR-12345R:
Reviewer Comments:
Reviewer #1 Evaluations:
Overall Rating: Publish as is
I recommend acceptance of the manuscript.
Reviewer #2 Evaluations:
Overall Rating: Publish with revision optional`;

test('the editor revision request wins over reviewer recommendations without inventing a revision degree',()=>{
 const found=ruleExtract(mail,body);
 assert.equal(found.status,'revision_requested');assert.equal(found.editorial_decision,true);
 assert.equal(found.journal,'Chaos');assert.equal(found.number,'CHA26-AR-12345R');
 assert.equal(found.title,'A synthetic network manuscript');
 assert.equal(found.raw_status,'further review and revision may be necessary');
 assert.equal(normalizeStatus(found.raw_status),'revision_requested');
});
test('does not read a request in reviewer comments or quoted old correspondence as a new editorial decision',()=>{
 for(const boundary of ['Reviewer Comments:','On Monday the editor wrote:']){
  const found=ruleExtract(mail,'Manuscript #CHA26-AR-12345R:\n'+boundary+'\n'+body);
  assert.equal(found.status,'unknown');assert.equal(found.editorial_decision,false);
 }
 assert.equal(ruleExtract({...mail,subject:'Review invitation'},body),null);
});
test('submission confirmations keep their meaning',()=>{
 assert.equal(ruleExtract({...mail,subject:'Chaos: Receipt of Revised MS'},body).editorial_decision,false);
 assert.equal(normalizeStatus('Receipt of Revised MS'),'unknown');
 assert.equal(normalizeStatus('revised manuscript submitted'),'revised_submitted');
});

function extractor(ai){
 const source=readFileSync(new URL('../../supabase/functions/manuscripts-api/index.ts',import.meta.url),'utf8');
 const start=source.indexOf('async function extract('),end=source.indexOf('\nasync function refresh(',start);
 const code=source.slice(start,end).replace(/:any\b|:string\b/g,'');
 return new Function('dependencies','const {ruleExtract,modelJSON,env,bodyText,publisherForJournal,publisherOf,text,canonicalJournal,normalizeStatus,STATUSES,extractReviewMetrics,apsURL,cleanManuscriptNumber}=dependencies;return '+code)({ruleExtract,modelJSON:async()=>{if(ai instanceof Error)throw ai;return ai;},env:()=> 'test-key',bodyText:message=>message.text_body,publisherForJournal,publisherOf,text,canonicalJournal,normalizeStatus,STATUSES,extractReviewMetrics,apsURL,cleanManuscriptNumber});
}

test('AI punctuation and a code quoted elsewhere cannot replace a labelled AIP manuscript code',async()=>{
 const extract=extractor({is_submission:true,number:'CHA26-AR-54321.',journal:'Chaos',title:'Synthetic title',authors:'A. Author',status:'submitted'});
 const result=await extract({id:'mail',message_id:'synthetic',from_email:'office@aip.org',subject:'Chaos manuscript update',received_at:'2026-11-01',text_body:'Manuscript Number: CHA26-AR-12345R1.\nTitle: Synthetic title\nA quoted old code is CHA26-AR-54321.'});
 assert.equal(result.number,'CHA26-AR-12345R1');
});
test('AI unknown, reviewer acceptance, or metadata failure cannot erase a proven editorial request',async()=>{
 for(const ai of [
  {is_submission:true,number:'CHA26-AR-12345R',status:'unknown'},
  {is_submission:true,number:'CHA26-AR-12345R',status:'accepted',status_quote:'I recommend acceptance of the manuscript.',journal:'A wrong journal'},
  {is_submission:false},new Error('AI unavailable')
 ]){
  const result=await extractor(ai)({...mail,text_body:body},'user');
  assert.equal(result.status,'revision_requested');assert.equal(result.journal,canonicalJournal('Chaos'));
  assert.equal(result.publisher,'AIP Publishing');assert.equal(result.number,'CHA26-AR-12345R');
 }
});

test('reprocessing fixes the original unknown event without duplicating the email or losing prior rounds',()=>{
 const previous={id:'first-round',source:'email',source_id:'older-mail',date:'2026-11-01',status:'major_revision',number:'CHA26-AR-12345'};
 const unresolved={id:'unknown-event',source:'email',source_id:mail.message_id,message_ref:mail.id,date:mail.received_at,status:'unknown',raw_status:'Unrecognized decision',number:'CHA26-AR-12345R'};
 const manuscript={id:'paper',publisher:'AIP Publishing',journal:'Chaos',number:'CHA26-AR-12345R',events:[previous,unresolved]};
 const data={manuscripts:[manuscript]},observation={...ruleExtract(mail,body),date:mail.received_at,source:'email',source_id:mail.message_id,message_ref:mail.id};
 applyObservation(data,observation);
 assert.equal(data.manuscripts.length,1);assert.equal(manuscript.status,'revision_requested');
 assert.equal(manuscript.events.length,2);assert.equal(manuscript.events[1].id,'unknown-event');
 assert.equal(manuscript.events[1].status,'revision_requested');assert.equal(manuscript.events[0].status,'major_revision');
 applyObservation(data,{...observation,status:'unknown',raw_status:'Unknown on another scan'});
 assert.equal(manuscript.events.length,2);assert.equal(manuscript.status,'revision_requested');
 assert.equal(unknownMailRetries(data).length,0);
});
test('unknown retry batches are bounded and successful or already attempted sources are skipped',()=>{
 const manuscript={id:'paper',events:Array.from({length:5},(_,i)=>({source:'email',source_id:'mail-'+i,message_ref:'ref-'+i,status:'unknown',date:'2026-11-'+(10+i)}))};
 assert.equal(unknownMailRetries({manuscripts:[manuscript]}).length,3);
 manuscript.extraction_retries={'mail-4':{version:MAIL_EXTRACTION_VERSION,status:'unknown'}};
 assert.equal(unknownMailRetries({manuscripts:[manuscript]})[0].source_id,'mail-3');
 manuscript.archived_at='2026-11-23';assert.equal(unknownMailRetries({manuscripts:[manuscript]}).length,0);
 delete manuscript.archived_at;manuscript.deleted_at='2026-11-23';assert.equal(unknownMailRetries({manuscripts:[manuscript]}).length,0);
});
