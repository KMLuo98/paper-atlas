import './mail-intro.css';
import {mailLaunchScene} from './mail-launch-scene.js';
const svg=content=>`<svg viewBox="0 0 48 48" aria-hidden="true">${content}</svg>`;
const providers=[
 ['QQ邮箱',-148,-112,-14,svg('<ellipse cx="24" cy="27" rx="14" ry="17" fill="#25303a"/><ellipse cx="24" cy="29" rx="10" ry="12" fill="white"/><ellipse cx="19" cy="17" rx="3" ry="5" fill="white"/><ellipse cx="29" cy="17" rx="3" ry="5" fill="white"/><circle cx="20" cy="17" r="1.3"/><circle cx="28" cy="17" r="1.3"/><path d="M20 23h8l-4 4z" fill="#f5ad31"/><path d="M12 28q12 6 24 0l-2 6q-10 4-20-1z" fill="#e44442"/><ellipse cx="16" cy="43" rx="7" ry="3" fill="#f5ad31"/><ellipse cx="32" cy="43" rx="7" ry="3" fill="#f5ad31"/>')],
 ['Gmail',-52,-157,9,svg('<path d="M7 12v26h7V20l10 8 10-8v18h7V12l-7-2-10 8-10-8z" fill="#fff"/><path d="M7 14v24h7V20z" fill="#4285f4"/><path d="M34 20v18h7V14z" fill="#34a853"/><path d="m7 12 7-2 10 8 10-8 7 2v9l-7-1-10 8-10-8-7 1z" fill="#ea4335"/><path d="m34 10 7 2v9l-7-1z" fill="#fbbc04"/>')],
 ['163邮箱',58,-155,-10,svg('<text x="24" y="31" text-anchor="middle" fill="#dc343a" font-family="Arial,sans-serif" font-size="25" font-weight="800" font-style="italic">163</text><path d="M7 36q17 5 34-3" fill="none" stroke="#dc343a" stroke-width="2.5"/>')],
 ['Outlook',150,-108,13,svg('<rect x="16" y="9" width="26" height="31" rx="3" fill="#168ad5"/><path d="m17 20 12 9 12-9" fill="none" stroke="#cdeeff" stroke-width="2"/><rect x="5" y="14" width="23" height="25" rx="3" fill="#0864b7"/><text x="16.5" y="32" text-anchor="middle" fill="white" font-family="Arial" font-size="19" font-weight="700">O</text>')],
 ['Foxmail',-172,-18,-8,svg('<path d="m6 12 12 5 6-7 6 7 12-5-6 21-12 9-12-9z" fill="#ee8c36"/><path d="m12 26 12 10 12-10-5 12-7 4-7-4z" fill="#fff1dc"/><circle cx="18" cy="26" r="2" fill="#5f3e2d"/><circle cx="30" cy="26" r="2" fill="#5f3e2d"/>')],
 ['学校邮箱',173,-13,11,svg('<path d="m4 20 20-11 20 11-20 11z" fill="#477a9f"/><path d="M12 26v10q12 7 24 0V26l-12 7z" fill="#6a98b5"/><path d="M42 22v14" stroke="#477a9f" stroke-width="3"/>')],
 ['Yahoo邮箱',-135,70,12,svg('<rect x="6" y="7" width="36" height="35" rx="9" fill="#6b35bf"/><text x="24" y="33" text-anchor="middle" fill="white" font-family="Georgia,serif" font-size="28" font-weight="700">Y!</text>')],
 ['企业邮箱',138,68,-12,svg('<rect x="7" y="12" width="34" height="27" rx="5" fill="#3e8b76"/><path d="m9 16 15 12 15-12" fill="none" stroke="#e4f7ed" stroke-width="3"/><path d="M18 12V8h12v4" fill="none" stroke="#3e8b76" stroke-width="3"/>')]
];
function playMailIntro(){
 document.querySelector('#mail-launch')?.remove();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let ready=false,leaving=false,closed=false,finishTimer;
 const overlay=document.createElement('div');overlay.id='mail-launch';overlay.className='mail-launch'+(reduced?' reduce-motion':'');overlay.setAttribute('role','status');overlay.setAttribute('aria-label','正在打开邮件工作台');
 overlay.innerHTML=mailLaunchScene(providers);
 const app=document.querySelector('#app'),wasInert=app?.inert;if(app)app.inert=true;
 document.body.append(overlay);
 const cleanup=()=>{if(closed)return;closed=true;clearTimeout(finishTimer);overlay.remove();if(app)app.inert=wasInert;};
 function finish(){
  if(!ready||leaving||closed)return;
  overlay.classList.add('is-finishing');finishTimer=setTimeout(()=>{if(closed)return;leaving=true;overlay.classList.add('is-leaving');overlay.querySelector('[data-intro-caption]').textContent='欢迎来到你的邮件工作台';finishTimer=setTimeout(cleanup,reduced?400:980);},reduced?0:300);
 }
 return {ready(){if(ready)return;ready=true;finish();},destroy:cleanup};
}
export function createMailIntro(){return playMailIntro();}
