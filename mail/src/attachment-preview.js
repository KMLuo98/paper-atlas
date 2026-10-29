export function openAttachmentPreview(file,{modal}){
 const data=file.bytes,name=file.filename||'附件',type=String(file.mime_type||'').toLowerCase(),ext=name.split('.').at(-1).toLowerCase();
 modal(name,'<section class="attachment-preview"><div class="attachment-preview-tools"><span class="attachment-preview-status" role="status">正在准备预览…</span><button type="button" class="secondary" data-preview-download>下载附件</button></div><div class="attachment-preview-body"></div></section>',true);
 const root=document.querySelector('.attachment-preview'),body=root.querySelector('.attachment-preview-body'),status=root.querySelector('[role=status]');root.closest('.modal').classList.add('attachment-preview-modal');
 let alive=true,url=URL.createObjectURL(new Blob([data],{type})),loading=null,renderTask=null,resize=null;
 root.querySelector('[data-preview-download]').addEventListener('click',()=>{const a=document.createElement('a');a.href=url;a.download=name;a.click();});
 const fail=message=>{if(alive){status.textContent=message;body.replaceChildren();}};
 const pdf=new TextDecoder().decode(data.subarray(0,5))==='%PDF-';
 if(pdf){
  (async()=>{
   const pdfjs=await import('pdfjs-dist');if(!alive)return;pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).href;
   loading=pdfjs.getDocument({data:new Uint8Array(data),isEvalSupported:false,useSystemFonts:true});
   const doc=await loading.promise;if(!alive)return;let number=1,busy=false;
   const nav=document.createElement('div');nav.className='attachment-pdf-nav';
   const prev=document.createElement('button'),next=document.createElement('button'),pageLabel=document.createElement('span');prev.type=next.type='button';prev.className=next.className='secondary';prev.textContent='上一页';next.textContent='下一页';nav.append(prev,pageLabel,next);root.querySelector('.attachment-preview-tools').prepend(nav);
   async function draw(){
    if(!alive||busy)return;busy=true;prev.disabled=next.disabled=true;
    try{const page=await doc.getPage(number);if(!alive)return;const original=page.getViewport({scale:1}),width=Math.max(180,body.clientWidth-24),scale=Math.min(width/original.width,2),ratio=Math.min(devicePixelRatio||1,2),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.maxWidth='100%';canvas.setAttribute('aria-label','PDF 第 '+number+' 页');body.replaceChildren(canvas);renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]});await renderTask.promise;if(alive){status.textContent='PDF 预览';pageLabel.textContent=number+' / '+doc.numPages;}}
    finally{busy=false;if(alive){prev.disabled=number<=1;next.disabled=number>=doc.numPages;}}
   }
   prev.addEventListener('click',()=>{if(number>1&&!busy){number--;draw().catch(()=>fail('PDF 显示失败，可下载查看'));}});next.addEventListener('click',()=>{if(number<doc.numPages&&!busy){number++;draw().catch(()=>fail('PDF 显示失败，可下载查看'));}});
   let width=body.clientWidth;resize=()=>{if(body.clientWidth!==width){width=body.clientWidth;draw().catch(()=>{});}};window.addEventListener('resize',resize);await draw();
  })().catch(()=>fail('PDF 暂无法预览，可能需要密码或文件已损坏，可下载查看'));
 }else if(/^(png|jpe?g|gif|webp|bmp|avif|ico)$/.test(ext)||/^image\/(png|jpeg|gif|webp|bmp|avif|x-icon)$/.test(type)){
  const image=document.createElement('img');image.alt=name;image.src=url;image.onload=()=>{if(alive)status.textContent='图片预览';};image.onerror=()=>fail('图片无法显示，可下载查看');body.append(image);
 }else if(/^text\//.test(type)||/^(txt|csv|tsv|md|log|json|xml|html?|css|js|ts|py|tex|yaml|yml|svg)$/.test(ext)){
  const pre=document.createElement('pre');pre.textContent=new TextDecoder().decode(data);body.append(pre);status.textContent='文本预览';
 }else fail('此格式暂不支持站内预览，请下载后打开');
 return ()=>{alive=false;renderTask?.cancel();loading?.destroy()?.catch(()=>{});if(resize)window.removeEventListener('resize',resize);URL.revokeObjectURL(url);};
}
