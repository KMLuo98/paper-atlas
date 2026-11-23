import test from 'node:test';
import assert from 'node:assert/strict';
import {statistics,deleteJournalStatistics,canonicalJournal} from '../../supabase/functions/manuscripts-api/core.js';

test('removing a manual journal deletes its statistics without changing other rows',()=>{
 const data={manuscripts:[],stats_offsets:{Custom:{total:3,active:1,completed:2,accepted:1,rejected:1},Other:{total:2}}};
 deleteJournalStatistics(data,'Custom');
 assert.deepEqual(statistics(data).map(row=>row.journal),['Other']);
 assert.equal(data.stats_offsets.Custom,undefined);assert.equal(data.stats_offsets.Other.total,2);
 assert.deepEqual(statistics(JSON.parse(JSON.stringify(data))),statistics(data));
});
test('deleting an automatically counted journal keeps manuscripts and stays deleted after new mail',()=>{
 const data={manuscripts:[{id:'paper',journal:'Chaos',status:'under_review'},{id:'other',journal:'Physical Review E',status:'accepted',archived_at:'2026-11-01'}],stats_offsets:{}};
 const original=structuredClone(data.manuscripts);
 deleteJournalStatistics(data,'Chaos');
 assert.deepEqual(data.manuscripts,original);assert.equal(statistics(data).length,1);
 data.manuscripts.push({id:'new',journal:canonicalJournal('Chaos'),status:'submitted'});
 assert.equal(statistics(data).some(row=>row.journal===canonicalJournal('Chaos')),false);
 assert.equal(statistics(data)[0].accepted,1);
});
test('aliases resolve to the same deletion and unknown journal names are rejected',()=>{
 const data={manuscripts:[{journal:'Chaos',status:'accepted'}],stats_offsets:{Chaos:{total:3}}};
 deleteJournalStatistics(data,canonicalJournal('Chaos'));deleteJournalStatistics(data,'Chaos');
 assert.equal(statistics(data).length,0);assert.deepEqual(data.stats_offsets,{});
 assert.throws(()=>deleteJournalStatistics(data,''),/请选择/);
 assert.throws(()=>deleteJournalStatistics(data,'Unknown journal'),/请选择/);
});
