import './responsive-toolbars.css';

const rows = new Map([
  ['.page-head', '.head-actions'],
  ['.list-actions', ':scope > div, .filter-controls'],
  ['.reader-toolbar', ':scope > div'],
  ['.pagination', ':scope > div'],
  ['.compose-bottom', ''],
  ['.translation-controls', ''],
  ['.email-bottom', ''],
  ['.contact-card-actions', ''],
  ['.modal-footer', ''],
  ['.form-footer', ''],
  ['.account-preferences', '']
]);
const toolbarSelector = [...rows.keys()].join(',');
const compactControl = '.mobile-icon-action, .adaptive-icon-action, .inbox-filter summary';
const desktop = matchMedia('(width > 700px)');
let frame;

function rowDoesNotFit(row) {
  const bounds = row.getBoundingClientRect();
  const style = getComputedStyle(row);
  const horizontal = !style.flexDirection.startsWith('column');
  let top = -Infinity, bottom = Infinity;
  for (const item of row.children) {
    const rect = item.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(item).position === 'absolute') continue;
    if (rect.right > bounds.right + 1 || rect.left < bounds.left - 1) return true;
    if (horizontal) {
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
      if (top >= bottom) return true;
    }
  }
  return row.clientWidth > 0 && row.scrollWidth > row.clientWidth + 1;
}

function labelDoesNotFit(label, range) {
  range.selectNodeContents(label);
  const lines = [...range.getClientRects()];
  return lines.length > 1 && lines.some(line => Math.abs(line.top - lines[0].top) > 1);
}

function fitToolbars() {
  const groups = [...document.querySelectorAll(toolbarSelector)].filter(group => group.querySelector(compactControl));
  // Measure the text layout in one pass, then restore compact mode before the next paint.
  for (const group of groups) delete group.dataset.compactToolbar;
  if (!desktop.matches) return;
  const range = document.createRange();
  const compact = groups.filter(group => {
    const selector = [...rows].find(([selector]) => group.matches(selector))[1];
    const nested = selector ? [...group.querySelectorAll(selector)] : [];
    return [group, ...nested].some(rowDoesNotFit) ||
      [...group.querySelectorAll('.mobile-action-label')].some(label => labelDoesNotFit(label, range));
  });
  for (const group of compact) group.dataset.compactToolbar = '';
}

export function scheduleToolbarFit() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    fitToolbars();
  });
}

window.addEventListener('resize', scheduleToolbarFit, {passive:true});
document.fonts?.addEventListener('loadingdone', scheduleToolbarFit);
