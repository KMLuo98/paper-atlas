import {clean,email,uuid,hostname} from './core.js';
import {formattedMail} from './formatted-mail.js';

export async function administrator(service,user,checked){
 return checked(service.from('admin_users').select('user_id,must_change_password').eq('user_id',user).maybeSingle());
}
export async function managementAction({service,user,action,b,checked,rate,HTTPError,parseHTML,credentials,smtp,composeRaw,sendRemote,sha}){
 const admin=await administrator(service,user,checked);
 if(!admin)throw new HTTPError(403,'需要管理员权限');
 if(admin.must_change_password)throw new HTTPError(403,'请先在文献管理系统修改管理员初始密码');
 const sender=async()=>{const rows=await checked(service.from('mail_accounts').select('*').eq('user_id',user).contains('config',{official_sender:true}).order('created_at').limit(1));return rows[0]||null;};
 const profile=async id=>{const p=await checked(service.from('profiles').select('id,username,email,display_name,created_at').eq('id',uuid(id)).maybeSingle());if(!p)throw new HTTPError(404,'用户不存在');const a=await checked(service.from('mail_accounts').select('email').eq('user_id',p.id).order('created_at').order('id').limit(1));return {...p,primary_email:a[0]?.email||p.email};};
 if(action==='admin_mail_users'){
  const offset=Math.max(0,Number(b.offset)||0),users=await checked(service.from('profiles').select('id,username,email,display_name,created_at').order('created_at',{ascending:false}).range(offset,offset+99));
  const ids=users.map(p=>p.id),accounts=ids.length?await checked(service.from('mail_accounts').select('user_id,email').in('user_id',ids).order('created_at').order('id')):[],admins=await checked(service.from('admin_users').select('user_id'));
  const a=await sender();return {users:users.map(p=>({...p,primary_email:accounts.find(a=>a.user_id===p.id)?.email||p.email,is_admin:admins.some(a=>a.user_id===p.id)})),has_more:users.length===100,sender:a?{email:a.email,smtp_host:a.config.smtp_host,username:a.config.username}:null};
 }
 if(action==='admin_mail_sender'){
  await rate('admin-sender:'+user,10,600);const old=await sender(),address=email(b.email),host=hostname(b.smtp_host),password=clean(b.password,1024);
  if(!password&&(!old||old.email!==address||old.config.smtp_host!==host||old.config.username!==(clean(b.username,254)||address)))throw new HTTPError(400,'更改发信邮箱或服务器时请重新填写授权码');
  const a={id:old?.id||crypto.randomUUID(),user_id:user,email:address,label:'Mail Atlas 官方通知',provider:'imap',enabled:false,color:'#638b82',config:{official_sender:true,smtp_host:host,smtp_port:465,imap_host:host,imap_port:993,username:clean(b.username,254)||address}};
  const secret=password?{auth_type:'password',password}:await credentials(service,old);const transport=await smtp(a,secret);try{await transport.verify();}catch{throw new HTTPError(400,'SMTP 验证失败，请检查服务器、邮箱和授权码');}finally{transport.close();}
  await checked(service.from('mail_accounts').upsert(a,{onConflict:'id'}));if(password)await checked(service.rpc('mail_secret',{p_account:a.id,p_user:user,p_value:secret}));return {ok:true,sender:{email:address,smtp_host:host,username:a.config.username}};
 }
 if(!['admin_mail_reset','admin_mail_send'].includes(action))throw new HTTPError(400,'未知管理操作');
 await rate('admin-mail:'+user,30,3600);const a=await sender();
 if(!a)throw new HTTPError(409,'请先配置官方发信邮箱');
 const secret=await credentials(service,a),key=uuid(b.key);
 async function deliver(target,subject,body,html){
  const options={from:{name:'Mail Atlas',address:a.email},to:[email(target.primary_email)],cc:[],bcc:[],subject,text:body,html,messageId:'<'+crypto.randomUUID()+'@mail-atlas.local>'};
  const raw=await composeRaw(options);await sendRemote(a,secret,options,raw);
 }
 async function claim(k){const locked=await checked(service.rpc('mail_send_lock',{p_user:user,p_key:k}));if(locked.acquired)return null;if(locked.status==='sent')return locked.result;throw new HTTPError(409,'请求已提交，状态待确认，请勿重复操作');}
 const complete=(k,result)=>checked(service.rpc('mail_send_lock',{p_user:user,p_key:k,p_result:result}));
 if(action==='admin_mail_reset'){
  const target=await profile(b.user_id);if(await administrator(service,target.id,checked))throw new HTTPError(403,'不能在这里重置管理员密码');
  const prior=await claim(key);if(prior)return prior;
  const changed=await service.auth.admin.updateUserById(target.id,{password:'12345678'});if(changed.error){const result={password_reset:false,notification_sent:false,error:'密码重置失败'};await complete(key,result);return result;}
  let result={password_reset:true,notification_sent:true,recipient:target.primary_email};
  try{await deliver(target,'Mail Atlas：密码重置已完成','你的 Mail Atlas 账户密码已由管理员重置为 12345678。请立即登录并在设置中修改密码。此修改也适用于文献管理系统。\nhttps://kmluo98.github.io/mail/','<p>你的 Mail Atlas 账户密码已由管理员重置为 <strong>12345678</strong>。</p><p>请立即<a href="https://kmluo98.github.io/mail/">登录工作台</a>并在设置中修改密码。此修改也适用于文献管理系统。</p>');}
  catch{result={...result,notification_sent:false,error:'密码已重置，但通知发送失败，请单独发送通知，不要重复重置'};}
  await complete(key,result);return result;
 }
 const ids=[...new Set((Array.isArray(b.user_ids)?b.user_ids:[]).map(uuid))];if(!ids.length||ids.length>50)throw new HTTPError(400,'每批请选择1–50位用户');
 const formatted=formattedMail(b.body,b.body_html,parseHTML),subject=clean(b.subject,1000);if(!subject||!formatted.text)throw new HTTPError(400,'请填写邮件主题和正文');
 const targets=await Promise.all(ids.map(profile)),results=[];
 for(const target of targets){const hash=await sha(key+':'+target.id),k=hash.slice(0,8)+'-'+hash.slice(8,12)+'-'+hash.slice(12,16)+'-'+hash.slice(16,20)+'-'+hash.slice(20,32);try{
   const prior=await claim(k);if(prior){results.push(prior);continue;}
   try{await deliver(target,subject,formatted.text,formatted.html);const r={user_id:target.id,email:target.primary_email,sent:true};await complete(k,r);results.push(r);}catch{const r={user_id:target.id,email:target.primary_email,sent:false,error:'投递失败或状态未确认，请核对收件邮箱后再处理'};await complete(k,r);results.push(r);}
  }catch(e){results.push({user_id:target.id,sent:false,error:e.message});}}
 return {results};
}
