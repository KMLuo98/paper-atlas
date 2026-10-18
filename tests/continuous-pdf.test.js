import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {fitPDFPage} from '../src/pdf-navigation.js';
const source=fs.readFileSync(new URL('../src/continuous-pdf.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
test('continuous PDF retains all pages, renders successive pages and preserves jump/previous controls',async()=>{
 const observers=[],rendered=[],steps=[{dataset:{step:'-1'}},{dataset:{step:'1'}}];let destroyed=0;
 class Element{constructor(){this.children=[];this.dataset={};this.style={};this.clientWidth=390;this.value='1';}setAttribute(k,v){this[k]=v;}append(child){this.children.push(child);}replaceChildren(...children){this.children=children;}querySelector(selector){return selector==='canvas'?this.children.find(c=>c.tag==='canvas'):null;}scrollIntoView(){this.scrolled=true;}getContext(){return {};}}
 const host=new Element(),input=new Element(),status=new Element(),submit=new Element(),form=new Element(),total=new Element();form.querySelector=()=>submit;
 const container=new Element();container.querySelector=selector=>({'.pdf-canvas-host':host,'[role=status]':status,input,form,'form button':submit,'.pdf-page-total':total}[selector]);container.querySelectorAll=()=>steps;
 class Observer{constructor(fn,options){this.fn=fn;this.options=options;this.targets=[];observers.push(this);}observe(el){this.targets.push(el);}disconnect(){this.disconnected=true;}}
 const pdf={numPages:3,async getPage(number){return {getViewport:({scale})=>({width:600*scale,height:(number===2?400:800)*scale}),render(){rendered.push(number);return {promise:Promise.resolve(),cancel(){}};},cleanup(){}};}};
 const context={openPDFTask:async()=>({promise:Promise.resolve(pdf),async destroy(){destroyed++;}}),fitPDFPage,e:s=>s,document:{createElement:tag=>Object.assign(new Element(),{tag})},window:{devicePixelRatio:2},IntersectionObserver:Observer,ResizeObserver:Observer,setTimeout,clearTimeout,console};vm.createContext(context);vm.runInContext(source,context);
 const dispose=context.mountResponsivePDF(container,'https://example.com/paper.pdf','Paper');await new Promise(r=>setImmediate(r));assert.equal(host.children.length,3);assert(rendered.includes(1));
 const near=observers.find(o=>o.options?.rootMargin);near.fn(host.children.map(target=>({target,isIntersecting:true})));await new Promise(r=>setImmediate(r));assert.deepEqual(rendered,[1,2,3]);assert(host.children.every(slot=>slot.querySelector('canvas')));
 input.value='3';form.onsubmit({preventDefault(){}});assert(host.children[2].scrolled);assert.equal(steps[1].disabled,true);steps[0].onclick();assert(host.children[1].scrolled);assert.equal(input.value,2);
 dispose();await new Promise(r=>setImmediate(r));assert.equal(destroyed,1);assert(observers.every(o=>o.disconnected));
});
