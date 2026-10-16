export const MAX_PDF_BYTES = 30 * 1024 * 1024;
export function safeImportPath(name) {
  const path = String(name).replace(/\\/g, '/');
  if (/^(\/|[A-Za-z]:)/.test(path) || path.split('/').some(part => part === '..' || part === '__MACOSX' || part.startsWith('.'))) return '';
  return path;
}
export async function collectImports(files) {
  const items = [], errors = [], readers = [];
  for (const file of files) {
    const path = safeImportPath(file.webkitRelativePath || file.name);
    if (!path) {errors.push(`${file.name}：文件路径无效`); continue;}
    if (/\.pdf$/i.test(path)) {items.push({name: path, size: file.size, getFile: async () => file}); continue;}
    if (!/\.zip$/i.test(path)) continue;
    let reader;
    try {
      const {ZipReader, BlobReader} = await import('@zip.js/zip.js');
      reader = new ZipReader(new BlobReader(file), {useWebWorkers: false});
      readers.push(reader);
      for await (const entry of reader.getEntriesGenerator()) {
        if (entry.directory || !/\.pdf$/i.test(entry.filename)) continue;
        const name = safeImportPath(entry.filename);
        if (!name) {errors.push(`${entry.filename}：忽略不安全路径`); continue;}
        if (entry.uncompressedSize > MAX_PDF_BYTES) {errors.push(`${name}：解压后超过 30 MB，已跳过`); continue;}
        items.push({name: `${path}/${name}`, size: entry.uncompressedSize, async getFile() {
          // Decode one entry at a time. Bound actual output too, even if ZIP metadata is false.
          let bytes = 0; const chunks = [];
          const writer = new WritableStream({write(chunk) {bytes += chunk.length; if (bytes > MAX_PDF_BYTES) throw new Error('解压后超过 30 MB'); chunks.push(chunk);}});
          await entry.getData(writer, {checkSignature: true, useWebWorkers: false});
          return new File(chunks, name.split('/').at(-1), {type: 'application/pdf'});
        }});
      }
    } catch {errors.push(`${path}：ZIP 无法读取或已损坏，其它文件继续处理`);}
  }
  return {items, errors, async close() {await Promise.allSettled(readers.map(reader => reader.close()));}};
}
export async function filesFromDrop(dataTransfer) {
  const entries = [...(dataTransfer.items || [])].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...dataTransfer.files];
  const files = [];
  async function visit(entry) {
    if (entry.isFile) files.push(await new Promise((resolve, reject) => entry.file(resolve, reject)));
    else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {const children = await new Promise((resolve, reject) => reader.readEntries(resolve, reject)); if (!children.length) break; for (const child of children) await visit(child);}
    }
  }
  for (const entry of entries) await visit(entry);
  return files;
}
export async function runImportBatch(items, {upload, analyze, onProgress = () => {}}) {
  const saved = [], failures = [];
  for (let i = 0; i < items.length; i++) {
    onProgress({phase: 'upload', index: i + 1, total: items.length, name: items[i].name});
    try {saved.push(await upload(items[i]));} catch (error) {failures.push({phase: 'upload', name: items[i].name, message: error.message});}
  }
  // No PDF extraction or model request starts until every upload has been attempted.
  for (let i = 0; analyze && i < saved.length; i++) {
    onProgress({phase: 'analyze', index: i + 1, total: saved.length, name: saved[i].title});
    try {await analyze(saved[i]);} catch (error) {failures.push({phase: 'analyze', name: saved[i].title, message: error.message});}
  }
  return {saved, failures};
}
