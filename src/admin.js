import {api, db} from './cloud.js';
import {getLanguage} from './i18n.js';
import {escapeHTML as e} from './core.js';
export async function renderAdmin({state, shell, modal, busy, toast, go, render}) {
  if (!state.isAdmin) {shell('用户管理', '<div class="content"><h1>无权访问</h1><p>只有管理员能够访问用户管理。</p></div>'); return;}
  shell('用户管理', `<div class="content"><div class="eyebrow">ADMINISTRATION</div><h1 class="page-title">用户管理.</h1><p class="subtitle">管理用户及其云端论文，删除操作需要重新验证管理员密码。</p><section class="settings-card"><h3>${state.adminMustChange ? '首次登录：修改初始密码' : '修改管理员密码'}</h3>${state.adminMustChange ? '<p>修改初始密码后，才会开启用户和论文管理。</p>' : ''}<form id="admin-password"><label>当前密码<input name="current" type="password" autocomplete="current-password" required></label><label>新密码（至少10位）<input name="next" type="password" autocomplete="new-password" minlength="10" required></label><label>再次输入新密码<input name="confirm" type="password" autocomplete="new-password" minlength="10" required></label><button type="submit" class="primary">修改密码并重新登录</button></form></section>${state.adminMustChange ? '' : '<section class="settings-card"><h3>新用户默认额度</h3><div id="signup-defaults">正在加载…</div></section><section class="settings-card"><h3>全部用户</h3><div id="admin-user-list">正在加载…</div></section><section class="settings-card"><h3 id="admin-paper-heading">用户的论文</h3><div id="admin-paper-list">请选择一位用户查看论文，包括其回收站记录。</div></section>'}</div>`);
  document.querySelector('#admin-password').onsubmit = event => {
    event.preventDefault(); const form = event.currentTarget;
    busy(form.querySelector('button'), async () => {
      const fields = new FormData(form); if (fields.get('next') !== fields.get('confirm')) throw new Error('两次新密码不一致');
      await api('admin_set_password', {password: fields.get('current'), new_password: fields.get('next')}); form.reset();
      await db.auth.signOut(); state.user = null; state.isAdmin = false; state.papers = []; go('login'); toast('密码已更新，请使用新密码登录');
    });
  };
  if (state.adminMustChange) return;
  const l=(zh,en)=>getLanguage()==='en'?en:zh;
  const gb=n=>(Number(n)/1073741824).toFixed(2);
  let selectedUser = null, usersPage = 0, papersPage = 0;
  async function confirmDelete({title, detail, action, payload, onDone}) {
    const d = modal(title, `<p>${e(detail)}</p><form id="admin-delete-form"><label>当前管理员密码<input name="password" type="password" autocomplete="current-password" required></label><label class="remember"><input type="checkbox" required>我确认永久删除，无法恢复</label><div class="actions"><button type="button" id="cancel-admin-delete">取消</button><button type="submit" class="danger">确认永久删除</button></div></form>`);
    d.el.querySelector('#cancel-admin-delete').onclick = d.close;
    d.el.querySelector('#admin-delete-form').onsubmit = event => {
      event.preventDefault(); const form = event.currentTarget;
      busy(form.querySelector('[type=submit]'), async () => {try {await api(action, {...payload, password: new FormData(form).get('password')}); d.close(); toast('已删除'); await onDone();} finally {form.reset();}});
    };
  }
  async function loadUsers(page = 0) {
    usersPage = page; const target = document.querySelector('#admin-user-list'); if (!target) return;
    try {
      const result = await api('admin_users', {page});
      target.innerHTML = `<div class="admin-table">${result.users.map(user => `<div class="api-key-row"><span><strong>${e(user.display_name || user.username)}</strong><br><small>${e(user.username)} · ${e(user.email)}</small><br><small>${l('当前用量','Current usage')}: ${gb(user.used_bytes||0)} / ${gb(user.quota_bytes??268435456)} GB</small><br><small>${l('AI 提问','AI questions')}: ${l('剩余','Remaining')} ${user.ai_questions_remaining??10} · ${l('已用','Used')} ${user.ai_questions_used??0}</small></span><button data-user-quota="${e(user.id)}">${l('调整配额','Adjust quota')}</button><button data-user-ai="${e(user.id)}">${l('调整提问次数','Adjust questions')}</button><button data-user-papers="${e(user.id)}">查看论文</button>${user.id !== state.user.id ? `<button class="danger" data-delete-user="${e(user.id)}">删除用户</button>` : '<small>当前管理员</small>'}</div>`).join('') || '<p>没有用户。</p>'}</div><div class="actions"><button id="users-prev" ${!page ? 'disabled' : ''}>上一页</button><span>第 ${page + 1} 页</span><button id="users-next" ${!result.has_more ? 'disabled' : ''}>下一页</button></div>`;
      target.querySelector('#users-prev').onclick = () => loadUsers(page - 1); target.querySelector('#users-next').onclick = () => loadUsers(page + 1);
      target.querySelectorAll('[data-user-papers]').forEach(button => button.onclick = () => {selectedUser = result.users.find(user => user.id === button.dataset.userPapers); loadPapers(0);});
      target.querySelectorAll('[data-user-quota]').forEach(button=>button.onclick=()=>{
        const user=result.users.find(u=>u.id===button.dataset.userQuota);
        const d=modal(l('空间配额','Storage quota'),`<p data-user-content>${e(user.username)} · ${l('当前用量','Current usage')} ${gb(user.used_bytes||0)} GB</p><form id="quota-form"><label>${l('配额（GB）','Quota (GB)')}<input name="quota" type="number" min="0" max="10240" step="0.01" value="${Number(((user.quota_bytes??1073741824)/1073741824).toFixed(4))}" required></label><p>${l('0 表示暂停新增上传。降低配额不会删除已有文件。','0 pauses new uploads. Reducing a quota preserves existing files.')}</p><button class="primary" type="submit">${l('保存配额','Save quota')}</button></form>`);
        d.el.querySelector('#quota-form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;busy(form.querySelector('button'),async()=>{const value=Number(form.querySelector('[name=quota]').value);if(!Number.isFinite(value)||value<0||value>10240)throw Error(l('请输入有效配额','Enter a valid quota'));await api('admin_set_quota',{user_id:user.id,quota_bytes:Math.round(value*1073741824)});d.close();toast(l('配额已更新','Quota updated'));await loadUsers(usersPage);});};
      });
      target.querySelectorAll('[data-user-ai]').forEach(button=>button.onclick=()=>{
        const user=result.users.find(u=>u.id===button.dataset.userAi);
        const d=modal(l('AI 提问额度','AI question allowance'),`<p data-user-content>${e(user.username)} · ${l('已用','Used')} ${user.ai_questions_used??0}</p><form id="ai-quota-form"><label>${l('剩余提问次数','Remaining questions')}<input name="remaining" type="number" min="0" max="1000000" step="1" value="${user.ai_questions_remaining??10}" required></label><p>${l('累计额度，成功回答计1次，失败退回；0表示暂停新的提问。','Cumulative allowance: one successful answer uses one question; failures are refunded. 0 pauses new questions.')}</p><button class="primary" type="submit">${l('保存额度','Save allowance')}</button></form>`);
        d.el.querySelector('form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;busy(form.querySelector('button'),async()=>{const remaining=Number(form.querySelector('input').value);if(!Number.isSafeInteger(remaining)||remaining<0||remaining>1000000)throw Error(l('请输入有效整数','Enter a valid whole number'));await api('admin_set_ai_quota',{user_id:user.id,remaining});d.close();toast(l('提问额度已更新','Question allowance updated'));await loadUsers(usersPage);});};
      });
      target.querySelectorAll('[data-delete-user]').forEach(button => button.onclick = () => {
        const user = result.users.find(user => user.id === button.dataset.deleteUser);
        confirmDelete({title: '永久删除用户', detail: `删除 ${user.username} 的账户、头像、全部论文与 API 令牌，无法恢复。`, action: 'admin_delete_user', payload: {user_id: user.id, confirmation: 'DELETE_USER'}, onDone: async () => {selectedUser = null; document.querySelector('#admin-paper-list').textContent = '请选择用户'; await loadUsers(usersPage);}});
      });
    } catch (error) {target.textContent = error.message;}
  }
  async function loadPapers(page = 0) {
    if (!selectedUser) return; papersPage = page;
    const target = document.querySelector('#admin-paper-list'); if (!target) return;
    document.querySelector('#admin-paper-heading').textContent = `${selectedUser.username} 的论文`;
    try {
      const result = await api('admin_papers', {user_id: selectedUser.id, page});
      target.innerHTML = `${result.papers.map(p => `<div class="api-key-row"><span>${e(p.title)}<br><small>${p.deleted_at ? '回收站' : p.status === 'ready' ? '已解析' : '待处理'}</small></span><button class="danger" data-admin-delete-paper="${e(p.id)}">永久删除论文</button></div>`).join('') || '<p>该用户没有论文。</p>'}<div class="actions"><button id="papers-prev" ${!page ? 'disabled' : ''}>上一页</button><span>第 ${page + 1} 页</span><button id="papers-next" ${!result.has_more ? 'disabled' : ''}>下一页</button></div>`;
      target.querySelector('#papers-prev').onclick = () => loadPapers(page - 1); target.querySelector('#papers-next').onclick = () => loadPapers(page + 1);
      target.querySelectorAll('[data-admin-delete-paper]').forEach(button => button.onclick = () => {
        const p = result.papers.find(p => p.id === button.dataset.adminDeletePaper);
        confirmDelete({title: '永久删除论文', detail: `永久删除“${p.title}”的 PDF、元数据和解析结果，无法恢复。`, action: 'admin_delete_paper', payload: {paper_id: p.id, confirmation: 'DELETE_PAPER'}, onDone: () => loadPapers(papersPage)});
      });
    } catch (error) {target.textContent = error.message;}
  }
  await loadUsers();
  const defaultsRoot=document.querySelector('#signup-defaults');if(!defaultsRoot)return;
  try{const defaults=await api('admin_get_defaults');if(!defaultsRoot.isConnected)return;defaultsRoot.innerHTML=`<form id="signup-defaults-form"><div class="field-grid"><label>${l('存储空间（MB）','Storage (MB)')}<input name="storage" type="number" min="0" max="10485760" step="1" value="${defaults.storage_quota_bytes/1048576}" required></label><label>${l('AI 提问次数','AI questions')}<input name="questions" type="number" min="0" max="1000000" step="1" value="${defaults.ai_question_limit}" required></label></div><p>${l('只影响之后注册的新用户，已有账户额度保持原值。','Applies only to future signups; existing allowances are preserved.')}</p><button class="primary" type="submit">${l('保存默认额度','Save signup defaults')}</button></form>`;defaultsRoot.querySelector('form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;busy(form.querySelector('button'),async()=>{const quota=Number(form.querySelector('[name=storage]').value)*1048576,questions=Number(form.querySelector('[name=questions]').value);await api('admin_set_defaults',{quota_bytes:quota,questions});toast(l('默认额度已更新','Signup defaults updated'));});};}catch(error){if(defaultsRoot.isConnected)defaultsRoot.textContent=error.message;}
}
