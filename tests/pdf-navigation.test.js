import test from 'node:test';
import assert from 'node:assert/strict';
import {fitPDFPage,createPDFNavigation} from '../src/pdf-navigation.js';
test('portrait and landscape PDFs fit narrow phones while bounding canvas memory',()=>{
  for(const [width,height] of [[595,842],[842,595],[400,12000]]){
    const g=fitPDFPage(width,height,240,3);assert.equal(g.cssWidth,240);assert(g.width*g.height<6100000);assert(g.ratio<=2);assert(Math.abs(g.cssHeight/g.cssWidth-height/width)<0.00001);
  }
});
test('page navigation reaches every PDF page and clamps typed page numbers',async()=>{
  const shown=[];const nav=createPDFNavigation({total:3,draw:async n=>shown.push(n),onState:()=>{}});
  await nav.go(1);await nav.next();await nav.next();assert.equal(nav.page,3);await nav.next();await nav.go(-5);await nav.go(2.8);await nav.go('invalid');assert.deepEqual(shown,[1,2,3,3,1,2,2]);
});
test('a slow earlier page cannot replace a later requested page',async()=>{
  const states=[];let release;
  const nav=createPDFNavigation({total:4,onState:s=>states.push(s),draw:async(n,signal)=>{if(n===1)await new Promise(resolve=>release=resolve);if(!signal.aborted)states.push({displayed:n});}});
  const first=nav.go(1);await nav.go(3);release();assert.equal(await first,false);assert.equal(nav.page,3);assert.deepEqual(states.filter(s=>s.displayed).map(s=>s.displayed),[3]);
});
test('leaving the reader cancels rendering and page errors allow another attempt',async()=>{
  let calls=0;const states=[];const nav=createPDFNavigation({total:2,onState:s=>states.push(s),draw:async()=>{if(++calls===1)throw Error('bad page');}});
  assert.equal(await nav.go(1),false);assert(states.at(-1).error);assert.equal(await nav.go(2),true);nav.destroy();assert.equal(await nav.go(1),false);assert.equal(calls,2);
});
