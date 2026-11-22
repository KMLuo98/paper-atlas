const key=user=>'mail-startup-v1:'+user;
export function readStartup(user){
 try{const cached=JSON.parse(sessionStorage.getItem(key(user))||'null');return cached&&cached.user===user&&Date.now()-cached.at<1800000?cached.data:null;}catch{return null;}
}
export function saveStartup(user,data){
 if(data.is_admin){clearStartup(user);return;}
 const pick=(object,fields)=>Object.fromEntries(fields.filter(field=>object?.[field]!==undefined).map(field=>[field,object[field]]));
 const safe={is_admin:false,profile:pick(data.profile,['id','username','display_name','avatar_path','email']),accounts:(data.accounts||[]).map(account=>pick(account,['id','label','email','color','enabled','provider','sync_error','last_sync_at'])),contacts:data.contacts||[],categories:data.categories||[],counts:data.counts||[],drafts:[],settings:pick(data.settings,['signature','sync_interval_minutes','translation_language','contact_groups','localize_organizations','auto_contact_photos','auto_contact_organizations'])};
 try{sessionStorage.setItem(key(user),JSON.stringify({user,at:Date.now(),data:safe}));}catch{}
}
export function clearStartup(user){try{sessionStorage.removeItem(key(user));}catch{}}
