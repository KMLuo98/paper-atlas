import {cachedAuthorPhotos} from './author-photo-cache.js';
import {buildAuthorDirectory} from '../supabase/functions/_shared/author-directory.js';

export async function loadNetworkPhotos(db,owner,papers,nodes,options={}){
 if(!db||!owner)return new Map();
 const profiles=[];
 for(let start=0;;start+=500){const r=await db.from('author_profiles').select('*').eq('user_id',owner).order('id').range(start,start+499);if(r.error)throw Error('作者照片读取失败 / Unable to load author photos');profiles.push(...r.data);if(r.data.length<500)break;}
 const paths=new Map();
 for(const author of buildAuthorDirectory(papers,profiles))if(author.photo_path?.startsWith(owner+'/'))for(const key of author.identity_keys)paths.set(key,author.photo_path);
 const selected=new Map(nodes.filter(n=>paths.has(n.id)).map(n=>[n.id,paths.get(n.id)])),urls=await cachedAuthorPhotos(db,owner,[...selected.values()],options);
 return new Map([...selected].filter(([,path])=>urls.has(path)).map(([key,path])=>[key,urls.get(path)]));
}
