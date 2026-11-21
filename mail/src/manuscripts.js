import {publisherLogos} from './publisher-logos.js';
import {esc,fmtDate,fuzzy} from './core.js';
import {getMailLanguage} from './mail-language.js';
import {feedbackHTML} from './submission-feedback.js';
import {STATUSES,submissionRound,acceptedBefore,reviewHistory,progressUpdatedAt,SUBMISSION_PHASES,submissionPhase} from '../../supabase/functions/manuscripts-api/core.js';
import './manuscripts.css';

let context,owner='',loaded=false,loading,selectionMode='';
const checkedManuscripts=new Set();
const statusFilters=new Set(),journalFilters=new Set();
let state={enabled:false,manuscripts:[],statistics:[]},scope='active',selected='',query='',layout='grid',updating=false,notice='';
const labels={active:'投稿信息',archived:'已归档稿件',trash:'稿件垃圾箱'};
const providerLogos={
 Elsevier:[publisherLogos.Elsevier,'E'],
 APS:[publisherLogos.APS,'APS'],
 'AIP Publishing':[publisherLogos['AIP Publishing'],'AIP'],
 'Springer Nature':[publisherLogos['Springer Nature'],'N']
};
const icon=(name,size=18)=>context.icon(name,size);
const request=async(action,body={})=>{
 const expectedOwner=owner;
 const result=await context.api('manuscripts_'+action,body);
 if(expectedOwner!==owner)throw Error('账号已切换，请重新操作');
 return result;
};
export function configureManuscripts(options){context=options;}
export function academicEnabled(){return state.enabled;}
document.addEventListener('pa-language-change',()=>{if(context?.active())repaint();});
export async function loadAcademic(user){
 if(owner!==user){owner=user;loaded=false;loading=null;updating=false;notice='';dailyOwner='';statusFilters.clear();journalFilters.clear();state={enabled:false,manuscripts:[],statistics:[]};}
 if(loaded)return;
 if(loading)return loading;
 const expectedOwner=user;
 const task=request('get').then(data=>{if(owner===expectedOwner){state={...state,...data};loaded=true;}}).catch(()=>{}).finally(()=>{if(loading===task)loading=null;});
 loading=task;
 return task;
}
export function academicSettingsHTML(){
 return '<section class="settings-block"><div class="block-heading"><h2>学术版</h2></div><label class="switch-row"><span><strong>开启投稿追踪</strong></span><input type="checkbox" id="academic-enabled" '+(state.enabled?'checked':'')+'></label></section>';
}
function badge(item){
 const provider=providerLogos[item.publisher];
 return '<span class="submission-publisher">'+(provider?'<img src="'+provider[0]+'" alt="'+esc(item.publisher)+'" referrerpolicy="no-referrer">':'')+'<span>'+esc(provider?.[1]||item.publisher?.slice(0,3)||'期刊')+'</span></span>';
}
const status=item=>!item.status||item.status==='unknown'?'':'<span class="submission-status" data-status="'+esc(item.status)+'">'+esc(STATUSES[item.status]||STATUSES.unknown)+'</span>';
const action=(name,label,glyph,extra='')=>'<button type="button" class="secondary" data-ms="'+name+'" aria-label="'+label+'" title="'+label+'" '+extra+'>'+icon(glyph)+'<span class="ms-button-label">'+label+'</span></button>';

const roundLabel=item=>getMailLanguage()==='en'?'Round '+submissionRound(item):'第 '+submissionRound(item)+' 轮';
const statusRound=item=>'<span class="submission-state-pair">'+status(item)+'<span class="submission-round" data-user-content data-round-label>'+roundLabel(item)+'</span></span>';
function dateOnly(value){
 const d=new Date(value);if(!value||!Number.isFinite(+d))return '—';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Shanghai'}).formatToParts(d).map(part=>[part.type,part.value]));
 return getMailLanguage()==='en'?parts.year+'-'+parts.month+'-'+parts.day:parts.year+'年'+parts.month+'月'+parts.day+'日';
}
function listItem(item){
 const updatedAt=progressUpdatedAt(item);
 return '<article class="submission-card '+(checkedManuscripts.has(item.id)?'is-selected':'')+'" data-ms="detail" data-id="'+item.id+'" role="button" tabindex="0">'+
 (selectionMode?'<input class="submission-select" type="checkbox" data-ms-select="'+item.id+'" '+(checkedManuscripts.has(item.id)?'checked':'')+' aria-label="选择 '+esc(item.title)+'">':'')+badge(item)+
 '<div class="submission-identity" data-user-content><span class="submission-journal">'+esc(item.journal||'未注明期刊')+'</span><h2>'+esc(item.title||'标题待补充')+'</h2><p>'+esc(item.authors||'作者待补充')+'</p><div class="submission-idline"><code>'+esc(item.number)+'</code></div></div>'+
 '<div class="submission-state">'+statusRound(item)+(item.tracking_url?'<a href="'+esc(item.tracking_url)+'" target="_blank" rel="noopener noreferrer" class="text-btn">状态链接 '+icon('arrow-up-right',14)+'</a>':'')+'<small class="submission-last-update"><span>状态更新</span><time data-user-content datetime="'+esc(updatedAt)+'">'+dateOnly(updatedAt)+'</time></small></div></article>';
}
function filtersHTML(){
 const journals=[...new Set(state.manuscripts.map(item=>item.journal||'未注明期刊'))].sort((a,b)=>a.localeCompare(b));
 const filter=(name,label,glyph,values,selected)=>'<details class="submission-filter" data-submission-filter="'+name+'"><summary aria-label="'+label+'" title="'+label+'">'+icon(glyph,17)+'<span>'+label+'</span>'+(selected.size?'<b>'+selected.size+'</b>':'')+'</summary><div class="submission-filter-options">'+values.map(([value,title])=>'<label><input type="checkbox" data-ms-filter="'+name+'" value="'+esc(value)+'" '+(selected.has(value)?'checked':'')+'><span '+(name==='journal'?'data-user-content':'')+'>'+esc(title)+'</span></label>').join('')+'</div></details>';
 return '<div class="submission-filters">'+filter('status','稿件状态','list-filter',Object.entries(SUBMISSION_PHASES),statusFilters)+filter('journal','期刊','book-open',journals.map(name=>[name,name]),journalFilters)+((statusFilters.size||journalFilters.size)?action('filters-clear','清除筛选','x'):'')+'</div>';
}
const journalTerms={'Physical':'Phys.','Review':'Rev.','Letters':'Lett.','Research':'Res.','Journal':'J.','International':'Int.','Education':'Educ.','Science':'Sci.','Physics':'Phys.','Communications':'Commun.','Chinese':'Chin.','Nonlinear':'Nonlinear'};
export function journalShort(name){
 if(/^Chaos:/i.test(name)||name==='Chaos')return 'Chaos';
 if(/^Chaos,? Solitons/i.test(name))return 'Chaos Solitons Fractals';
 if(/^Physica [A-E]:/i.test(name))return name.split(':')[0];
 return name.split(':')[0].replace(/\b(?:of|the|and|An|A)\b\s*/g,'').replace(/\b[A-Z][a-z]+\b/g,word=>journalTerms[word]||word).replace(/\s+/g,' ').trim();
}
let statsFrame;
function fitStatistics(){
 cancelAnimationFrame(statsFrame);
 statsFrame=requestAnimationFrame(()=>{
  for(const container of document.querySelectorAll('.submission-stats-scroll')){
   container.removeAttribute('data-abbreviated');
   if(container.scrollWidth>container.clientWidth+1)container.dataset.abbreviated='true';
  }
 });
}
window.addEventListener('resize',fitStatistics,{passive:true});
function statsHTML(){
 return '<section class="submission-statistics"><div class="block-heading"><h2>投稿统计</h2><div>'+action('stats-add','编辑统计','pencil')+action('stats-reset','重置统计','undo-2')+'</div></div><div class="submission-stats-scroll"><table><thead><tr><th>期刊</th><th>累计投稿</th><th>进行中</th><th>已完成</th><th>Accept</th><th>Reject</th><th></th></tr></thead><tbody>'+
 state.statistics.map(row=>'<tr><th class="stats-journal" title="'+esc(row.journal)+'" data-user-content><span class="journal-full">'+esc(row.journal)+'</span><span class="journal-short">'+esc(journalShort(row.journal))+'</span></th>'+['total','active','completed','accepted','rejected'].map(key=>'<td>'+row[key]+'</td>').join('')+'<td><button class="icon-btn" data-ms="stats-edit" data-journal="'+esc(row.journal)+'" aria-label="编辑 '+esc(row.journal)+' 的统计">'+icon('pencil',16)+'</button></td></tr>').join('')+
 '</tbody></table>'+(state.statistics.length?'':'<p class="muted">识别或添加稿件后显示统计</p>')+'</div></section>';
}
function timelineHTML(events){
 return '<ol class="submission-timeline">'+[...events].reverse().map(event=>'<li><time>'+fmtDate(event.date,true)+'</time><div>'+status(event)+'<p data-user-content>'+esc(event.raw_status||'')+'</p>'+
 (event.number?'<code>'+esc(event.number)+'</code>':'')+
 (event.source==='email'?'<button class="text-btn" data-ms="source" data-source="'+esc(event.message_ref||event.source_id)+'">'+icon('mail-open',14)+' 查看来源邮件</button>':event.source_url?'<a class="text-btn" href="'+esc(event.source_url)+'" target="_blank" rel="noopener noreferrer">查看来源 '+icon('arrow-up-right',14)+'</a>':'')+'</div></li>').join('')+'</ol>';
}
function publisherHTML(item){
 const history=item.publisher_history;
 let html='<section class="publisher-records"><h2>出版社信息</h2>';
 if(item.last_checked_at)html+='<p class="muted">上次状态查询 '+fmtDate(item.last_checked_at,true)+'</p>';
 if(item.lookup_notice)html+='<p class="submission-notice">'+esc(item.lookup_notice)+'</p>';
 if(item.publisher==='Elsevier'){
  const metrics=reviewHistory(item);
  html+='<ol class="review-metric-history">'+metrics.map(row=>'<li data-review-kind="'+row.kind+'"><header><span class="submission-round" data-user-content>'+roundLabel({round:row.round})+'</span><time>'+fmtDate(row.date,true)+'</time></header>'+status(row)+(row.kind==='email'?'<p data-user-content>'+esc(row.raw_status)+'</p><button class="text-btn" data-ms="source" data-source="'+esc(row.message_ref||row.source_id)+'">'+icon('mail-open',14)+' 邮件阶段记录</button>':'<dl>'+[
   ['Reviews completed',row.metrics.reviews_completed],['Review invitations accepted',row.metrics.invitations_accepted],['Review invitations sent',row.metrics.invitations_sent],['Last review activity',row.metrics.last_review_activity&&Number.isFinite(Date.parse(row.metrics.last_review_activity))?fmtDate(row.metrics.last_review_activity,true):row.metrics.last_review_activity]
  ].map(([label,value])=>'<dt>'+label+'</dt><dd>'+esc(value??'—')+'</dd>').join('')+'</dl>')+'</li>').join('')+'</ol>';
  if(!metrics.length)html+='<p class="muted">尚无审稿进度记录</p>';
 }
 if(history?.tables?.length){
  html+='<div class="publisher-history-tables">'+history.tables.map(table=>'<div class="publisher-table-scroll"><table class="publisher-history-table" data-user-content><thead><tr>'+table.headers.map(cell=>'<th>'+esc(cell)+'</th>').join('')+'</tr></thead><tbody>'+table.rows.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>').join('')+'</div>';
 }else if(item.publisher!=='Elsevier')html+=timelineHTML((item.events||[]).filter(event=>event.source==='website'));
 return html+'</section>';
}
function detailHTML(item){
 return '<div class="submission-detail"><div class="submission-detail-heading">'+badge(item)+'<div data-user-content><p>'+esc(item.publisher)+' · '+esc(item.journal)+'</p><h1>'+esc(item.title||'标题待补充')+'</h1><p>'+esc(item.authors||'作者待补充')+'</p><div class="submission-idline"><code>'+esc(item.number)+'</code></div>'+
 ((item.number_history||[]).length>1?'<p class="submission-old-numbers">'+esc(item.number_history.filter(number=>number!==item.number).join(' · '))+'</p>':'')+'</div></div><div class="submission-detail-actions">'+statusRound(item)+
 (item.tracking_url?'<a class="secondary" href="'+esc(item.tracking_url)+'" target="_blank" rel="noopener noreferrer">状态链接 '+icon('arrow-up-right',16)+'</a>':'')+
 (!item.deleted_at&&!item.archived_at?action('edit','编辑稿件','pencil','data-id="'+item.id+'"')+action('archive','归档','archive','data-id="'+item.id+'"')+action('trash','删除','trash-2','data-id="'+item.id+'"'):action('restore','恢复追踪','undo-2','data-id="'+item.id+'"')+(item.deleted_at?action('purge','永久删除','trash-2','data-id="'+item.id+'"'):''))+'</div>'+
 '<div class="submission-history-columns">'+publisherHTML(item)+'<section class="submission-mail-records"><h2>邮件信息</h2>'+timelineHTML((item.events||[]).filter(event=>event.source!=='website'))+'</section></div></div>';
}
export function manuscriptsHTML(){
 if(!state.enabled)return '<section class="page"><h1>请先在设置中开启学术版</h1></section>';
 const route=context.route();selected=route.id;scope=route.scope;
 fitStatistics();
 const item=state.manuscripts.find(item=>item.id===selected);
 const items=state.manuscripts.filter(item=>scope==='trash'?item.deleted_at:scope==='archived'?item.archived_at&&!item.deleted_at:!item.archived_at&&!item.deleted_at)
  .filter(item=>(!statusFilters.size||statusFilters.has(submissionPhase(item.status)))&&(!journalFilters.size||journalFilters.has(item.journal||'未注明期刊')))
  .filter(item=>!query||fuzzy([item.publisher,item.journal,item.title,item.authors,item.number,STATUSES[item.status]].join(' '),query))
  .sort((a,b)=>(Date.parse(progressUpdatedAt(b))||0)-(Date.parse(progressUpdatedAt(a))||0)||(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
 return '<section class="page manuscripts-page">'+(item?'<div class="reader-toolbar">'+action('back','返回稿件','arrow-left')+'</div>':'')+
 '<header class="page-head"><div><h1>'+labels[scope]+'</h1>'+(state.last_updated_at?'<p>上次更新 '+fmtDate(state.last_updated_at,true)+'</p>':'')+'</div><div class="head-actions">'+
 action('refresh',updating?'更新中':'更新状态','refresh-cw',updating?'disabled aria-busy="true"':'')+
 (!item?(scope==='active'?action('select-archive','归档','archive')+action('select-trash','删除','trash-2'):action('select-restore','批量恢复','undo-2')):'')+
 action('add','手动添加','plus')+'</div></header>'+(updating?'<p role="status" class="submission-notice">正在检索邮件和查询稿件状态…</p>':'')+(notice?'<p role="status" class="submission-notice">'+esc(notice)+'</p>':'')+
 (item?detailHTML(item):'<div class="submission-dashboard"><section class="submission-results"><div class="submission-toolbar"><input type="search" id="submission-search" placeholder="搜索期刊、标题、作者或稿件号" aria-label="搜索稿件" value="'+esc(query)+'">'+filtersHTML()+'<div class="contact-layout-switch" role="group" aria-label="稿件视图"><button data-ms="layout" data-layout="list" aria-label="列表视图" title="列表视图" aria-pressed="'+(layout==='list')+'">'+icon('list',16)+'</button><button data-ms="layout" data-layout="grid" aria-label="卡片视图" title="卡片视图" aria-pressed="'+(layout==='grid')+'">'+icon('layout-grid',16)+'</button></div></div>'+
 (selectionMode?'<div class="submission-bulk-bar"><label class="check"><input type="checkbox" data-ms-select-all '+(items.length&&items.every(item=>checkedManuscripts.has(item.id))?'checked':'')+'> 全选</label><span>已选 '+checkedManuscripts.size+' 篇</span>'+action('bulk-apply',selectionMode==='restore'?'恢复所选':selectionMode==='archive'?'归档所选':'删除所选',selectionMode==='restore'?'undo-2':selectionMode==='archive'?'archive':'trash-2',checkedManuscripts.size?'':'disabled')+action('selection-cancel','取消选择','x')+'</div>':'')+
 '<div class="submission-items '+(layout==='list'?'submission-list':'')+'">'+(items.map(listItem).join('')||'<div class="empty-state"><h2>暂无稿件</h2><p>点击更新状态从已同步邮件识别，或手动添加稿件</p></div>')+'</div></section>'+statsHTML()+'</div>')+
 '<div class="submission-vault">'+action('scope-archived','已归档','archive')+action('scope-trash','垃圾箱','trash-2')+(scope!=='active'?action('scope-active','返回进行中','arrow-left'):'')+'</div></section>';
}
function repaint(){
 if(!context.active())return;
 context.repaint();
}
function input(name,label,value='',required=false){
 return '<label>'+label+'<input name="'+name+'" value="'+esc(value)+'" '+(required?'required':'')+'></label>';
}
function edit(item={}){
 context.modal(item.id?'编辑稿件':'添加稿件','<form id="submission-form" data-id="'+(item.id||'')+'"><div class="form-grid">'+
 '<label>出版社<input name="publisher" list="submission-publishers" value="'+esc(item.publisher||'')+'" autocomplete="off"><datalist id="submission-publishers">'+['Elsevier','APS','AIP Publishing','Springer Nature','Wiley','Taylor & Francis','Sage'].map(name=>'<option value="'+name+'">').join('')+'</datalist></label>'+
 input('journal','投稿期刊',item.journal,true)+input('number','稿件号',item.number,true)+
 '<label>稿件状态<select name="status">'+Object.entries(STATUSES).map(([value,label])=>'<option value="'+value+'" '+(value===(item.status||'submitted')?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+
 input('title','标题',item.title,true)+input('authors','作者',item.authors)+input('lookup_author','APS 查询作者姓氏（前三位之一）',item.lookup_author)+
 input('tracking_url','状态链接',item.tracking_url)+
 '<p class="form-error" role="alert"></p><div class="modal-footer"><button type="submit" class="primary">'+icon('save',16)+' 保存稿件</button></div></form>',true);
}

function statsEditorRow(row={}){
 return '<fieldset class="stats-editor-row"><label>期刊<input data-stat="journal" value="'+esc(row.journal||'')+'" '+(row.journal?'readonly':'')+' required></label><div class="form-grid">'+
 [['total','累计投稿'],['active','进行中'],['completed','已完成'],['accepted','Accept'],['rejected','Reject']].map(([name,label])=>'<label>'+label+'<input data-stat="'+name+'" type="number" min="0" max="1000000" value="'+(row[name]||0)+'" required></label>').join('')+'</div></fieldset>';
}
function editStats(journal=''){
 const selected=state.statistics.find(row=>row.journal===journal)||state.statistics[0];
 context.modal('编辑投稿统计','<form id="submission-stats-form"><label>选择期刊<select id="statistics-journal-choice">'+state.statistics.map((row,index)=>'<option value="'+index+'" '+(row===selected?'selected':'')+'>'+esc(row.journal)+'</option>').join('')+'<option value="new" '+(!selected?'selected':'')+'>添加期刊…</option></select></label><div id="statistics-edit-rows">'+statsEditorRow(selected)+'</div>'+
 '<p class="form-error" role="alert"></p><div class="modal-footer"><button class="primary" type="submit">'+icon('save',16)+' 保存统计</button></div></form>',true);
}
async function confirmAction(label,run){
 context.modal(label,'<p>确认'+label+'？</p><div class="modal-footer"><button class="secondary" data-action="close-modal">取消</button><button class="primary" id="submission-confirm">确认</button></div>');
 document.querySelector('#submission-confirm').onclick=async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{await run();context.closeModal();repaint();}catch(error){context.toast(error.message,true);button.disabled=false;}
 };
}
function celebrate(rejected=false){
 const root=document.createElement('div');root.className='submission-celebration';root.setAttribute('role','dialog');root.setAttribute('aria-label','恭喜稿件接收');root.setAttribute('aria-modal','true');
 root.classList.toggle('is-comfort',rejected);
 root.setAttribute('aria-label',rejected?'安慰动画':'恭喜发表');
 root.innerHTML=feedbackHTML(rejected,getMailLanguage());
 document.body.append(root);context.icons();
 const app=document.querySelector('#app'),wasInert=app?.inert;if(app)app.inert=true;
 const close=()=>{root.remove();if(app)app.inert=wasInert;document.removeEventListener('keydown',escape);document.querySelector('[data-ms=scope-archived]')?.focus();};
 const escape=event=>{if(event.key==='Escape')close();};
 root.querySelector('button').onclick=close;
 document.addEventListener('keydown',escape);
 root.querySelector('button').focus();
}
document.addEventListener('error',event=>{if(event.target.matches?.('.submission-publisher img'))event.target.hidden=true;},true);

export async function updateManuscripts(daily=false){
 if(updating||!state.enabled)return;
 const runOwner=owner;
 updating=true;notice='';repaint();
 try{
  let first=true;
  while(state.enabled&&runOwner===owner){
   const next=await request('refresh',{start:first,daily});first=false;
   state={...state,...next};repaint();
   if(next.error_notice){notice=next.error_notice;break;}
   if(!next.more)break;
   await new Promise(resolve=>setTimeout(resolve,next.busy?1800:650));
  }
 }catch(error){if(runOwner===owner){notice=error.message;context.toast(error.message,true);}}
 finally{if(runOwner===owner){updating=false;repaint();}}
}
let dailyOwner='';
export function checkAcademicDaily(user){
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const key=user+':'+date;
 if(!state.enabled||dailyOwner===key)return;
 dailyOwner=key;
 updateManuscripts(true);
}
document.addEventListener('click',event=>{if(event.target.matches?.('[data-ms-select]'))event.stopPropagation();},true);
document.addEventListener('toggle',event=>{if(event.target.matches?.('.submission-filter')&&event.target.open)for(const filter of document.querySelectorAll('.submission-filter[open]'))if(filter!==event.target)filter.open=false;},true);
document.addEventListener('click',event=>{if(!event.target.closest?.('.submission-filters'))for(const filter of document.querySelectorAll('.submission-filter[open]'))filter.open=false;});
document.addEventListener('change',event=>{
 if(event.target.matches?.('[data-ms-filter]')){
  const opened=[...document.querySelectorAll('.submission-filter[open]')].map(node=>node.dataset.submissionFilter);
  const filter=event.target.dataset.msFilter==='status'?statusFilters:journalFilters;
  event.target.checked?filter.add(event.target.value):filter.delete(event.target.value);repaint();
  for(const name of opened)document.querySelector('[data-submission-filter="'+name+'"]').open=true;
 }
 if(event.target.id==='statistics-journal-choice'){
  const row=event.target.value==='new'?undefined:state.statistics[Number(event.target.value)];
  document.querySelector('#statistics-edit-rows').innerHTML=statsEditorRow(row);
  document.querySelector('#submission-stats-form .form-error').textContent='';
 }
 if(event.target.matches?.('[data-ms-select]')){event.target.checked?checkedManuscripts.add(event.target.dataset.msSelect):checkedManuscripts.delete(event.target.dataset.msSelect);repaint();}
 if(event.target.matches?.('[data-ms-select-all]')){for(const item of document.querySelectorAll('[data-ms-select]')){event.target.checked?checkedManuscripts.add(item.dataset.msSelect):checkedManuscripts.delete(item.dataset.msSelect);}repaint();}
});
document.addEventListener('change',async event=>{
 if(event.target.id!=='academic-enabled')return;
 const enabled=event.target.checked;event.target.disabled=true;
 try{
  state={...state,...await request('toggle',{enabled})};loaded=true;
  if(enabled)dailyOwner='';
  context.refreshShell();if(enabled)checkAcademicDaily(owner);
 }catch(error){event.target.checked=!enabled;context.toast(error.message,true);event.target.disabled=false;}
});
document.addEventListener('input',event=>{
 if(event.target.id!=='submission-search')return;
 query=event.target.value;
 const pos=event.target.selectionStart;repaint();
 const field=document.querySelector('#submission-search');field?.focus();field?.setSelectionRange(pos,pos);
});
document.addEventListener('keydown',event=>{
 if(event.target.matches?.('.submission-card')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.target.click();}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-ms]');if(!button||event.target.closest('a')||button.disabled)return;
 const op=button.dataset.ms,item=state.manuscripts.find(item=>item.id===button.dataset.id);
 try{
  if(op==='detail'){if(selectionMode){checkedManuscripts.has(item.id)?checkedManuscripts.delete(item.id):checkedManuscripts.add(item.id);}else context.routeChange({id:item.id});repaint();}
  else if(op==='back'){context.back();}
  else if(op==='add')edit();
  else if(op==='filters-clear'){statusFilters.clear();journalFilters.clear();repaint();}
  else if(op.startsWith('select-')){selectionMode=op.slice(7);checkedManuscripts.clear();repaint();}
  else if(op==='selection-cancel'){selectionMode='';checkedManuscripts.clear();repaint();}
  else if(op==='bulk-apply'){
   button.disabled=true;const selectedIds=[...checkedManuscripts];
   state=await request('bulk_'+selectionMode,{ids:selectedIds,scope});const restored=selectionMode==='restore';selectionMode='';checkedManuscripts.clear();repaint();if(restored)updateManuscripts();
  }
  else if(op==='edit')edit(item);
  else if(op==='layout'){layout=button.dataset.layout;localStorage.setItem('mail-manuscript-layout',layout);repaint();}
  else if(op==='refresh')await updateManuscripts();
  else if(op.startsWith('scope-')){query='';selectionMode='';checkedManuscripts.clear();context.routeChange({scope:op.slice(6),id:''});}
  else if(op==='source')await context.openSource(button.dataset.source);
  else if(op==='stats-edit')editStats(button.dataset.journal);
  else if(op==='stats-add')editStats();
  else if(op==='stats-reset')await confirmAction('重置统计为库内稿件计数',async()=>{await updateManuscripts();if(notice)throw Error(notice);state=await request('statistics',{reset:true});});
  else if(op==='purge')await confirmAction('永久删除此稿件',async()=>{state=await request('purge',{id:item.id});selected='';context.routeChange({id:''});if(item.status==='rejected')celebrate(true);else if(acceptedBefore(item))celebrate();});
  else if(['archive','trash','restore'].includes(op)){
   button.disabled=true;state=await request(op,{id:item.id});selected='';context.routeChange({id:''});
   if(['archive','trash'].includes(op)){if(item.status==='rejected')celebrate(true);else if(acceptedBefore(item))celebrate();}
   if(op==='restore')updateManuscripts();
  }
 }catch(error){button.disabled=false;context.toast(error.message,true);}
});
document.addEventListener('submit',async event=>{
 const form=event.target;if(!['submission-form','submission-stats-form'].includes(form.id))return;
 event.preventDefault();event.stopImmediatePropagation();
 const button=form.querySelector('[type=submit]');button.disabled=true;
 try{
  const values=form.id==='submission-stats-form'?{rows:[...form.querySelectorAll('.stats-editor-row')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-stat]')].map(input=>[input.dataset.stat,input.value])))}:Object.fromEntries(new FormData(form));
  state=await request(form.id==='submission-form'?'save':'statistics',{...values,...(form.dataset.id?{id:form.dataset.id}:{})});
  context.closeModal();selected='';context.routeChange({id:''});
 }catch(error){form.querySelector('.form-error').textContent=error.message;button.disabled=false;}
},true);
try{layout=localStorage.getItem('mail-manuscript-layout')||'grid';}catch{}
