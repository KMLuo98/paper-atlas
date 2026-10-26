export async function openPDFTask(source) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const root = new URL('pdf-assets/', new URL(import.meta.env?.BASE_URL || './', document.baseURI));
  return pdfjs.getDocument({...(typeof source === 'string' ? {url: source} : {data: source}), isEvalSupported: false,
    cMapUrl: new URL('cmaps/', root).href, cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', root).href,
    wasmUrl: new URL('wasm/', root).href, useSystemFonts: true});
}
export async function renderPDFTextLayer(page,slot,canvas,viewport,isCurrent=()=>true){
 const {TextLayer}=await import('pdfjs-dist'),content=await page.getTextContent();if(!isCurrent())return ()=>{};
 const element=slot.ownerDocument.createElement('div');element.className='pdf-text-layer';element.setAttribute('data-user-content','');const a=canvas.getBoundingClientRect(),b=slot.getBoundingClientRect();element.style.left=(a.left-b.left)+'px';element.style.top=(a.top-b.top)+'px';element.style.setProperty('--total-scale-factor',String(viewport.scale*(viewport.userUnit||1)));slot.append(element);
 const layer=new TextLayer({textContentSource:content,container:element,viewport});await layer.render();if(!isCurrent())element.remove();return()=>{layer.cancel();element.remove();};
}
