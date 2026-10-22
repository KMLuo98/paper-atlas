// Local files, clipboard and user-initiated display capture share the same crop step.
export function openPhotoInput({overlay,close,onChoose,onAutoMatch,onError}){
 let imageURL='',dispose=()=>{};
 const notify=text=>{const n=document.querySelector('#photo-input-message');if(n)n.textContent=text;};
 const crop=async blob=>{
  if(!/^image\/(png|jpeg|webp)$/.test(blob.type))throw Error('请选择 PNG、JPEG 或 WebP 图片');
  if(blob.size>25000000)throw Error('图片最大 25MB');
  if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(blob);
  const image=new Image();image.src=imageURL;await image.decode();
  const stage=document.querySelector('#photo-crop');stage.innerHTML='<canvas aria-label="拖动选择裁剪区域"></canvas><p>在图片上拖动选择区域；也可使用完整图片。</p><button type="button" class="secondary" id="crop-reset">使用完整图片</button><button type="button" class="primary" id="crop-accept">确认照片</button>';
  const canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d');canvas.width=Math.min(1200,image.naturalWidth);canvas.height=Math.round(image.naturalHeight*canvas.width/image.naturalWidth);
  let box=null,anchor=null;
  const paint=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);if(box){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.setLineDash([8,4]);ctx.strokeRect(box.x,box.y,box.w,box.h);}};
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width,(e.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-r.top)*canvas.height/r.height))};};
  canvas.onpointerdown=e=>{e.preventDefault();anchor=point(e);canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!anchor)return;const p=point(e);box={x:Math.min(p.x,anchor.x),y:Math.min(p.y,anchor.y),w:Math.abs(p.x-anchor.x),h:Math.abs(p.y-anchor.y)};paint();};
  canvas.onpointerup=canvas.onpointercancel=()=>{anchor=null;if(box&&(box.w<8||box.h<8))box=null;paint();};
  document.querySelector('#crop-reset').onclick=()=>{box=null;paint();};
  document.querySelector('#crop-accept').onclick=async()=>{try{const b=box||{x:0,y:0,w:canvas.width,h:canvas.height},ratio=image.naturalWidth/canvas.width,out=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(b.w*ratio,b.h*ratio));out.width=Math.max(1,Math.round(b.w*ratio*scale));out.height=Math.max(1,Math.round(b.h*ratio*scale));out.getContext('2d').drawImage(image,b.x*ratio,b.y*ratio,b.w*ratio,b.h*ratio,0,0,out.width,out.height);const file=await new Promise(r=>out.toBlob(r,'image/jpeg',.9));if(!file||file.size>2000000)throw Error('裁剪后仍超过 2MB，请缩小区域');await onChoose(new File([file],'avatar.jpg',{type:file.type}));dispose();close();}catch(e){notify(e.message);}};
  paint();
 };
 overlay('选择照片',(onAutoMatch?'<div class="photo-auto-search"><button type="button" class="primary" id="photo-auto">自动匹配照片</button></div>':'')+'<div class="photo-upload-zone" id="photo-drop" tabindex="0"><strong>将照片拖到这里，或粘贴剪贴板中的图片</strong><div><label class="secondary file-button">选择文件<input id="photo-upload" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button type="button" class="secondary" id="photo-paste">读取剪贴板</button><button type="button" class="secondary" id="photo-screen">截图并裁剪</button></div></div><p role="status" id="photo-input-message"></p><div id="photo-crop"></div>');
 const root=document.querySelector('#review-overlay'),zone=document.querySelector('#photo-drop');if(onAutoMatch)document.querySelector('#photo-auto').onclick=()=>{dispose();Promise.resolve().then(onAutoMatch).catch(onError||notify);};
 const run=fn=>Promise.resolve().then(fn).catch(e=>notify(e.message||'当前浏览器暂不支持此操作，可以选择文件或直接粘贴。'));
 document.querySelector('#photo-upload').onchange=e=>{if(e.target.files[0])run(()=>crop(e.target.files[0]));};
 zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over');};zone.ondragleave=()=>zone.classList.remove('drag-over');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('drag-over');if(e.dataTransfer.files[0])run(()=>crop(e.dataTransfer.files[0]));};
 const paste=e=>{if(!root.isConnected)return;const file=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'))?.getAsFile();if(file){e.preventDefault();run(()=>crop(file));}};
 document.addEventListener('paste',paste);
 document.querySelector('#photo-paste').onclick=()=>run(async()=>{if(!navigator.clipboard?.read)throw Error('浏览器不支持直接读取，请使用 Ctrl+V 或手机粘贴');const entries=await navigator.clipboard.read();for(const entry of entries){const type=entry.types.find(t=>/^image\/(png|jpeg|webp)$/.test(t));if(type){await crop(await entry.getType(type));return;}}throw Error('剪贴板中没有图片');});
 document.querySelector('#photo-screen').onclick=()=>run(async()=>{if(!navigator.mediaDevices?.getDisplayMedia)throw Error('当前浏览器不支持网页截图，请用系统截图后粘贴或选择照片');let stream;try{stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});const video=document.createElement('video');video.srcObject=stream;await video.play();await new Promise(r=>video.requestVideoFrameCallback?video.requestVideoFrameCallback(r):setTimeout(r,120));const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0);const blob=await new Promise(r=>c.toBlob(r,'image/png'));await crop(blob);}finally{stream?.getTracks().forEach(t=>t.stop());}});
 const observer=new MutationObserver(()=>{if(!root.isConnected)dispose();});observer.observe(root.parentNode,{childList:true});
 dispose=()=>{document.removeEventListener('paste',paste);observer.disconnect();if(imageURL){URL.revokeObjectURL(imageURL);imageURL='';}};
}
