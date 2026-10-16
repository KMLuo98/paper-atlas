export async function mergePaperPDFs(papers, fetchPDF, onProgress = () => {}) {
  const {PDFDocument} = await import('pdf-lib');
  const merged = await PDFDocument.create(), failures = [];
  for (let i = 0; i < papers.length; i++) {
    onProgress(i + 1, papers.length);
    try {
      const bytes = await fetchPDF(papers[i]);
      const pdf = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    } catch (error) {failures.push({title: papers[i].title, error: error.message});}
  }
  if (!merged.getPageCount()) throw new Error('没有可合并的 PDF，请尝试逐个下载；加密文档需要先解除密码保护');
  merged.setTitle('Paper Atlas 文献合集');
  return {bytes: await merged.save(), failures, pages: merged.getPageCount()};
}
