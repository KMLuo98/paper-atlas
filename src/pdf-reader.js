import {openPDFTask} from './pdf-engine.js';
import {createPDFNavigation,fitPDFPage} from './pdf-navigation.js';
import {escapeHTML as e} from './core.js';

function mountPagedPDF(container, url) {
  container.innerHTML = `<div class="paged-pdf-reader"><div class="pdf-pager"><button data-page-step="-1" disabled>上一页</button><form class="pdf-page-form"><label>页码<input type="number" min="1" value="1" inputmode="numeric" aria-label="页码" disabled></label><span class="pdf-page-total">/ …</span><button type="submit" disabled>跳转</button></form><button data-page-step="1" disabled>下一页</button></div><div class="pdf-page-status" role="status">正在加载原文…</div><div class="pdf-canvas-host"></div><div class="pdf-pager pdf-pager-bottom"><button data-page-step="-1" disabled>上一页</button><a href="${e(url)}" target="_blank" rel="noopener noreferrer">打开原始 PDF ↗</a><button data-page-step="1" disabled>下一页</button></div></div>`;
  const host = container.querySelector('.pdf-canvas-host'), status = container.querySelector('.pdf-page-status');
  const input = container.querySelector('input'), form = container.querySelector('form');
  let disposed = false, task = null, navigation = null, timer = null, lastWidth = 0;
  const observer = new ResizeObserver(() => {
    const width = host.clientWidth;
    if (Math.abs(width-lastWidth)<1) return;
    lastWidth=width;clearTimeout(timer);timer=setTimeout(()=>navigation?.go(navigation.page),100);
  });
  observer.observe(host);
  const show = async value => {if(await navigation?.go(value))host.scrollIntoView({block:'start',behavior:'instant'});};
  form.onsubmit = event => {event.preventDefault();show(input.value);};
  container.querySelectorAll('[data-page-step]').forEach(button => button.onclick=()=>show(navigation.page+Number(button.dataset.pageStep)));
  (async()=>{
    task = await openPDFTask(url); if(disposed){await task.destroy();return;}
    const pdf = await task.promise; if(disposed)return;
    navigation = createPDFNavigation({total:pdf.numPages,
      async draw(number,signal) {
        const page = await pdf.getPage(number); if(signal.aborted)return;
        const viewport = page.getViewport({scale:1});
        const geometry = fitPDFPage(viewport.width,viewport.height,Math.max(1,host.clientWidth-24),window.devicePixelRatio||1);
        const canvas = document.createElement('canvas');canvas.width=geometry.width;canvas.height=geometry.height;
        canvas.style.width=geometry.cssWidth+'px';canvas.style.height=geometry.cssHeight+'px';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`第 ${number} 页`);
        const render = page.render({canvas,viewport:page.getViewport({scale:geometry.scale}),transform:[geometry.ratio,0,0,geometry.ratio,0,0]});
        const cancel=()=>render.cancel();signal.addEventListener('abort',cancel,{once:true});
        try {await render.promise;if(!signal.aborted&&!disposed)host.replaceChildren(canvas);}
        finally {signal.removeEventListener('abort',cancel);page.cleanup();}
      },
      onState({page,total,loading,error}) {
        input.value=page;input.max=total;input.disabled=false;form.querySelector('button').disabled=false;
        container.querySelector('.pdf-page-total').textContent='/ '+total;
        container.querySelectorAll('[data-page-step]').forEach(b=>b.disabled=Number(b.dataset.pageStep)<0?page===1:page===total);
        status.textContent=error?'本页加载失败，请重试或打开原始 PDF':loading?'正在加载原文…':'';
      }});
    await navigation.go(1);
  })().catch(error=>{if(!disposed){status.textContent=error.message;host.innerHTML='<p class="notice warn">原文加载失败，可打开原始 PDF 阅读。</p>';}});
  return ()=>{disposed=true;clearTimeout(timer);observer.disconnect();navigation?.destroy();task?.destroy().catch(()=>{});};
}

export function mountResponsivePDF(container, url, title) {
  container.className='pdf-content';
  container.setAttribute('aria-label',title);
  return mountPagedPDF(container,url);
}
