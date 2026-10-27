import {imapFolders} from './folders.js';

const validUid=value=>Number.isSafeInteger(Number(value))&&Number(value)>0&&Number(value)<=0xffffffff;
export async function moveImapMessage(client,message,uid,folder){
 const target=imapFolders(await client.list()).find(item=>item.kind===folder);
 if(!target)throw Error('原邮箱未提供'+({trash:'垃圾箱',archive:'归档',sent:'已发送',inbox:'收件箱'}[folder]||'目标文件夹')+'，请先在原邮箱确认文件夹');
 if(target.path===message.remote_folder)return {remote_folder:target.path,remote_id:message.remote_id};
 const moved=await client.messageMove(uid,target.path,{uid:true});
 if(!moved)throw Error('原邮箱未确认移动，请同步后重试');
 let newUid=moved.uidMap?.get(Number(uid)),newValid=moved.uidValidity;
 if(!validUid(newUid)||!newValid){
  // Some servers omit COPYUID. Locate the moved message without reusing its old UID.
  try{
   await client.mailboxOpen(target.path,{readOnly:true});newValid=client.mailbox.uidValidity;
   const ids=message.message_id?await client.search({header:{'Message-ID':message.message_id}},{uid:true}):[];
   newUid=Array.isArray(ids)&&ids.length===1&&validUid(ids[0])?Number(ids[0]):null;
  }catch{newUid=null;}
 }
 return {remote_folder:target.path,remote_id:validUid(newUid)&&newValid?target.path+'|'+String(newValid)+':'+newUid:'moved:'+message.id};
}
