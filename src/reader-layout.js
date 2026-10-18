export function mountReaderSplit(root){
 const separator=root.querySelector('.reader-divider');let ratio=Math.max(45,Math.min(85,Number(localStorage.getItem('pa-reader-ratio'))||70));
 const set=value=>{ratio=Math.max(45,Math.min(85,value));root.style.setProperty('--reader-ratio',ratio+'fr');root.style.setProperty('--info-ratio',(100-ratio)+'fr');separator.setAttribute('aria-valuenow',String(Math.round(ratio)));};set(ratio);
 const save=()=>localStorage.setItem('pa-reader-ratio',String(ratio));let dragging=false;
 separator.onpointerdown=event=>{dragging=true;separator.setPointerCapture(event.pointerId);root.classList.add('resizing');};
 separator.onpointermove=event=>{if(!dragging)return;const box=root.getBoundingClientRect();set((event.clientX-box.left)/box.width*100);};
 separator.onpointerup=separator.onpointercancel=()=>{dragging=false;root.classList.remove('resizing');save();};
 separator.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home'].includes(event.key)){event.preventDefault();set(event.key==='Home'?70:ratio+(event.key==='ArrowRight'?2:-2));save();}};
}
