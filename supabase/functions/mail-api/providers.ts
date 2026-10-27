import {replyHeaders} from './reply-headers.js';
import {moveImapMessage} from './remote-move.js';
import {attachmentSize,attachmentBase64} from './mime-content.js';
import {ImapFlow} from 'npm:imapflow@2.5.9';
import nodemailer from 'npm:nodemailer@10.1.7';
import PostalMime from 'npm:postal-mime@4.0.11';
import {Buffer} from 'node:buffer';
import {folderKey,imapFolders,priorFolderState,selectSyncFolders,syncImapFolder} from './folders.js';
import {clean,publicIPv4,hostname,providerError,mailboxPassword} from './core.js';

export {PostalMime};
export const b64=(s:Uint8Array)=>Buffer.from(s).toString('base64');
export const unb64=(s:string)=>new Uint8Array(Buffer.from(s,'base64'));
const env=(n:string)=>Deno.env.get(n)||'';
export const callback=()=>env('SUPABASE_URL')+'/functions/v1/mail-api';
export function oauthMeta(provider:string){return provider==='gmail'?{auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'https://mail.google.com/'}:{auth:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',token:'https://login.microsoftonline.com/common/oauth2/v2.0/token',scope:'offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send'};}
export async function oauthExchange(provider:string,params:Record<string,string>){const r=await fetch(oauthMeta(provider).token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||!d.access_token)throw Error('邮箱授权失败或已过期，请重新授权');return d;}
export async function credentials(service:any,a:any){const {data:s,error}=await service.rpc('mail_secret',{p_account:a.id,p_user:a.user_id});if(error||!s)throw Error('尚未连接邮箱，请在设置中授权');if(s.auth_type==='password'){const normalized=mailboxPassword(s.password,a.config.imap_host);if(normalized!==s.password){s.password=normalized;const saved=await service.rpc('mail_secret',{p_account:a.id,p_user:a.user_id,p_value:s});if(saved.error)throw Error('授权码格式修正保存失败');}}if(s.auth_type==='oauth'&&(!s.expires_at||s.expires_at<Date.now()+120000)){
 const d=await oauthExchange(a.provider,{grant_type:'refresh_token',refresh_token:s.refresh_token,client_id:s.client_id,...(s.client_secret?{client_secret:s.client_secret}:{}),scope:oauthMeta(a.provider).scope});
 Object.assign(s,{access_token:d.access_token,refresh_token:d.refresh_token||s.refresh_token,expires_at:Date.now()+d.expires_in*1000});
 const saved=await service.rpc('mail_secret',{p_account:a.id,p_user:a.user_id,p_value:s});if(saved.error)throw Error('授权保存失败');
 }return s;}
async function endpoint(host:string){const h=hostname(host);const ips=await Deno.resolveDns(h,'A');if(!ips.length||ips.some(ip=>!publicIPv4(ip)))throw Error('邮箱服务器地址不被允许');return {host:ips[0],servername:h};}
export async function imap(a:any,s:any){const ep=await endpoint(a.config.imap_host||'imap.gmail.com');let lastCommandError:any=null;const capture=(entry:any)=>{if(entry?.err)lastCommandError=entry.err;};const c=new ImapFlow({...ep,port:993,secure:true,tls:{servername:ep.servername,minVersion:'TLSv1.2',rejectUnauthorized:true},auth:{user:a.config.username||a.email,...(s.auth_type==='oauth'?{accessToken:s.access_token}:{pass:s.password})},clientInfo:{name:'Mail Atlas',version:'1.0.0',vendor:'Mail Atlas'},logger:{trace(){},debug(){},info(){},warn:capture,error:capture},disableAutoIdle:true,disableCompression:true,connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});(c as any).mailLastError=()=>lastCommandError;(c as any).mailClearError=()=>{lastCommandError=null;};c.on('error',()=>{});try{await c.connect();return c;}catch(e){c.close();throw providerError(e,'IMAP连接或登录',[s.password,s.access_token]);}}
export async function smtp(a:any,s:any){const ep=await endpoint(a.config.smtp_host||'smtp.gmail.com');return nodemailer.createTransport({...ep,port:465,secure:true,tls:{servername:ep.servername,minVersion:'TLSv1.2',rejectUnauthorized:true},auth:s.auth_type==='oauth'?{type:'OAuth2',user:a.email,accessToken:s.access_token}:{user:a.config.username||a.email,pass:s.password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000,logger:false,debug:false});}
export async function graph(s:any,path:string,options:RequestInit={}){const url=path.startsWith('https://')?path:'https://graph.microsoft.com/v1.0/me/'+path;if(!url.startsWith('https://graph.microsoft.com/v1.0/'))throw Error('无效分页地址');const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${s.access_token}`,...options.headers},signal:AbortSignal.timeout(25000)});if(!r.ok){await r.body?.cancel();throw Error(`Outlook 接口失败（${r.status}），请重新授权或稍后重试`);}return r;}
export async function parseRaw(raw:Uint8Array){return await PostalMime.parse(raw,{attachmentEncoding:'arraybuffer',maxNestingDepth:30});}
export {attachmentBase64};
export function messageFields(m:any){return {...replyHeaders(m),message_id:clean(m.messageId,500),from_email:clean(m.from?.address,254).toLowerCase(),from_name:clean(m.from?.name,200),to_list:(m.to||[]).map((x:any)=>({address:clean(x.address,254),name:clean(x.name,100)})),cc_list:(m.cc||[]).map((x:any)=>({address:clean(x.address,254),name:clean(x.name,100)})),reply_to:clean(m.replyTo?.[0]?.address,254),subject:clean(m.subject,1000)||'（无主题）',received_at:Number.isFinite(Date.parse(m.date))?new Date(m.date).toISOString():new Date().toISOString(),preview:clean(m.text||String(m.html||'').replace(/<[^>]+>/g,' '),220),text_body:clean(m.text,600000),html_body:clean(m.html,1000000),attachments:(m.attachments||[]).map((x:any,i:number)=>({index:i,filename:clean(x.filename,200)||'附件',mime_type:clean(x.mimeType,100),size:attachmentSize(x.content),content_id:clean(x.contentId,200)}))};}
async function graphFolders(a:any,s:any){
 const previous=a.sync_state||{};if(previous.folders?.length&&Date.now()-Date.parse(previous.folders_discovered_at||'')<600000)return previous.folders;
 const roles:any={inbox:'inbox',sentitems:'sent',drafts:'drafts',archive:'archive',deleteditems:'trash',junkemail:'spam'};const known:any[]=[];
 for(const [path,kind]of Object.entries(roles)){try{const f=await(await graph(s,'mailFolders/'+path+'?$select=id,displayName,totalItemCount,unreadItemCount')).json();known.push({path:f.id,name:f.displayName,kind,total:f.totalItemCount,unread:f.unreadItemCount});}catch(e){if(path==='inbox')throw e;}}
 let next='mailFolders?$top=100&$select=id,displayName,totalItemCount,unreadItemCount,childFolderCount';const pending:string[]=[];let n=0;
 while(next&&n++<20){const d=await(await graph(s,next)).json();for(const f of d.value||[]){if(!known.some(x=>x.path===f.id))known.push({path:f.id,name:f.displayName,kind:'custom',total:f.totalItemCount,unread:f.unreadItemCount});if(f.childFolderCount&&pending.length<100)pending.push('mailFolders/'+encodeURIComponent(f.id)+'/childFolders?$top=100&$select=id,displayName,totalItemCount,unreadItemCount,childFolderCount');}next=d['@odata.nextLink']||pending.shift()||'';}
 return known;
}
async function syncGraphFolder(a:any,s:any,f:any,state:any,accept:any,older:boolean,limit:number){
 let path=older?state.older_link:state.next_link;if(older&&!path)return {...state,_processed:0,has_older:false};
 if(!path){path='mailFolders/'+encodeURIComponent(f.path)+'/messages?$top='+limit+'&$select=id,receivedDateTime,isRead,flag&$orderby=receivedDateTime desc';if(state.last_received&&f.kind!=='drafts')path+='&$filter='+encodeURIComponent('receivedDateTime gt '+state.last_received);}
 const d=await(await graph(s,path)).json();let latest=state.pending_latest||state.last_received||'';
 for(const x of d.value||[]){const raw=new Uint8Array(await(await graph(s,'messages/'+encodeURIComponent(x.id)+'/$value')).arrayBuffer());if(raw.length>25000000)throw Error('邮件超过25MB，无法导入');await accept(x.id,raw,{read:x.isRead,starred:x.flag?.flagStatus==='flagged'},f.path,f.kind);if(x.receivedDateTime>latest)latest=x.receivedDateTime;}
 if(older)return {...state,older_link:d['@odata.nextLink']||null,has_older:!!d['@odata.nextLink'],last_sync:new Date().toISOString(),error:null,_processed:(d.value||[]).length};
 const initial=!state.last_received;return {...state,...(initial?{older_link:d['@odata.nextLink']||null,has_older:!!d['@odata.nextLink']}:{}),next_link:initial?null:d['@odata.nextLink']||null,pending_latest:!initial&&d['@odata.nextLink']?latest:null,last_received:!initial&&d['@odata.nextLink']?state.last_received:latest,last_sync:new Date().toISOString(),error:null,_processed:(d.value||[]).length};
}
export async function syncRemote(a:any,s:any,accept:(id:string,raw:Uint8Array|null,flags:any,remoteFolder?:string,folderKind?:string)=>Promise<void>,older=false,target:any={}){
 const root={...(a.sync_state||{})},states={...(root.folder_states||{})},allFlags:any[]=[],errors:string[]=[];let client:any=null,processed=0;
 try{
 const folders=a.provider==='outlook'?await graphFolders(a,s):imapFolders(await (client=await imap(a,s)).list());
 // Upgrade the original inbox-only cursor without downloading it a second time.
 const graphInbox=folders.find((f:any)=>f.kind==='inbox');if(a.provider==='outlook'&&graphInbox&&!states[folderKey(graphInbox.path)]&&root.last_received)states[folderKey(graphInbox.path)]={last_received:root.last_received,older_link:root.older_link,next_link:root.next_link,pending_latest:root.pending_latest};
 root.folder_states=states;const selected=selectSyncFolders(folders,root,target.folder||'',target.remote_path||'',older);const deadline=Date.now()+85000;
 for(const f of selected){if(processed>=30||Date.now()>=deadline)break;const key=folderKey(f.path),state=priorFolderState(root,f);try{
 const result=a.provider==='outlook'?await syncGraphFolder(a,s,f,state,accept,older,Math.min(20,30-processed)):await syncImapFolder(client,f,state,accept,{older,limit:Math.min(selected.length>1?15:30,30-processed),deadline});
 const {_flags=[],_processed=0,...saved}=result;states[key]=saved;allFlags.push(..._flags);processed+=_processed;
 }catch(e){const safe=providerError(e,'同步'+f.name,[s.password,s.access_token]);states[key]={...state,error:safe.message,last_attempt:new Date().toISOString()};errors.push(safe.message);}}
 const inventory=folders.map((f:any)=>{const state=priorFolderState(root,f);return {...f,last_sync:state.last_sync||null,has_older:!!state.has_older,error:state.error||null,...(state.total!==undefined?{total:state.total}:{})};});
 const inbox=folders.find((f:any)=>f.kind==='inbox');const inboxState=inbox?states[folderKey(inbox.path)]:null;
 return {...root,...(inboxState?{uid_validity:inboxState.uid_validity,last_uid:inboxState.last_uid,oldest_uid:inboxState.oldest_uid,has_older:inboxState.has_older}:{}),folders:inventory,folders_discovered_at:new Date().toISOString(),folder_states:states,_flags:allFlags,_errors:errors,_missing:!!target.folder&&!selected.length};
 }finally{if(client)await client.logout().catch(()=>client.close());}}
export async function remotePatch(a:any,s:any,m:any,patch:any){if(!m.remote_id||m.remote_id.startsWith('local:'))return;
 if(a.provider==='outlook'){
 const p:any={};if('is_read'in patch)p.isRead=patch.is_read;if('starred'in patch)p.flag={flagStatus:patch.starred?'flagged':'notFlagged'};
 if(Object.keys(p).length)await graph(s,'messages/'+encodeURIComponent(m.remote_id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
 if(patch.folder&&patch.folder!==m.folder){const target:any={archive:'archive',trash:'deleteditems',inbox:'inbox',sent:'sentitems'};if(target[patch.folder]){const r=await(await graph(s,'messages/'+encodeURIComponent(m.remote_id)+'/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destinationId:target[patch.folder]})})).json();return {remote_id:r.id,remote_folder:patch.folder};}}return;
 }
 const c=await imap(a,s);let lock;try{lock=await c.getMailboxLock(m.remote_folder||'INBOX');const [valid,id]=m.remote_id.split('|').at(-1).split(':');if(String((c.mailbox as any).uidValidity)!==valid)throw Error('邮箱索引已更新，请重新同步');
 for(const [key,flag]of [['is_read','\\Seen'],['starred','\\Flagged']])if(key in patch){if(patch[key])await c.messageFlagsAdd(id,[flag],{uid:true});else await c.messageFlagsRemove(id,[flag],{uid:true});}
 if(patch.folder&&patch.folder!==m.folder)return await moveImapMessage(c,m,id,patch.folder);
 }catch(e){throw providerError(e,patch.folder?'移动邮件':'同步邮件状态',[s.password,s.access_token]);}finally{lock?.release();await c.logout().catch(()=>c.close());}}
export async function composeRaw(options:any){const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'windows'});const result=await transport.sendMail(options);return new Uint8Array(result.message as Uint8Array);}
export async function sendRemote(a:any,s:any,options:any,raw:Uint8Array){if(a.provider==='outlook'){await graph(s,'sendMail',{method:'POST',headers:{'Content-Type':'text/plain'},body:b64(raw)});return {messageId:options.messageId,accepted:options.to,rejected:[]};}
 const t=await smtp(a,s);try{const r=await t.sendMail({envelope:{from:a.email,to:[...options.to,...options.cc,...options.bcc]},raw:Buffer.from(raw)});if(r.rejected?.length)throw Error('部分收件人被拒收，请在原邮箱确认投递结果后再处理');return {messageId:r.messageId,accepted:r.accepted,rejected:r.rejected};}finally{t.close();}}
