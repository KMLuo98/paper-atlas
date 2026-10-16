export function fitPDFPage(width, height, availableWidth, pixelRatio = 1) {
  const scale = Math.max(1, availableWidth) / width;
  const cssWidth = width * scale, cssHeight = height * scale;
  const ratio = Math.min(Math.max(1, pixelRatio), 2, Math.sqrt(6000000 / (cssWidth * cssHeight)));
  return {scale, cssWidth, cssHeight, ratio, width: Math.ceil(cssWidth * ratio), height: Math.ceil(cssHeight * ratio)};
}

export function createPDFNavigation({total, draw, onState}) {
  let page = 1, controller = null, disposed = false;
  async function go(value) {
    if (disposed) return false;
    const number = Number(value);
    page = Number.isFinite(number) ? Math.max(1, Math.min(total, Math.floor(number))) : page;
    controller?.abort(); const current = controller = new AbortController();
    onState({page,total,loading:true});
    try {
      await draw(page, current.signal);
      if (current.signal.aborted || disposed) return false;
      onState({page,total,loading:false}); return true;
    } catch (error) {
      if (!current.signal.aborted && !disposed) onState({page,total,loading:false,error});
      return false;
    }
  }
  return {go, next:()=>go(page+1), previous:()=>go(page-1), get page(){return page;}, destroy(){disposed=true;controller?.abort();}};
}
