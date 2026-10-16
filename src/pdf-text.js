export async function extractDocumentText(loadingTask) {
  try {
    const doc = await loadingTask.promise;
    let text = '';
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      text += `\n[Page ${n}]\n` + content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
      if (text.length > 600000) throw new Error('全文超过 60 万字符，请分拆 PDF 后重试');
    }
    if (text.trim().length < 150) throw new Error('未提取到足够文本，扫描版 PDF 请先做 OCR');
    return text;
  } finally {
    // PDF.js 6 owns worker teardown on the loading task, not PDFDocumentProxy.
    await loadingTask.destroy();
  }
}

export async function extractPDF(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const data = new Uint8Array(await file.arrayBuffer());
  return extractDocumentText(pdfjs.getDocument({data, isEvalSupported: false}));
}
