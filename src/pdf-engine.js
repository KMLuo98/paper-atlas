export async function openPDFTask(source) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const root = new URL('pdf-assets/', new URL(import.meta.env?.BASE_URL || './', document.baseURI));
  return pdfjs.getDocument({...(typeof source === 'string' ? {url: source} : {data: source}), isEvalSupported: false,
    cMapUrl: new URL('cmaps/', root).href, cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', root).href,
    wasmUrl: new URL('wasm/', root).href, useSystemFonts: true});
}
