import {esc,fuzzy} from './core.js';

export function inboxFilterHTML({id, label, icon, options, value, searchable=false}) {
  const selected = options.find(option => option.value === value);
  return `<details class="inbox-filter" data-inbox-filter="${id}">
    <summary aria-label="${esc(label)}" title="${esc(label)}">${icon}<span>${esc(selected?.label || options[0].label)}</span></summary>
    <div class="inbox-filter-panel">
      ${searchable?'<input type="search" class="inbox-filter-search" aria-label="搜索发件人" placeholder="搜索姓名或邮箱">':''}
      <div class="inbox-filter-options">${options.map(option => `<button type="button" data-action="set-inbox-filter"
        data-filter="${id}" data-value="${esc(option.value)}" data-search="${esc(option.search || option.label)}"
        aria-pressed="${option.value===value}">${esc(option.label)}</button>`).join('')}</div>
      <p class="inbox-filter-empty" hidden>没有匹配的发件人</p>
    </div>
  </details>`;
}

document.addEventListener('input', event => {
  if (!event.target.matches?.('.inbox-filter-search')) return;
  const menu = event.target.closest('.inbox-filter');
  const query = event.target.value.trim();
  let matches = 0;
  for (const option of menu.querySelectorAll('[data-search]')) {
    option.hidden = Boolean(query && !fuzzy(option.dataset.search,query));
    if (!option.hidden) matches++;
  }
  menu.querySelector('.inbox-filter-empty').hidden = matches > 0;
});
document.addEventListener('toggle', event => {
  const menu = event.target;
  if (!menu.matches?.('.inbox-filter[open]')) return;
  for (const other of document.querySelectorAll('.inbox-filter[open]')) if (other !== menu) other.open = false;
  const panel = menu.querySelector('.inbox-filter-panel');
  const bounds = menu.getBoundingClientRect();
  panel.style.left = Math.max(8,Math.min(bounds.left,innerWidth-panel.offsetWidth-8))+'px';
  const top = bounds.bottom+6+panel.offsetHeight <= innerHeight-8
    ? bounds.bottom+6 : Math.max(8,bounds.top-panel.offsetHeight-6);
  panel.style.top = top+'px';
},true);
document.addEventListener('click', event => {
  for (const menu of document.querySelectorAll('.inbox-filter[open]')) if (!menu.contains(event.target)) menu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const menu = document.querySelector('.inbox-filter[open]');
  if (menu) {menu.open=false;menu.querySelector('summary').focus();}
});
