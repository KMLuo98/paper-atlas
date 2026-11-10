import './send-animation.css';

// Packing starts on confirmation; the envelope only departs after the server accepts the mail.
export function beginSendAnimation(dialog){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const stage=document.createElement('div');stage.className='mail-send-stage';
 stage.setAttribute('role','status');stage.setAttribute('aria-live','polite');
 stage.innerHTML='<div class="send-scene" aria-hidden="true"><div class="send-envelope"><div class="send-envelope-back"></div><div class="send-letter"></div><div class="send-envelope-front"></div><div class="send-envelope-flap"></div></div></div><p class="send-animation-status">正在装入信封并提交邮件…</p>';
 const paper=dialog.querySelector('.send-summary')?.cloneNode(true);
 if(paper)stage.querySelector('.send-letter').append(paper);
 dialog.append(stage);dialog.classList.add('is-mail-sending');dialog.setAttribute('aria-busy','true');
 const app=document.querySelector('#app'),wasInert=app?.inert;if(app)app.inert=true;
 let timer,settle,closed=false;
 const packed=new Promise(resolve=>{settle=resolve;timer=setTimeout(resolve,reduced?0:850);});
 const cleanup=()=>{if(closed)return;closed=true;clearTimeout(timer);settle();stage.remove();dialog.classList.remove('is-mail-sending');dialog.removeAttribute('aria-busy');if(app)app.inert=wasInert;};
 return {
  async accepted(){await packed;if(closed)return;stage.querySelector('p').textContent='邮件已提交投递';stage.classList.add('is-departing');await new Promise(resolve=>{settle=resolve;timer=setTimeout(resolve,reduced?400:950);});cleanup();},
  cancel:cleanup
 };
}
