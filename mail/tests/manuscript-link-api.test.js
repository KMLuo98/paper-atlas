import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {parseHTML} from 'linkedom';
import * as core from '../../supabase/functions/manuscripts-api/core.js';

const source=stripTypeScriptTypes(fs.readFileSync(new URL('../../supabase/functions/manuscripts-api/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''),{mode:'transform'});
function fixture(mails=[],publisherMetadata=null){
 let handler;const workspace={user_id:'owner',enabled:true,version:0,data:{manuscripts:[],tombstones:[],stats_offsets:{}}};
 const queries=[],publisherReads=[];
 class Query{
  constructor(table){this.table=table;this.filters=[];this.operation='select';this.maximum=Infinity;queries.push(this);}
  select(){return this;}eq(key,value){this.filters.push([key,value]);return this;}
  order(){return this;}limit(n){this.maximum=n;return this;}
  ilike(field,pattern){this.like=[field,pattern.slice(1,-1).replace(/\\([_%\\])/g,'$1').toLowerCase()];return this;}
  upsert(){this.operation='upsert';return this;}
  update(patch){this.operation='update';this.patch=patch;return this;}
  async result(single=false){
   if(this.operation!=='upsert')assert.ok(this.filters.some(([key,value])=>key==='user_id'&&value==='owner'));
   if(this.table==='mail_academic_workspaces'){
    if(this.operation==='update'){
     const version=this.filters.find(([key])=>key==='version')?.[1];
     if(version!==workspace.version)return {data:[]};Object.assign(workspace,structuredClone(this.patch));
    }
    return {data:single?structuredClone(workspace):[structuredClone(workspace)]};
   }
   assert.equal(this.table,'mail_messages');
   const rows=mails.filter(row=>this.filters.every(([key,value])=>row[key]===value)&&(!this.like||String(row[this.like[0]]||'').toLowerCase().includes(this.like[1]))).slice(0,this.maximum);
   return {data:structuredClone(single?rows[0]:rows)};
  }
  single(){return this.result(true);}then(resolve,reject){return this.result().then(resolve,reject);}
 }
 const service={from:table=>new Query(table),rpc:async()=>({data:true}),auth:{getUser:async token=>token==='valid'?{data:{user:{id:'owner'}}}:{data:{user:null},error:Error('denied')}}};
 vm.runInNewContext(source,{...core,parseHTML,createClient:()=>service,Deno:{env:{get:()=>''},serve:fn=>handler=fn},Request,Response,URL,AbortSignal,TextEncoder,crypto,structuredClone,console,fetchStatusPage:async item=>{publisherReads.push(structuredClone(item));return publisherMetadata||{events:[]};},fetch:async()=>{throw Error('No external query is needed');}});
 return {workspace,queries,publisherReads,request:(body,token='valid')=>handler(new Request('https://project.supabase.co/functions/v1/manuscripts-api',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}))};
}

test('automatic status-link lookup reads only the current user mail and does not modify the workspace',async()=>{
 const number='PHYSD-D-26-01234',url='https://track.authorhub.elsevier.com/?uuid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const mail={id:'own',user_id:'owner',direction:'received',subject:'Track the status of your submission',received_at:'2026-11-21',from_email:'journal@elsevier.com',text_body:'Journal: Physica D\nManuscript Number: '+number+'\n'+url};
 const f=fixture([{...mail,id:'other',user_id:'someone-else',text_body:mail.text_body.replace('aaaaaaaa','ffffffff')},mail]);
 const before=JSON.stringify(f.workspace);
 assert.equal((await f.request({action:'resolve_link',journal:'Physica D',publisher:'Elsevier',number},'invalid')).status,401);
 assert.equal(f.queries.length,0);
 const response=await f.request({action:'resolve_link',journal:'Physica D',publisher:'Elsevier',number});
 assert.equal(response.status,200);assert.equal((await response.json()).tracking_url,url);
 assert.equal(JSON.stringify(f.workspace),before);
});

test('save persists auto/manual mode and APS manual links are never silently replaced',async()=>{
 const f=fixture();
 const body={action:'save',publisher:'APS',journal:'Physical Review E',title:'A test submission',number:'EXR1234',lookup_author:'Author',status:'submitted',tracking_mode:'auto',tracking_url:'https://example.test/ignored'};
 let response=await f.request(body);assert.equal(response.status,200);
 let item=(await response.json()).manuscripts[0];assert.match(item.tracking_url,/accode=EXR1234&author=Author/);assert.equal(item.tracking_mode,'auto');assert.ok(!item.manual_fields.includes('tracking_url'));
 response=await f.request({...body,id:item.id,tracking_mode:'manual',tracking_url:'https://example.test/author-status'});assert.equal(response.status,200);
 item=(await response.json()).manuscripts[0];assert.equal(item.tracking_url,'https://example.test/author-status');assert.equal(item.tracking_mode,'manual');assert.ok(item.manual_fields.includes('tracking_url'));
 response=await f.request({...body,id:item.id,tracking_mode:'auto'});assert.equal(response.status,200);
 item=(await response.json()).manuscripts[0];assert.match(item.tracking_url,/accode=EXR1234/);assert.ok(!item.manual_fields.includes('tracking_url'));
});

test('statistics reset requires one selected journal and leaves every other adjustment intact',async()=>{
 const f=fixture(),journal='Physical Review E',other='Physica D: Nonlinear Phenomena';
 f.workspace.data.manuscripts=[{id:'paper',journal,status:'rejected',deleted_at:'2026-11-21'}];
 f.workspace.data.stats_offsets={[journal]:{total:8,active:2,completed:6,accepted:4,rejected:2},[other]:{total:5,active:1,completed:4,accepted:2,rejected:2}};
 const before=JSON.stringify(f.workspace);
 let response=await f.request({action:'statistics',reset:true});assert.equal(response.status,400);assert.equal(JSON.stringify(f.workspace),before);
 response=await f.request({action:'statistics',reset:true,journal});assert.equal(response.status,200);
 const result=await response.json();
 assert.deepEqual(result.statistics.find(row=>row.journal===journal),{journal,total:1,active:0,accepted:0,rejected:1,completed:1});
 assert.deepEqual(result.stats_offsets[other],{total:5,active:1,completed:4,accepted:2,rejected:2});
 response=await f.request({action:'statistics',reset:true,journal:other});assert.equal(response.status,200);
 assert.deepEqual((await response.json()).statistics.find(row=>row.journal===other),{journal:other,total:0,active:0,completed:0,accepted:0,rejected:0});
});

test('saving an Elsevier manuscript with no authors fills verified tracker names and preserves later manual edits',async()=>{
 const number='PHYSD-D-26-01234',url='https://track.authorhub.elsevier.com/?uuid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const f=fixture([],{number,authors:'A. Author, B. Author',authors_partial:true});
 const body={action:'save',publisher:'Elsevier',journal:'Physica D',title:'A test manuscript',number,status:'under_review',tracking_mode:'manual',tracking_url:url,authors:''};
 let response=await f.request(body);assert.equal(response.status,200);
 let item=(await response.json()).manuscripts[0];assert.equal(item.authors,'A. Author, B. Author');assert.equal(item.authors_source,'publisher');assert.equal(item.authors_partial,true);assert.ok(!item.manual_fields.includes('authors'));assert.equal(f.publisherReads.length,1);
 response=await f.request({...body,id:item.id,title:'Edited title',authors:item.authors});assert.equal(response.status,200);
 item=(await response.json()).manuscripts[0];assert.ok(!item.manual_fields.includes('authors'));assert.equal(item.authors_partial,true);
 response=await f.request({...body,id:item.id,authors:'Manually confirmed author'});assert.equal(response.status,200);
 item=(await response.json()).manuscripts[0];assert.ok(item.manual_fields.includes('authors'));assert.equal(item.authors_source,'manual');assert.equal(f.publisherReads.length,1);
 core.applyPublisherMetadata(item,{number,authors:'Other automatic name',authors_partial:true});assert.equal(item.authors,'Manually confirmed author');
});

test('automatic lookup prefers a dedicated tracker email over a generic Editorial Manager entrance',async()=>{
 const number='PHYSD-D-26-01234',url='https://track.authorhub.elsevier.com/?uuid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const f=fixture([{id:'tracker-mail',user_id:'owner',direction:'received',subject:'Track the status of your submission',from_email:'journal@elsevier.com',received_at:'2026-11-22',text_body:'Journal: Physica D\nManuscript Number: '+number+'\n'+url}]);
 f.workspace.data.manuscripts=[{id:'paper',publisher:'Elsevier',journal:'Physica D',number,tracking_url:'https://www.editorialmanager.com/physd/',manual_fields:[]}];
 const response=await f.request({action:'resolve_link',publisher:'Elsevier',journal:'Physica D',number});assert.equal(response.status,200);assert.equal((await response.json()).tracking_url,url);
});
