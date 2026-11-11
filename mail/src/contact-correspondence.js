import {esc,fmtDate} from './core.js';
import './contact-correspondence.css';

const mounted = new WeakSet();

export function correspondenceHTML(id) {
  return `<section class="contact-correspondence" data-contact-correspondence="${esc(id)}">
    <input type="search" class="correspondence-search" aria-label="搜索往来邮件" placeholder="搜索主题、正文或邮箱">
    <p class="correspondence-status" role="status">正在读取往来邮件…</p>
    <div class="correspondence-results"></div>
    <button type="button" class="secondary correspondence-more" hidden>加载更多</button>
  </section>`;
}

export function mountCorrespondence(api) {
  for (const root of document.querySelectorAll('[data-contact-correspondence]')) {
    if (mounted.has(root)) continue;
    mounted.add(root);
    const search = root.querySelector('input');
    const results = root.querySelector('.correspondence-results');
    const status = root.querySelector('.correspondence-status');
    const more = root.querySelector('.correspondence-more');
    let offset = 0, request = 0, timer;

    async function load(append = false) {
      const current = ++request;
      const query = search.value.trim();
      if (!append) {
        offset = 0;
        results.replaceChildren();
      }
      more.hidden = true;
      status.textContent = '正在读取往来邮件…';
      try {
        const data = await api('contact_correspondence', {
          id: root.dataset.contactCorrespondence, query, offset
        });
        if (!root.isConnected || current !== request) return;
        const messages = data.messages || [];
        results.insertAdjacentHTML('beforeend', messages.map(message => {
          const sent = message.direction === 'sent' || message.folder === 'sent';
          return `<button type="button" class="correspondence-message" data-action="open-contact-message" data-id="${esc(message.id)}">
            <span class="correspondence-direction" data-sent="${sent}">${sent ? '发出' : '收到'}</span>
            <span class="correspondence-copy"><strong>${esc(message.subject || '（无主题）')}</strong>
              <small>${esc(message.preview || '')}</small></span>
            <time>${esc(fmtDate(message.received_at, true))}</time>
          </button>`;
        }).join(''));
        offset += messages.length;
        status.textContent = data.total ? `${data.total} 封往来邮件` : query ? '没有匹配的邮件' : '暂无往来邮件';
        more.textContent = '加载更多';
        more.hidden = !messages.length || offset >= data.total;
      } catch (error) {
        if (!root.isConnected || current !== request) return;
        status.textContent = error.message || '邮件读取失败';
        more.textContent = '重试';
        more.hidden = false;
      }
    }

    search.oninput = () => {
      request++;
      more.hidden = true;
      clearTimeout(timer);
      timer = setTimeout(() => load(), 250);
    };
    more.onclick = () => load(offset > 0);
    load();
  }
}
