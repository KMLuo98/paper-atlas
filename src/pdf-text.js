import {databaseText} from '../supabase/functions/_shared/text.js';
import {openPDFTask} from './pdf-engine.js';
import {pdfORCIDLinks} from './pdf-orcid.js';

export async function extractDocumentText(loadingTask) {
  try {
    const doc = await loadingTask.promise;
    let text = '';
    let contentLength = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items.map(item => ({...item, str: databaseText(item.str || '')}));
      contentLength += items.reduce((n, item) => n + item.str.trim().length, 0);
      text += `\n[Page ${n}]\n` + items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
      try{const links=pdfORCIDLinks(await page.getAnnotations?.({intent:'display'}),items);if(links)text+='\n[PDF ORCID links; assign only when author correspondence is unambiguous]\n'+links+'\n';}catch{/* Unreadable annotations must not block text extraction. */}
      if (text.length > 600000) throw new Error('全文超过 60 万字符，请分拆 PDF 后重试');
    }
    if (contentLength < 150) throw new Error('未提取到足够文本，扫描版 PDF 请先做 OCR');
    return text.replace(/([\p{Script=Han}])[\t ]+(?=[\p{Script=Han}])/gu, '$1');
  } finally {
    // PDF.js 6 owns worker teardown on the loading task, not PDFDocumentProxy.
    await loadingTask.destroy();
  }
}

export async function extractPDF(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  return extractDocumentText(await openPDFTask(data));
}
