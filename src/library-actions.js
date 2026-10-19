import {collectImports, filesFromDrop, MAX_PDF_BYTES, runImportBatch} from './imports.js';
import {db, api, signedPDF, updatePaper,ensureStorageSpace} from './cloud.js';
import {extractPDF} from './pdf-text.js';
import {escapeHTML as e} from './core.js';

export function createLibraryActions({state, modal, icon, busy, toast, refresh, render, go, uiIcons}) {
  function progress(info) {
    let banner = document.querySelector('#batch-status');
    if (!banner) {banner = document.createElement('div'); banner.id = 'batch-status'; banner.setAttribute('role', 'status'); document.body.append(banner);}
    banner.innerHTML = `<strong>${info.phase === 'upload' ? '先上传全部文件' : info.phase === 'keywords' ? '整理双语关键词' : '逐篇 AI 分析'} · ${info.index}/${info.total}</strong><span>${e(info.name || '')}</span><small>单篇失败不会中止队列，请保持本页打开。</small>`;
  }
  async function analyzePaper(p) {
    try {
      let text = p.full_text;
      if (!text) {const {data, error} = await db.from('papers').select('full_text').eq('id', p.id).single(); if (error) throw error; text = data.full_text;}
      if (!text) {
        const url = await signedPDF(p.file_path), response = await fetch(url); if (!response.ok) throw new Error('PDF 下载失败，请重试');
        text = await extractPDF(await response.blob()); await updatePaper(p.id, {full_text: text});
      }
      p.full_text = text;
      const result = await api('analyze', {paper_id: p.id}); Object.assign(p, result.paper); return p;
    } catch (error) {
      p.status = 'error'; p.analysis_error = error.message;
      await updatePaper(p.id, {status: 'error', analysis_error: error.message}).catch(() => {}); throw error;
    }
  }
  async function batchAnalyze(papers, keywordsOnly = false, silent = false) {
    if (state.demo) {toast('请登录后分析真实论文'); return;}
    if (state.batchBusy) {if (!silent) toast('已有队列正在处理'); return;}
    if (!papers.length) {if (!silent) toast('没有待处理的论文'); return;}
    state.batchBusy = true; const failures = [];
    try {
      for (let i = 0; i < papers.length; i++) {
        const p = papers[i]; progress({phase: keywordsOnly ? 'keywords' : 'analyze', index: i + 1, total: papers.length, name: p.title});
        try {if (keywordsOnly) Object.assign(p, (await api('upgrade_keywords', {paper_id: p.id})).paper); else await analyzePaper(p);} catch (error) {failures.push({name: p.title, message: error.message});}
      }
      await refresh(); if (!document.querySelector('.dialog-backdrop')) await render();
      if (failures.length && !silent) showFailures('处理已完成', papers.length - failures.length, failures);
      else if (!silent) toast(`已完成 ${papers.length} 篇论文的${keywordsOnly ? '双语关键词整理' : '分析'}`);
    } finally {state.batchBusy = false; document.querySelector('#batch-status')?.remove();}
  }
  function showFailures(title, savedCount, failures) {
    modal(title, `<p>${savedCount} 篇处理成功，${failures.length} 项未完成；已上传的原文件仍在云端。</p><div class="import-errors">${failures.map(f => `<div class="notice warn"><strong>${e(f.name)}</strong><br>${e(f.message)}</div>`).join('')}</div><p>可在文献详情点击“重试解析”，或选中文献后点击“分析所选”。</p>`);
  }
  function uploadDialog() {
    if (state.demo) {toast('请登录后上传到私人云端文献库'); return;}
    if (state.batchBusy) {toast('请等待当前队列完成后再添加一批文件'); return;}
    const d = modal('批量导入论文', `<p>支持 PDF、文件夹及 ZIP，不限制每批篇数。先保存全部文件，再逐篇分析。</p><label class="upload-zone" id="drop-zone" for="import-files">${icon('cloud-upload')}<strong>拖入文件或文件夹，或点击选择 PDF / ZIP</strong><small>每篇 PDF 最大 30 MB · 云端空间以你的项目配额为准</small></label><input type="file" id="import-files" accept=".pdf,.zip,application/pdf,application/zip" multiple hidden><input type="file" id="import-folder" webkitdirectory multiple hidden><div class="actions"><button id="choose-folder">${icon('folder-open')} 选择文件夹</button><button id="add-imports">继续添加 PDF / ZIP</button></div><div id="import-list" class="import-list"></div><div id="import-feedback" role="status"></div><div class="import-analysis-option"><label class="remember import-option"><input type="checkbox" id="auto-analyze" checked>全部上传完成后自动开始 AI 分析</label><span class="help-tooltip" tabindex="0">?<span role="tooltip">ZIP 中只读取 PDF，逐个解压上传。中文和未发表稿件也可分析；缺少期刊或日期不会中止。扫描件仍需要 OCR。关闭或刷新页面会停止当前队列，已上传文件可以稍后继续分析。</span></span></div><div class="actions"><button id="start-import" class="primary" disabled>上传全部文件</button></div>`);
    const picker = d.el.querySelector('#import-files'), folder = d.el.querySelector('#import-folder'), zone = d.el.querySelector('#drop-zone'), start = d.el.querySelector('#start-import');
    const packs = [], items = [], skipped = []; let selecting = false, uploading = false;
    async function add(files) {
      if (uploading || selecting) return; selecting = true; start.disabled = true;
      d.el.querySelector('#import-feedback').textContent = '正在读取文件列表…';
      try {
        const pack = await collectImports(files); packs.push(pack); items.push(...pack.items); skipped.push(...pack.errors);
        d.el.querySelector('#import-list').innerHTML = items.map(item => `<div class="upload-file">${icon('file-text')}<span>${e(item.name)}</span><small>${(item.size / 1024 / 1024).toFixed(1)} MB</small></div>`).join('');
        d.el.querySelector('#import-feedback').textContent = `已选择 ${items.length} 篇 PDF${skipped.length ? `，${skipped.length} 项将跳过` : ''}`;
        uiIcons();
      } catch (error) {d.el.querySelector('#import-feedback').textContent = error.message;}
      finally {selecting = false; start.disabled = !items.length;}
    }
    picker.onchange = () => add([...picker.files]); folder.onchange = () => add([...folder.files]);
    d.el.querySelector('#choose-folder').onclick = () => folder.click(); d.el.querySelector('#add-imports').onclick = () => picker.click();
    for (const name of ['dragenter', 'dragover']) zone.addEventListener(name, event => {event.preventDefault(); zone.classList.add('dragover');});
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', async event => {event.preventDefault(); zone.classList.remove('dragover'); try {await add(await filesFromDrop(event.dataTransfer));} catch (error) {toast(error.message);}});
    start.onclick = () => busy(start, async () => {
      state.batchBusy = true; uploading = true;
      d.el.querySelectorAll('input,button').forEach(el => el.disabled = true); zone.style.pointerEvents = 'none';
      const autoAnalyze = d.el.querySelector('#auto-analyze').checked;
      try {
        const result = await runImportBatch(items, {onProgress: progress, async upload(item) {
          if (item.size > MAX_PDF_BYTES) throw new Error('单篇 PDF 超过 30 MB');
          const file = await item.getFile(); if (!file.size || file.size > MAX_PDF_BYTES) throw new Error('PDF 文件为空或超过 30 MB');
          if (!new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer()).includes('%PDF-')) throw new Error('文件不是有效 PDF');
          const id = crypto.randomUUID(), path = `${state.user.id}/${id}.pdf`;
          await ensureStorageSpace(file.size);const {error} = await db.storage.from('papers').upload(path, file, {contentType: 'application/pdf', upsert: false}); if (error) throw error;
          const saved = await db.from('papers').insert({id, user_id: state.user.id, title: file.name.replace(/\.pdf$/i, '').slice(0, 500), file_path: path, file_size: file.size, original_filename: item.name, status: 'pending'}).select().single();
          if (saved.error) {await db.storage.from('papers').remove([path]); throw saved.error;}
          state.papers.unshift(saved.data); return saved.data;
        }, analyze: autoAnalyze ? analyzePaper : undefined});
        await refresh(); d.close(); await render();
        const failures = [...skipped.map(message => ({name: '跳过项目', message})), ...result.failures];
        if (failures.length) showFailures('导入队列已完成', result.saved.length, failures);
        else toast(`${result.saved.length} 篇已保存${autoAnalyze ? '，分析已完成' : '，可选中文献后点击“分析所选”继续'}`);
      } finally {await Promise.allSettled(packs.map(pack => pack.close())); state.batchBusy = false; document.querySelector('#batch-status')?.remove();}
    });
  }
  return {uploadDialog, analyzePaper, batchAnalyze};
}
