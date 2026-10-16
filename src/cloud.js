import { createClient } from '@supabase/supabase-js';
import { projectConfig } from './project-config.js';
import {databaseJSON} from '../supabase/functions/_shared/text.js';
const saved = (()=>{try{return JSON.parse(localStorage.getItem('pa-cloud')||'{}');}catch{return {};}})();
export const cloudConfig={url:import.meta.env.VITE_SUPABASE_URL||saved.url||projectConfig.url,key:import.meta.env.VITE_SUPABASE_ANON_KEY||saved.key||projectConfig.key};
export const configured=Boolean(cloudConfig.url&&cloudConfig.key);
const sessionStore={
  getItem:key=>(localStorage.getItem('pa-remember')==='false'?sessionStorage:localStorage).getItem(key),
  setItem:(key,value)=>{const remember=localStorage.getItem('pa-remember')!=='false';(remember?localStorage:sessionStorage).setItem(key,value);(remember?sessionStorage:localStorage).removeItem(key);},
  removeItem:key=>{localStorage.removeItem(key);sessionStorage.removeItem(key);}
};
export const db=configured?createClient(cloudConfig.url,cloudConfig.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:sessionStore}}):null;
export async function api(action,payload={}) {
  if(!db)throw new Error('请先在云端设置中连接 Supabase 项目');
  const {data,error}=await db.functions.invoke('library-api',{body:{action,...payload}});
  if(error){let message=error.message;try{const body=await error.context.json();message=body.error||message;}catch{}throw new Error(message);}
  if(data?.error)throw new Error(data.error);
  return data;
}
export async function loadPapers(){const papers=[];for(let offset=0;;offset+=250){const {data,error}=await db.from('papers').select('id,title,journal,journal_abbr,published_at,doi,volume,issue,pages,authors,keywords,keyword_pairs,publication_status,tags,search_terms,references,summary,file_path,file_size,original_filename,favorite,status,analysis_error,analysis_coverage,analyzed_at,deleted_at,created_at,updated_at').order('created_at',{ascending:false}).order('id').range(offset,offset+249);if(error)throw error;papers.push(...data);if(data.length<250)return papers;}}
export async function updatePaper(id,patch){const {data,error}=await db.from('papers').update(databaseJSON(patch)).eq('id',id).select().single();if(error)throw error;return data;}
export async function signedPDF(path){const {data,error}=await db.storage.from('papers').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
