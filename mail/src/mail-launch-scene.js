export function mailLaunchScene(providers){
 return `<div class="mail-launch-content"><div class="mail-launch-stage" aria-hidden="true">
  <svg class="intro-atlas-orbit" viewBox="0 0 360 360" fill="none"><circle cx="180" cy="180" r="153" stroke="currentColor" stroke-opacity=".13"/><circle cx="180" cy="180" r="135" stroke="currentColor" stroke-opacity=".1" stroke-dasharray="1 8"/><path d="M180 19v14M180 327v14M19 180h14M327 180h14" stroke="currentColor" stroke-opacity=".3"/><circle cx="180" cy="27" r="2.5" fill="currentColor"/><circle cx="333" cy="180" r="2" fill="currentColor"/></svg>
  <div class="intro-envelope"><div class="intro-envelope-glow"></div>
   <svg class="intro-envelope-back" viewBox="0 0 220 148"><rect x="1" y="1" width="218" height="146" rx="12" fill="#849b90" stroke="#6d8477"/><path d="M4 3h212L110 90z" fill="#36584e"/><path d="M8 7h204" stroke="#b6c3af" stroke-opacity=".5"/></svg>
   <div class="intro-provider-cloud">${providers.map(([name,x,y,rotation,icon],index)=>`<span class="intro-provider" title="${name}" data-provider="${name}" style="--from-x:${x}px;--from-y:${y}px;--tilt:${rotation}deg;--delay:${[.4,.55,2.2,2.35,2.5,4.1,4.25,4.4][index]}s">${icon}</span>`).join('')}</div>
   <svg class="intro-envelope-front" viewBox="0 0 220 148"><path d="M1 4 110 79 219 4v132q0 11-11 11H12q-11 0-11-11z" fill="#e8eee4" stroke="#adb9a9"/><path d="M2 6 85 75 3 139z" fill="#dee6da"/><path d="m218 6-83 69 82 64z" fill="#eef2e8"/><path d="m4 142 80-65m132 65-80-65" stroke="#b5bdab" stroke-width=".8"/><path d="M12 141h196" stroke="#fff" stroke-opacity=".5"/></svg>
   <div class="intro-envelope-flap"><svg viewBox="0 0 220 95"><path d="M1 1h218L117 89q-7 6-14 0z" fill="#edf1e7" stroke="#adb9a9"/><path d="m10 6 95 77q5 4 10 0l95-77" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/></svg></div>
   <svg class="intro-envelope-seal" viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" fill="#45685b"/><circle cx="26" cy="26" r="19" fill="none" stroke="#d8c598" stroke-width=".7"/><path d="M17 20h18v13H17zM17 21l9 7 9-7" fill="none" stroke="#e6dbc0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
   <span class="intro-envelope-shine"></span>
  </div>
 </div><div class="mail-launch-caption"><span class="intro-caption-rule" aria-hidden="true"></span><strong>Mail Atlas</strong><span data-intro-caption>把所有来信，收进一个信封</span></div></div>`;
}
