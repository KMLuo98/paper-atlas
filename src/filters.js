import {journalFull,searchPapers,escapeHTML as e} from './core.js';
export const journalOptions=papers=>[...new Set(papers.map(journalFull).filter(Boolean))].sort(new Intl.Collator('en',{sensitivity:'base',numeric:true}).compare);
export function yearBounds(papers){const years=papers.map(p=>Number(p.published_at?.slice(0,4))).filter(n=>n>1000);return years.length?[Math.min(...years),Math.max(...years)]:[new Date().getFullYear(),new Date().getFullYear()];}
export function filterPapers(papers,{query='',journals=[],years=null}={}){return searchPapers(papers.filter(p=>(!journals.length||journals.includes(journalFull(p)))&&(!years||(p.published_at&&Number(p.published_at.slice(0,4))>=years[0]&&Number(p.published_at.slice(0,4))<=years[1]))),query);}
export function filterMarkup(papers,filters={},prefix='library'){
 const [min,max]=yearBounds(papers),range=filters.years||[min,max];
 return `<div class="advanced-filters" data-filters="${prefix}"><details class="journal-multi"><summary>期刊 <span data-journal-count>${filters.journals?.length||'全部'}</span> ▾</summary><div class="journal-options"><button type="button" data-journal-clear>全部期刊</button>${journalOptions(papers).map(j=>`<label><input type="checkbox" value="${e(j)}" data-journal ${filters.journals?.includes(j)?'checked':''}><span data-user-content>${e(j)}</span></label>`).join('')}</div></details><fieldset class="year-filter"><legend>时间跨度 <output>${filters.years?range.join('–'):'全部'}</output></legend><div class="range-pair"><input type="range" min="${min}" max="${max}" value="${range[0]}" data-year-low aria-label="起始年份"><input type="range" min="${min}" max="${max}" value="${range[1]}" data-year-high aria-label="结束年份"></div><button type="button" class="text-button" data-year-reset>不限时间</button></fieldset></div>`;
}
export function bindFilters(root,filters,changed){
 const checks=[...root.querySelectorAll('[data-journal]')];checks.forEach(c=>c.onchange=()=>{filters.journals=checks.filter(c=>c.checked).map(c=>c.value);root.querySelector('[data-journal-count]').textContent=filters.journals.length||'全部';changed();});
 root.querySelector('[data-journal-clear]').onclick=()=>{filters.journals=[];checks.forEach(c=>c.checked=false);root.querySelector('[data-journal-count]').textContent='全部';changed();};
 const low=root.querySelector('[data-year-low]'),high=root.querySelector('[data-year-high]');
 const update=event=>{if(+low.value>+high.value){if(event.target===low)high.value=low.value;else low.value=high.value;}filters.years=[+low.value,+high.value];root.querySelector('output').textContent=filters.years.join('–');changed();};low.oninput=update;high.oninput=update;
 root.querySelector('[data-year-reset]').onclick=()=>{filters.years=null;low.value=low.min;high.value=high.max;root.querySelector('output').textContent='全部';changed();};
}
