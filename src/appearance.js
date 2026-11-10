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
