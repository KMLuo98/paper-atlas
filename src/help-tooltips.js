export function installHelpTooltips(doc=document){
 const view=doc.defaultView,tip=doc.createElement('div');tip.className='floating-help-tooltip';tip.id='pa-floating-help';tip.setAttribute('role','tooltip');tip.setAttribute('popover','manual');tip.hidden=true;doc.body.append(tip);
 let active=null,previous=null,timer;
 const trigger=target=>target?.closest?.('.help-tooltip');
 function hide(){clearTimeout(timer);if(active){if(previous===null)active.removeAttribute('aria-describedby');else active.setAttribute('aria-describedby',previous);}active=null;try{tip.hidePopover?.();}catch{}tip.hidden=true;}
 function position(){
  if(!active)return;if(!active.isConnected){hide();return;}
  const r=active.getBoundingClientRect(),width=view.innerWidth||1024,height=view.innerHeight||768,pad=12;
  if(r.bottom<0||r.top>height||r.right<0||r.left>width){hide();return;}
  tip.style.width=Math.min(340,width-pad*2)+'px';tip.style.maxHeight=Math.max(40,height-pad*2)+'px';
  const box=tip.getBoundingClientRect(),w=Math.min(box.width||340,width-pad*2),h=Math.min(box.height||80,height-pad*2);
  tip.style.left=Math.max(pad,Math.min(width-w-pad,r.left+r.width/2-w/2))+'px';
  const above=r.top-h-9,below=r.bottom+9;tip.style.top=Math.max(pad,Math.min(height-h-pad,above>=pad?above:below))+'px';
 }
 function show(el){const content=el.querySelector('[role="tooltip"]')||el.querySelector('span');if(!content?.textContent.trim())return;clearTimeout(timer);if(active!==el){hide();active=el;previous=el.getAttribute('aria-describedby');el.setAttribute('aria-describedby',[previous,tip.id].filter(Boolean).join(' '));}tip.textContent=content.textContent;tip.hidden=false;try{tip.showPopover?.();}catch{}position();}
 const over=e=>{const el=trigger(e.target);if(el)show(el);else if(tip.contains(e.target))clearTimeout(timer);};
 const out=e=>{if(active&&(active.contains(e.target)||tip.contains(e.target))){if(active.contains(e.relatedTarget)||tip.contains(e.relatedTarget))return;timer=setTimeout(hide,120);}};
 const click=e=>{const el=trigger(e.target);if(el)show(el);else if(!tip.contains(e.target))hide();};
 const key=e=>{if(e.key==='Escape'&&active){hide();e.stopImmediatePropagation();}else if((e.key==='Enter'||e.key===' ')&&trigger(e.target)){e.preventDefault();show(trigger(e.target));}};
 const scroll=e=>{if(!tip.contains(e.target))position();};
 doc.addEventListener('pointerover',over);doc.addEventListener('pointerout',out);doc.addEventListener('focusin',over);doc.addEventListener('focusout',out);doc.addEventListener('click',click);doc.addEventListener('keydown',key);doc.addEventListener('scroll',scroll,true);view.addEventListener('resize',position);view.addEventListener('hashchange',hide);
 return ()=>{hide();tip.remove();for(const [name,fn] of [['pointerover',over],['pointerout',out],['focusin',over],['focusout',out],['click',click],['keydown',key]])doc.removeEventListener(name,fn);doc.removeEventListener('scroll',scroll,true);view.removeEventListener('resize',position);view.removeEventListener('hashchange',hide);};
}
