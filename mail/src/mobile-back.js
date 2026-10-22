// Edge-only touch navigation leaves ordinary horizontal scrolling and dragging alone.
export function installMobileBack({canGoBack,goBack,onError}){
 let gesture=null,busy=false,suppressClickUntil=0,hint;
 const hide=()=>{if(hint)hint.classList.remove('visible','ready');};
 const reset=()=>{gesture=null;hide();};
 const show=(y,progress)=>{
  if(!hint){hint=document.createElement('div');hint.className='mobile-back-hint';hint.setAttribute('aria-hidden','true');hint.textContent='‹';document.body.append(hint);}
  hint.style.top=Math.max(70,Math.min(innerHeight-70,y))+'px';
  hint.style.setProperty('--back-progress',Math.min(1,progress));
  hint.classList.add('visible');hint.classList.toggle('ready',progress>=1);
 };
 document.addEventListener('touchstart',event=>{
  reset();
  if(busy||event.touches.length!==1||!matchMedia('(max-width:700px)').matches)return;
  const point=event.touches[0],target=event.target;
  if(point.clientX>28||!target.closest?.('#app,#modal-root')||target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),canvas,[data-column-resize],[data-drag-category],[draggable="true"]'))return;
  gesture={id:point.identifier,x:point.clientX,y:point.clientY,dx:0,dy:0,active:false,threshold:Math.max(72,Math.min(96,innerWidth*.23))};
 },{passive:true});
 document.addEventListener('touchmove',event=>{
  const g=gesture;if(!g)return;
  if(event.touches.length!==1){reset();return;}
  const point=event.touches[0];if(point.identifier!==g.id){reset();return;}
  g.dx=point.clientX-g.x;g.dy=point.clientY-g.y;
  if(!g.active){
   if(Math.abs(g.dy)>10&&Math.abs(g.dy)>=g.dx||g.dx< -8){reset();return;}
   if(g.dx<10||g.dx<Math.abs(g.dy)*1.6)return;
   g.active=true;
  }
  if(!event.cancelable){reset();return;}
  event.preventDefault();if(canGoBack())show(g.y,g.dx/g.threshold);else hide();
 },{passive:false});
 document.addEventListener('touchend',event=>{
  const g=gesture;if(!g)return;
  const point=[...event.changedTouches].find(p=>p.identifier===g.id);if(!point)return;
  reset();
  if(!g.active)return;
  suppressClickUntil=Date.now()+400;
  const dx=point.clientX-g.x,dy=Math.abs(point.clientY-g.y);
  if(event.touches.length||dx<g.threshold||dx<dy*1.6||!canGoBack())return;
  busy=true;
  Promise.resolve().then(goBack).catch(onError).finally(()=>{busy=false;});
 },{passive:true});
 document.addEventListener('touchcancel',reset,{passive:true});
 document.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
 window.addEventListener('resize',reset);
 window.addEventListener('blur',reset);
}
