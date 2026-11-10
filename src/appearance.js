import './appearance.css';

const key = 'pa-appearance';
const root = document.documentElement;

try {
  if (localStorage.getItem(key) === 'glass') root.dataset.appearance = 'glass';
} catch { /* The theme can still be changed for the current page. */ }

export function currentAppearance() {
  return root.dataset.appearance === 'glass' ? 'glass' : 'classic';
}

export function setAppearance(value) {
  if (value !== 'classic' && value !== 'glass') return;
  root.dataset.appearance = value;
  try {localStorage.setItem(key, value);} catch { /* Storage may be unavailable. */ }
}

let highlight, activePaper;
function hidePaperHighlight() {
  highlight?.classList.remove('visible');
  activePaper = null;
}

// One floating highlight follows either the list row or the card under the pointer.
document.addEventListener('pointermove', event => {
  if (currentAppearance() !== 'glass' || event.pointerType !== 'mouse') return;
  const paper = event.target.closest?.('#paper-results tbody tr, #paper-results .paper-card');
  if (!paper) {hidePaperHighlight();return;}
  const results = paper.closest('#paper-results');
  if (highlight?.parentElement !== results) {
    highlight = document.createElement('div');
    highlight.className = 'paper-glass-highlight';
    highlight.setAttribute('aria-hidden', 'true');
    results.prepend(highlight);
  }
  const rect = paper.getBoundingClientRect();
  const viewport = paper.closest('.table-scroll')?.getBoundingClientRect();
  const left = viewport ? Math.max(rect.left, viewport.left) : rect.left;
  const right = viewport ? Math.min(rect.right, viewport.right) : rect.right;
  const first = !activePaper?.isConnected || activePaper.closest('#paper-results') !== results;
  const style = highlight.style;
  if (first) highlight.classList.remove('visible');
  if (activePaper !== paper) {
    const container = results.getBoundingClientRect();
    style.width = Math.max(0,right-left) + 'px';
    style.height = rect.height + 'px';
    style.transform = `translate3d(${left - container.left}px,${rect.top - container.top}px,0)`;
  }
  style.setProperty('--glass-x', (event.clientX - left) + 'px');
  style.setProperty('--glass-y', (event.clientY - rect.top) + 'px');
  if (first) {
    // Put the highlight directly under the first item. Only subsequent movement has inertia.
    highlight.getBoundingClientRect();
  }
  highlight.classList.add('visible');
  activePaper = paper;
});
document.addEventListener('pointerleave', hidePaperHighlight);
document.defaultView?.addEventListener('blur', hidePaperHighlight);
document.addEventListener('scroll', hidePaperHighlight, {capture: true, passive: true});
