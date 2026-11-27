import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {cleanManuscriptNumber,canonicalNumber,manuscriptKey,applyObservation,reconcileManuscripts,findManuscript,MANUSCRIPT_IDENTITY_VERSION,submissionRound} from '../../supabase/functions/manuscripts-api/core.js';

const journal='Chaos: An Interdisciplinary Journal of Nonlinear Science';
const empty=()=>({manuscripts:[],tombstones:[],stats_offsets:{}});
const mail=(number,patch={})=>({publisher:'AIP Publishing',journal,title:'A synthetic manuscript about network relaxation',number,status:'submitted',date:'2026-11-01T00:00:00Z',source:'email',source_id:number,...patch});

test('sentence punctuation, Unicode hyphens, quotes and zero-width characters do not change an accession identity',()=>{
 const expected=manuscriptKey(mail('CHA26-AR-01234'));
 for(const number of ['CHA26-AR-01234.','“CHA26-AR-01234R1,”','(CHA26–AR–01234R1).','ＣＨＡ２６－ＡＲ－０１２３４Ｒ１。','CHA26-AR-\u200b01234R1;'])assert.equal(manuscriptKey(mail(number)),expected,number);
 assert.equal(cleanManuscriptNumber('PHYSD-D-26-01234R2.'),'PHYSD-D-26-01234R2');
 assert.equal(canonicalNumber('EXR1134.','APS'),'EXR1134');
 assert.equal(cleanManuscriptNumber('es2026nov01_123'),'es2026nov01_123');
});
test('repeated scans and later revisions reuse a single record and keep the newest AIP round',()=>{
 const data=empty();
 applyObservation(data,mail('CHA26-AR-01234.'));
 const id=data.manuscripts[0].id;
 applyObservation(data,mail('CHA26-AR-01234R1',{date:'2026-11-02',status:'revised_submitted'}));
 applyObservation(data,mail('CHA26-AR-01234.',{source_id:'older-mail',date:'2026-10-20'}));
 assert.equal(data.manuscripts.length,1);assert.equal(data.manuscripts[0].id,id);
 assert.equal(data.manuscripts[0].number,'CHA26-AR-01234R1');assert.equal(submissionRound(data.manuscripts[0]),3);
 assert.equal(data.manuscripts[0].events.length,3);
});
test('legacy punctuation duplicates merge without dropping source mails, manual statistics or unrelated archived records',()=>{
 const data=empty();applyObservation(data,mail('CHA26-AR-01234R1',{source_id:'latest',date:'2026-11-20',status:'revised_submitted'}));
 const kept=data.manuscripts[0];kept.authors='Edited author';kept.manual_fields=['authors'];
 data.manuscripts.push({...mail('CHA26-AR-01234.'),id:'legacy',created_at:'2026-10-01',events:[{id:'legacy-mail',date:'2026-10-01',source:'email',source_id:'original',status:'submitted',number:'CHA26-AR-01234.'}]});
 const archived={id:'archived',publisher:'Elsevier',journal:'Physica D',number:'PHYSD-D-26-01234',status:'accepted',archived_at:'2026-10-02',created_at:'2026-10-01',events:[]};data.manuscripts.push(structuredClone(archived));
 data.stats_offsets[journal]={total:4,active:1,completed:2,accepted:1,rejected:1};const offsets=structuredClone(data.stats_offsets);
 reconcileManuscripts(data);assert.equal(data.manuscripts.length,2);
 assert.equal(kept.number,'CHA26-AR-01234R1');assert.equal(kept.authors,'Edited author');assert.ok(kept.merged_ids.includes('legacy'));
 assert.deepEqual(new Set(kept.events.map(e=>e.source_id)),new Set(['latest','original']));assert.deepEqual({...data.stats_offsets},offsets);
 assert.equal(data.manuscripts.find(x=>x.id==='archived').archived_at,archived.archived_at);
 const stable=JSON.stringify(data);reconcileManuscripts(data);assert.equal(JSON.stringify(data),stable);
});
test('missing journal metadata and a changed AI label cannot split an already indexed source mail',()=>{
 const data=empty();const item=applyObservation(data,mail('CHA26-AR-01234',{source_id:'same-mail',message_ref:'same-row'}));
 applyObservation(data,mail('CHA26-AR-01234.',{journal:'',source_id:'missing-journal',date:'2026-11-02'}));
 applyObservation(data,mail('CHA26-AR-01234',{journal:'Wrong AI label',source_id:'same-mail',message_ref:'same-row',date:'2026-11-03'}));
 assert.equal(data.manuscripts.length,1);assert.equal(item.journal,journal);
 applyObservation(data,mail('CHA26-AR-01234',{journal:'Another AI label',source_id:'new-mail',date:'2026-11-04'}));assert.equal(data.manuscripts.length,1);assert.equal(item.journal,journal);
 item.archived_at='2026-11-04';applyObservation(data,mail('CHA26-AR-01234.',{journal:'',source_id:'later',date:'2026-11-05'}));assert.equal(data.manuscripts.length,1);assert.equal(item.events.length,4);
});
test('different real codes, explicit journals and unidentified records are not merged by a shared title',()=>{
 const data=empty();applyObservation(data,mail('CHA26-AR-01234'));applyObservation(data,mail('CHA26-AR-54321'));
 applyObservation(data,mail('CHA26-AR-01234',{publisher:'Elsevier',journal:'Chaos, Solitons & Fractals',source_id:'other-journal'}));
 data.manuscripts.push({id:'missing-1',journal,events:[]},{id:'missing-2',journal,events:[]});reconcileManuscripts(data);assert.equal(data.manuscripts.length,5);
 assert.equal(findManuscript(data,mail('CHA26-AR-00000')),undefined);
 const manual={...mail('CHA26-AR-09999'),id:'manual-journal',journal:'My deliberately edited journal',manual_fields:['journal'],events:[]};
 assert.equal(findManuscript({manuscripts:[manual]},mail('CHA26-AR-09999')),undefined);
});
test('a permanent deletion cannot be bypassed by trailing punctuation or a revision suffix',()=>{
 const data=empty();data.tombstones=[manuscriptKey(mail('CHA26-AR-01234'))+'.'];
 applyObservation(data,mail('CHA26-AR-01234R1.'));assert.equal(data.manuscripts.length,0);
});

test('every versioned mutation reconciles both existing rows and newly produced duplicates',async()=>{
 const source=fs.readFileSync(new URL('../../supabase/functions/manuscripts-api/index.ts',import.meta.url),'utf8');
 const code=stripTypeScriptTypes(source.slice(source.indexOf('async function mutate('),source.indexOf('const view=')));
 let row={user_id:'owner',enabled:true,version:10,data:{...empty(),tracking_version:4,identity_version:MANUSCRIPT_IDENTITY_VERSION}},failOnce=true;
 row.data.manuscripts=[{...mail('CHA26-AR-01234R1'),id:'kept',created_at:'2026-11-01',events:[]}];
 const ctx={table:'mail_academic_workspaces',structuredClone,Date,MANUSCRIPT_IDENTITY_VERSION,reconcileManuscripts,resolveManuscriptStatus(){},RequestError:class extends Error{},workspace:async()=>structuredClone(row),checked:async x=>x,service:{from(){return{update(values){const filters={};return{eq(k,v){filters[k]=v;return this;},async select(){assert.equal(filters.user_id,'owner');assert.equal(filters.version,row.version);if(failOnce){failOnce=false;row.version++;return [];}row={...row,...values};return [structuredClone(row)];}};}};}}};
 vm.runInNewContext(code+'\nglobalThis.mutateForTest=mutate;globalThis.upgradeForTest=upgradeWorkspace;',ctx);
 await ctx.mutateForTest('owner',copy=>{copy.data.manuscripts.push({...mail('CHA26-AR-01234.'),id:'late-duplicate',created_at:'2026-10-01',events:[]});return copy;});
 assert.equal(row.data.manuscripts.length,1);assert.equal(row.version,12);assert.equal(row.data.identity_version,MANUSCRIPT_IDENTITY_VERSION);
 // A previously current tracking schema still runs the new identity migration once.
 delete row.data.identity_version;await ctx.upgradeForTest('owner');assert.equal(row.data.identity_version,MANUSCRIPT_IDENTITY_VERSION);
 const version=row.version;await ctx.upgradeForTest('owner');assert.equal(row.version,version);
});
