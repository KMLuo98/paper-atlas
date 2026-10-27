import {imapFolders} from './folders.js';

const validUid=value=>Number.isSafeInteger(Number(value))&&Number(value)>0&&Number(value)<=0xffffffff;
const identity=value=>String(value||'').trim().replace(/^<|>$/g,'');
const missingError=error=>String(error?.serverResponseCode||error?.code||'').toUpperCase()==='NONEXISTENT';
const reference=(path,valid,uid)=>path+'|'+String(valid)+':'+uid;
async function fetchMessage(client,uid,query){
 client.mailClearError?.();let item;
 try{item=await client.fetchOne(uid,query,{uid:true});}catch(error){if(missingError(error))return false;throw error;}
 if(!item&&client.mailLastError?.()&&!missingError(client.mailLastError()))throw client.mailLastError();
 return item;
}

async function selectMailbox(client,path,readOnly){
 if(client.mailbox?.path!==path||!readOnly&&client.mailbox?.readOnly)await client.mailboxOpen(path,{readOnly});
}
async function matchingUid(client,message){
 if(!message.message_id)return null;
 client.mailClearError?.();
 const ids=await client.search({header:{'Message-ID':message.message_id}},{uid:true});
 if(!Array.isArray(ids))throw client.mailLastError?.()||Error('无法核对原邮箱中的邮件位置，请稍后重试');
 if(ids.length>10)throw Error('原邮箱存在多个匹配副本，已停止操作，请先同步确认');
 const matches=[];let unverified=false;
 for(const uid of ids){
  if(!validUid(uid))throw Error('原邮箱返回的邮件索引无效，请重新同步');
  const item=await fetchMessage(client,uid,{uid:true,envelope:true});
  if(item&&!item.envelope?.messageId)unverified=true;
  if(item&&identity(item.envelope?.messageId)===identity(message.message_id))matches.push(Number(uid));
 }
 if(matches.length>1)throw Error('原邮箱存在多个匹配副本，已停止操作，请先同步确认');
 if(!matches.length&&unverified)throw Error('无法确认原邮箱中匹配邮件的身份，已停止操作，请重新同步');
 return matches[0]||null;
}
async function sourceUid(client,message,path,uid,useSavedUid){
 await selectMailbox(client,path,false);
 const saved=String(message.remote_id||'').split('|').at(-1).match(/^(\d+):(\d+)$/);
 if(useSavedUid&&saved&&saved[1]===String(client.mailbox.uidValidity)&&validUid(uid)){
  const item=await fetchMessage(client,Number(uid),{uid:true,envelope:true});
  if(item&&(!message.message_id||!item.envelope?.messageId||identity(item.envelope.messageId)===identity(message.message_id)))return Number(uid);
 }
 return await matchingUid(client,message);
}
async function reconcileMissing(client,message,target,folder){
 await selectMailbox(client,target.path,true);
 const uid=await matchingUid(client,message);
 if(uid)return {remote_folder:target.path,remote_id:reference(target.path,client.mailbox.uidValidity,uid),notice:'邮件已在原邮箱目标文件夹，已更新本站记录'};
 if(folder!=='trash')throw Error('原邮箱已找不到对应邮件，无法移动；本站副本仍然保留');
 // Keep the stored MIME and translations recoverable, without claiming a remote move.
 return {remote_folder:target.path,remote_id:'local:'+message.id,notice:'原邮件已不在原文件夹，已将本站保存的副本移入垃圾箱'};
}
async function compatibleMove(client,message,path,uid,target,originalError){
 // UID EXPUNGE must be available: never purge unrelated \Deleted messages.
 if(!client.capabilities?.has('UIDPLUS'))throw originalError;
 await selectMailbox(client,target.path,true);
 let targetUid=await matchingUid(client,message),valid=client.mailbox.uidValidity;
 if(!targetUid){
  await selectMailbox(client,path,false);client.mailClearError?.();
  const copied=await client.messageCopy(uid,target.path,{uid:true});
  if(!copied)throw client.mailLastError?.()||originalError;
  await selectMailbox(client,target.path,true);valid=client.mailbox.uidValidity;
  const mapped=copied.uidMap?.get(uid);
  if(validUid(mapped)&&String(copied.uidValidity)===String(valid)){
   const item=await fetchMessage(client,mapped,{uid:true,envelope:true});
   if(item&&(!message.message_id||identity(item.envelope?.messageId)===identity(message.message_id)))targetUid=Number(mapped);
  }
  if(!targetUid)targetUid=await matchingUid(client,message);
  if(!targetUid)throw Error('垃圾箱副本尚未确认，已保留原邮件，请同步后重试');
 }
 const current=await sourceUid(client,message,path,uid,true);
 if(current){
  client.mailClearError?.();const removed=await client.messageDelete(current,{uid:true,silent:true});
  if(!removed){const reason=client.mailLastError?.()||originalError;const remaining=await fetchMessage(client,current,{uid:true});if(remaining)throw reason;}
 }
 return {remote_folder:target.path,remote_id:reference(target.path,valid,targetUid)};
}
export async function moveImapMessage(client,message,uid,folder){
 const target=imapFolders(await client.list()).find(item=>item.kind===folder);
 if(!target)throw Error('原邮箱未提供'+({trash:'垃圾箱',archive:'归档',sent:'已发送',inbox:'收件箱'}[folder]||'目标文件夹')+'，请先在原邮箱确认文件夹');
 const path=message.remote_folder||client.mailbox.path||'INBOX';
 let resolved=await sourceUid(client,message,path,uid,true);
 if(!resolved)return await reconcileMissing(client,message,target,folder);
 if(target.path===path)return {remote_folder:target.path,remote_id:reference(target.path,client.mailbox.uidValidity,resolved),notice:'邮件已在原邮箱目标文件夹，已更新本站记录'};
 if(client.capabilities&&!client.capabilities.has('MOVE')&&!client.capabilities.has('UIDPLUS'))throw Error('原邮箱不支持安全的单封移动，已保留原邮件，请在原邮箱操作');
 client.mailClearError?.();
 let moved=await client.messageMove(resolved,target.path,{uid:true});
 if(!moved){
  const error=client.mailLastError?.();
  if(!missingError(error))throw error||Error('原邮箱未确认移动，请同步后重试');
  const retried=await sourceUid(client,message,path,null,false);
  if(!retried)return await reconcileMissing(client,message,target,folder);
  if(retried===resolved)return await compatibleMove(client,message,path,resolved,target,error);
  resolved=retried;client.mailClearError?.();
  moved=await client.messageMove(resolved,target.path,{uid:true});
  if(!moved)throw client.mailLastError?.()||Error('原邮箱未确认移动，请同步后重试');
 }
 let newUid=moved.uidMap?.get(resolved),newValid=moved.uidValidity;
 if(!validUid(newUid)||!newValid){
  // Some servers omit COPYUID. Locate the moved message without reusing its old UID.
  try{
   await client.mailboxOpen(target.path,{readOnly:true});newValid=client.mailbox.uidValidity;
   newUid=await matchingUid(client,message);
  }catch{newUid=null;}
 }
 return {remote_folder:target.path,remote_id:validUid(newUid)&&newValid?reference(target.path,newValid,newUid):'moved:'+message.id};
}
