import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {mountNetworkGestures} from '../src/network-gestures.js';
function fixture(pointerSupport=true,initialTransform={scale:1,tx:0,ty:0}){
 const {document,window}=parseHTML('<html><body><svg><g class="node"><circle></circle></g></svg><p id="outside"></p></body></html>');window.PointerEvent=pointerSupport?function(){}:undefined;
 const svg=document.querySelector('svg'),circle=document.querySelector('circle'),node={id:'node'},calls=[];let transform=initialTransform;svg.getBoundingClientRect=()=>({left:0,top:0,width:400,height:500});svg.setPointerCapture=()=>{};
 const gestures=mountNetworkGestures(svg,{width:400,height:500,getTransform:()=>transform,setTransform:next=>transform=next,nodeForTarget:target=>target.closest?.('.node')?node:null,onNodeStart:n=>calls.push(['start',n.id]),onNodeMove:(_n,p)=>calls.push(['move',p]),onNodeEnd:n=>calls.push(['end',n.id]),onNodeClick:n=>calls.push(['click',n.id]),onBlankClick:()=>calls.push(['blank'])});
 const fire=(type,id,x,y,target=svg)=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0});target.dispatchEvent(event);return event;};
 const touch=(type,touches,changedTouches)=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{touches,changedTouches});svg.dispatchEvent(event);return event;};
 return {document,window,svg,circle,calls,fire,touch,gestures,get transform(){return transform;}};
}
test('pinch zoom anchors the network under the fingers, then resumes single-finger panning without clicks',()=>{
 const f=fixture();f.fire('pointerdown',1,100,100,f.circle);f.fire('pointerdown',2,200,100);assert.deepEqual(f.calls.slice(0,2),[['start','node'],['end','node']]);const moved=f.fire('pointermove',2,300,100);assert(moved.defaultPrevented);assert.equal(f.transform.scale,2);assert.equal((200-f.transform.tx)/f.transform.scale,150);assert.equal((100-f.transform.ty)/f.transform.scale,100);
 f.fire('pointerup',2,300,100);f.fire('pointermove',1,130,120);assert.equal(f.transform.scale,2);assert.equal(f.transform.tx,-70);assert.equal(f.transform.ty,-80);f.fire('pointerup',1,130,120);assert(!f.calls.some(c=>c[0]==='click'||c[0]==='blank'));
 f.fire('pointerdown',3,50,50,f.circle);f.fire('pointerup',3,50,50);assert(f.calls.some(c=>c[0]==='click'));f.gestures.destroy();
});
test('node drag coordinates follow graph zoom and pointer cancellation releases drag state',()=>{
 const f=fixture();f.fire('pointerdown',1,100,100);f.fire('pointerdown',2,200,100);f.fire('pointermove',2,300,100);f.fire('pointercancel',1,100,100);f.fire('pointercancel',2,300,100);
 f.fire('pointerdown',3,200,200,f.circle);f.fire('pointermove',3,240,200);const point=f.calls.find(c=>c[0]==='move')[1];assert.equal(point.x,170);assert.equal(point.y,150);f.fire('lostpointercapture',3,240,200);assert.equal(f.calls.filter(c=>c[0]==='end').length,1);assert(!f.calls.some(c=>c[0]==='click'));f.gestures.destroy();
});
test('touch fallback zooms the graph and native gesture prevention is limited to the graph',()=>{
 const f=fixture(false),a={identifier:1,clientX:100,clientY:100,target:f.svg},b={identifier:2,clientX:200,clientY:100,target:f.svg};f.touch('touchstart',[a],[a]);f.touch('touchstart',[a,b],[b]);const next={...b,clientX:300};assert(f.touch('touchmove',[a,next],[next]).defaultPrevented);assert.equal(f.transform.scale,2);f.touch('touchend',[a],[next]);f.touch('touchend',[],[a]);assert(!f.calls.some(c=>c[0]==='blank'));
 const inside=new f.window.Event('gesturestart',{bubbles:true,cancelable:true});f.svg.dispatchEvent(inside);assert(inside.defaultPrevented);const outside=new f.window.Event('gesturestart',{bubbles:true,cancelable:true});f.document.querySelector('#outside').dispatchEvent(outside);assert(!outside.defaultPrevented);f.gestures.destroy();assert(!f.svg.style.touchAction);const after=new f.window.Event('gesturestart',{cancelable:true});f.svg.dispatchEvent(after);assert(!after.defaultPrevented);
});
test('single-pointer panning and wheel zoom remain available after gesture cleanup and restart',()=>{
 const f=fixture();f.fire('pointerdown',1,50,50);f.fire('pointermove',1,80,90);f.fire('pointerup',1,80,90);assert.equal(f.transform.tx,30);assert.equal(f.transform.ty,40);const wheel=new f.window.Event('wheel',{bubbles:true,cancelable:true});Object.assign(wheel,{clientX:200,clientY:200,deltaY:-100});f.svg.dispatchEvent(wheel);assert(wheel.defaultPrevented);assert(f.transform.scale>1);f.gestures.cancel();f.fire('pointerdown',2,50,50);f.fire('pointerup',2,50,50);assert.equal(f.calls.filter(c=>c[0]==='blank').length,1);f.gestures.destroy();
});

test('dense graphs initially fitted below the usual zoom floor can still pinch out smoothly',()=>{const f=fixture(true,{scale:.04,tx:0,ty:0});f.fire('pointerdown',1,100,100);f.fire('pointerdown',2,200,100);f.fire('pointermove',2,150,100);assert.equal(f.transform.scale,.02);f.gestures.destroy();});
