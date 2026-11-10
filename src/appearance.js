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

const transparencyKey = 'pa-glass-transparency';
let transparency = 28;
export function glassTransparency() {return transparency;}
export function setGlassTransparency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return;
  transparency = Math.max(10, Math.min(65, Math.round(number)));
  root.style.setProperty('--glass-alpha', String(1 - transparency / 100));
  try {localStorage.setItem(transparencyKey, String(transparency));} catch {}
}
try {
  const value = localStorage.getItem(transparencyKey);
  if (value !== null) setGlassTransparency(value);
} catch {}

const highlights = new Map();
function hideHighlights() {
  for (const state of highlights.values()) {
    state.layer.classList.remove('visible');
    state.active = null;
  }
}

document.addEventListener('pointermove', event => {
  if (currentAppearance() !== 'glass' || event.pointerType !== 'mouse') return;
  const item = event.target.closest?.('#paper-results tbody tr, #paper-results .paper-card, .sidebar .nav-link, .sidebar .tag-nav');
  if (!item) {hideHighlights();return;}
  const host = item.closest('#paper-results,.sidebar');
  const mode = host.id === 'paper-results' ? 'paper' : 'sidebar';
  for (const [other,state] of highlights) if (other !== mode) {
    state.layer.classList.remove('visible');state.active=null;
  }
  let state = highlights.get(mode);
  if (state?.layer.parentElement !== host) {
    const layer = document.createElement('div');
    layer.className = mode+'-glass-highlight';
    layer.setAttribute('aria-hidden','true');
    host.prepend(layer);
    state = {layer,active:null};highlights.set(mode,state);
  }
  const rect = item.getBoundingClientRect();
  const viewport = item.closest('.table-scroll')?.getBoundingClientRect();
  const left = viewport ? Math.max(rect.left, viewport.left) : rect.left;
  const right = viewport ? Math.min(rect.right, viewport.right) : rect.right;
  const {layer,active}=state,style=layer.style,first=!active?.isConnected;
  if (first) layer.classList.remove('visible');
  if (active !== item) {
    const container = host.getBoundingClientRect();
    style.width = Math.max(0,right-left) + 'px';
    style.height = rect.height + 'px';
    style.transform = `translate3d(${left-container.left+(host.scrollLeft||0)}px,${rect.top-container.top+(host.scrollTop||0)}px,0)`;
  }
  style.setProperty('--glass-x', (event.clientX-left)+'px');
  style.setProperty('--glass-y', (event.clientY-rect.top)+'px');
  if (first) layer.getBoundingClientRect();
  layer.classList.add('visible');
  state.active=item;
});
document.addEventListener('pointerleave',hideHighlights);
document.defaultView?.addEventListener('blur',hideHighlights);
document.addEventListener('scroll',hideHighlights,{capture:true,passive:true});
