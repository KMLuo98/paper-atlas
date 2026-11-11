import './appearance.css';

const appearanceKey = 'pa-appearance';
const transparencyKey = 'pa-glass-transparency';
const root = document.documentElement;
let transparency = 28;

function applyAppearance(value) {
  root.dataset.appearance = value === 'glass' ? 'glass' : 'classic';
}

function applyTransparency(value) {
  const number = Number(value);
  if (value == null || !Number.isFinite(number)) return;
  transparency = Math.max(10, Math.min(65, Math.round(number)));
  root.style.setProperty('--glass-alpha', String(1 - transparency / 100));
}

try {
  applyAppearance(localStorage.getItem(appearanceKey));
  applyTransparency(localStorage.getItem(transparencyKey));
} catch { /* Appearance remains available when storage is restricted. */ }

export function mailAppearanceHTML() {
  return `<section class="settings-block mail-appearance"><div class="block-heading"><div><h2>外观</h2></div></div>
    <div class="mail-appearance-options" role="group" aria-label="界面风格">
      <button type="button" data-mail-appearance="classic">经典</button>
      <button type="button" data-mail-appearance="glass">液态玻璃</button>
    </div>
    <label class="mail-transparency">玻璃透明度 <output id="mail-glass-value"></output>
      <input type="range" id="mail-glass-transparency" min="10" max="65" step="1">
    </label>
  </section>`;
}

function paintAppearanceControls() {
  const mode = root.dataset.appearance || 'classic';
  const controls = document.querySelector('.mail-appearance-options');
  if (!controls) return;
  controls.dataset.selected = mode;
  for (const button of controls.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.mailAppearance === mode));
  }
  const range = document.querySelector('#mail-glass-transparency');
  range.value = transparency;
  range.disabled = mode !== 'glass';
  document.querySelector('#mail-glass-value').textContent = transparency + '%';
}

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-mail-appearance]');
  if (!button) return;
  applyAppearance(button.dataset.mailAppearance);
  try { localStorage.setItem(appearanceKey, root.dataset.appearance); } catch {}
  paintAppearanceControls();
});

document.addEventListener('input', event => {
  if (event.target.id !== 'mail-glass-transparency') return;
  applyTransparency(event.target.value);
  try { localStorage.setItem(transparencyKey, String(transparency)); } catch {}
  paintAppearanceControls();
});

window.addEventListener('storage', event => {
  if (event.key === appearanceKey) applyAppearance(event.newValue);
  else if (event.key === transparencyKey) applyTransparency(event.newValue);
  else return;
  paintAppearanceControls();
});

const mailHover = matchMedia('(min-width:701px) and (hover:hover)');
document.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || !mailHover.matches || root.dataset.appearance !== 'glass') return;
  const row = event.target.closest?.('.mail-row');
  if (!row) return;
  row.style.setProperty('--mail-glint-x', (event.clientX - row.getBoundingClientRect().left) + 'px');
});

const toolbarButtons = [
  '.head-actions button', '.reader-toolbar button', '.compose-bottom button',
  '.list-actions button', '.pagination button', '.translation-controls button',
  '.email-bottom button', '.filter-controls button', '.contact-card-actions button'
].join(',');
const actionIcons = {
  'bulk-read':'check', 'bulk-category':'folder', 'load-older':'arrow-down',
  'mark-unread':'mail', 'prev-page':'chevron-left', 'next-page':'chevron-right',
  'sync':'refresh-cw', 'mail-columns':'settings-2', 'translate':'languages',
  'leave-compose':'arrow-left', 'save-draft':'save', 'unread-filter':'mail',
  'toggle-advertising':'shield-check'
};

export function prepareMailAppearance(icon) {
  paintAppearanceControls();
  for (const button of document.querySelectorAll('.sidebar :is(button,a)')) {
    const mailbox = button.querySelector('.color-dot + span');
    const label = mailbox
      ? [...mailbox.childNodes].map(node => node.textContent.trim()).filter(Boolean).join(' · ')
      : (button.querySelector('span:not(.all-dot)')?.textContent || button.textContent).trim();
    const name = button.getAttribute('aria-label') || label;
    if (name) {
      button.setAttribute('aria-label', name);
      if (!button.title) button.title = name;
    }
    const marker = button.querySelector('.color-dot');
    if (marker && !marker.firstChild) marker.innerHTML = icon('mail', 15);
  }
  for (const button of document.querySelectorAll(toolbarButtons)) {
    if (button.classList.contains('mobile-icon-action')) continue;
    const label = button.textContent.trim();
    if (!label) continue;
    const glyph = actionIcons[button.dataset.action];
    const currentIcon = button.querySelector('[data-lucide],svg');
    if (currentIcon && glyph) currentIcon.setAttribute('data-lucide', glyph);
    if (!currentIcon) {
      if (!glyph) continue;
      button.insertAdjacentHTML('afterbegin', icon(glyph, 18));
    }
    const text = document.createElement('span');
    text.className = 'mobile-action-label';
    for (const node of [...button.childNodes]) if (node.nodeType === 3) text.append(node);
    if (!text.textContent.trim()) continue;
    button.append(text);
    button.classList.add('mobile-icon-action');
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', label);
    if (!button.title) button.title = label;
  }
}

let heldButton, pressTimer, tip, tipTimer, startX, startY, pointerId, suppressUntil = 0;
let suppressedButton;
const mobileButtons = matchMedia('(max-width:700px)');
function cancelPress() {
  clearTimeout(pressTimer);
  heldButton = null;
}
document.addEventListener('pointerdown', event => {
  cancelPress();
  if (!mobileButtons.matches || event.pointerType === 'mouse' || !event.isPrimary) return;
  const button = event.target.closest?.('button');
  if (!button || button.disabled || button.closest('[draggable="true"]')) return;
  const label = (button.getAttribute('aria-label') || button.title || button.textContent).trim();
  if (!label) return;
  heldButton = button;
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  pressTimer = setTimeout(() => {
    if (!heldButton?.isConnected) return;
    tip?.remove();
    tip = document.createElement('div');
    tip.className = 'mail-action-tip';
    tip.textContent = label;
    tip.setAttribute('role', 'tooltip');
    document.body.append(tip);
    const bounds = heldButton.getBoundingClientRect();
    const left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, bounds.left + (bounds.width - tip.offsetWidth) / 2));
    tip.style.left = left + 'px';
    tip.style.top = (bounds.top > tip.offsetHeight + 12 ? bounds.top - tip.offsetHeight - 8 : bounds.bottom + 8) + 'px';
    suppressedButton = heldButton;
    suppressUntil = Infinity;
  }, 500);
}, {passive:true});
document.addEventListener('pointermove', event => {
  if (event.pointerId === pointerId && Math.hypot(event.clientX - startX, event.clientY - startY) > 12) cancelPress();
}, {passive:true});
function finishPress(event) {
  if (event.pointerId !== pointerId) return;
  cancelPress();
  if (suppressUntil === Infinity) suppressUntil = Date.now() + 600;
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => tip?.remove(), 900);
}
document.addEventListener('pointerup', finishPress, {passive:true});
document.addEventListener('pointercancel', finishPress, {passive:true});
document.addEventListener('contextmenu', event => {
  if (heldButton?.contains(event.target)) event.preventDefault();
});
document.addEventListener('click', event => {
  if (Date.now() < suppressUntil && suppressedButton?.contains(event.target)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressUntil = 0;
  }
}, true);
