import {getMailLanguage} from './mail-language.js';
import './scheduled-animation.css';

const packingDuration=1180,confirmationDuration=940;
const clock='<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="25"/><path d="M32 10v3m22 19h-3M32 54v-3M10 32h3"/><path class="scheduled-hour" d="M32 32V19"/><path class="scheduled-minute" d="M32 32V14"/><circle class="scheduled-clock-pin" cx="32" cy="32" r="2"/></svg>';

// The envelope stays in its tray. Only a confirmed durable enqueue earns the clock seal.
export function beginScheduledAnimation(dialog,sendAt){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const english=getMailLanguage()==='en',date=new Date(sendAt);
 const stage=document.createElement('div');stage.className='mail-scheduled-stage';
 stage.setAttribute('role','status');stage.setAttribute('aria-live','polite');
 stage.style.setProperty('--scheduled-pack-time',packingDuration+'ms');
 stage.style.setProperty('--scheduled-confirm-time',confirmationDuration+'ms');
 stage.style.setProperty('--scheduled-hour',((date.getHours()%12)*30+date.getMinutes()/2)+'deg');
 stage.style.setProperty('--scheduled-minute',(date.getMinutes()*6)+'deg');
 stage.innerHTML='<div class="scheduled-scene" aria-hidden="true"><svg class="scheduled-orbit" viewBox="0 0 240 240" fill="none"><circle class="scheduled-orbit-track" cx="120" cy="120" r="108"/><circle class="scheduled-orbit-progress" cx="120" cy="120" r="108"/></svg><div class="scheduled-tray"></div><div class="scheduled-envelope"><div class="scheduled-envelope-back"></div><div class="scheduled-letter-pocket"><div class="scheduled-letter"></div></div><div class="scheduled-envelope-front"></div><div class="scheduled-envelope-flap"></div><div class="scheduled-clock-seal">'+clock+'</div></div></div><span class="scheduled-caption"></span><time class="scheduled-send-time"></time><p class="scheduled-animation-status"></p>';
 const paper=dialog.querySelector('.send-summary')?.cloneNode(true);
 if(paper)stage.querySelector('.scheduled-letter').append(paper);
 stage.querySelector('.scheduled-caption').textContent=english?'SCHEDULED DELIVERY':'预约递送';
 const time=stage.querySelector('time');time.dateTime=date.toISOString();
 time.textContent=new Intl.DateTimeFormat(english?'en':'zh-CN',{month:'short',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
 const status=stage.querySelector('.scheduled-animation-status');status.textContent=english?'Sealing your message for later…':'正在封存定时邮件…';
 const scroll=dialog.scrollTop,app=document.querySelector('#app'),wasInert=app?.inert;
 dialog.append(stage);dialog.classList.add('is-mail-scheduling');dialog.setAttribute('aria-busy','true');dialog.scrollTop=0;if(app)app.inert=true;
 const waiting=new Map();let closed=false,completion;
 const pause=ms=>new Promise(resolve=>{const timer=setTimeout(()=>{waiting.delete(timer);resolve();},ms);waiting.set(timer,resolve);});
 const packed=pause(reduced?0:packingDuration);
 const cleanup=()=>{if(closed)return;closed=true;for(const [timer,resolve] of waiting){clearTimeout(timer);resolve();}waiting.clear();stage.remove();dialog.classList.remove('is-mail-scheduling');dialog.removeAttribute('aria-busy');dialog.scrollTop=scroll;if(app)app.inert=wasInert;};
 return {
  preparing(){if(!closed)status.textContent=english?'Saved. Preparing your scheduled mail…':'已保存，正在准备定时邮件列表…';},
  saved(){return completion||=(async()=>{await packed;if(closed)return;stage.classList.add('is-queued');status.textContent=english?'Saved. Waiting for your chosen time.':'已保存，等待预约时间';await pause(reduced?260:confirmationDuration);cleanup();})();},
  cancel:cleanup
 };
}
