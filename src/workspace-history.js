export function protectWorkspaceEntry(history, url) {
  if (history.state?.paWorkspace) return;
  history.replaceState({...history.state,paVisited:true,paWorkspace:'boundary'},'',url);
  history.pushState({paVisited:true,paWorkspace:'entry'},'',url);
}

export function restoreWorkspaceEntry(history, entry, signedIn) {
  if (signedIn && entry?.paWorkspace==='boundary') history.forward();
}

export function pushWorkspacePage(history, from, to, signedIn) {
  const state = signedIn && from !== '#/login' && to !== '#/login'
    ? {paVisited:true,paWorkspace:'page',paFrom:from||'#/library'}
    : {paVisited:true};
  history.pushState(state,'',to);
}
