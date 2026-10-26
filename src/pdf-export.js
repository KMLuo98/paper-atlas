export async function annotatedPDF(url,marks,{fetcher=fetch,makeCanvas=()=>document.createElement('canvas')}={}){
 const response=await fetcher(url);if(!response.ok)throw Error('PDF 下载失败 / PDF download failed');const bytes=new Uint8Array(await response.arrayBuffer());if(!marks.length)return new Blob([bytes],{type:'application/pdf'});
 const {PDFDocument,degrees}=await import('pdf-lib'),pdf=await PDFDocument.load(bytes);const pageNumbers=[...new Set(marks.map(m=>m.page))];
 for(const number of pageNumbers){const page=pdf.getPages()[number-1];if(!page)continue;const original=page.getSize(),rotation=(page.getRotation().angle%360+360)%360,width=rotation%180?original.height:original.width,height=rotation%180?original.width:original.height,canvas=makeCanvas(),ratio=Math.min(2,Math.sqrt(6000000/(width*height)));canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  for(const m of marks.filter(m=>m.page===number)){
   ctx.save();ctx.strokeStyle=ctx.fillStyle=m.color;ctx.lineWidth=m.size*width;ctx.lineCap=ctx.lineJoin='round';
   if(m.type==='ink'||m.type==='highlight'){ctx.globalAlpha=m.type==='highlight'?.28:1;ctx.beginPath();m.points.forEach(([x,y],i)=>i?ctx.lineTo(x*width,y*height):ctx.moveTo(x*width,y*height));if(m.points.length===1){const [x,y]=m.points[0];ctx.lineTo(x*width+.1,y*height);}ctx.stroke();}
   else{const x=m.x*width,y=m.y*height,size=Math.max(9,m.size*width),lines=m.text.match(/[^\n]{1,24}|\n/g)||[''];if(m.type==='note'){ctx.fillStyle='#fff2a3';ctx.fillRect(x,y-size,Math.min(width-x,240),Math.min(lines.length,12)*(size*1.3)+size*.5);ctx.fillStyle='#453b17';}ctx.font=size+'px sans-serif';lines.slice(0,12).forEach((line,i)=>ctx.fillText(line,x+3,y+i*size*1.3,Math.max(1,width-x-5)));}ctx.restore();
  }
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('批注导出失败');const image=await pdf.embedPng(await blob.arrayBuffer());const placement=rotation===90?{x:0,y:original.height,rotate:degrees(-90)}:rotation===180?{x:original.width,y:original.height,rotate:degrees(180)}:rotation===270?{x:original.width,y:0,rotate:degrees(90)}:{x:0,y:0};page.drawImage(image,{...placement,width,height});canvas.width=canvas.height=1;
 }
 return new Blob([await pdf.save()],{type:'application/pdf'});
}
