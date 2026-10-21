import {ImapFlow} from 'npm:imapflow@2.5.9';
import nodemailer from 'npm:nodemailer@10.1.7';
import PostalMime from 'npm:postal-mime@4.0.11';
import {Buffer} from 'node:buffer';
import {clean,publicIPv4,hostname} from './core.js';

export {PostalMime};
export const b64=(s:Uint8Array)=>Buffer.from(s).toString('base64');
export const unb64=(s:string)=>new Uint8Array(Buffer.from(s,'base64'));
const env=(n:string)=>Deno.env.get(n)||'';
export const callback=()=>env('SUPABASE_URL')+'/functions/v1/mail-api';
export function oauthMeta(provider:string){return provider==='gmail'?{auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'https://mail.google.com/'}:{auth:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',token:'https://login.microsoftonline.com/common/oauth2/v2.0/token',scope:'offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send'};}
export async function oauthExchange(provider:string,params:Record<string,string>){const r=await fetch(oauthMeta(provider).token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||!d.access_token)throw Error('邮箱授权失败或已过期，请重新授权');return d;}
export async function credentials(service:any,a:any){const {data:s,error}=await service.rpc('mail_secret',{p_account:a.id,p_user:a.user_id});if(error||!s)throw Error('尚未连接邮箱，请在设置中授权');if(s.auth_type==='oauth'&&(!s.expires_at||s.expires_at<Date.now()+120000)){
 const d=await oauthExchange(a.provider,{grant_type:'refresh_token',refresh_token:s.refresh_token,client_id:s.client_id,...(s.client_secret?{client_secret:s.client_secret}:{}),scope:oauthMeta(a.provider).scope});
 Object.assign(s,{access_token:d.access_token,refresh_token:d.refresh_token||s.refresh_token,expires_at:Date.now()+d.expires_in*1000});
 const saved=await service.rpc('mail_secret',{p_account:a.id,p_user:a.user_id,p_value:s});if(saved.error)throw Error('授权保存失败');
 }return s;}
async function endpoint(host:string){const h=hostname(host);const ips=await Deno.resolveDns(h,'A');if(!ips.length||ips.some(ip=>!publicIPv4(ip)))throw Error('邮箱服务器地址不被允许');return {host:ips[0],servername:h};}
export async function imap(a:any,s:any){const ep=await endpoint(a.config.imap_host||'imap.gmail.com');const c=new ImapFlow({...ep,port:993,secure:true,tls:{servername:ep.servername,minVersion:'TLSv1.2',rejectUnauthorized:true},auth:{user:a.config.username||a.email,...(s.auth_type==='oauth'?{accessToken:s.access_token}:{pass:s.password})},clientInfo:{name:'Mail Atlas',version:'1.0.0',vendor:'Mail Atlas'},logger:false,disableAutoIdle:true,disableCompression:true,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});c.on('error',()=>{});await c.connect();return c;}
export async function smtp(a:any,s:any){const ep=await endpoint(a.config.smtp_host||'smtp.gmail.com');return nodemailer.createTransport({...ep,port:465,secure:true,tls:{servername:ep.servername,minVersion:'TLSv1.2',rejectUnauthorized:true},auth:s.auth_type==='oauth'?{type:'OAuth2',user:a.email,accessToken:s.access_token}:{user:a.config.username||a.email,pass:s.password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,logger:false,debug:false});}
export async function graph(s:any,path:string,options:RequestInit={}){const url=path.startsWith('https://')?path:'https://graph.microsoft.com/v1.0/me/'+path;if(!url.startsWith('https://graph.microsoft.com/v1.0/'))throw Error('无效分页地址');const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${s.access_token}`,...options.headers},signal:AbortSignal.timeout(25000)});if(!r.ok){await r.body?.cancel();throw Error(`Outlook 接口失败（${r.status}），请重新授权或稍后重试`);}return r;}
export async function parseRaw(raw:Uint8Array){return await PostalMime.parse(raw,{attachmentEncoding:'base64',maxNestingDepth:30});}
export function messageFields(m:any){return {message_id:clean(m.messageId,500),from_email:clean(m.from?.address,254).toLowerCase(),from_name:clean(m.from?.name,200),to_list:(m.to||[]).map((x:any)=>({address:clean(x.address,254),name:clean(x.name,100)})),cc_list:(m.cc||[]).map((x:any)=>({address:clean(x.address,254),name:clean(x.name,100)})),reply_to:clean(m.replyTo?.[0]?.address,254),subject:clean(m.subject,1000)||'（无主题）',received_at:Number.isFinite(Date.parse(m.date))?new Date(m.date).toISOString():new Date().toISOString(),preview:clean(m.text||String(m.html||'').replace(/<[^>]+>/g,' '),220),text_body:clean(m.text,600000),html_body:clean(m.html,1000000),attachments:(m.attachments||[]).map((x:any,i:number)=>({index:i,filename:clean(x.filename,200)||'附件',mime_type:clean(x.mimeType,100),size:Math.floor(String(x.content||'').length*3/4),content_id:clean(x.contentId,200)}))};}
export async function syncRemote(a:any,s:any,accept:(id:string,raw:Uint8Array|null,flags:any,remoteFolder?:string)=>Promise<void>,older=false){
 if(a.provider==='outlook'){
 let path=older?a.sync_state.older_link:a.sync_state.next_link;
 if(!path){if(older)return {...a.sync_state};path='mailFolders/inbox/messages?$top=20&$select=id,receivedDateTime,isRead,flag&$orderby=receivedDateTime desc';if(a.sync_state.last_received)path+='&$filter='+encodeURIComponent('receivedDateTime gt '+a.sync_state.last_received);}
 const d=await (await graph(s,path)).json();let latest=a.sync_state.pending_latest||a.sync_state.last_received||'';
 for(const x of d.value||[]){const raw=new Uint8Array(await (await graph(s,'messages/'+encodeURIComponent(x.id)+'/$value')).arrayBuffer());if(raw.length>25000000)throw Error('邮件超过25MB，跳过前请单独处理');await accept(x.id,raw,{read:x.isRead,starred:x.flag?.flagStatus==='flagged'});if(x.receivedDateTime>latest)latest=x.receivedDateTime;}
 if(older)return {...a.sync_state,older_link:d['@odata.nextLink']||null};
 const initial=!a.sync_state.last_received;return {...a.sync_state,...(initial?{older_link:d['@odata.nextLink']||null}:{}),next_link:initial?null:d['@odata.nextLink']||null,pending_latest:(!initial&&d['@odata.nextLink'])?latest:null,last_received:(!initial&&d['@odata.nextLink'])?a.sync_state.last_received:latest};
 }
 const c=await imap(a,s);let lock;try{lock=await c.getMailboxLock('INBOX');const valid=String((c.mailbox as any).uidValidity),changed=a.sync_state.uid_validity!==valid;
 const last=changed?0:Number(a.sync_state.last_uid||0),oldest=changed?0:Number(a.sync_state.oldest_uid||0);let ids:number[]=[];
 if(older){if(!oldest||oldest<=1)return {...a.sync_state,has_older:false};ids=(await c.search({uid:'1:'+(oldest-1)},{uid:true})||[]).slice(-15);}
 else if(last){const found=await c.search({uid:(last+1)+':*'},{uid:true});ids=(found||[]).filter((v:number)=>v>last).slice(0,15);}
 else {const found=await c.search({all:true},{uid:true});ids=(found||[]).slice(-30);}
 let newest=last,old=oldest;for(const id of ids){const meta=await c.fetchOne(id,{size:true},{uid:true});if(!meta)continue;if(meta.size>25000000)throw Error('存在超过25MB的邮件，请在原邮箱处理后继续同步');const item=await c.fetchOne(id,{source:true,flags:true},{uid:true});if(!item||!item.source)continue;await accept('INBOX|'+valid+':'+id,new Uint8Array(item.source),{read:item.flags.has('\\Seen'),starred:item.flags.has('\\Flagged')});newest=Math.max(newest,id);old=old?Math.min(old,id):id;}
 const flags:any[]=[];const exists=Number((c.mailbox as any).exists);if(exists&&!older)for await(const item of c.fetch(Math.max(1,exists-99)+':*',{uid:true,flags:true})){flags.push({remote_id:'INBOX|'+valid+':'+item.uid,is_read:item.flags.has('\\Seen'),starred:item.flags.has('\\Flagged')});}
 return {...a.sync_state,uid_validity:valid,last_uid:newest,oldest_uid:old,has_older:older?ids.length===15:old>1,_flags:flags};
 }finally{lock?.release();await c.logout().catch(()=>c.close());}}
export async function remotePatch(a:any,s:any,m:any,patch:any){if(!m.remote_id||m.remote_id.startsWith('local:'))return;
 if(a.provider==='outlook'){
 const p:any={};if('is_read'in patch)p.isRead=patch.is_read;if('starred'in patch)p.flag={flagStatus:patch.starred?'flagged':'notFlagged'};
 if(Object.keys(p).length)await graph(s,'messages/'+encodeURIComponent(m.remote_id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
 if(patch.folder&&patch.folder!==m.folder){const target:any={archive:'archive',trash:'deleteditems',inbox:'inbox'};if(target[patch.folder]){const r=await(await graph(s,'messages/'+encodeURIComponent(m.remote_id)+'/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destinationId:target[patch.folder]})})).json();return {remote_id:r.id,remote_folder:patch.folder};}}return;
 }
 const c=await imap(a,s);let lock;try{lock=await c.getMailboxLock(m.remote_folder||'INBOX');const [valid,id]=m.remote_id.split('|').at(-1).split(':');if(String((c.mailbox as any).uidValidity)!==valid)throw Error('邮箱索引已更新，请重新同步');
 for(const [key,flag]of [['is_read','\\Seen'],['starred','\\Flagged']])if(key in patch){if(patch[key])await c.messageFlagsAdd(id,[flag],{uid:true});else await c.messageFlagsRemove(id,[flag],{uid:true});}
 if(patch.folder&&patch.folder!==m.folder){const all=await c.list();const special:any={archive:'\\Archive',trash:'\\Trash',inbox:'\\Inbox'};const dest=patch.folder==='inbox'?'INBOX':all.find((x:any)=>x.specialUse===special[patch.folder])?.path;if(!dest)throw Error('原邮箱未提供目标文件夹，请先在原邮箱建立归档/垃圾箱');const moved=await c.messageMove(id,dest,{uid:true});if(!moved||!moved.uidMap?.get(Number(id)))throw Error('服务器未返回新索引，请在原邮箱确认移动结果并同步');return {remote_folder:dest,remote_id:dest+'|'+String(moved.uidValidity)+':'+moved.uidMap.get(Number(id))};}
 }finally{lock?.release();await c.logout().catch(()=>c.close());}}
export async function composeRaw(options:any){const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'windows'});const result=await transport.sendMail(options);return new Uint8Array(result.message as Uint8Array);}
export async function sendRemote(a:any,s:any,options:any,raw:Uint8Array){if(a.provider==='outlook'){await graph(s,'sendMail',{method:'POST',headers:{'Content-Type':'text/plain'},body:b64(raw)});return {messageId:options.messageId,accepted:options.to,rejected:[]};}
 const t=await smtp(a,s);try{const r=await t.sendMail({envelope:{from:a.email,to:[...options.to,...options.cc,...options.bcc]},raw:Buffer.from(raw)});if(r.rejected?.length)throw Error('部分收件人被拒收，请在原邮箱确认投递结果后再处理');return {messageId:r.messageId,accepted:r.accepted,rejected:r.rejected};}finally{t.close();}}
