export function mountReaderSplit(root, language, currentDocument) {
  const divider = root.querySelector('.reader-divider');
  const info = root.querySelector('.reader-info');
  const infoToggle = root.querySelector('.reader-info-toggle');
  const immersiveToggle = root.querySelector('.reader-immersive-toggle');
  const desktop = window.matchMedia('(min-width:851px)');
  const label = (zh, en) => language === 'en' ? en : zh;

  let ratio = Number(localStorage.getItem('pa-reader-ratio')) || 70;
  let collapsed = localStorage.getItem('pa-reader-info') === 'collapsed';
  let immersive = false;
  let pointer = null;

  function setRatio(value) {
    ratio = Math.max(45, Math.min(85, value));
    root.style.setProperty('--reader-ratio', ratio + 'fr');
    root.style.setProperty('--info-ratio', (100 - ratio) + 'fr');
    divider.setAttribute('aria-valuenow', String(Math.round(ratio)));
  }

  function paint() {
    const infoHidden = immersive || (desktop.matches && collapsed);
    root.toggleAttribute('data-info-collapsed', collapsed);
    root.toggleAttribute('data-immersive', immersive);
    info.toggleAttribute('inert', infoHidden);
    divider.tabIndex = desktop.matches && !infoHidden ? 0 : -1;
    infoToggle.setAttribute('aria-expanded', String(!infoHidden));
    infoToggle.title = collapsed ? label('展开论文信息', 'Expand paper details') : label('收起论文信息', 'Collapse paper details');
    infoToggle.setAttribute('aria-label', infoToggle.title);
    immersiveToggle.setAttribute('aria-pressed', String(immersive));
    immersiveToggle.title = immersive ? label('退出沉浸式阅读', 'Exit immersive reading') : label('沉浸式阅读', 'Immersive reading');
  }

  function finishDrag(event) {
    if (event.pointerId !== pointer) return;
    pointer = null;
    root.classList.remove('resizing');
    localStorage.setItem('pa-reader-ratio', String(ratio));
  }

  divider.onpointerdown = event => {
    if (event.button !== 0 || pointer !== null || collapsed || immersive) return;
    pointer = event.pointerId;
    root.classList.add('resizing');
    divider.setPointerCapture(event.pointerId);
  };
  divider.onpointermove = event => {
    if (event.pointerId !== pointer) return;
    const box = root.getBoundingClientRect();
    setRatio((event.clientX - box.left) / box.width * 100);
  };
  divider.onpointerup = divider.onpointercancel = divider.onlostpointercapture = finishDrag;
  divider.onkeydown = event => {
    if (collapsed || immersive || !['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    setRatio(event.key === 'Home' ? 70 : ratio + (event.key === 'ArrowRight' ? 2 : -2));
    localStorage.setItem('pa-reader-ratio', String(ratio));
  };

  infoToggle.onclick = () => {
    collapsed = !collapsed;
    localStorage.setItem('pa-reader-info', collapsed ? 'collapsed' : 'expanded');
    paint();
  };
  const setImmersive = value => {
    const reader = currentDocument();
    const position = reader?.readingPosition?.();
    immersive = value;
    paint();
    reader?.restoreReadingPosition?.(position);
  };
  immersiveToggle.onclick = () => setImmersive(!immersive);
  const exitOnEscape = event => {
    if (event.key !== 'Escape' || !immersive || event.defaultPrevented || event.target.closest?.('textarea,input,[contenteditable]')) return;
    setImmersive(false);
    immersiveToggle.focus({preventScroll:true});
  };

  setRatio(ratio);
  paint();
  desktop.addEventListener('change', paint);
  root.ownerDocument.addEventListener('keydown', exitOnEscape);
  return () => {
    desktop.removeEventListener('change', paint);
    root.ownerDocument.removeEventListener('keydown', exitOnEscape);
  };
}
