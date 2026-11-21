import './submission-feedback.css';

const acceptance=`<div class="acceptance-scene" aria-hidden="true">
 <svg viewBox="0 0 320 230" fill="none">
  <ellipse cx="160" cy="198" rx="62" ry="6" fill="currentColor" opacity=".05"/>
  <g class="acceptance-halo" stroke="currentColor"><circle cx="160" cy="107" r="77" stroke-opacity=".12"/><circle cx="160" cy="107" r="65" stroke-opacity=".18" stroke-dasharray="2 8"/></g>
  <g class="acceptance-laurel" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
   <path d="M142 171C93 160 78 111 99 68M178 171C227 160 242 111 221 68"/>
   <path d="M99 79C86 74 84 63 91 56C102 60 105 69 99 79ZM93 98C79 96 74 87 78 79C89 80 96 88 93 98ZM94 119C79 119 73 110 76 102C87 101 95 109 94 119ZM103 139C88 142 79 135 80 127C91 124 102 129 103 139ZM118 156C106 164 94 160 93 152C102 144 113 147 118 156Z"/>
   <path d="M221 79C234 74 236 63 229 56C218 60 215 69 221 79ZM227 98C241 96 246 87 242 79C231 80 224 88 227 98ZM226 119C241 119 247 110 244 102C233 101 225 109 226 119ZM217 139C232 142 241 135 240 127C229 124 218 129 217 139ZM202 156C214 164 226 160 227 152C218 144 207 147 202 156Z"/>
  </g>
  <g class="acceptance-medallion"><circle cx="160" cy="108" r="43" fill="currentColor" fill-opacity=".07" stroke="currentColor" stroke-opacity=".4"/><circle cx="160" cy="108" r="36" stroke="currentColor" stroke-opacity=".17"/><path class="acceptance-check" d="M143 108L155 120L178 96" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g>
  <g class="acceptance-stars" fill="currentColor"><path d="M160 16l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/><circle cx="55" cy="108" r="2"/><circle cx="264" cy="96" r="2"/><circle cx="240" cy="37" r="1.5"/><circle cx="77" cy="32" r="1.5"/></g>
 </svg>
 <div class="submission-fireworks">${Array.from({length:3},(_,burst)=>`<div class="firework-burst" style="--burst:${burst}">${Array.from({length:12},(_,i)=>`<i style="--angle:${i*30}deg"></i>`).join('')}</div>`).join('')}</div>
</div>`;

const comfort=`<div class="reassurance-scene" aria-hidden="true"><svg viewBox="0 0 320 230" fill="none">
 <ellipse class="comfort-floor" cx="160" cy="203" rx="94" ry="7" fill="currentColor" opacity=".06"/>
 <circle class="comfort-aura" cx="160" cy="111" r="86" stroke="currentColor" stroke-opacity=".09"/>
 <g class="comfort-recipient">
  <path d="M84 190V149C84 126 99 115 118 115C138 115 154 128 154 149V190C133 198 105 198 84 190Z" fill="#9eafb2"/>
  <path d="M102 119L118 136L134 119" stroke="#ecf0ed" stroke-width="2" stroke-linecap="round"/>
  <g class="comfort-recipient-head"><path d="M92 77C92 58 103 48 119 48C136 48 147 60 147 77V87C147 104 135 116 120 116C104 116 92 103 92 87Z" fill="#dfcdb7"/>
   <path d="M92 79C87 61 99 44 119 44C134 44 148 54 148 74C135 71 125 65 119 58C113 69 104 75 92 79Z" fill="#5b625d"/>
   <path d="M105 86L111 88M129 88L135 86" stroke="#6b5d50" stroke-width="1.8" stroke-linecap="round"/>
   <path class="comfort-smile" d="M114 99Q120 103 126 99" stroke="#9a7761" stroke-width="1.5" stroke-linecap="round"/>
  </g>
 </g>
 <g class="comfort-friend">
  <path d="M174 191V146C174 122 188 111 207 111C228 111 242 126 242 146V191C219 198 197 198 174 191Z" fill="#52726f"/>
  <path d="M192 116L207 132L222 116" stroke="#dce6dc" stroke-width="2" stroke-linecap="round"/>
  <path d="M181 71C181 53 192 42 208 42C225 42 236 55 236 73V83C236 100 224 112 208 112C192 112 181 100 181 83Z" fill="#e8d9c5"/>
  <path d="M181 77C175 60 184 40 205 39C225 36 239 50 237 70C222 69 212 64 206 55C203 67 193 74 181 77Z" fill="#657268"/>
  <path d="M193 83Q196 81 199 83M216 83Q219 81 222 83M202 96Q208 100 214 96" stroke="#85715b" stroke-width="1.5" stroke-linecap="round"/>
 </g>
 <g class="comfort-pat-hand"><path d="M191 138C170 118 163 82 132 61" stroke="#52726f" stroke-width="19" stroke-linecap="round"/><path d="M135 64C129 59 119 58 110 61" stroke="#e8d9c5" stroke-width="13" stroke-linecap="round"/></g>
 <g class="comfort-embrace"><path d="M201 139C181 162 142 163 118 147" stroke="#52726f" stroke-width="20" stroke-linecap="round"/><path d="M122 150L110 145" stroke="#e8d9c5" stroke-width="13" stroke-linecap="round"/><path d="M133 167Q160 185 182 168" stroke="#aebfc0" stroke-width="15" stroke-linecap="round"/></g>
 <path class="comfort-heart" d="M157 41C146 31 151 21 158 26C166 17 176 28 157 41Z" fill="currentColor" opacity=".7"/>
</svg></div>`;

export function feedbackHTML(rejected,language='zh'){
 const heading=rejected?(language==='en'?'A moment of kindness':'抱抱你，慢慢来'):(language==='en'?'Congratulations!':'恭喜发表');
 return '<div class="feedback-panel">'+(rejected?comfort:acceptance)+'<div class="celebration-message"><span class="feedback-rule" aria-hidden="true"></span><h2>'+heading+'</h2><button type="button" class="feedback-close" aria-label="'+(language==='en'?'Close':'关闭')+'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div></div>';
}
