import {richEditorHTML,installRichEditor,editorBody} from './rich-editor.js';
import {esc} from './core.js';
import './mail-admin.css';

export function mountMailAdmin({root,api,logout,toast}){
 if(root.querySelector('.mail-admin'))return;
 root.innerHTML=`<main class="mail-admin"><header class="admin-heading"><div><span class="eyebrow">MAIL ATLAS · ADMINISTRATION</span><h1>用户管理</h1></div><div><button class="secondary" id="admin-refresh">刷新用户</button><button class="secondary" id="admin-logout">退出登录</button></div></header><section class="admin-panel"><details id="admin-sender-details"><summary>官方发信邮箱 <span id="admin-sender-status">正在读取…</span></summary><form id="admin-sender-form"><div class="admin-fields"><label>发信邮箱<input name="email" type="email" autocomplete="off" required></label><label>SMTP 服务器<input name="smtp_host" placeholder="smtp.qq.com" required></label><label>登录用户名<input name="username" placeholder="默认与邮箱地址相同"></label><label>授权码 / 应用密码<input name="password" type="password" autocomplete="new-password" placeholder="已配置时留空保留"></label></div><p class="muted">使用 SSL 加密端口 465。请使用邮箱服务商提供的 SMTP 授权码。</p><button class="primary" type="submit">验证并保存</button></form></details></section><section class="admin-panel"><div class="admin-list-heading"><h2>注册用户 <span id="admin-user-count"></span></h2><input id="admin-search" aria-label="搜索注册用户" placeholder="搜索用户名、姓名或邮箱"></div><div id="admin-user-results" aria-live="polite">正在加载用户…</div><button class="secondary" id="admin-more" hidden>加载更多用户</button></section><section class="admin-panel admin-mail-compose"><h2>发送邮件</h2><p id="admin-recipient-count">请选择收件用户</p><form id="admin-mail-form"><label>主题<input name="subject" required maxlength="1000"></label>${richEditorHTML('')}<div class="admin-send-actions"><button type="button" class="secondary" id="admin-clear-selection">清除选择</button><button type="submit" class="primary">预览并发送</button></div></form><div id="admin-send-results" role="status"></div></section><div id="admin-review"></div></main>`;
 const $=q=>root.querySelector(q),selected=new Set();let users=[],offset=0,sender=null,loading=false,sendKey=crypto.randomUUID(),draft={body:'',body_html:''};
 installRichEditor($('#admin-mail-form'),value=>Object.assign(draft,value));
 const count=()=>{$('#admin-recipient-count').textContent=selected.size?'已选择 '+selected.size+' 位用户 · 每人单独收到邮件':'请选择收件用户';};
 function rows(){const query=$('#admin-search').value.trim().toLowerCase(),visible=users.filter(u=>[u.username,u.email,u.primary_email,u.display_name].some(v=>String(v||'').toLowerCase().includes(query)));
  $('#admin-user-count').textContent='· '+users.length;
  $('#admin-user-results').innerHTML=`<div class="admin-table-scroll"><table class="admin-users-table"><thead><tr><th><input type="checkbox" id="admin-select-visible" aria-label="选择当前搜索结果" ${visible.length&&visible.every(u=>selected.has(u.id))?'checked':''}></th><th>用户名 / 姓名</th><th>注册邮箱</th><th>接收通知的第一邮箱</th><th>注册时间</th><th>管理</th></tr></thead><tbody>${visible.map(u=>`<tr><td><input type="checkbox" data-admin-select="${u.id}" aria-label="选择 ${esc(u.username)}" ${selected.has(u.id)?'checked':''}></td><td><strong>${esc(u.username)}</strong>${u.is_admin?'<span class="admin-role">Admin</span>':''}<small>${esc(u.display_name||'')}</small></td><td>${esc(u.email)}</td><td>${esc(u.primary_email)}</td><td>${new Date(u.created_at).toLocaleDateString()}</td><td>${u.is_admin?'—':`<button class="text-btn" data-admin-reset="${u.id}">重置密码</button>`}<button class="text-btn" data-admin-write="${u.id}">写邮件</button></td></tr>`).join('')}</tbody></table>${!visible.length?'<p class="muted">没有匹配用户</p>':''}</div>`;
  $('#admin-select-visible').onchange=e=>{for(const u of visible){if(e.target.checked)selected.add(u.id);else selected.delete(u.id);}rows();count();};
  root.querySelectorAll('[data-admin-select]').forEach(el=>el.onchange=()=>{if(el.checked)selected.add(el.dataset.adminSelect);else selected.delete(el.dataset.adminSelect);count();});
  root.querySelectorAll('[data-admin-write]').forEach(el=>el.onclick=()=>{selected.add(el.dataset.adminWrite);rows();count();$('.admin-mail-compose').scrollIntoView({behavior:'smooth',block:'start'});$('#admin-mail-form [name=subject]').focus({preventScroll:true});});
  root.querySelectorAll('[data-admin-reset]').forEach(el=>el.onclick=()=>resetReview(users.find(u=>u.id===el.dataset.adminReset)));
 }
 async function busy(button,work){if(button.disabled)return;button.disabled=true;try{await work();}catch(e){toast(e.message,true);}finally{if(button.isConnected)button.disabled=false;}}
 async function load(more=false){if(loading)return;loading=true;try{const result=await api('admin_mail_users',{offset:more?offset:0});users=more?[...users,...result.users]:result.users;offset=users.length;sender=result.sender;
   if(!more)for(const id of selected)if(!users.some(u=>u.id===id))selected.delete(id);
   $('#admin-more').hidden=!result.has_more;$('#admin-sender-status').textContent=sender?sender.email+' · 已配置':'尚未配置';
   if(sender)for(const name of ['email','smtp_host','username'])$('#admin-sender-form [name='+name+']').value=sender[name]||'';
   else $('#admin-sender-details').open=true;rows();count();
  }catch(e){toast(e.message,true);$('#admin-user-results').textContent=e.message;}finally{loading=false;}}
 function review(title,html,action){const container=$('#admin-review');container.innerHTML=`<div class="modal-shade"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="icon-btn admin-review-close" aria-label="关闭">×</button></header>${html}<p class="admin-review-error" role="alert"></p><div class="modal-footer"><button class="secondary admin-review-close">取消</button><button class="primary" id="admin-review-confirm">确认</button></div></section></div>`;
  let pending=false;container.querySelectorAll('.admin-review-close').forEach(b=>b.onclick=()=>{if(!pending)container.innerHTML='';});$('#admin-review-confirm').onclick=async e=>{if(pending)return;pending=true;e.currentTarget.disabled=true;try{await action();container.innerHTML='';}catch(error){container.querySelector('.admin-review-error').textContent=error.message;container.querySelector('#admin-review-confirm').disabled=false;}finally{pending=false;}};
 }
 function resetReview(u){const key=crypto.randomUUID();review('重置用户密码',`<p>将 ${esc(u.username)} 的密码重置为 <strong>12345678</strong>。</p><p>完成后发送修改密码提醒到：<strong>${esc(u.primary_email)}</strong>。</p>`,async()=>{if(!sender)throw Error('请先配置官方发信邮箱');const r=await api('admin_mail_reset',{user_id:u.id,key});if(!r.password_reset)throw Error(r.error||'密码重置失败');toast(r.notification_sent?'密码已重置，通知已发送至 '+r.recipient:r.error,!r.notification_sent);});}
 $('#admin-search').oninput=rows;$('#admin-refresh').onclick=e=>busy(e.currentTarget,()=>load());$('#admin-more').onclick=e=>busy(e.currentTarget,()=>load(true));$('#admin-logout').onclick=logout;
 $('#admin-clear-selection').onclick=()=>{selected.clear();rows();count();};
 $('#admin-sender-form').onsubmit=e=>{e.preventDefault();e.stopPropagation();const form=e.currentTarget;busy(form.querySelector('button'),async()=>{await api('admin_mail_sender',Object.fromEntries(new FormData(form)));form.password.value='';await load();toast('官方发信邮箱验证成功');});};
 $('#admin-mail-form').onsubmit=e=>{e.preventDefault();e.stopPropagation();const form=e.currentTarget;try{
  if(!selected.size)throw Error('请选择收件用户');if(selected.size>50)throw Error('每批最多50位用户');if(!sender)throw Error('请先配置官方发信邮箱');
  const {body,body_html}=editorBody(form.querySelector('#compose-body')),subject=form.subject.value.trim();if(!subject||!body.trim())throw Error('请填写邮件主题和正文');
  const ids=[...selected],people=users.filter(u=>selected.has(u.id));review('确认发送通知',`<p>${people.map(u=>esc(u.username)+' &lt;'+esc(u.primary_email)+'&gt;').join('<br>')}</p><p><strong>${esc(subject)}</strong></p><div class="send-preview">${body_html||esc(body)}</div>`,async()=>{
   const r=await api('admin_mail_send',{key:sendKey,user_ids:ids,subject,body,body_html});
   $('#admin-send-results').innerHTML=r.results.map(item=>`<p class="${item.sent?'':'error-text'}">${esc(item.email||users.find(u=>u.id===item.user_id)?.primary_email)}：${item.sent?'已提交投递':esc(item.error)}</p>`).join('');
   const sent=r.results.filter(x=>x.sent).length;toast('已提交 '+sent+' 封，未确认 '+(r.results.length-sent)+' 封',sent!==r.results.length);
  });
 }catch(error){toast(error.message,true);}};
 $('#admin-mail-form').addEventListener('input',()=>{sendKey=crypto.randomUUID();});
 load();
}
