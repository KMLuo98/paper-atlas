import {db, api} from './cloud.js';
import {escapeHTML as e} from './core.js';

export function renderProfile({state, shell, icon, busy, modal, toast, refresh, render, go}) {
  shell('个人设置', `<div class="content"><div class="eyebrow">YOUR PERSONAL SPACE</div><h1 class="page-title">个人设置.</h1><p class="subtitle">管理你的头像、个人资料与账户。</p><section class="settings-card"><h3>头像与资料</h3><div class="profile-preview"><div class="avatar large-avatar">${state.avatarURL ? `<img src="${e(state.avatarURL)}" alt="当前头像">` : e((state.profile?.display_name || state.profile?.username || 'DE').slice(0, 2))}</div><div><button id="choose-avatar">${icon('cloud-upload')} 上传头像</button><button id="remove-avatar" class="text-button">移除头像</button><p>JPG、PNG 或 WebP，最大 5 MB。</p></div></div><input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><form id="profile-form"><label>显示名称<input name="display_name" maxlength="60" value="${e(state.profile?.display_name || '')}" placeholder="你的名字或昵称"></label><label>用户名<input value="${e(state.profile?.username || 'demo')}" readonly></label><label>邮箱<input value="${e(state.user?.email || '演示模式')}" readonly></label><button type="submit" class="primary">保存资料</button></form></section><section class="settings-card danger-zone"><h3>注销账户</h3><p>注销将永久删除你的账户、头像、全部论文（含回收站）、分析结果和 API 令牌，无法恢复。请先下载需要保留的论文和引用。</p><button id="delete-account" class="danger">注销我的账户</button></section></div>`);
  const requireUser = () => {if (state.demo) throw new Error('请登录后管理个人资料，演示模式不会修改真实账户');};
  document.querySelector('#choose-avatar').onclick = () => {
    if (state.demo) {toast('请登录后设置头像'); return;}
    document.querySelector('#avatar-file').click();
  };
  document.querySelector('#avatar-file').onchange = event => busy(document.querySelector('#choose-avatar'), async () => {
    requireUser(); const file = event.target.files[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('请选择 5 MB 以内的 JPG、PNG 或 WebP 图片');
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const side = Math.min(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256); bitmap.close();
    const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!image) throw new Error('头像处理失败，请更换图片');
    const path = `${state.user.id}/${crypto.randomUUID()}.webp`, oldPath = state.profile?.avatar_path;
    const {error} = await db.storage.from('avatars').upload(path, image, {contentType: 'image/webp', upsert: false}); if (error) throw error;
    const updated = await db.from('profiles').update({avatar_path: path}).eq('id', state.user.id).select().single();
    if (updated.error) {await db.storage.from('avatars').remove([path]); throw updated.error;}
    if (oldPath) await db.storage.from('avatars').remove([oldPath]);
    await refresh(); render(); toast('头像已保存到云端');
  });
  document.querySelector('#remove-avatar').onclick = event => busy(event.currentTarget, async () => {
    requireUser(); const path = state.profile?.avatar_path; if (!path) return;
    const {error} = await db.from('profiles').update({avatar_path: null}).eq('id', state.user.id); if (error) throw error;
    await db.storage.from('avatars').remove([path]); await refresh(); render(); toast('头像已移除');
  });
  document.querySelector('#profile-form').onsubmit = event => {
    event.preventDefault(); const form = event.currentTarget;
    busy(form.querySelector('[type=submit]'), async () => {
      requireUser(); const display_name = String(new FormData(form).get('display_name')).trim();
      const {error} = await db.from('profiles').update({display_name}).eq('id', state.user.id); if (error) throw error;
      await refresh(); render(); toast('个人资料已保存');
    });
  };
  document.querySelector('#delete-account').onclick = () => {
    if (state.demo) {toast('演示模式没有可注销的真实账户'); return;}
    const d = modal('永久注销账户', `<p>这将永久删除账户与全部云端文献，无法恢复。此操作与“退出登录”不同。</p><form id="delete-form"><label>当前密码<input name="password" type="password" autocomplete="current-password" required></label><label>输入 DELETE 确认<input name="confirmation" autocomplete="off" required pattern="DELETE" placeholder="DELETE"></label><div class="form-error" id="delete-error" role="alert"></div><div class="actions"><button type="button" id="cancel-delete">取消</button><button type="submit" class="danger">永久注销并删除全部数据</button></div></form>`);
    d.el.querySelector('#cancel-delete').onclick = d.close;
    d.el.querySelector('#delete-form').onsubmit = event => {
      event.preventDefault(); const form = event.currentTarget;
      busy(form.querySelector('[type=submit]'), async () => {
        const fields = new FormData(form);
        try {
          await api('delete_account', {password: fields.get('password'), confirmation: fields.get('confirmation')});
          await db.auth.signOut({scope: 'local'}); state.user = null; state.profile = null; state.avatarURL = null; state.papers = []; state.selected.clear();
          d.close(); go('login'); toast('账户及云端数据已注销删除');
        } catch (error) {d.el.querySelector('#delete-error').textContent = error.message;}
        form.reset();
      });
    };
  };
}
