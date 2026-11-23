import test from 'node:test';
import assert from 'node:assert/strict';
import {submissionRound,submissionStages,applyObservation,reconcileManuscripts} from '../../supabase/functions/manuscripts-api/core.js';

test('AIP original, R, R1 and R2 identify the first through fourth submission rounds',()=>{
 for(const [suffix,round] of [['',1],['R',2],['R1',3],['R2',4]]){
  const number='CHA26-AR-12345'+suffix;
  assert.equal(submissionRound({publisher:'AIP Publishing',number,events:[]}),round);
  assert.equal(submissionRound({publisher:'AIP Publishing',number,events:[{number,date:'2026-11-24',status:'submitted'}]}),round);
 }
 assert.equal(submissionRound({publisher:'AIP Publishing',number:'POF26-AR-12345R1',events:[]}),3);
 assert.equal(submissionRound({publisher:'AIP Publishing',number:'EXR1134',events:[]}),1);
});
test('AIP history keeps each version in its own round even if an older-version notice arrives late',()=>{
 const item={publisher:'AIP Publishing',number:'CHA26-AR-12345R1',events:[
  {number:'CHA26-AR-12345',date:'2026-11-01',status:'submitted'},
  {number:'CHA26-AR-12345R',date:'2026-11-10',status:'revised_submitted'},
  {number:'CHA26-AR-12345R1',date:'2026-11-22',status:'revised_submitted'},
  {number:'CHA26-AR-12345R',date:'2026-11-23',status:'revision_requested'},
  {number:'CHA26-AR-12345R1',date:'2026-11-24',status:'revised_submitted'}
 ]};
 assert.deepEqual(submissionStages(item).map(event=>event.round),[1,2,3,2,3]);
 assert.equal(submissionRound(item),3);
});
test('older AIP mail cannot downgrade R1 back to R and duplicate reconciliation picks the newest version',()=>{
 const base={publisher:'AIP Publishing',journal:'Chaos',title:'Synthetic AIP manuscript',number:'CHA26-AR-12345R1',status:'revised_submitted',status_at:'2026-11-22',events:[],manual_fields:[]};
 const data={manuscripts:[{...base,id:'paper'}]};
 applyObservation(data,{...base,number:'CHA26-AR-12345R',date:'2026-11-23',status:'revision_requested',source:'email',source_id:'late'});
 assert.equal(data.manuscripts[0].number,'CHA26-AR-12345R1');
 assert.equal(data.manuscripts[0].events[0].number,'CHA26-AR-12345R');
 const duplicates={manuscripts:[{...base,id:'new',number:'CHA26-AR-12345R1'},{...base,id:'old',number:'CHA26-AR-12345R',status_at:'2026-11-24'}],stats_offsets:{}};
 reconcileManuscripts(duplicates);
 assert.equal(duplicates.manuscripts.length,1);assert.equal(duplicates.manuscripts[0].number,'CHA26-AR-12345R1');
});
test('Elsevier and APS round mappings remain unchanged',()=>{
 for(const [suffix,round] of [['R1',2],['R2',3]]){
  const number='PHYSD-D-26-12345'+suffix;
  assert.equal(submissionRound({publisher:'Elsevier',number,events:[{number,date:'2026-11-24',status:'revised_submitted'}]}),round);
 }
 assert.equal(submissionRound({publisher:'Elsevier',number:'PHYSD-D-26-12345R2',events:[]}),1);
 assert.equal(submissionRound({publisher:'APS',number:'EXR1134',events:[{number:'EXR1134',date:'2026-11-24',status:'submitted'}]}),1);
});
