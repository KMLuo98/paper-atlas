import './responsive-ui.css';
import {scheduleToolbarFit} from './responsive-toolbars.js';

const mobile=matchMedia('(max-width:700px)');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const root=document.documentElement;
let pendingSwitch;
const switchStates=new Map();
const switchGroups='.contact-layout-switch,.mail-language-switch,.mail-appearance-options';
function paintSidebarState(){
 const sidebar=document.querySelector('.sidebar');
 if(!sidebar)return;
 for(const row of sidebar.querySelectorAll('.brand,.compose-btn,.inbox-nav-link,button.nav-item,.mailbox-link,.section-label')){
  const glyph=row.firstElementChild;
  if(glyph?.matches('svg,[data-lucide],.all-dot,.color-dot')){
   const slot=document.createElement('span');slot.className='sidebar-glyph';slot.setAttribute('aria-hidden','true');
   glyph.replaceWith(slot);slot.append(glyph);
  }
  for(const child of [...row.childNodes]){
   if(child.nodeType===3&&child.textContent.trim()){
    const label=document.createElement('span');label.className='sidebar-label';child.replaceWith(label);label.append(child);
   }else if(child.nodeType===1&&child.matches('span:not(.sidebar-glyph):not(.error-dot),small'))child.classList.add('sidebar-label');
  }
 }
 sidebar.querySelector('.profile-chip>div')?.classList.add('sidebar-label');
 sidebar.querySelector('.sidebar-hint')?.classList.add('sidebar-label');
 sidebar.toggleAttribute('data-collapsed',root.dataset.mailSidebar==='collapsed');
}
try {root.dataset.mailSidebar=localStorage.getItem('mail-sidebar')==='collapsed'?'collapsed':'expanded';}catch{}

export function paintMobileNavigation(open) {
  const shell=document.querySelector('.app-shell');
  shell?.toggleAttribute('data-nav-open',open);
  shell?.querySelector('.sidebar')?.classList.toggle('open',open);
  const scrim=shell?.querySelector('.nav-scrim');
  if(scrim){scrim.tabIndex=open?0:-1;scrim.setAttribute('aria-hidden',String(!open));}
  shell?.querySelector('.mobile-menu')?.setAttribute('aria-expanded',String(open));
}

export function sidebarBeforeRender() {
  captureSwitches();
  const sidebar=document.querySelector('.sidebar');
  return sidebar&&mobile.matches?sidebar.classList.contains('open'):null;
}

export function sidebarAfterRender(wasOpen,open) {
  paintMobileNavigation(open);
  if(wasOpen!==null&&wasOpen!==open&&mobile.matches&&!reduced.matches) {
    document.querySelector('.sidebar')?.animate([
      {transform:wasOpen?'translateX(0)':'translateX(-100%)'},
      {transform:open?'translateX(0)':'translateX(-100%)'}
    ],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
  }
}

function switchKey(group) {
  if(group.matches('[data-language-control]'))return 'language';
  if(group.matches('.mail-appearance-options'))return 'appearance';
  return group.querySelector('[data-ms="layout"]')?'manuscript-layout':'contact-layout';
}

function localBox(element,group){
 const rect=element.getBoundingClientRect(),parent=group.getBoundingClientRect();
 return {x:rect.left-parent.left-group.clientLeft,y:rect.top-parent.top-group.clientTop,width:rect.width,height:rect.height};
}

export function captureSwitches(){
 for(const group of document.querySelectorAll(switchGroups)){
  const previous=switchStates.get(switchKey(group)),thumb=group.querySelector(':scope > .switch-thumb');
  if(previous?.group===group&&thumb&&group.getBoundingClientRect().width)previous.visual=localBox(thumb,group);
 }
}

function prepareSwitch(group){
 const selected=group.querySelector('button[aria-pressed="true"]');
 if(!selected||!group.getBoundingClientRect().width)return;
 const key=switchKey(group),previous=switchStates.get(key);
 if(previous?.group!==group){
  if(previous?.group)switchResizeObserver?.unobserve(previous.group);
  switchResizeObserver?.observe(group);
 }
 const selection=selected.dataset.layout||selected.dataset.languageChoice||selected.dataset.mailAppearance;
 let thumb=group.querySelector(':scope > .switch-thumb');
 if(!thumb){thumb=document.createElement('span');thumb.className='switch-thumb';thumb.setAttribute('aria-hidden','true');group.prepend(thumb);}
 group.classList.add('sliding-switch');
 const target=localBox(selected,group),now=performance.now();
 const clicked=pendingSwitch?.key===key&&pendingSwitch.selection===selection;
 const changed=previous&&previous.selection!==selection;
 const continuing=previous&&previous.group!==group&&previous.ends>now;
 let from=clicked?pendingSwitch.box:(changed||continuing?previous.visual:null);
 // Repeated layout checks must leave an in-flight animation alone.
 const sameTarget=previous?.group===group&&previous.selection===selection&&
  ['x','y','width','height'].every(field=>Math.abs(previous.target[field]-target[field])<.1);
 if(sameTarget&&!clicked)return;
 if(!from&&previous?.group===group)from=localBox(thumb,group);
 for(const animation of thumb.getAnimations())animation.cancel();
 thumb.style.width=target.width+'px';thumb.style.height=target.height+'px';
 thumb.style.transform=`translate(${target.x}px,${target.y}px)`;
 let duration=continuing&&!clicked?Math.max(0,previous.ends-now):240;
 const moves=from&&['x','y','width','height'].some(field=>Math.abs(from[field]-target[field])>.1);
 if(!reduced.matches&&moves&&duration>0){
  thumb.animate([
   {transform:`translate(${from.x}px,${from.y}px)`,width:from.width+'px',height:from.height+'px'},
   {transform:`translate(${target.x}px,${target.y}px)`,width:target.width+'px',height:target.height+'px'}
  ],{duration,easing:'cubic-bezier(.4,0,.2,1)'});
 }else duration=0;
 switchStates.set(key,{group,selection,target,visual:from||target,ends:now+duration});
 if(clicked)pendingSwitch=null;
}

const switchResizeObserver=typeof ResizeObserver==='undefined'?null:new ResizeObserver(entries=>{
 for(const {target} of entries)if(target.isConnected)prepareSwitch(target);
});

export function prepareResponsiveUI() {
  paintSidebarState();
  const collapse=document.querySelector('[data-action="toggle-sidebar"]');
  if(collapse){
    const expanded=root.dataset.mailSidebar!=='collapsed';
    collapse.setAttribute('aria-expanded',String(expanded));
    collapse.setAttribute('aria-label',document.documentElement.lang==='en'?(expanded?'Collapse sidebar':'Expand sidebar'):(expanded?'收起侧栏':'展开侧栏'));
    collapse.title=collapse.getAttribute('aria-label');
  }
  for(const group of document.querySelectorAll(switchGroups))prepareSwitch(group);
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button||button.disabled)return;
  const group=button.closest('.contact-layout-switch,.mail-language-switch,.mail-appearance-options');
  const selected=group?.querySelector('button[aria-pressed="true"]');
  if(selected&&selected!==button){pendingSwitch={key:switchKey(group),selection:button.dataset.layout||button.dataset.languageChoice||button.dataset.mailAppearance,box:localBox(group.querySelector('.switch-thumb')||selected,group)};requestAnimationFrame(prepareResponsiveUI);}
  if(button.matches('[data-action="toggle-sidebar"]')) {
    root.dataset.mailSidebar=root.dataset.mailSidebar==='collapsed'?'expanded':'collapsed';
    try{localStorage.setItem('mail-sidebar',root.dataset.mailSidebar);}catch{}
    prepareResponsiveUI();
    scheduleToolbarFit();
  }
},true);
window.addEventListener('resize',()=>requestAnimationFrame(prepareResponsiveUI),{passive:true});
document.addEventListener('transitionend',event=>{if(event.target.matches('.app-shell')){scheduleToolbarFit();prepareResponsiveUI();}});
document.addEventListener('pa-language-change',()=>requestAnimationFrame(prepareResponsiveUI));
