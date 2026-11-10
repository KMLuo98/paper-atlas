import './library-intro.css';

import publisherIcons from './publisher-icons.json';

const publishers = ['Nature', 'Science', 'Cell', 'PNAS', 'Wiley', 'Elsevier', 'APS'];

const sheet = `<rect width="25" height="32" rx="3" fill="#fffefa" stroke="#9aab9d"/>
  <path d="M5 8h15M5 14h12M5 20h15M5 26h9" stroke="#8c9f92" stroke-width="1.5" stroke-linecap="round"/>`;

const scholar = `<g class="atlas-scholar">
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
    </g>`;

function scene() {
  return `<svg viewBox="0 0 640 330" aria-hidden="true">
    <rect x="10" y="8" width="620" height="306" rx="36" fill="#e8eee0"/>
    <circle cx="132" cy="104" r="63" fill="#f6edcf"/>
    <path d="M35 288h570" stroke="#c6d1bf" stroke-width="2"/>
    <rect x="285" y="38" width="304" height="232" rx="13" fill="#856654"/>
    ${publishers.map((name, i) => {
      const x = 297 + (i % 4) * 71, y = 51 + Math.floor(i / 4) * 88;
      return `<g transform="translate(${x} ${y})">
        <rect width="66" height="80" rx="5" fill="#faf5e8"/>
        <path d="M5 41 36 5h10L5 53z" fill="#fff" opacity=".7"/>
        <image x="8" y="5" width="50" height="30" href="${publisherIcons[name.toLowerCase()]}"/>
        <text x="33" y="47" fill="#344538" font-size="12" font-weight="700">${name}</text>
        <g class="atlas-filed" style="--file-time:${1700 + i * 260}ms" transform="translate(15 56) scale(1.45 .58)">${sheet}</g>
      </g>`;
    }).join('')}
    ${scholar}
    ${publishers.map((_, i) => {
      const x = 257 + (i % 4) * 71, y = -77 + Math.floor(i / 4) * 88;
      return `<g transform="translate(55 181)"><g class="atlas-flying" style="--file-time:${1270 + i * 260}ms;--target-x:${x}px;--target-y:${y}px;--mid-x:${(116 + x) / 2}px;--mid-y:${y / 2 - 32}px">${sheet}</g></g>`;
    }).join('')}
    <path d="M205 238h12v49h-12zm335 0h12v49h-12z" fill="#9b7559"/>
    <rect x="191" y="227" width="376" height="14" rx="6" fill="#c79e75"/>
  </svg>`;
}

function loginScene() {
  return `<svg class="atlas-login-scene" viewBox="0 0 640 330" aria-hidden="true">
    <rect x="10" y="8" width="620" height="306" rx="36" fill="#e8eee0"/>
    <circle cx="132" cy="104" r="63" fill="#f6edcf"/>
    <path d="M35 288h570" stroke="#c6d1bf" stroke-width="2"/>
    <rect x="286" y="39" width="255" height="245" rx="9" fill="#856654"/>
    <rect x="298" y="51" width="231" height="225" rx="4" fill="#fff3ce"/>
    <g transform="translate(298 51)">
      <g class="atlas-study-door">
        <rect width="231" height="225" rx="4" fill="#598471" stroke="#34594b" stroke-width="3"/>
        <rect x="20" y="20" width="191" height="185" rx="6" fill="#749a83" stroke="#a1b7a0" stroke-width="2"/>
        <circle cx="34" cy="114" r="9" fill="#efcb77"/><path d="M31 114h6" stroke="#614c34" stroke-width="2" stroke-linecap="round"/>
      </g>
    </g>
    ${scholar}
    <g transform="translate(278 193)">
      <g class="atlas-key-pull">
        <g class="atlas-key-ring">
          <circle r="9" fill="none" stroke="#89602c" stroke-width="3"/>
          ${[-45, 0, 45].map((angle, index) => `<path transform="rotate(${angle})" d="M0 8v${21 + index * 4}h6v-5h-4" fill="none" stroke="${['#a97b40','#b48b50','#906434'][index]}" stroke-width="3" stroke-linejoin="round"/>`).join('')}
        </g>
      </g>
    </g>
    <g transform="translate(279 187)">
      <g class="atlas-key-found">
        <circle r="6" fill="none" stroke="#a77836" stroke-width="3"/>
        <path d="M6 0h19m-5 0v5" stroke="#a77836" stroke-width="3" stroke-linecap="round"/>
      </g>
    </g>
  </svg>`;
}

export function createLibraryIntro(language, mode = 'startup') {
  const app = document.querySelector('#app');
  const overlay = document.createElement('div');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const login = mode === 'login';
  const caption = login
    ? (language === 'en' ? 'Opening your study…' : '正在打开你的书房…')
    : language === 'en' ? 'Getting your library ready…' : '正在整理你的文献库…';
  overlay.className = 'atlas-intro';
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `<div class="atlas-intro-content">${login ? loginScene() : scene()}<strong>Paper Atlas</strong><span>${caption}</span></div>`;
  const previousInert = app.inert;
  app.inert = true;
  document.body.append(overlay);
  const start = performance.now();
  let leaving = false;
  function destroy() {
    if (!overlay.isConnected) return;
    clearTimeout(watchdog);
    overlay.remove();
    app.inert = previousInert;
  }
  async function ready() {
    if (leaving || !overlay.isConnected) return;
    leaving = true;
    clearTimeout(watchdog);
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    if (!reduced) {
      await wait(Math.max(0, (login ? 980 : 3450) - (performance.now() - start)));
      if (login) {
        overlay.classList.add('atlas-key-ready');
        await wait(940);
      }
      overlay.classList.add('atlas-intro-leaving');
      await wait(260);
    }
    destroy();
  }
  const watchdog = login ? undefined : setTimeout(ready, 10000);
  return { ready, destroy };
}
