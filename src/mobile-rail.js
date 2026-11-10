export function mountMobileRail(sidebar, shell, enabled) {
  const doc=sidebar.ownerDocument;
  const layer=doc.createElement('span'),tip=doc.createElement('span');
  layer.className='mobile-rail-highlight';tip.className='mobile-rail-label';
  layer.hidden=tip.hidden=true;
  layer.setAttribute('aria-hidden','true');tip.setAttribute('aria-hidden','true');
  sidebar.prepend(layer);shell.append(tip);
  const selector='.nav-link,.tag-nav,#logout';
  let press=null,timer,suppressUntil=0,current=null;

  function preview(item){
    if(!item||item===current)return;
    const rect=item.getBoundingClientRect(),rail=sidebar.getBoundingClientRect();
    const label=item.querySelector('.nav-label')?.textContent?.trim()||item.getAttribute('aria-label')||item.getAttribute('title')||'';
    layer.style.transform=`translate3d(${rect.left-rail.left+(sidebar.scrollLeft||0)}px,${rect.top-rail.top+(sidebar.scrollTop||0)}px,0)`;
    layer.style.width=rect.width+'px';layer.style.height=rect.height+'px';
    tip.style.left=(rail.right+8)+'px';tip.style.top=(rect.top+rect.height/2)+'px';tip.textContent=label;
    layer.hidden=false;tip.hidden=!label;current=item;
  }
  function clear(){
    clearTimeout(timer);press=null;current=null;layer.hidden=tip.hidden=true;
  }
  sidebar.addEventListener('pointerdown',event=>{
    if(!enabled()||!event.isPrimary||event.pointerType==='mouse'||event.button>0)return;
    const item=event.target.closest(selector);if(!item)return;
    suppressUntil=0;press={id:event.pointerId,start:event.clientY,y:event.clientY,held:false,moved:false};
    item.setPointerCapture?.(event.pointerId);
    timer=setTimeout(()=>{if(!press)return;press.held=true;preview(item);},360);
  });
  sidebar.addEventListener('pointermove',event=>{
    if(!press||press.id!==event.pointerId)return;
    if(press.held){
      const rail=sidebar.getBoundingClientRect();
      const item=doc.elementFromPoint((rail.left+rail.right)/2,event.clientY)?.closest(selector);
      if(item&&sidebar.contains(item))preview(item);
    }else if(press.moved||Math.abs(event.clientY-press.start)>8){
      clearTimeout(timer);press.moved=true;sidebar.scrollTop+=press.y-event.clientY;
    }
    press.y=event.clientY;
  });
  const finish=event=>{
    if(!press||press.id!==event.pointerId)return;
    if(press.held||press.moved)suppressUntil=Date.now()+500;
    clear();
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])sidebar.addEventListener(type,finish);
  sidebar.addEventListener('click',event=>{
    if(Date.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  sidebar.addEventListener('contextmenu',event=>{
    if(enabled()&&event.target.closest(selector))event.preventDefault();
  });
  return clear;
}
