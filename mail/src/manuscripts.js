import {publisherLogos} from './publisher-logos.js';
import {esc,fmtDate,fuzzy} from './core.js';
import {STATUSES} from '../../supabase/functions/manuscripts-api/core.js';
import './manuscripts.css';

let context,owner='',loaded=false,loading;
let state={enabled:false,manuscripts:[],statistics:[]},scope='active',selected='',query='',layout='grid',updating=false,notice='';
const labels={active:'投稿信息',archived:'已归档稿件',trash:'稿件垃圾箱'};
const providerLogos={
 Elsevier:[publisherLogos.Elsevier,'E'],
 APS:[publisherLogos.APS,'APS'],
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
export async function loadAcademic(user){
 if(owner!==user){owner=user;loaded=false;loading=null;updating=false;notice='';dailyOwner='';state={enabled:false,manuscripts:[],statistics:[]};}
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
const status=item=>'<span class="submission-status" data-status="'+esc(item.status)+'">'+esc(STATUSES[item.status]||STATUSES.unknown)+'</span>';
const action=(name,label,glyph,extra='')=>'<button class="secondary" data-ms="'+name+'" aria-label="'+label+'" title="'+label+'" '+extra+'>'+icon(glyph)+'<span class="ms-button-label">'+label+'</span></button>';
function listItem(item){
 return '<article class="submission-card" data-ms="detail" data-id="'+item.id+'" role="button" tabindex="0">'+badge(item)+
 '<div class="submission-identity"><span class="submission-journal">'+esc(item.journal||'未注明期刊')+'</span><h2>'+esc(item.title||'标题待补充')+'</h2><p>'+esc(item.authors||'作者待补充')+'</p><code>'+esc(item.number)+'</code></div>'+
 '<div class="submission-state">'+status(item)+(item.tracking_url?'<a href="'+esc(item.tracking_url)+'" target="_blank" rel="noopener noreferrer" class="text-btn">状态链接 '+icon('arrow-up-right',14)+'</a>':'')+'</div></article>';
}
function statsHTML(){
 return '<section class="submission-statistics"><div class="block-heading"><h2>投稿统计</h2><div>'+action('stats-add','编辑统计','pencil')+action('stats-reset','重置统计','undo-2')+'</div></div><div class="submission-stats-scroll"><table><thead><tr><th>期刊</th><th>累计投稿</th><th>进行中</th><th>已完成</th><th>Accept</th><th>Reject</th><th></th></tr></thead><tbody>'+
 state.statistics.map(row=>'<tr><th>'+esc(row.journal)+'</th>'+['total','active','completed','accepted','rejected'].map(key=>'<td>'+row[key]+'</td>').join('')+'<td><button class="icon-btn" data-ms="stats-edit" data-journal="'+esc(row.journal)+'" aria-label="编辑 '+esc(row.journal)+' 的统计">'+icon('pencil',16)+'</button></td></tr>').join('')+
 '</tbody></table>'+(state.statistics.length?'':'<p class="muted">识别或添加稿件后显示统计</p>')+'</div></section>';
}
function detailHTML(item){
 return '<div class="submission-detail"><div class="submission-detail-heading">'+badge(item)+'<div><p>'+esc(item.publisher)+' · '+esc(item.journal)+'</p><h1>'+esc(item.title||'标题待补充')+'</h1><p>'+esc(item.authors||'作者待补充')+'</p><code>'+esc(item.number)+'</code></div></div><div class="submission-detail-actions">'+status(item)+
 (item.tracking_url?'<a class="secondary" href="'+esc(item.tracking_url)+'" target="_blank" rel="noopener noreferrer">状态链接 '+icon('arrow-up-right',16)+'</a>':'')+
 (!item.deleted_at&&!item.archived_at?action('edit','编辑稿件','pencil','data-id="'+item.id+'"')+action('archive','归档','archive','data-id="'+item.id+'"')+action('trash','删除','trash-2','data-id="'+item.id+'"'):action('restore','恢复追踪','undo-2','data-id="'+item.id+'"')+(item.deleted_at?action('purge','永久删除','trash-2','data-id="'+item.id+'"'):''))+'</div>'+
 (item.last_checked_at?'<p class="muted">上次状态查询 '+fmtDate(item.last_checked_at,true)+'</p>':'')+(item.lookup_notice?'<p class="submission-notice">'+esc(item.lookup_notice)+'</p>':'')+
 '<h2>状态历史</h2><ol class="submission-timeline">'+[...(item.events||[])].reverse().map(event=>'<li><time>'+fmtDate(event.date,true)+'</time><div>'+status(event)+'<p>'+esc(event.raw_status||'')+'</p><small>'+esc(({email:'来源邮件',website:'出版社 History',manual:'手动更新'})[event.source]||'')+'</small>'+
 (event.number?'<code>'+esc(event.number)+'</code>':'')+
 (event.source==='email'?'<button class="text-btn" data-ms="source" data-source="'+esc(event.message_ref||event.source_id)+'">查看来源邮件 '+icon('arrow-up-right',14)+'</button>':event.source_url?'<a class="text-btn" href="'+esc(event.source_url)+'" target="_blank" rel="noopener noreferrer">查看来源 '+icon('arrow-up-right',14)+'</a>':'')+'</div></li>').join('')+'</ol></div>';
}
export function manuscriptsHTML(){
 if(!state.enabled)return '<section class="page"><h1>请先在设置中开启学术版</h1></section>';
 const item=state.manuscripts.find(item=>item.id===selected);
 const items=state.manuscripts.filter(item=>scope==='trash'?item.deleted_at:scope==='archived'?item.archived_at&&!item.deleted_at:!item.archived_at&&!item.deleted_at)
  .filter(item=>!query||fuzzy([item.publisher,item.journal,item.title,item.authors,item.number,STATUSES[item.status]].join(' '),query))
  .sort((a,b)=>Date.parse(b.updated_at||b.created_at)-Date.parse(a.updated_at||a.created_at));
 return '<section class="page manuscripts-page"><header class="page-head"><div><h1>'+labels[scope]+'</h1>'+(state.last_updated_at?'<p>上次更新 '+fmtDate(state.last_updated_at,true)+'</p>':'')+'</div><div class="head-actions">'+(selected?action('back','返回稿件','arrow-left'):'')+
 action('refresh',updating?'更新中':'更新状态','refresh-cw',updating?'disabled aria-busy="true"':'')+
 action('add','手动添加','plus')+'</div></header>'+(updating?'<p role="status" class="submission-notice">正在检索邮件和查询稿件状态…</p>':'')+(notice?'<p role="status" class="submission-notice">'+esc(notice)+'</p>':'')+
 (item?detailHTML(item):'<div class="submission-toolbar"><input type="search" id="submission-search" placeholder="搜索期刊、标题、作者或稿件号" aria-label="搜索稿件" value="'+esc(query)+'"><div class="contact-layout-switch" role="group" aria-label="稿件视图"><button data-ms="layout" data-layout="list" aria-label="列表视图" title="列表视图" aria-pressed="'+(layout==='list')+'">'+icon('list',16)+'</button><button data-ms="layout" data-layout="grid" aria-label="卡片视图" title="卡片视图" aria-pressed="'+(layout==='grid')+'">'+icon('layout-grid',16)+'</button></div></div><div class="submission-items '+(layout==='list'?'submission-list':'')+'">'+
 (items.map(listItem).join('')||'<div class="empty-state"><h2>暂无稿件</h2><p>点击更新状态从已同步邮件识别，或手动添加稿件</p></div>')+'</div>'+statsHTML())+
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
 '<label>出版社<select name="publisher">'+['Elsevier','APS','Springer Nature','Wiley','Taylor & Francis','Sage','其他'].map(name=>'<option '+(name===item.publisher?'selected':'')+'>'+name+'</option>').join('')+'</select></label>'+
 input('journal','投稿期刊',item.journal,true)+input('number','稿件号',item.number,true)+
 '<label>稿件状态<select name="status">'+Object.entries(STATUSES).map(([value,label])=>'<option value="'+value+'" '+(value===(item.status||'submitted')?'selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+
 input('title','标题',item.title,true)+input('authors','作者',item.authors)+input('lookup_author','APS 查询作者姓氏（前三位之一）',item.lookup_author)+
 input('tracking_url','状态链接',item.tracking_url)+
 '<p class="form-error" role="alert"></p><div class="modal-footer"><button type="submit" class="primary">'+icon('save',16)+' 保存稿件</button></div></form>',true);
}
function editStats(journal=''){
 const row=state.statistics.find(row=>row.journal===journal)||{};
 context.modal('编辑投稿统计','<form id="submission-stats-form">'+input('journal','期刊',journal,true)+'<div class="form-grid">'+
 [['total','累计投稿'],['active','进行中'],['completed','已完成'],['accepted','Accept'],['rejected','Reject']].map(([name,label])=>'<label>'+label+'<input name="'+name+'" type="number" min="0" max="1000000" value="'+(row[name]||0)+'" required></label>').join('')+
 '</div><p class="form-error" role="alert"></p><div class="modal-footer"><button class="primary" type="submit">'+icon('save',16)+' 保存统计</button></div></form>');
}
async function confirmAction(label,run){
 context.modal(label,'<p>确认'+label+'？</p><div class="modal-footer"><button class="secondary" data-action="close-modal">取消</button><button class="primary" id="submission-confirm">确认</button></div>');
 document.querySelector('#submission-confirm').onclick=async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{await run();context.closeModal();repaint();}catch(error){context.toast(error.message,true);button.disabled=false;}
 };
}
function celebrate(){
 const root=document.createElement('div');root.className='submission-celebration';root.setAttribute('role','dialog');root.setAttribute('aria-label','恭喜稿件接收');root.setAttribute('aria-modal','true');
 root.innerHTML='<div class="submission-fireworks" aria-hidden="true">'+Array.from({length:3},(_,burst)=>'<div class="firework-burst" style="--burst:'+burst+'">'+Array.from({length:16},(_,i)=>'<i style="--angle:'+(i*22.5)+'deg"></i>').join('')+'</div>').join('')+'</div><div class="celebration-message"><span>'+icon('check',28)+'</span><h2>恭喜！</h2><p>Congratulations!</p><button class="secondary">关闭</button></div>';
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
  if(op==='detail'){selected=item.id;repaint();}
  else if(op==='back'){selected='';repaint();}
  else if(op==='add')edit();
  else if(op==='edit')edit(item);
  else if(op==='layout'){layout=button.dataset.layout;localStorage.setItem('mail-manuscript-layout',layout);repaint();}
  else if(op==='refresh')await updateManuscripts();
  else if(op.startsWith('scope-')){scope=op.slice(6);selected='';query='';repaint();}
  else if(op==='source')await context.openSource(button.dataset.source);
  else if(op==='stats-edit')editStats(button.dataset.journal);
  else if(op==='stats-add')editStats();
  else if(op==='stats-reset')await confirmAction('重置统计为库内稿件计数',async()=>{await updateManuscripts();if(notice)throw Error(notice);state=await request('statistics',{reset:true});});
  else if(op==='purge')await confirmAction('永久删除此稿件',async()=>{state=await request('purge',{id:item.id});selected='';});
  else if(['archive','trash','restore'].includes(op)){
   button.disabled=true;state=await request(op,{id:item.id});selected='';repaint();
   if(op==='archive'&&['accepted','published'].includes(item.status))celebrate();
   if(op==='restore')updateManuscripts();
  }
 }catch(error){button.disabled=false;context.toast(error.message,true);}
});
document.addEventListener('submit',async event=>{
 const form=event.target;if(!['submission-form','submission-stats-form'].includes(form.id))return;
 event.preventDefault();event.stopImmediatePropagation();
 const button=form.querySelector('[type=submit]');button.disabled=true;
 try{
  const values=Object.fromEntries(new FormData(form));
  state=await request(form.id==='submission-form'?'save':'statistics',{...values,...(form.dataset.id?{id:form.dataset.id}:{})});
  context.closeModal();selected='';repaint();
 }catch(error){form.querySelector('.form-error').textContent=error.message;button.disabled=false;}
},true);
try{layout=localStorage.getItem('mail-manuscript-layout')||'grid';}catch{}
