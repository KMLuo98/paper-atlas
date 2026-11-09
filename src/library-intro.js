import './library-intro.css';

const publishers = [
  ['Nature', 'n', '#a73949'], ['Science', 'S', '#b12935'],
  ['Cell', 'C', '#297b84'], ['PNAS', '◉', '#246387'],
  ['Wiley', 'W', '#397252'], ['Elsevier', '♣', '#aa572a'],
  ['APS', '✦', '#385b9a'],
];

const sheet = `<rect width="25" height="32" rx="3" fill="#fffefa" stroke="#9aab9d"/>
  <path d="M5 8h15M5 14h12M5 20h15M5 26h9" stroke="#8c9f92" stroke-width="1.5" stroke-linecap="round"/>`;

function scene() {
  return `<svg viewBox="0 0 640 330" aria-hidden="true">
    <rect x="10" y="8" width="620" height="306" rx="36" fill="#e8eee0"/>
    <circle cx="132" cy="104" r="63" fill="#f6edcf"/>
    <path d="M35 288h570" stroke="#c6d1bf" stroke-width="2"/>
    <rect x="285" y="38" width="304" height="232" rx="13" fill="#856654"/>
    ${publishers.map(([name, mark, color], i) => {
      const x = 297 + (i % 4) * 71, y = 51 + Math.floor(i / 4) * 88;
      return `<g transform="translate(${x} ${y})">
        <rect width="66" height="80" rx="5" fill="#faf5e8"/>
        <path d="M5 41 36 5h10L5 53z" fill="#fff" opacity=".7"/>
        <circle cx="33" cy="18" r="11" fill="${color}"/>
        <text x="33" y="23" fill="white" font-size="14" font-weight="800">${mark}</text>
        <text x="33" y="47" fill="#344538" font-size="12" font-weight="700">${name}</text>
        <g class="atlas-filed" style="--file-time:${1700 + i * 260}ms" transform="translate(15 56) scale(1.45 .58)">${sheet}</g>
      </g>`;
    }).join('')}
    <g class="atlas-scholar">
      <ellipse cx="61" cy="277" rx="45" ry="7" fill="#bccbbb"/>
      <g class="atlas-walk">
        <path class="atlas-foot" d="M42 248v23h-9" fill="none" stroke="#293b35" stroke-width="11" stroke-linecap="round"/>
        <path class="atlas-foot atlas-foot-alt" d="M71 248v23h10" fill="none" stroke="#293b35" stroke-width="11" stroke-linecap="round"/>
        <path d="M40 179q17-12 36 0l18 72H24z" fill="#294940"/>
        <path d="m42 175 17 25 18-25" fill="#e8bf64"/>
        <circle cx="59" cy="144" r="34" fill="#f5c49f"/>
        <path d="M27 137q3-35 34-34 30 1 33 31-17 1-28-13-14 18-39 16" fill="#5d433a"/>
        <path d="m17 108 42-17 44 17-44 17z" fill="#223e37"/>
        <path d="M98 110v22" stroke="#d6aa54" stroke-width="3" stroke-linecap="round"/>
        <circle cx="49" cy="146" r="2.8" fill="#263932"/><circle cx="72" cy="146" r="2.8" fill="#263932"/>
        <ellipse cx="40" cy="155" rx="5" ry="3" fill="#ed9e8e"/><ellipse cx="80" cy="155" rx="5" ry="3" fill="#ed9e8e"/>
        <path d="M54 157q6 7 12 0" fill="none" stroke="#864f45" stroke-width="2" stroke-linecap="round"/>
        <g class="atlas-stack">
          <g transform="translate(69 176) rotate(-12)">${sheet}</g>
          <g transform="translate(77 173) rotate(8)">${sheet}</g>
          <g transform="translate(71 179) rotate(-3)">${sheet}</g>
        </g>
        <path d="M38 193q13 29 37 11" fill="none" stroke="#3a6255" stroke-width="12" stroke-linecap="round"/>
        <circle cx="78" cy="202" r="6" fill="#f5c49f"/>
      </g>
    </g>
    ${publishers.map((_, i) => {
      const x = 257 + (i % 4) * 71, y = -77 + Math.floor(i / 4) * 88;
      return `<g transform="translate(55 181)"><g class="atlas-flying" style="--file-time:${1270 + i * 260}ms;--target-x:${x}px;--target-y:${y}px">${sheet}</g></g>`;
    }).join('')}
    <path d="M205 238h12v49h-12zm335 0h12v49h-12z" fill="#9b7559"/>
    <rect x="191" y="227" width="376" height="14" rx="6" fill="#c79e75"/>
  </svg>`;
}

export function createLibraryIntro(language) {
  const app = document.querySelector('#app');
  const overlay = document.createElement('div');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const caption = language === 'en' ? 'Getting your library ready…' : '正在整理你的文献库…';
  overlay.className = 'atlas-intro';
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `<div class="atlas-intro-content">${scene()}<strong>Paper Atlas</strong><span>${caption}</span></div>`;
  const previousInert = app.inert;
  app.inert = true;
  document.body.append(overlay);
  const start = performance.now();
  let leaving = false;
  function ready() {
    if (leaving) return;
    leaving = true;
    clearTimeout(watchdog);
    setTimeout(() => {
      overlay.classList.add('atlas-intro-leaving');
      setTimeout(() => {
        overlay.remove();
        app.inert = previousInert;
      }, reduced ? 0 : 260);
    }, reduced ? 0 : Math.max(0, 3450 - (performance.now() - start)));
  }
  const watchdog = setTimeout(ready, 10000);
  return { ready };
}
