import './library-intro.css';
import publisherIcons from './publisher-icons.json';

const publishers = [
  ['nature', 'Nature'],
  ['science', 'Science'],
  ['cell', 'Cell'],
  ['pnas', 'PNAS'],
  ['wiley', 'Wiley'],
  ['elsevier', 'Elsevier'],
  ['aps', 'APS'],
  ['aip', 'AIP'],
];

function catalogScene() {
  const cards = publishers.map(([id, name], index) => `
    <li class="atlas-publisher" style="--atlas-order:${index}">
      <img src="${publisherIcons[id]}" alt="" draggable="false">
      <span>${name}</span>
    </li>`).join('');

  return `<ul class="atlas-catalog">${cards}</ul>`;
}

function studyScene() {
  return `<div class="atlas-study">
    <div class="atlas-study-interior"></div>
    <div class="atlas-study-door">
      <div class="atlas-door-inlay"></div>
      <div class="atlas-door-lock"></div>
    </div>
  </div>`;
}

export function createLibraryIntro(language, mode = 'startup') {
  const app = document.querySelector('#app');
  const overlay = document.createElement('div');
  const login = mode === 'login';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const caption = login
    ? (language === 'en' ? 'Opening your study…' : '正在打开你的书房…')
    : (language === 'en' ? 'Getting your library ready…' : '正在整理你的文献库…');

  overlay.className = 'atlas-intro';
  overlay.setAttribute('role', 'status');
  overlay.innerHTML = `
    <div class="atlas-intro-content">
      <div class="atlas-intro-copy">
        <img class="atlas-intro-logo" src="./logo.png" alt="" width="48" height="48">
        <strong class="atlas-intro-title">Paper Atlas</strong>
        <p class="atlas-intro-caption">${caption}</p>
        <div class="atlas-intro-progress" aria-hidden="true"></div>
      </div>
      <div class="atlas-intro-stage" aria-hidden="true">
        ${login ? studyScene() : catalogScene()}
      </div>
    </div>`;

  const previousInert = app.inert;
  app.inert = true;
  document.body.append(overlay);

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let completion;
  const watchdog = login ? undefined : setTimeout(ready, 10000);

  function destroy() {
    clearTimeout(watchdog);
    if (!overlay.isConnected) return;
    overlay.remove();
    app.inert = previousInert;
  }

  async function finish() {
    if (reduced) {
      destroy();
      return;
    }
    overlay.classList.add('atlas-intro-ready');
    if (login) await wait(520);
    if (!overlay.isConnected) return;
    overlay.classList.add('atlas-intro-leaving');
    await wait(220);
    destroy();
  }

  function ready() {
    if (!overlay.isConnected) return completion;
    clearTimeout(watchdog);
    completion ??= finish();
    return completion;
  }

  return { ready, destroy };
}
