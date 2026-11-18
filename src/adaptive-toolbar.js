const toolbars='.library-controls,.author-toolbar,.page-head,.network-scope,.graph-controls,.top-actions,.reader-toolbar,.selection-bar,.literature-search-controls';
const controls='[data-mobile-icon],.author-mobile-select,.mobile-sort-wrap,button:has(>svg.icon)';

export function mountAdaptiveToolbars(root) {
  let frame;
  function measure() {
    const range=document.createRange();
    for(const toolbar of root.querySelectorAll(toolbars)){
      toolbar.classList.remove('adaptive-icons');
      if(window.innerWidth<=700)continue;
      const buttons=[...toolbar.querySelectorAll(controls)].filter(button=>
        button.closest(toolbars)===toolbar&&(!button.closest('details')||button.matches('summary')||button.closest('details')===button.parentElement));
      const overflow=buttons.some(button=>{
        if(!button.getClientRects().length||button.clientWidth===0)return false;
        if(button.scrollWidth>button.clientWidth+1)return true;
        const label=button.querySelector('.mobile-control-label')||button;
        const textNodes=[...label.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());
        const rows=new Set();
        for(const node of textNodes){range.selectNodeContents(node);for(const rect of range.getClientRects())if(rect.width)rows.add(Math.round(rect.top));}
        return rows.size>1;
      });
      if(overflow){
        for(const button of buttons){
          const label=button.getAttribute('aria-label')||button.textContent.trim();
          if(label&&!button.title)button.title=label;
          if(label&&!button.hasAttribute('aria-label'))button.setAttribute('aria-label',label);
        }
        toolbar.classList.add('adaptive-icons');
      }
    }
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);}
  window.addEventListener('resize',schedule);
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true,characterData:true});
  document.fonts?.ready.then(schedule);
  schedule();
}
