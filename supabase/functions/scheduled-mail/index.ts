import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {parseHTML} from 'npm:linkedom@0.18.13';
import {clean,uuid,addresses} from '../mail-api/core.js';
import {formattedMail} from '../mail-api/formatted-mail.js';
import {credentials,composeRaw,sendRemote,parseRaw,messageFields,unb64,attachmentBase64} from '../mail-api/providers.ts';
import {scheduledTime,deliverScheduled} from './queue.js';

const env=(key:string)=>Deno.env.get(key)||'';
const service=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Content-Type':'application/json'};
const json=(value:any,status=200)=>new Response(JSON.stringify(value),{status,headers});
class HTTPError extends Error {constructor(public status:number,message:string){super(message);}}
const checked=async(p:any)=>{const {data,error}=await p;if(error)throw new HTTPError(503,'云端保存或读取失败，请重试');return data;};
async function own(table:string,id:string,user:string){const row=await checked(service.from(table).select('*').eq('id',uuid(id)).eq('user_id',user).maybeSingle());if(!row)throw new HTTPError(404,'记录不存在或无权访问');return row;}
async function rate(user:string){if(!await checked(service.rpc('consume_rate_limit',{bucket_key:'mail:schedule:'+user,maximum:30,window_seconds:3600})))throw new HTTPError(429,'操作过于频繁，请稍后再试');}
const summary=(row:any)=>({id:row.id,account_id:row.account_id,send_at:row.send_at,status:row.status,subject:row.metadata.subject,to:row.metadata.to.join(', '),attachments:row.metadata.attachments||0,last_error:row.last_error,warning:row.warning});
async function download(row:any){const {data,error}=await service.storage.from('mail-files').download(row.raw_path);if(error)throw Error('原文读取失败');return new Uint8Array(await data.arrayBuffer());}

async function saveCopy(row:any,prepared:any){
 const {raw,account}=prepared,fields=messageFields(await parseRaw(raw));
 const imported=await checked(service.from('mail_messages').select('id').eq('user_id',row.user_id).eq('account_id',row.account_id).eq('folder','sent').eq('message_id',fields.message_id).limit(1));
 if(!imported.length)await checked(service.from('mail_messages').upsert({...fields,id:row.id,user_id:row.user_id,account_id:account.id,remote_id:'local:'+row.id,folder:'sent',direction:'sent',is_read:true,raw_path:row.raw_path},{onConflict:'account_id,remote_id',ignoreDuplicates:true}));
 if(row.metadata.draft_id)await checked(service.from('mail_drafts').delete().eq('id',row.metadata.draft_id).eq('user_id',row.user_id));
}
async function runQueue(){
 const rows=await checked(service.rpc('mail_claim_scheduled'));
 await Promise.all(rows.map((row:any)=>deliverScheduled(row,{
  prepare:async()=>{const account=await own('mail_accounts',row.account_id,row.user_id);const secret=await credentials(service,account),raw=await download(row);return {account,secret,raw,options:{messageId:'<'+row.id+'@mail-atlas.local>',to:row.metadata.to,cc:row.metadata.cc,bcc:row.metadata.bcc}};},
  begin:async()=>{const changed=await checked(service.from('mail_scheduled_sends').update({delivery_started_at:new Date().toISOString()}).eq('id',row.id).eq('claim_token',row.claim_token).eq('status','sending').is('delivery_started_at',null).select('id'));return changed.length===1;},
  send:async(p:any)=>sendRemote(p.account,p.secret,p.options,p.raw),
  finish:async(_row:any,status:string,fields:any)=>{await checked(service.from('mail_scheduled_sends').update({status,...fields,finished_at:new Date().toISOString()}).eq('id',row.id).eq('claim_token',row.claim_token).in('status',['sending','uncertain']));if(status==='sent')await checked(service.rpc('mail_send_lock',{p_user:row.user_id,p_key:row.id,p_result:{ok:true,...fields.result}}));},
  saveCopy,
  warning:async(_row:any,warning:string)=>{await checked(service.from('mail_scheduled_sends').update({warning}).eq('id',row.id).eq('status','sent'));}
 })));
 return rows.length;
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'仅支持 POST'},405);
 try{
  const b=await req.json(),action=clean(b.action,60);
  if(action==='cron'){
   if(!await checked(service.rpc('mail_cron_check',{p_token:clean(b.token,100)})))throw new HTTPError(401,'无效调度凭证');
   // Keep working if pg_net's short HTTP timeout disconnects during SMTP delivery.
   const work=runQueue();EdgeRuntime.waitUntil(work);return json({processed:await work});
  }
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:auth,error}=await service.auth.getUser(token);if(error||!auth.user)throw new HTTPError(401,'请先登录');const user=auth.user.id;
  if(await checked(service.from('admin_users').select('user_id').eq('user_id',user).maybeSingle()))throw new HTTPError(403,'管理员仅能使用管理功能');
  if(action==='list')return json({items:(await checked(service.from('mail_scheduled_sends').select('*').eq('user_id',user).neq('status','sent').order('send_at').limit(200))).map(summary)});
  if(action==='create'){
   await rate(user);const id=uuid(b.key),existing=await checked(service.from('mail_scheduled_sends').select('*').eq('id',id).eq('user_id',user).maybeSingle());if(existing)return json(summary(existing));
   const send_at=scheduledTime(b.send_at),account=await own('mail_accounts',b.account_id,user),to=addresses(b.to),cc=addresses(b.cc),bcc=addresses(b.bcc);
   if(!to.length)throw new HTTPError(400,'请填写收件人');if(to.length+cc.length+bcc.length>50)throw new HTTPError(400,'最多50位收件人');
   const formatted=formattedMail(b.body,b.body_html,parseHTML),subject=clean(b.subject,1000),text=clean(formatted.text,100000);if(!subject||!text)throw new HTTPError(400,'请填写主题和正文');
   if(b.draft_id)await own('mail_drafts',b.draft_id,user);
   const original=b.reply_id?await own('mail_messages',b.reply_id,user):null;
   if(Array.isArray(b.attachments)&&b.attachments.length>10)throw new HTTPError(413,'最多10个附件');
   const attachments=(Array.isArray(b.attachments)?b.attachments:[]).map((x:any)=>({filename:clean(x.filename,200),content:unb64(x.content),contentType:clean(x.mime_type,100)||'application/octet-stream'}));
   if(attachments.reduce((n:number,x:any)=>n+x.content.length,0)>12000000)throw new HTTPError(413,'附件总大小最大12MB');
   // Check authorization now; OAuth credentials are refreshed again when delivery is due.
   await credentials(service,account);
   const raw=await composeRaw({from:{name:account.label,address:account.email},to,cc,bcc,subject,text,html:formatted.html||undefined,date:new Date(send_at),messageId:'<'+id+'@mail-atlas.local>',keepBcc:account.provider==='outlook',attachments,...(original?.message_id?{inReplyTo:original.message_id,references:[original.message_id]}:{})});
   const path=user+'/'+account.id+'/scheduled/'+crypto.randomUUID()+'.eml';
   const uploaded=await service.storage.from('mail-files').upload(path,raw,{contentType:'message/rfc822'});if(uploaded.error)throw new HTTPError(503,'定时邮件内容保存失败');
   let saved:any;
   try{saved=await checked(service.rpc('mail_enqueue_scheduled',{p_row:{id,user_id:user,account_id:account.id,send_at,raw_path:path,metadata:{subject,to,cc,bcc,reply_id:original?.id||null,draft_id:b.draft_id||null,attachments:attachments.length}}}));}
   catch(e){await service.storage.from('mail-files').remove([path]);throw e;}
   if(saved.raw_path!==path)await service.storage.from('mail-files').remove([path]);
   if(b.draft_id)await checked(service.from('mail_drafts').delete().eq('id',b.draft_id).eq('user_id',user));
   return json(summary(saved));
  }
  if(['cancel','get','delete'].includes(action)){
   const row=await own('mail_scheduled_sends',b.id,user);
   if(action==='cancel'){
    const changed=await checked(service.from('mail_scheduled_sends').update({status:'cancelled'}).eq('id',row.id).eq('user_id',user).in('status',['pending','failed']).select('*'));
    if(!changed.length&&row.status!=='cancelled')throw new HTTPError(409,'邮件已开始投递或结果待确认，无法取消');return json({ok:true});
   }
   if(!['cancelled','failed'].includes(row.status))throw new HTTPError(409,'请先取消定时发送；投递结果待确认的邮件请先到原邮箱核实');
   if(action==='get'){
    const parsed=await parseRaw(await download(row));return json({data:{account_id:row.account_id,subject:row.metadata.subject,to:row.metadata.to.join(', '),cc:row.metadata.cc.join(', '),bcc:row.metadata.bcc.join(', '),body:parsed.text||'',body_html:parsed.html||'',reply_id:row.metadata.reply_id,attachments:(parsed.attachments||[]).map((x:any)=>({filename:x.filename,mime_type:x.mimeType,size:x.content.byteLength,content:attachmentBase64(x.content)}))}});
   }
   await checked(service.from('mail_scheduled_sends').delete().eq('id',row.id).eq('user_id',user).in('status',['cancelled','failed']));await service.storage.from('mail-files').remove([row.raw_path]);return json({ok:true});
  }
  throw new HTTPError(400,'未知操作');
 }catch(e){return json({error:e instanceof HTTPError?e.message:'操作失败，请重试'},e instanceof HTTPError?e.status:400);}
});
