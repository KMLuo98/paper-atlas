import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {drawNetwork} from '../src/network-layout.js';
test('dense networks spread nodes without fixed-boundary piles and support focus/highlighting',()=>{
 const {document}=parseHTML('<html><body><svg id="graph"></svg></body></html>');globalThis.document=document;const svg=document.querySelector('svg');Object.defineProperty(svg,'clientWidth',{value:900});Object.defineProperty(svg,'clientHeight',{value:680});
 const nodes=Array.from({length:75},(_,i)=>({id:String(i),name:'Author '+i,label:'Author '+i})),edges=[];for(let i=1;i<nodes.length;i++)edges.push({source:String(Math.floor((i-1)/3)),target:String(i),weight:1});let selected;
 const graph=drawNetwork(svg,{nodes,edges},{authors:true,onSelectionChange:id=>selected=id});
 const elements=[...svg.querySelectorAll('[data-node-id]')],positions=elements.map(el=>el.getAttribute('transform').match(/translate\(([^,]+),([^\)]+)\)/).slice(1).map(Number));assert.equal(new Set(positions.map(p=>p.join(','))).size,75);let minimum=Infinity;for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)minimum=Math.min(minimum,Math.hypot(positions[i][0]-positions[j][0],positions[i][1]-positions[j][1]));assert(minimum>40,'Nodes should have meaningful separation');assert(svg.querySelector('[data-network-viewport]').getAttribute('transform').includes('scale('));assert(svg.querySelectorAll('.node-label[style*="display:none"]').length>40);
 graph.highlight('0');assert.equal(selected,'0');assert.equal(svg.querySelectorAll('.node.selected').length,1);assert.equal(svg.querySelector('[data-node-id="0"]').getAttribute('aria-pressed'),'true');assert(svg.querySelectorAll('.selected-edge').length>0);assert(svg.querySelectorAll('.network-muted').length>0);
 assert.equal(svg.querySelector('[data-node-id="0"] .node-label').style.display,'');
 svg.querySelector('[data-node-id="0"]').onmouseenter();assert.equal([...svg.querySelectorAll('.node-label')].filter(el=>el.style.display!=='none').length,1);
 assert.equal(graph.toggleLabels(),true);assert([...svg.querySelectorAll('.node-label')].every(el=>el.style.display===''));
 assert.equal(graph.toggleLabels(),false);assert.equal([...svg.querySelectorAll('.node-label')].filter(el=>el.style.display!=='none').length,1);
 graph.highlight('0');assert.equal(selected,'0');graph.highlight(null);assert.equal(selected,null);assert.equal(svg.querySelectorAll('.node.selected').length,0);assert([...svg.querySelectorAll('.node-label')].every(el=>el.style.display==='none'));graph.destroy();delete globalThis.document;
});

test('weighted connections enlarge node areas while only the selected label overrides hidden labels',()=>{
 const {document}=parseHTML('<html><body><svg></svg></body></html>');globalThis.document=document;const svg=document.querySelector('svg'),nodes=['a','b','c','d','e'].map(id=>({id,name:id,label:id}));const graph=drawNetwork(svg,{nodes,edges:[{source:'a',target:'b',weight:20},{source:'c',target:'d',weight:1}]},{authors:true});
 const radius=id=>Number(svg.querySelector(`[data-node-id="${id}"] circle:not(.selection-ring)`).getAttribute('r'));assert(radius('a')>radius('c'));assert(radius('c')>radius('e'));assert(radius('a')**2/radius('c')**2>4);assert(radius('a')**2/radius('e')**2<=7.37);assert(radius('a')<=38);assert.equal(graph.toggleLabels(),false);graph.highlight('a',{focus:false});svg.querySelector('[data-node-id="a"]').onmouseenter();assert.equal(svg.querySelector('[data-node-id="a"] .node-label').style.display,'');assert([...svg.querySelectorAll('.node:not(.selected) .node-label')].every(el=>el.style.display==='none'));graph.reset();assert([...svg.querySelectorAll('.node-label')].every(el=>el.style.display==='none'));assert.equal(graph.toggleLabels(),true);assert([...svg.querySelectorAll('.node-label')].every(el=>el.style.display===''));graph.destroy();delete globalThis.document;
});

test('citation highlighting gives incoming and outgoing links matching colored arrows and trims edges outside nodes',()=>{
 const {document}=parseHTML('<html><body><svg></svg></body></html>');globalThis.document=document;const svg=document.querySelector('svg'),nodes=['a','b','c','d'].map(id=>({id,label:id,short_label:'PRE'}));
 const graph=drawNetwork(svg,{nodes,edges:[{source:'b',target:'a',weight:1},{source:'a',target:'c',weight:1},{source:'d',target:'c',weight:1}]});graph.highlight('a',{focus:false});
 const incoming=svg.querySelector('.incoming-edge'),outgoing=svg.querySelector('.outgoing-edge');assert(incoming&&outgoing);assert.equal(incoming.getAttribute('stroke'),'#2879b8');assert.equal(outgoing.getAttribute('stroke'),'#d46b38');assert.equal(svg.querySelectorAll('.network-edge.network-muted').length,1);
 for(const [edge,color] of [[incoming,'#2879b8'],[outgoing,'#d46b38']]){const marker=edge.getAttribute('marker-end').slice(5,-1);assert.equal(svg.querySelector('#'+marker+' path').getAttribute('fill'),color);}
 const target=svg.querySelector('[data-node-id="a"]'),position=target.getAttribute('transform').match(/translate\(([^,]+),([^\)]+)\)/).slice(1).map(Number),radius=Number(target.querySelector('circle:not(.selection-ring)').getAttribute('r'));assert(Math.hypot(+incoming.getAttribute('x2')-position[0],+incoming.getAttribute('y2')-position[1])>=radius);
 graph.reset();assert.equal(svg.querySelectorAll('.incoming-edge,.outgoing-edge,.selected-edge').length,0);graph.destroy();delete globalThis.document;
});

test('the rendered graph handles pinches starting on a node without opening its paper',()=>{
 const {document,window}=parseHTML('<html><body><svg></svg></body></html>');globalThis.document=document;window.PointerEvent=function(){};const svg=document.querySelector('svg');svg.getBoundingClientRect=()=>({left:0,top:0,width:400,height:500});Object.defineProperty(svg,'clientWidth',{value:400});Object.defineProperty(svg,'clientHeight',{value:500});svg.setPointerCapture=()=>{};let clicked=0;
 const graph=drawNetwork(svg,{nodes:[{id:'a',label:'Paper A',short_label:'PRE'}],edges:[]},{onClick:()=>clicked++}),viewport=svg.querySelector('[data-network-viewport]'),before=Number(viewport.getAttribute('transform').match(/scale\(([^)]+)\)/)[1]);
 const event=(type,id,x,target=svg)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:id,pointerType:'touch',clientX:x,clientY:100,button:0});target.dispatchEvent(e);};
 event('pointerdown',1,100,svg.querySelector('.node circle'));event('pointerdown',2,200);event('pointermove',2,300);const after=Number(viewport.getAttribute('transform').match(/scale\(([^)]+)\)/)[1]);assert.equal(after,before*2);event('pointerup',2,300);event('pointerup',1,100);assert.equal(clicked,0);graph.destroy();delete globalThis.document;
});

test('citation node first activation selects and shows its label, second opens; author activation stays selected', () => {
 for(const authors of [false,true]) {
  const {document}=parseHTML('<html><body><svg></svg></body></html>');const svg=document.querySelector('svg');
  const nodes=Array.from({length:45},(_,i)=>({id:String(i),label:'Paper '+i,name:'Author '+i,short_label:'PRE'}));let opened=0;
  const graph=drawNetwork(svg,{nodes,edges:[{source:'0',target:'1'}]},{authors,onClick:()=>opened++});
  const activate=id=>svg.querySelector(`[data-node-id="${id}"]`).onkeydown({key:'Enter',preventDefault(){}});
  activate('0');assert.equal(opened,0);assert.equal(svg.querySelectorAll('.node.selected').length,1);assert.equal(svg.querySelector('[data-node-id="0"] .node-label').style.display,'');
  assert.equal(svg.querySelector('[data-node-id="1"] .node-label').style.display,'none');assert(svg.querySelector('.selected-edge'));
  activate('0');assert.equal(opened,authors?0:1);assert(svg.querySelector('[data-node-id="0"]').classList.contains('selected'));
  activate('1');assert.equal(opened,authors?0:1);assert.equal(svg.querySelector('[data-node-id="0"] .node-label').style.display,'none');
  graph.reset();assert.equal(svg.querySelectorAll('.node.selected').length,0);graph.destroy();
 }
});

test('layout computation uses the worker once, caches positions, and ignores late results after destroy', async () => {
 const previous=globalThis.Worker,workers=[];
 class MockWorker {constructor(){workers.push(this);}postMessage(payload){this.payload=payload;}terminate(){this.terminated=true;}}
 globalThis.Worker=MockWorker;
 try {
  const data={nodes:[{id:'cache-a',label:'A'},{id:'cache-b',label:'B'}],edges:[{source:'cache-a',target:'cache-b'}]};
  const mount=()=>{const {document}=parseHTML('<html><body><div class="graph-wrap"><svg></svg><div class="network-loading" hidden></div></div></body></html>');const svg=document.querySelector('svg');return {svg,graph:drawNetwork(svg,data)};};
  const first=mount();assert.equal(workers.length,1);assert.equal(first.svg.getAttribute('aria-busy'),'true');
  const positions=[{id:'cache-a',x:100,y:100,community:'one'},{id:'cache-b',x:260,y:150,community:'one'}];
  workers[0].onmessage({data:{positions}});await first.graph.ready;assert.equal(first.svg.getAttribute('aria-busy'),'false');
  const before=first.svg.querySelector('[data-node-id="cache-a"]').getAttribute('transform');first.graph.destroy();
  const second=mount();await second.graph.ready;assert.equal(workers.length,1,'Cached reopening must not create another physics worker');assert.equal(second.svg.querySelector('[data-node-id="cache-a"]').getAttribute('transform'),before);second.graph.destroy();
  data.edges[0].weight=8;const third=mount();assert.equal(workers.length,2);const pending=workers[1],initial=third.svg.querySelector('.node').getAttribute('transform');third.graph.destroy();assert(pending.terminated);
  pending.onmessage({data:{positions}});await third.graph.ready;assert.equal(third.svg.querySelector('.node').getAttribute('transform'),initial);
 } finally {if(previous===undefined)delete globalThis.Worker;else globalThis.Worker=previous;}
});

test('hover does not repaint the graph and dragging updates only the node and its incident edges', () => {
 const {document,window}=parseHTML('<html><body><svg></svg></body></html>');window.PointerEvent=function(){};const svg=document.querySelector('svg');svg.getBoundingClientRect=()=>({left:0,top:0,width:840,height:620});
 const data={nodes:['drag-a','drag-b','drag-c','drag-d'].map(id=>({id,label:id})),edges:[{source:'drag-a',target:'drag-b'},{source:'drag-c',target:'drag-d'}]};
 const graph=drawNetwork(svg,data);let writes=0;
 for(const el of svg.querySelectorAll('*')){const set=el.setAttribute.bind(el);el.setAttribute=(...args)=>{writes++;return set(...args);};}
 const node=svg.querySelector('[data-node-id="drag-a"]');node.onmouseenter();node.onmouseleave();assert.equal(writes,0);
 const stableNode=svg.querySelector('[data-node-id="drag-c"]').getAttribute('transform'),stableEdge=svg.querySelectorAll('.network-edge')[1].outerHTML;
 const event=(type,x,y)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'mouse',clientX:x,clientY:y,button:0});node.querySelector('circle').dispatchEvent(e);};
 event('pointerdown',100,100);event('pointermove',140,140);event('pointerup',140,140);
 assert(writes>0);assert.equal(svg.querySelector('[data-node-id="drag-c"]').getAttribute('transform'),stableNode);assert.equal(svg.querySelectorAll('.network-edge')[1].outerHTML,stableEdge);graph.destroy();
});
