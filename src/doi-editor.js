import {normalizeDOI} from '../supabase/functions/_shared/publication.js';
import {sameAuthor} from '../supabase/functions/_shared/author-identity.js';
import {getLanguage} from './i18n.js';
const l=(zh,en)=>getLanguage()==='en'?en:zh;
export function bindDOIMatch(form,{lookup,onMatch=()=>{},onError=()=>{}}){
 const input=form.querySelector('[name=doi]'),button=form.querySelector('[data-doi-match]'),status=form.querySelector('[data-doi-status]');let version=0;
 input.addEventListener('input',()=>{version++;onMatch(null);status.textContent='';});
 button.onclick=async()=>{const doi=normalizeDOI(input.value),id=++version;if(!/^10\.\d{4,9}\/[^\s?#]+$/i.test(doi)){status.textContent=l("请先填写有效的 DOI","Enter a valid DOI first");input.focus();return;}button.disabled=true;const submit=form.querySelector('[type=submit]'),wasDisabled=submit.disabled;submit.disabled=true;status.textContent=l("正在匹配 DOI 元数据…","Looking up DOI metadata...");
  try{const result=await lookup(doi);if(!form.isConnected||version!==id||normalizeDOI(input.value)!==doi)return;const m=result.metadata;if(!m?.title)throw Error('未取得完整元数据');for(const key of ['title','journal','journal_abbr','published_at','publication_status','doi','pages']){const field=form.querySelector('[name='+key+']');if(field&&m[key]!==null&&m[key]!==undefined&&m[key]!=='')field.value=m[key];}if(m.volume||m.issue){const field=form.querySelector('[name=volume_issue]'),prior=field.value.split('/').map(v=>v.trim());field.value=[m.volume||prior[0]||'',m.issue||prior[1]||''].join(' / ');}if(m.authors?.length){const field=form.querySelector('[name=authors]'),prior=field.value.split('\n').map(line=>{const [name,institution,email,orcid]=line.split('|').map(v=>v.trim());return {name,institution,email,orcid};});field.value=m.authors.map(a=>{const old=prior.find(b=>sameAuthor(a,b))||{};return [a.name,a.institution||old.institution||'',a.email||old.email||'',a.orcid||old.orcid||''].join(' | ');}).join('\n');}const refs=form.querySelector('[name=references]');if(m.references?.length&&refs&&['','[]'].includes(refs.value.trim()))refs.value=JSON.stringify(m.references,null,2);onMatch(m);status.textContent=l("已填入可取得的信息，请核对后点击“保存更改”。未提供的字段保持原值。","Available metadata has been filled in. Review it and click Save changes; unavailable fields are unchanged.");}
  catch(error){if(form.isConnected&&version===id){status.textContent=error.message||'匹配失败，原信息保持不变';onError(error);}}
  finally{button.disabled=false;submit.disabled=wasDisabled;}
 };
}
