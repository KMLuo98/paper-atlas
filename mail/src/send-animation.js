import './send-animation.css';

const packingDuration = 1500;
const flightDuration = 1120;
const seal = '<div class="send-wax-seal"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><rect x="13" y="20" width="38" height="27" rx="5"/><path d="m15 23 17 13 17-13"/></svg></div>';

// Packing starts on confirmation. The envelope departs after the server accepts the mail.
export function beginSendAnimation(dialog){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const stage=document.createElement('div');stage.className='mail-send-stage';
 stage.style.setProperty('--send-packing-time',packingDuration+'ms');
 stage.style.setProperty('--send-flight-time',flightDuration+'ms');
 stage.setAttribute('role','status');stage.setAttribute('aria-live','polite');
 stage.innerHTML='<div class="send-scene" aria-hidden="true"><div class="send-envelope"><div class="send-envelope-back"></div><div class="send-letter-pocket"><div class="send-letter"></div></div><div class="send-envelope-front"></div><div class="send-envelope-flap"></div>'+seal+'</div></div><p class="send-animation-status">正在装入信封并提交邮件…</p>';
 const paper=dialog.querySelector('.send-summary')?.cloneNode(true);
 if(paper)stage.querySelector('.send-letter').append(paper);
 dialog.append(stage);dialog.classList.add('is-mail-sending');dialog.setAttribute('aria-busy','true');
 const app=document.querySelector('#app'),wasInert=app?.inert;if(app)app.inert=true;
 let timer,settle,closed=false;
 const pause=ms=>new Promise(resolve=>{settle=resolve;timer=setTimeout(resolve,ms);});
 const packed=pause(reduced?0:packingDuration);
 const cleanup=()=>{if(closed)return;closed=true;clearTimeout(timer);settle();stage.remove();dialog.classList.remove('is-mail-sending');dialog.removeAttribute('aria-busy');if(app)app.inert=wasInert;};
 return {
  async accepted(){await packed;if(closed)return;stage.querySelector('p').textContent='邮件已提交投递';stage.classList.add('is-departing');await pause(reduced?400:flightDuration);cleanup();},
  cancel:cleanup
 };
}
