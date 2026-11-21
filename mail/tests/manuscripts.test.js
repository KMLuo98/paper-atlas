import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {canonicalNumber,manuscriptKey,applyObservation,statistics,rawStatistics,normalizeStatus,apsURL,safeStatusURL,ruleExtract,bulkManuscriptAction} from '../../supabase/functions/manuscripts-api/core.js';
import {fetchStatusPage} from '../../supabase/functions/manuscripts-api/publishers.js';

const empty=()=>({manuscripts:[],tombstones:[],stats_offsets:{}});
const observation=(patch={})=>({publisher:'Elsevier',journal:'Physica A',title:'Network dynamics',authors:'A. Researcher',number:'PHYSA-D-26-00123',date:'2026-11-01T00:00:00Z',status:'submitted',source:'email',source_id:'email-1',...patch});
test('revisions and duplicate copies keep one submission with an ordered history',()=>{
 const data=empty();
 applyObservation(data,observation());
 applyObservation(data,observation());
 applyObservation(data,observation({number:'PHYSA-D-26-00123R1',date:'2026-11-03T00:00:00Z',status:'revised_submitted',source_id:'email-3'}));
 applyObservation(data,observation({date:'2026-11-02T00:00:00Z',status:'major_revision',source_id:'email-2'}));
 assert.equal(data.manuscripts.length,1);
 assert.equal(data.manuscripts[0].events.length,3);
 assert.equal(data.manuscripts[0].status,'revised_submitted');
 assert.equal(data.manuscripts[0].number,'PHYSA-D-26-00123R1');
 assert.equal(statistics(data)[0].total,1);
 assert.equal(canonicalNumber('LA12345','APS'),'LA12345');
});
test('archives, trash and permanent tombstones stop automatic updates',()=>{
 const data=empty();
 const item=applyObservation(data,observation());
 item.archived_at='2026-11-02';
 applyObservation(data,observation({status:'accepted',source_id:'later',date:'2026-11-03'}));
 assert.equal(item.status,'submitted');
 item.archived_at=null;item.deleted_at='2026-11-02';
 applyObservation(data,observation({status:'accepted',source_id:'later',date:'2026-11-03'}));
 assert.equal(item.status,'submitted');
 data.tombstones.push(item.key);data.manuscripts=[];
 applyObservation(data,observation());
 assert.equal(data.manuscripts.length,0);
});
test('manual count adjustments survive new submissions and status updates',()=>{
 const data=empty();
 applyObservation(data,observation());
 data.stats_offsets['Physica A']={total:9,active:4,accepted:2,rejected:1,completed:5};
 assert.deepEqual(statistics(data)[0],{journal:'Physica A',total:10,active:5,accepted:2,rejected:1,completed:5});
 applyObservation(data,observation({number:'PHYSA-D-26-00456',source_id:'new'}));
 applyObservation(data,observation({status:'accepted',source_id:'accepted',date:'2026-11-04'}));
 assert.deepEqual(statistics(data)[0],{journal:'Physica A',total:11,active:5,accepted:3,rejected:1,completed:6});
 data.stats_offsets={};
 assert.deepEqual(statistics(data)[0],{journal:'Physica A',...rawStatistics(data)['Physica A']});
});

test('archive, trash and restore cannot change journal counts or saved adjustments',()=>{
 const data=empty(),journal='Chaos, Solitons & Fractals';
 for(const [index,status] of ['published','rejected','under_review'].entries())applyObservation(data,observation({journal,number:'CHAOS-D-26-0012'+index,status,source_id:'mail-'+index}));
 data.stats_offsets[journal]={total:7,active:2,completed:5,accepted:3,rejected:2};
 const expected=[{journal,total:10,active:3,completed:7,accepted:4,rejected:3}];
 assert.deepEqual(statistics(data),expected);
 const ids=data.manuscripts.map(item=>item.id);
 for(const action of ['archive','trash']){
  bulkManuscriptAction(data,action,ids);
  assert.deepEqual(statistics(data),expected);
  bulkManuscriptAction(data,'restore',ids,action==='archive'?'archived':'trash');
  assert.deepEqual(statistics(data),expected);
 }
 data.stats_offsets={};
 assert.deepEqual(statistics(data),[{journal,total:3,active:1,completed:2,accepted:1,rejected:1}]);
});

test('a journal remains in statistics when its only manuscript is in Trash',()=>{
 const data=empty(),journal='Chaos, Solitons & Fractals';
 const item=applyObservation(data,observation({journal,status:'rejected'}));
 bulkManuscriptAction(data,'trash',[item.id]);
 assert.deepEqual(statistics(data),[{journal,total:1,active:0,accepted:0,rejected:1,completed:1}]);
});
test('referee invitations do not become acceptance decisions or author submissions',()=>{
 assert.equal(normalizeStatus('Reviewer accepted invitation'),'unknown');
 assert.equal(normalizeStatus('Major Revision'),'major_revision');
 assert.equal(normalizeStatus('Required reviews completed'),'reviews_completed');
 assert.equal(ruleExtract({subject:'Invitation to review manuscript',from_email:'em@editorialmanager.com'},'Manuscript number: PHYSA-D-26-00123'),null);
});
test('status URLs use verified APS field names and reject untrusted hosts',()=>{
 const url=new URL(apsURL('LA12345','Luo'));
 assert.equal(url.searchParams.get('accode'),'LA12345');
 assert.equal(url.searchParams.get('author'),'Luo');
 assert.equal(safeStatusURL('https://authors.aps.org.evil.test/Submissions/status'),'');
 assert.equal(safeStatusURL('http://127.0.0.1/'),'');
 assert.equal(safeStatusURL('https://authors.aps.org:8080/Submissions/status'),'');
 assert.ok(safeStatusURL(url.href));
});
test('APS History parsing retains all events and correctly orders status observations',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('<html><body><table><tr><th>Date</th><th>Event</th></tr><tr><td>21 Nov 2026</td><td>Accepted for publication</td></tr><tr><td>18 Nov 2026</td><td>Sent to referee</td></tr></table></body></html>',{headers:{'content-type':'text/html'}});
 try{
  const result=await fetchStatusPage({publisher:'APS',number:'LA12345',lookup_author:'Luo'},parseHTML);
  assert.equal(result.events.length,2);
  assert.deepEqual(result.events.map(e=>e.status),['accepted','under_review']);
 }finally{globalThis.fetch=original;}
});
test('login-only publisher pages preserve the last known status',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('<html><body>Log in to view manuscript status<input type="password"></body></html>',{headers:{'content-type':'text/html'}});
 try{
  const result=await fetchStatusPage({publisher:'Springer Nature',tracking_url:'https://www.nature.com/status'},parseHTML);
  assert.equal(result.events.length,0);
  assert.match(result.notice,/登录/);
 }finally{globalThis.fetch=original;}
});
