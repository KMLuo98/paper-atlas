const roles={'\\inbox':'inbox','\\sent':'sent','\\drafts':'drafts','\\archive':'archive','\\trash':'trash','\\junk':'spam'};
const names={inbox:['inbox','收件箱'],sent:['sent','sentitems','sentmessages','sentmail','已发送','已发送邮件'],drafts:['drafts','draft','草稿箱','草稿'],archive:['archive','archives','归档','归档邮件'],trash:['trash','deleteditems','deletedmessages','已删除','已删除邮件','垃圾箱','废纸篓'],spam:['spam','junk','junkemail','垃圾邮件','广告邮件']};
export const folderKey=path=>'path:'+encodeURIComponent(path);
export function imapFolders(list){
 const result=[];for(const item of list){const flags=[...(item.flags||[])].map(x=>String(x).toLowerCase());if(item.disabled||flags.includes('\\noselect')||!item.path)continue;
 const path=String(item.path),name=String(item.name||path),special=String(item.specialUse||'').toLowerCase();let kind=roles[special]||'';
 if(!kind){const candidates=[path,name,path.split(item.delimiter||'/').at(-1)].map(x=>x.toLowerCase().replace(/[\s_-]/g,''));kind=Object.keys(names).find(k=>names[k].some(n=>candidates.includes(n)))||'custom';}
 if(path.toUpperCase()==='INBOX')kind='inbox';
 result.push({path,name,kind,...(item.status?{total:Number(item.status.messages)||0,unread:Number(item.status.unseen)||0}:{})});}
 if(!result.some(x=>x.kind==='inbox'))result.unshift({path:'INBOX',name:'收件箱',kind:'inbox'});
 return result;
}
export function priorFolderState(accountState,folder){const state=accountState?.folder_states?.[folderKey(folder.path)];if(state)return {...state};if(folder.kind==='inbox'&&accountState?.uid_validity)return {uid_validity:accountState.uid_validity,last_uid:accountState.last_uid,oldest_uid:accountState.oldest_uid,has_older:accountState.has_older};return {};}
export function selectSyncFolders(folders,state,requested='',remotePath='',older=false){
 if(remotePath){const match=folders.find(f=>f.path===remotePath);if(!match)throw Error('原邮箱未找到此文件夹，请重新同步文件夹列表');return [match];}
 if(requested&&requested!=='all'){const matches=folders.filter(f=>f.kind===requested);return matches;}
 const inbox=folders.find(f=>f.kind==='inbox');if(older)return inbox?[inbox]:[];
 const priority={sent:0,drafts:1,archive:2,trash:3,spam:4,custom:5};
 const others=folders.filter(f=>f.kind!=='inbox'&&(f.kind!=='custom'||priorFolderState(state,f).last_sync));
 others.sort((a,b)=>{const x=priorFolderState(state,a).last_sync||'',y=priorFolderState(state,b).last_sync||'';return x.localeCompare(y)||(priority[a.kind]-priority[b.kind])||a.path.localeCompare(b.path);});
 return [inbox,others[0]].filter(Boolean);
}
export async function syncImapFolder(client,folder,state,accept,{older=false,limit=15,deadline=Infinity}={}){
 const lock=await client.getMailboxLock(folder.path,{readOnly:true});const flags=[];let processed=0;
 try{
 const box=client.mailbox,valid=String(box.uidValidity);const same=state.uid_validity===valid;
 const last=same?Number(state.last_uid||0):0,oldest=same?Number(state.oldest_uid||0):0;
 const history=older&&!!oldest,refreshDrafts=folder.kind==='drafts';let found;if(history){if(oldest<=1)return {...state,has_older:false,_flags:[],_processed:0};found=await client.search({uid:'1:'+(oldest-1)},{uid:true});}
 else if(last&&!refreshDrafts)found=await client.search({uid:(last+1)+':*'},{uid:true});else found=await client.search({all:true},{uid:true});
 if(!Array.isArray(found))throw Error('服务器未返回有效的邮件索引，请稍后重试');
 const candidates=found.map(Number).filter(x=>Number.isSafeInteger(x)&&x>0&&(history?x<oldest:refreshDrafts||!last||x>last)).sort((a,b)=>a-b);
 const ids=history?candidates.slice(-limit).reverse():!last||refreshDrafts?candidates.slice(-limit):candidates.slice(0,limit);
 Object.assign(state,{uid_validity:valid,last_uid:last,oldest_uid:oldest,total:Number(box.exists)||0});
 for(const id of ids){if(Date.now()>=deadline)break;const meta=await client.fetchOne(id,{size:true},{uid:true});if(!meta)continue;if(meta.size>25000000)throw Error('此文件夹有超过25MB的邮件，无法继续导入');const item=await client.fetchOne(id,{source:true,flags:true},{uid:true});if(!item?.source)continue;
 await accept(folder.path+'|'+valid+':'+id,item.source instanceof Uint8Array?item.source:new Uint8Array(item.source),{read:item.flags.has('\\Seen'),starred:item.flags.has('\\Flagged'),answered:item.flags.has('\\Answered')},folder.path,folder.kind);
 state.last_uid=Math.max(state.last_uid,id);state.oldest_uid=state.oldest_uid?Math.min(state.oldest_uid,id):id;processed++;}
 state.has_older=history?candidates.length>processed:state.oldest_uid>1;state.last_sync=new Date().toISOString();state.error=null;
 if(box.exists&&Date.now()<deadline)for await(const item of client.fetch(Math.max(1,Number(box.exists)-49)+':*',{uid:true,flags:true}))flags.push({remote_id:folder.path+'|'+valid+':'+item.uid,is_read:item.flags.has('\\Seen'),starred:item.flags.has('\\Flagged'),is_answered:item.flags.has('\\Answered')});
 return {...state,_flags:flags,_processed:processed};
 }finally{lock.release();}
}
