import { createClient } from '@supabase/supabase-js';
import { projectConfig } from './project-config.js';
import {databaseJSON} from '../supabase/functions/_shared/text.js';
import {normalizePaperJournal} from './core.js';
import {invokeWithSessionRetry,apiFailure} from './auth-request.js';
import {normalizeDOI} from '../supabase/functions/_shared/publication.js';
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
  const {data,error}=await invokeWithSessionRetry(db,{body:{action,...payload}});
  if(error)throw await apiFailure(error);
  if(data?.error)throw new Error(data.error);
  return data;
}
export async function loadPapers(){const papers=[];for(let offset=0;;offset+=250){const {data,error}=await db.from('papers').select('supplementary_files,references_edited_at,id,title,journal,journal_abbr,published_at,doi,volume,issue,pages,authors,keywords,keyword_pairs,keywords_edited_at,publication_status,tags,search_terms,references,summary,file_path,file_size,original_filename,favorite,status,analysis_error,analysis_coverage,analyzed_at,deleted_at,created_at,updated_at,citation_count,citation_source,citation_url,citation_checked_at,arxiv_id,arxiv_date,preprint_url,publication_lookup_at,publication_lookup_status').order('created_at',{ascending:false}).order('id').range(offset,offset+249);if(error)throw error;papers.push(...data.map(normalizePaperJournal));if(data.length<250)return papers;}}
export async function updatePaper(id,patch){if('doi' in patch)patch={...patch,doi:normalizeDOI(patch.doi),publication_lookup_at:null};const {data,error}=await db.from('papers').update(databaseJSON(('journal' in patch||'journal_abbr' in patch)?normalizePaperJournal(patch):patch)).eq('id',id).select().single();if(error)throw error;if('doi' in patch&&patch.doi&&!data.published_at){try{const result=await api('refresh_publication',{paper_id:id});if(result.paper)return result.paper;}catch{/* The DOI remains saved even during a metadata outage. */}}return data;}
export async function signedPDF(path){const {data,error}=await db.storage.from('papers').createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;}
export async function ensureStorageSpace(bytes){const usage=await api('storage_status');if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('文件大小无效');if(usage.quota_bytes===0||Number(usage.used_bytes)+bytes>Number(usage.quota_bytes))throw Error('配额不足，请联系管理员');return usage;}
