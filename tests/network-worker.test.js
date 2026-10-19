import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';

test('the network worker computes finite clustered positions away from the UI thread', async () => {
 const worker=new Worker(`
  const {parentPort,workerData}=require('node:worker_threads');
  globalThis.self={postMessage:result=>parentPort.postMessage(result)};
  import(workerData.url).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});
 `,{eval:true,workerData:{url:new URL('../src/network-worker.js',import.meta.url).href}});
 try {
  await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  const result=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  const nodes=Array.from({length:120},(_,id)=>({id:String(id)})),edges=nodes.slice(1).map((n,i)=>({source:String(Math.floor(i/3)),target:n.id,weight:1}));
  worker.postMessage({graph:{nodes,edges},width:900,height:680});
  const response=await result;assert(!response.error);assert.equal(response.positions.length,120);
  assert(response.positions.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.community));
  assert.equal(new Set(response.positions.map(p=>p.id)).size,120);
 } finally {await worker.terminate();}
});
