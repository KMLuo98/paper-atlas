import './responsive-ui.css';
import {scheduleToolbarFit} from './responsive-toolbars.js';

const mobile=matchMedia('(max-width:700px)');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const root=document.documentElement;
let pendingSwitch;
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

export function prepareResponsiveUI() {
  const collapse=document.querySelector('[data-action="toggle-sidebar"]');
  if(collapse){
    const expanded=root.dataset.mailSidebar!=='collapsed';
    collapse.setAttribute('aria-expanded',String(expanded));
    collapse.setAttribute('aria-label',document.documentElement.lang==='en'?(expanded?'Collapse sidebar':'Expand sidebar'):(expanded?'收起侧栏':'展开侧栏'));
    collapse.title=collapse.getAttribute('aria-label');
  }
  for(const group of document.querySelectorAll('.contact-layout-switch,.mail-language-switch,.mail-appearance-options')) {
    const selected=group.querySelector('button[aria-pressed="true"]');
    if(!selected||!group.getBoundingClientRect().width)continue;
    let thumb=group.querySelector(':scope > .switch-thumb');
    if(!thumb){thumb=document.createElement('span');thumb.className='switch-thumb';thumb.setAttribute('aria-hidden','true');group.prepend(thumb);}
    group.classList.add('sliding-switch');
    const x=selected.offsetLeft,y=selected.offsetTop;
    thumb.style.width=selected.offsetWidth+'px';thumb.style.height=selected.offsetHeight+'px';
    thumb.style.transform=`translate(${x}px,${y}px)`;
    if(pendingSwitch?.key===switchKey(group)) {
      const next=selected.getBoundingClientRect(),previous=pendingSwitch.rect;
      if(!reduced.matches&&Math.abs(previous.left-next.left)>1)thumb.animate([
        {transform:`translate(${x+previous.left-next.left}px,${y+previous.top-next.top}px)`},
        {transform:`translate(${x}px,${y}px)`}
      ],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
      if(!reduced.matches&&pendingSwitch.key.endsWith('-layout')) {
        document.querySelector(pendingSwitch.key==='contact-layout'?'.contacts-grid':'.submission-items')?.animate([
          {opacity:.65,transform:'translateX(8px)'},{opacity:1,transform:'translateX(0)'}
        ],{duration:180,easing:'ease-out'});
      }
      pendingSwitch=null;
    }
  }
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button||button.disabled)return;
  const group=button.closest('.contact-layout-switch,.mail-language-switch,.mail-appearance-options');
  const selected=group?.querySelector('button[aria-pressed="true"]');
  if(selected&&selected!==button){pendingSwitch={key:switchKey(group),rect:(group.querySelector('.switch-thumb')||selected).getBoundingClientRect()};requestAnimationFrame(prepareResponsiveUI);}
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
