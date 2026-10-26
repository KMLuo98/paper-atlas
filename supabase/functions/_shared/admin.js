import {paperStoragePaths} from './paper-files.js';
import {removeUserFiles} from './account.js';
const str=(value,max=1000)=>typeof value==='string'?value.slice(0,max).trim():'';
export async function adminAction({service,userId,action,body,limit,createAuth,HTTPError}){

      const {data:admin,error:roleError}=await service.from('admin_users').select('user_id,must_change_password').eq('user_id',userId).maybeSingle();
      if(roleError)throw new HTTPError(503,'管理员权限读取失败');
      if(action==='admin_status')return ({is_admin:Boolean(admin),must_change_password:Boolean(admin?.must_change_password)});
      if(!admin)throw new HTTPError(403,'需要管理员权限');
      async function verifyAdminPassword(){
        if(typeof body.password!=='string'||body.password.length>1024)throw new HTTPError(400,'请输入当前管理员密码');
        await limit('admin-reauth:'+userId,10,600);const {data}=await service.auth.admin.getUserById(userId);
        const auth=createAuth();
        const verified=await auth.auth.signInWithPassword({email:data.user?.email||'',password:body.password});
        if(verified.error||verified.data.user?.id!==userId)throw new HTTPError(401,'管理员密码不正确');await auth.auth.signOut({scope:'local'});
      }
      if(action==='admin_set_password'){
        await verifyAdminPassword();if(typeof body.new_password!=='string'||body.new_password.length<10||body.new_password.length>1024||body.new_password===body.password)throw new HTTPError(400,'新密码至少10位，且必须不同于当前密码');
        const changed=await service.auth.admin.updateUserById(userId,{password:body.new_password});if(changed.error)throw new HTTPError(400,'密码更新失败，请检查密码要求');
        const {error}=await service.from('admin_users').update({must_change_password:false}).eq('user_id',userId);if(error)throw new HTTPError(503,'密码已修改，权限状态保存失败，请使用新密码重试');
        return ({ok:true});
      }
      if(admin.must_change_password)throw new HTTPError(403,'请先修改管理员初始密码');
      if(action==='admin_get_defaults'){
        const result=await service.from('signup_allowance_defaults').select('storage_quota_bytes,ai_question_limit').eq('singleton',true).single();if(result.error)throw new HTTPError(503,'默认额度读取失败');return result.data;
      }
      if(action==='admin_set_defaults'){
        const quota=body.quota_bytes,questions=body.questions;
        if(!Number.isSafeInteger(quota)||quota<0||quota>10995116277760||!Number.isSafeInteger(questions)||questions<0||questions>1000000)throw new HTTPError(400,'请填写有效的存储空间与提问次数');
        const result=await service.from('signup_allowance_defaults').update({storage_quota_bytes:quota,ai_question_limit:questions}).eq('singleton',true);if(result.error)throw new HTTPError(503,'默认额度保存失败');return {ok:true};
      }
      const page=Math.max(0,Math.floor(Number(body.page)||0));
      if(action==='admin_users'){
        const {data,error}=await service.from('profiles').select('id,username,email,display_name,created_at').order('created_at',{ascending:false}).range(page*100,page*100+99);if(error)throw new HTTPError(503,'用户列表读取失败');
        const usage=await service.rpc('account_storage_stats',{target_ids:data.map(user=>user.id)});if(usage.error)throw new HTTPError(503,'空间用量读取失败');
        const ai=await service.rpc('account_ai_stats',{target_ids:data.map(user=>user.id)});if(ai.error)throw new HTTPError(503,'AI 额度读取失败');
        return ({users:data.map(user=>({...user,...usage.data?.find(row=>row.user_id===user.id),...ai.data?.find(row=>row.user_id===user.id)})),page,has_more:data.length===100});
      }
      if(action==='admin_set_ai_quota'){
        const target=str(body.user_id,36),remaining=body.remaining;
        if(!/^[0-9a-f-]{36}$/i.test(target)||!Number.isSafeInteger(remaining)||remaining<0||remaining>1000000)throw new HTTPError(400,'剩余提问次数需为 0–1,000,000 的整数');
        const profile=await service.from('profiles').select('id').eq('id',target).maybeSingle();if(profile.error)throw new HTTPError(503,'用户读取失败');if(!profile.data)throw new HTTPError(404,'用户不存在');
        const saved=await service.rpc('set_ai_question_remaining',{target_user:target,remaining});if(saved.error||!saved.data)throw new HTTPError(503,'AI 额度保存失败');return {ok:true,remaining};
      }
      if(action==='admin_set_quota'){
        const target=str(body.user_id,36),quota=body.quota_bytes;
        if(!/^[0-9a-f-]{36}$/i.test(target)||!Number.isSafeInteger(quota)||quota<0||quota>10995116277760)throw new HTTPError(400,'配额必须是 0–10240 GB 范围内的有效值');
        const profile=await service.from('profiles').select('id').eq('id',target).maybeSingle();if(profile.error)throw new HTTPError(503,'用户读取失败');if(!profile.data)throw new HTTPError(404,'用户不存在');
        const saved=await service.from('account_storage_quotas').upsert({user_id:target,quota_bytes:quota,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(saved.error)throw new HTTPError(503,'配额保存失败');return {ok:true,quota_bytes:quota};
      }
      if(action==='admin_papers'){
        const target=str(body.user_id,36);if(!/^[0-9a-f-]{36}$/i.test(target))throw new HTTPError(400,'无效用户ID');
        const {data,error}=await service.from('papers').select('id,title,status,deleted_at,created_at').eq('user_id',target).order('created_at',{ascending:false}).range(page*100,page*100+99);if(error)throw new HTTPError(503,'论文读取失败');return ({papers:data,page,has_more:data.length===100});
      }
      if(action==='admin_delete_user'){
        if(body.confirmation!=='DELETE_USER')throw new HTTPError(400,'请确认永久删除用户');
        const target=str(body.user_id,36);if(!/^[0-9a-f-]{36}$/i.test(target)||target===userId)throw new HTTPError(400,'不能在这里删除当前管理员');
        const protectedUser=await service.from('admin_users').select('user_id').eq('user_id',target).maybeSingle();if(protectedUser.error||protectedUser.data)throw new HTTPError(403,'管理员账户不可在用户管理中删除');
        await verifyAdminPassword();try{await removeUserFiles(service,target);}catch(error){throw new HTTPError(503,error instanceof Error?error.message:'文件清理失败');}
        const {error}=await service.auth.admin.deleteUser(target);if(error)throw new HTTPError(503,'用户删除未完成，请重试');return ({ok:true});
      }
      if(action==='admin_delete_paper'){
        if(body.confirmation!=='DELETE_PAPER')throw new HTTPError(400,'请确认永久删除论文');await verifyAdminPassword();
        const id=str(body.paper_id,36);const {data:p,error}=await service.from('papers').select('id,file_path,user_id,supplementary_files').eq('id',id).maybeSingle();if(error||!p)throw new HTTPError(404,'论文不存在');
        const removed=await service.storage.from('papers').remove(paperStoragePaths(p,p.user_id));if(removed.error)throw new HTTPError(503,'论文文件删除失败');
        const deleted=await service.from('papers').delete().eq('id',id);if(deleted.error)throw new HTTPError(503,'文件已移除，记录删除失败，请重试');return ({ok:true});
      }
      throw new HTTPError(400,'未知管理操作');
    
}
