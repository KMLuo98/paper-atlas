import test from 'node:test';import assert from 'node:assert/strict';import {PDFDocument,degrees} from 'pdf-lib';
import {annotatedPDF} from '../src/pdf-export.js';
test('annotated export preserves pages and rotation and embeds rendered Chinese notes and highlights',async()=>{
 const original=await PDFDocument.create();original.setTitle('Research PDF');original.addPage([500,700]).drawText('Original research');original.addPage([700,500]).setRotation(degrees(90));const bytes=await original.save(),texts=[],sizes=[];
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBGkAAAAASUVORK5CYII=','base64');
 const makeCanvas=()=>{const ctx={scale(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(){},fillText(text){texts.push(text);}};const canvas={width:0,height:0,getContext:()=>ctx,toBlob(callback){sizes.push([canvas.width,canvas.height]);callback(new Blob([png],{type:'image/png'}));}};return canvas;};
 const result=await annotatedPDF('https://example.edu/a.pdf',[{type:'note',page:1,x:.2,y:.3,size:.02,color:'#333333',text:'中文备注'},{type:'highlight',page:2,size:.02,color:'#ffcc00',points:[[.1,.2],[.5,.2]]}],{fetcher:async()=>new Response(bytes),makeCanvas});
 const pdf=await PDFDocument.load(await result.arrayBuffer());assert.equal(pdf.getPageCount(),2);assert.equal(pdf.getTitle(),'Research PDF');assert.equal(pdf.getPages()[1].getRotation().angle,90);assert(texts.includes('中文备注'));assert.equal(sizes.length,2);assert(sizes.every(([w,h])=>w*h<=6000000));assert.match(pdf.getPage(0).node.Resources().toString(),/XObject/);
});
