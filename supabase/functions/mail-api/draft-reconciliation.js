// Only a complete successful inventory can retire cached remote drafts.
export function staleDraftIDs(rows,snapshot){
 if(!snapshot?.complete||!snapshot.path||!Array.isArray(snapshot.ids)||snapshot.ids.some(id=>typeof id!=='string'||!id))return [];
 const prefix=snapshot.uid_validity?snapshot.path+'|'+snapshot.uid_validity+':':null;
 if(prefix&&snapshot.ids.some(id=>!id.startsWith(prefix)||!/^\d+$/.test(id.slice(prefix.length))))return [];
 const present=new Set(snapshot.ids);
 return rows.filter(row=>row.folder==='drafts'&&row.remote_folder===snapshot.path&&row.remote_id&&!row.remote_id.startsWith('local:')&&(!prefix||row.remote_id.startsWith(prefix))&&!present.has(row.remote_id)).map(row=>row.id);
}
export async function graphDraftInventory(graph,secret,folder,deadline){
 const ids=[];let path='mailFolders/'+encodeURIComponent(folder.path)+'/messages?$select=id&$top=100',pages=0;
 while(path&&Date.now()<deadline&&pages++<100){const data=await(await graph(secret,path)).json();if(!Array.isArray(data.value)||data.value.some(row=>typeof row.id!=='string'||!row.id))throw Error('服务器未返回完整的草稿索引');ids.push(...data.value.map(row=>row.id));path=data['@odata.nextLink']||'';}
 return {path:folder.path,ids,complete:!path};
}
